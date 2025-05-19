// Use dynamic imports for Node.js modules to avoid client-side errors
import { executeQuery, insertFileData } from "./database";
import { isVercelEnvironment } from "./fileUtils";
import axios from "axios";
import { getConnectionManager } from "./database/connectionManager";

// These imports will only be used on the server side
let fs: any;
let csvParser: any;
let xlsx: any;
let stream: any;

// Only import Node.js modules on the server side
if (typeof window === "undefined") {
  // Server-side only imports
  fs = require("fs");
  csvParser = require("csv-parser");
  xlsx = require("xlsx");
  stream = require("stream");
}

// Define file formats
export enum FileFormat {
  CSV = "csv",
  XLSX = "xlsx",
}

// Define file status
export enum FileStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  HEADERS_EXTRACTED = "headers_extracted",
  ACTIVE = "active",
  ERROR = "error",
}

// Interface for parsed data
export interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Process a CSV file in streaming mode with batch processing
 * @param filePath Path to the CSV file
 * @param fileId File ID for database insertion
 * @param sourceId Source ID for provenance
 * @param batchSize Number of rows to process in each batch
 * @param onProgress Optional callback for progress updates
 * @param onHeadersExtracted Optional callback when headers are extracted
 * @returns Promise with processing result
 */
export async function processCSVStreaming(
  filePath: string,
  fileId: string,
  sourceId: string,
  batchSize: number = 1000,
  onProgress?: (processed: number) => void,
  onHeadersExtracted?: (headers: string[]) => Promise<void>
): Promise<{ headers: string[]; rowCount: number }> {
  return new Promise(async (resolve, reject) => {
    try {
      // For Vercel Blob Storage URLs, download the file first
      let fileStream;
      let tempFilePath: string | null = null;

      if (filePath.startsWith("http")) {
        try {
          console.log(`Downloading file from URL: ${filePath}`);
          const response = await axios({
            method: "GET",
            url: filePath,
            responseType: "stream",
          });

          // Create a pass-through stream
          const passThrough = new stream.PassThrough();
          response.data.pipe(passThrough);
          fileStream = passThrough;
        } catch (downloadError) {
          console.error(`Error downloading file from URL: ${downloadError}`);
          reject(downloadError);
          return;
        }
      } else {
        // Local file
        fileStream = fs.createReadStream(filePath);
      }

      // Set up CSV parser
      const parser = fileStream.pipe(csvParser());

      // Track headers and rows
      let headers: string[] = [];
      let rowCount = 0;
      let batch: Record<string, unknown>[] = [];
      let batchCount = 0;
      const timestamp = new Date().toISOString();

      // Process a batch of rows
      const processBatch = async () => {
        if (batch.length === 0) return;

        try {
          // Add provenance columns to each row
          const rowsWithProvenance = batch.map((row) => ({
            ...row,
            source_id: sourceId,
            ingested_at: timestamp,
          }));

          // Insert batch into database
          await insertFileData(fileId, rowsWithProvenance);

          rowCount += batch.length;
          if (onProgress) {
            onProgress(rowCount);
          }
        } catch (error) {
          console.error(`Error processing batch ${batchCount}:`, error);
          throw error;
        }

        // Clear the batch
        batch = [];
        batchCount++;
      };

      // Handle data events
      parser.on("data", async (row: Record<string, unknown>) => {
        // If this is the first row, extract headers
        if (rowCount === 0 && headers.length === 0) {
          headers = Object.keys(row);
          console.log(`Extracted ${headers.length} headers from CSV`);

          // Call the headers extracted callback if provided
          if (onHeadersExtracted) {
            try {
              await onHeadersExtracted(headers);
              console.log("CSV headers processed and stored successfully");
            } catch (headerError) {
              console.error("Error processing CSV headers:", headerError);
              // Continue even if header processing fails
            }
          }
        }

        // Add row to batch
        batch.push(row);

        // Process batch if it reaches the batch size
        if (batch.length >= batchSize) {
          try {
            await processBatch();
          } catch (error) {
            parser.destroy();
            reject(error);
          }
        }
      });

      // Handle end event
      parser.on("end", async () => {
        try {
          // Process any remaining rows
          if (batch.length > 0) {
            await processBatch();
          }

          console.log(
            `CSV processing complete. Processed ${rowCount} rows with ${headers.length} columns.`
          );

          // Clean up temp file if created
          if (tempFilePath) {
            try {
              fs.unlinkSync(tempFilePath);
              console.log(`Temporary file deleted: ${tempFilePath}`);
            } catch (cleanupError) {
              console.warn(`Failed to delete temporary file: ${cleanupError}`);
            }
          }

          resolve({ headers, rowCount });
        } catch (error) {
          reject(error);
        }
      });

      // Handle errors
      parser.on("error", (error: Error) => {
        console.error("Error parsing CSV:", error);
        reject(error);
      });

      fileStream.on("error", (error: Error) => {
        console.error("Error reading file stream:", error);
        reject(error);
      });
    } catch (error) {
      console.error("Error in CSV streaming process:", error);
      reject(error);
    }
  });
}

/**
 * Process an XLSX file with batch processing
 * @param filePath Path to the XLSX file
 * @param fileId File ID for database insertion
 * @param sourceId Source ID for provenance
 * @param batchSize Number of rows to process in each batch
 * @param onProgress Optional callback for progress updates
 * @param onHeadersExtracted Optional callback when headers are extracted
 * @returns Promise with processing result
 */
export async function processXLSXStreaming(
  filePath: string,
  fileId: string,
  sourceId: string,
  batchSize: number = 1000,
  onProgress?: (processed: number) => void,
  onHeadersExtracted?: (headers: string[]) => Promise<void>
): Promise<{ headers: string[]; rowCount: number }> {
  try {
    // For Vercel Blob Storage URLs, download the file first
    let workbook;
    let tempFilePath: string | null = null;

    if (filePath.startsWith("http")) {
      try {
        console.log(`Downloading XLSX file from URL: ${filePath}`);
        const response = await axios({
          method: "GET",
          url: filePath,
          responseType: "arraybuffer",
        });

        // Parse the workbook from the array buffer
        workbook = xlsx.read(response.data, { type: "buffer" });
      } catch (downloadError) {
        console.error(`Error downloading XLSX file from URL: ${downloadError}`);
        throw downloadError;
      }
    } else {
      // Local file
      workbook = xlsx.readFile(filePath);
    }

    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get the range of the worksheet
    const range = xlsx.utils.decode_range(worksheet["!ref"] || "A1");

    // Extract headers from the first row
    const headers: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: range.s.r, c: col });
      const cell = worksheet[cellAddress];
      headers.push(cell && cell.v ? String(cell.v) : `Column${col + 1}`);
    }

    console.log(`Extracted ${headers.length} headers from XLSX`);

    // Call the headers extracted callback if provided
    if (onHeadersExtracted) {
      try {
        // Wait for headers to be processed and stored
        await onHeadersExtracted(headers);
        console.log("XLSX headers processed and stored successfully");
      } catch (headerError) {
        console.error("Error processing XLSX headers:", headerError);
        // Continue even if header processing fails
      }
    }

    // Estimate total rows for better batch size determination
    const totalRows = range.e.r - range.s.r;
    console.log(`Estimated total rows in XLSX file: ${totalRows}`);

    // Adjust batch size for very large files
    if (totalRows > 100000) {
      batchSize = Math.min(batchSize, 500);
      console.log(
        `Large XLSX file detected, using reduced batch size: ${batchSize}`
      );
    } else if (totalRows > 50000) {
      batchSize = Math.min(batchSize, 750);
      console.log(
        `Medium-large XLSX file detected, using adjusted batch size: ${batchSize}`
      );
    }

    // Process rows in batches
    let rowCount = 0;
    let batch: Record<string, unknown>[] = [];
    let batchCount = 0;
    const timestamp = new Date().toISOString();

    // Process a batch of rows
    const processBatch = async () => {
      if (batch.length === 0) return;

      try {
        // Add provenance columns to each row
        const rowsWithProvenance = batch.map((row) => ({
          ...row,
          source_id: sourceId,
          ingested_at: timestamp,
        }));

        // Insert batch into database with dynamic batch sizing
        await insertFileData(fileId, rowsWithProvenance);

        rowCount += batch.length;
        if (onProgress) {
          onProgress(rowCount);
        }
      } catch (error) {
        console.error(`Error processing batch ${batchCount}:`, error);
        throw error;
      }

      // Clear the batch
      batch = [];
      batchCount++;
    };

    // Process each row (skip the header row)
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const row: Record<string, unknown> = {};

      // Process each cell in the row
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = xlsx.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        const header = headers[c - range.s.c];

        // Add cell value to row (handle empty cells)
        row[header] = cell ? cell.v : null;
      }

      // Add row to batch
      batch.push(row);

      // Process batch if it reaches the batch size
      if (batch.length >= batchSize) {
        await processBatch();
      }
    }

    // Process any remaining rows
    if (batch.length > 0) {
      await processBatch();
    }

    // Clean up temp file if created
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Temporary file deleted: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`Failed to delete temporary file: ${cleanupError}`);
      }
    }

    console.log(
      `XLSX processing complete. Processed ${rowCount} rows with ${headers.length} columns.`
    );

    return { headers, rowCount };
  } catch (error) {
    console.error("Error in XLSX streaming process:", error);
    throw error;
  }
}

/**
 * Process a file based on its format using streaming and batch processing
 * @param filePath Path to the file
 * @param fileId File ID for database insertion
 * @param sourceId Source ID for provenance
 * @param format File format (csv or xlsx)
 * @param batchSize Number of rows to process in each batch
 * @param onProgress Optional callback for progress updates
 * @param onHeadersExtracted Optional callback when headers are extracted
 * @returns Promise with processing result
 */
export async function processFileStreaming(
  filePath: string,
  fileId: string,
  sourceId: string,
  format: string,
  batchSize: number = 1000,
  onProgress?: (processed: number) => void,
  onHeadersExtracted?: (headers: string[]) => Promise<void>
): Promise<{ headers: string[]; rowCount: number }> {
  console.log(
    `Processing file ${fileId} (${format}) with streaming and batch size ${batchSize}`
  );

  switch (format.toLowerCase()) {
    case FileFormat.CSV:
      return processCSVStreaming(
        filePath,
        fileId,
        sourceId,
        batchSize,
        onProgress,
        onHeadersExtracted
      );
    case FileFormat.XLSX:
      return processXLSXStreaming(
        filePath,
        fileId,
        sourceId,
        batchSize,
        onProgress,
        onHeadersExtracted
      );
    default:
      throw new Error(`Unsupported file format for streaming: ${format}`);
  }
}

/**
 * Parse a file based on its format (legacy method - loads entire file into memory)
 * @param filePath Path to the file
 * @param format File format (csv or xlsx)
 * @returns Promise with parsed data
 * @deprecated Use processFileStreaming instead for large files
 */
export async function parseFile(
  filePath: string,
  format: string
): Promise<ParsedData> {
  console.warn(
    "Warning: parseFile loads the entire file into memory. Consider using processFileStreaming for large files."
  );
  console.log(`Parsing file: ${filePath} (${format})`);

  switch (format.toLowerCase()) {
    case FileFormat.CSV:
      return parseCSV(filePath);
    case FileFormat.XLSX:
      return parseXLSX(filePath);
    default:
      throw new Error(`Unsupported file format: ${format}`);
  }
}

/**
 * Update file status in the database
 * @param fileId File ID
 * @param status New status
 * @returns Promise<boolean> Success
 */
export async function updateFileStatus(
  fileId: string,
  status: FileStatus
): Promise<boolean> {
  try {
    // First try using the connection manager
    try {
      const connectionManager = getConnectionManager();
      const replicaClient = connectionManager.getReplicaClient();

      try {
        await replicaClient.file.update({
          where: { id: fileId },
          data: { status },
        });
        console.log(
          `Updated file ${fileId} status to ${status} using connection manager`
        );
        return true;
      } finally {
        // Release the client back to the pool
        connectionManager.releaseReplicaClient(replicaClient);
      }
    } catch (connError) {
      console.warn(
        `Connection manager failed, falling back to executeQuery: ${connError}`
      );
      // Fall back to executeQuery if connection manager fails
      await executeQuery(`
        UPDATE files
        SET status = '${status}'
        WHERE id = '${fileId}'
      `);
      console.log(
        `Updated file ${fileId} status to ${status} using executeQuery`
      );
      return true;
    }
  } catch (error) {
    // Check if this is a DuckDB server environment error
    if (
      error instanceof Error &&
      (error.message.includes(
        "DuckDB is only available in browser environments"
      ) ||
        error.message.includes("Worker is not defined") ||
        error.message === "DuckDB is not available in server environments")
    ) {
      console.warn(
        `DuckDB operation skipped (server environment): Unable to update file status to ${status} for file ${fileId}`
      );
      return false;
    } else {
      console.error(`Error updating file status: ${error}`);
      return false;
    }
  }
}

/**
 * Add provenance columns to data rows
 * @param rows Data rows
 * @param sourceId Source ID
 * @returns Rows with provenance columns
 */
export function addProvenanceColumns(
  rows: Record<string, unknown>[],
  sourceId: string
): Record<string, unknown>[] {
  const timestamp = new Date().toISOString();

  return rows.map((row) => ({
    ...row,
    source_id: sourceId,
    ingested_at: timestamp,
  }));
}

/**
 * Create a DuckDB table for the file data
 * @param fileId File ID
 * @param headers Column headers
 * @param userId User ID
 */
export async function createFileTable(
  fileId: string,
  headers: string[]
): Promise<void> {
  try {
    // Create column definitions
    const columnDefs = headers.map((header) => `"${header}" TEXT`).join(", ");

    // Create the table with the file ID as the table name
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS file_${fileId} (
        id SERIAL PRIMARY KEY,
        ${columnDefs ? columnDefs + "," : ""}
        source_id TEXT,
        ingested_at TIMESTAMP
      )
    `);

    console.log(`Created table for file ${fileId}`);
  } catch (error) {
    console.error(`Error creating table for file ${fileId}:`, error);
    throw error;
  }
}

/**
 * Parse a CSV file (legacy method - loads entire file into memory)
 * @param filePath Path to the CSV file
 * @returns Promise with parsed data
 * @deprecated Use processCSVStreaming instead for large files
 */
async function parseCSV(filePath: string): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, unknown>[] = [];
    let headers: string[] = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row: Record<string, unknown>) => {
        rows.push(row);
      })
      .on("headers", (csvHeaders: string[]) => {
        headers = csvHeaders;
      })
      .on("end", () => {
        resolve({
          headers,
          rows,
          rowCount: rows.length,
        });
      })
      .on("error", (error: Error) => {
        reject(error);
      });
  });
}

/**
 * Parse an XLSX file (legacy method - loads entire file into memory)
 * @param filePath Path to the XLSX file
 * @returns Promise with parsed data
 * @deprecated Use processXLSXStreaming instead for large files
 */
function parseXLSX(filePath: string): ParsedData {
  // Read the XLSX file
  const workbook = xlsx.readFile(filePath);

  // Get the first worksheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert the worksheet to JSON
  const jsonData = xlsx.utils.sheet_to_json(worksheet);

  // Extract headers from the first row
  const headers = Object.keys(jsonData[0] || {});

  return {
    headers,
    rows: jsonData,
    rowCount: jsonData.length,
  };
}
