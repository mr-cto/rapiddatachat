// Use dynamic imports for Node.js modules to avoid client-side errors
import { executeQuery, insertFileData } from "./database";
import { isVercelEnvironment } from "./fileUtils";
import axios from "axios";

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
 * @returns Promise with headers and row count
 */
export async function processCSVStreaming(
  filePath: string,
  fileId: string,
  sourceId: string,
  batchSize: number = 1000,
  onProgress?: (processed: number) => void,
  onHeadersExtracted?: (headers: string[]) => void
): Promise<{ headers: string[]; rowCount: number }> {
  return new Promise(async (resolve, reject) => {
    let headers: string[] = [];
    let rowCount = 0;
    let batch: Record<string, unknown>[] = [];
    let batchCount = 0;
    const timestamp = new Date().toISOString();

    // Track memory usage
    const logMemoryUsage = () => {
      if (process.memoryUsage) {
        const memUsage = process.memoryUsage();
        console.log(
          `Memory usage - RSS: ${Math.round(
            memUsage.rss / 1024 / 1024
          )}MB, Heap: ${Math.round(
            memUsage.heapUsed / 1024 / 1024
          )}/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
        );
      }
    };

    // Log initial memory usage
    logMemoryUsage();

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
        // Let insertFileData determine the optimal batch size based on the data volume
        await insertFileData(fileId, rowsWithProvenance);

        rowCount += batch.length;
        if (onProgress) {
          onProgress(rowCount);
        }

        // Clear the batch
        batch = [];
        batchCount++;

        // Log memory usage every 10 batches
        if (batchCount % 10 === 0) {
          logMemoryUsage();
        }

        console.log(`Processed batch ${batchCount} (${rowCount} rows total)`);
      } catch (error) {
        console.error(`Error processing batch ${batchCount}:`, error);

        // If batch processing fails, try with a smaller batch size
        if (batch.length > 100) {
          console.log(
            `Splitting failed batch ${batchCount} into smaller chunks`
          );

          try {
            // Process in smaller chunks
            const chunkSize = Math.ceil(batch.length / 4);
            for (let i = 0; i < batch.length; i += chunkSize) {
              const chunk = batch.slice(i, i + chunkSize);

              // Add provenance columns to each row in the chunk
              const chunkWithProvenance = chunk.map((row) => ({
                ...row,
                source_id: sourceId,
                ingested_at: timestamp,
              }));

              // Insert the smaller chunk
              await insertFileData(fileId, chunkWithProvenance);

              rowCount += chunk.length;
              if (onProgress) {
                onProgress(rowCount);
              }
            }

            // Clear the batch after processing all chunks
            batch = [];
            batchCount++;
            console.log(
              `Successfully processed split batch ${batchCount} (${rowCount} rows total)`
            );
          } catch (splitError) {
            console.error(
              `Error processing split batch ${batchCount}:`,
              splitError
            );
            throw splitError;
          }
        } else {
          throw error;
        }
      }
    };

    try {
      // Create a stream processor
      const processStream = (stream: NodeJS.ReadableStream) => {
        stream
          .pipe(csvParser())
          .on("headers", async (headerList: string[]) => {
            headers = headerList;
            console.log(`Found ${headers.length} columns in CSV file`);

            // Call the callback with extracted headers if provided
            // and wait for it to complete before processing any data
            if (onHeadersExtracted) {
              // Pause the stream while we process headers
              stream.pause();

              try {
                // Wait for headers to be processed and stored
                await onHeadersExtracted(headers);
                console.log("Headers processed and stored successfully");
              } catch (headerError) {
                console.error("Error processing headers:", headerError);
                // Continue even if header processing fails
              }

              // Resume the stream after headers are processed
              stream.resume();
            }
          })
          .on("data", async (row: Record<string, unknown>) => {
            batch.push(row);

            // Process batch when it reaches the batch size
            if (batch.length >= batchSize) {
              // Pause the stream to prevent memory buildup
              stream.pause();

              await processBatch();

              // Resume the stream after batch is processed
              stream.resume();
            }
          })
          .on("end", async () => {
            // Process any remaining rows
            if (batch.length > 0) {
              await processBatch();
            }

            console.log(
              `Completed processing CSV file. Total rows: ${rowCount}`
            );
            resolve({
              headers,
              rowCount,
            });
          })
          .on("error", (error: Error) => {
            console.error("Error processing CSV stream:", error);
            reject(error);
          });
      };

      // Handle remote files (URLs)
      if (filePath.startsWith("http")) {
        console.log(`Processing remote CSV file: ${filePath}`);
        const response = await axios.get(filePath, {
          responseType: "stream", // Use streaming response
        });

        processStream(response.data);
      } else {
        // Handle local files
        console.log(`Processing local CSV file: ${filePath}`);
        const fileStream = fs.createReadStream(filePath, {
          highWaterMark: 64 * 1024, // 64KB chunks for better performance
        });

        processStream(fileStream);
      }
    } catch (error) {
      console.error("Error setting up CSV processing:", error);
      reject(error);
    }
  });
}

/**
 * Parse a CSV file (legacy method - loads entire file into memory)
 * @param filePath Path to the CSV file
 * @returns Promise with parsed data
 * @deprecated Use processCSVStreaming instead for large files
 */
export async function parseCSV(filePath: string): Promise<ParsedData> {
  console.warn(
    "Warning: parseCSV loads the entire file into memory. Consider using processCSVStreaming for large files."
  );
  return new Promise(async (resolve, reject) => {
    const rows: Record<string, unknown>[] = [];
    let headers: string[] = [];

    try {
      // Handle remote files (URLs)
      if (filePath.startsWith("http")) {
        console.log(`Parsing remote CSV file: ${filePath}`);
        const response = await axios.get(filePath, {
          responseType: "arraybuffer",
        });
        const fileContent = Buffer.from(response.data);

        // Create a readable stream from the buffer
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileContent);

        bufferStream
          .pipe(csvParser())
          .on("headers", (headerList: string[]) => {
            headers = headerList;
          })
          .on("data", (row: Record<string, unknown>) => {
            rows.push(row);
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
      } else {
        // Handle local files
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on("headers", (headerList: string[]) => {
            headers = headerList;
          })
          .on("data", (row: Record<string, unknown>) => {
            rows.push(row);
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
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Process an XLSX file in streaming mode with batch processing
 * @param filePath Path to the XLSX file
 * @param fileId File ID for database insertion
 * @param sourceId Source ID for provenance
 * @param batchSize Number of rows to process in each batch
 * @param onProgress Optional callback for progress updates
 * @param onHeadersExtracted Optional callback when headers are extracted
 * @returns Promise with headers and row count
 */
export async function processXLSXStreaming(
  filePath: string,
  fileId: string,
  sourceId: string,
  batchSize: number = 1000,
  onProgress?: (processed: number) => void,
  onHeadersExtracted?: (headers: string[]) => void
): Promise<{ headers: string[]; rowCount: number }> {
  try {
    console.log(`Processing XLSX file: ${filePath}`);
    let workbook;

    // Track memory usage
    const logMemoryUsage = () => {
      if (process.memoryUsage) {
        const memUsage = process.memoryUsage();
        console.log(
          `Memory usage - RSS: ${Math.round(
            memUsage.rss / 1024 / 1024
          )}MB, Heap: ${Math.round(
            memUsage.heapUsed / 1024 / 1024
          )}/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
        );
      }
    };

    // Log initial memory usage
    logMemoryUsage();

    // Handle remote files (URLs)
    if (filePath.startsWith("http")) {
      console.log(`Downloading remote XLSX file: ${filePath}`);
      const response = await axios.get(filePath, {
        responseType: "arraybuffer",
      });
      const fileContent = Buffer.from(response.data);
      workbook = xlsx.read(fileContent, { type: "buffer" });
    } else {
      // Handle local files with streaming options
      workbook = xlsx.readFile(filePath, {
        cellFormula: false, // Disable formula parsing
        cellHTML: false, // Disable HTML parsing
        cellText: false, // Disable text parsing
        cellDates: true, // Convert dates properly
        cellNF: false, // Don't parse number formats
        sheetStubs: true, // Create stub cells for empty cells
      });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Extract headers (first row)
    const range = xlsx.utils.decode_range(worksheet["!ref"] || "A1");
    const headers: string[] = [];

    // Extract headers from the first row
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[xlsx.utils.encode_cell({ r: range.s.r, c: C })];
      headers.push(cell ? cell.v.toString() : `Column${C + 1}`);
    }

    console.log(`Found ${headers.length} columns in XLSX file`);

    // Call the callback with extracted headers if provided
    // and wait for it to complete before processing any data
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

        // Clear the batch
        batch = [];
        batchCount++;

        // Log memory usage every 10 batches
        if (batchCount % 10 === 0) {
          logMemoryUsage();
        }

        console.log(`Processed batch ${batchCount} (${rowCount} rows total)`);
      } catch (error) {
        console.error(`Error processing batch ${batchCount}:`, error);

        // If batch processing fails, try with a smaller batch size
        if (batch.length > 100) {
          console.log(
            `Splitting failed batch ${batchCount} into smaller chunks`
          );

          try {
            // Process in smaller chunks
            const chunkSize = Math.ceil(batch.length / 4);
            for (let i = 0; i < batch.length; i += chunkSize) {
              const chunk = batch.slice(i, i + chunkSize);

              // Add provenance columns to each row in the chunk
              const chunkWithProvenance = chunk.map((row) => ({
                ...row,
                source_id: sourceId,
                ingested_at: timestamp,
              }));

              // Insert the smaller chunk
              await insertFileData(fileId, chunkWithProvenance);

              rowCount += chunk.length;
              if (onProgress) {
                onProgress(rowCount);
              }
            }

            // Clear the batch after processing all chunks
            batch = [];
            batchCount++;
            console.log(
              `Successfully processed split batch ${batchCount} (${rowCount} rows total)`
            );
          } catch (splitError) {
            console.error(
              `Error processing split batch ${batchCount}:`,
              splitError
            );
            throw splitError;
          }
        } else {
          throw error;
        }
      }
    };

    // Process rows in batches to reduce memory usage
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const rowObj: Record<string, unknown> = {};

      // Extract each cell in the row
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = xlsx.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellRef];
        rowObj[headers[C]] = cell ? cell.v : null;
      }

      batch.push(rowObj);

      // Process batch when it reaches the batch size
      if (batch.length >= batchSize) {
        await processBatch();
      }

      // Periodically free memory by deleting processed cells
      if (R % (batchSize * 5) === 0) {
        // Delete processed rows from worksheet to free memory
        for (let cleanR = R - batchSize * 5; cleanR < R; cleanR++) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = xlsx.utils.encode_cell({ r: cleanR, c: C });
            delete worksheet[cellRef];
          }
        }
      }
    }

    // Process any remaining rows
    if (batch.length > 0) {
      await processBatch();
    }

    console.log(`Completed processing XLSX file. Total rows: ${rowCount}`);

    // Clear worksheet data to free memory
    workbook = null;

    return {
      headers,
      rowCount,
    };
  } catch (error) {
    console.error(`Error processing XLSX file: ${error}`);
    throw error;
  }
}

/**
 * Parse an XLSX file (legacy method - loads entire file into memory)
 * @param filePath Path to the XLSX file
 * @returns Promise with parsed data
 * @deprecated Use processXLSXStreaming instead for large files
 */
export async function parseXLSX(filePath: string): Promise<ParsedData> {
  console.warn(
    "Warning: parseXLSX loads the entire file into memory. Consider using processXLSXStreaming for large files."
  );
  try {
    let workbook;

    // Handle remote files (URLs)
    if (filePath.startsWith("http")) {
      console.log(`Parsing remote XLSX file: ${filePath}`);
      const response = await axios.get(filePath, {
        responseType: "arraybuffer",
      });
      const fileContent = Buffer.from(response.data);
      workbook = xlsx.read(fileContent, { type: "buffer" });
    } else {
      // Handle local files
      workbook = xlsx.readFile(filePath);
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Extract headers (first row)
    const headers = jsonData[0] as string[];

    // Extract rows (skip first row)
    const rows = jsonData.slice(1).map((row: unknown) => {
      const rowObj: Record<string, unknown> = {};
      const rowArray = row as unknown[];
      headers.forEach((header, index) => {
        rowObj[header] = rowArray[index];
      });
      return rowObj;
    });

    return {
      headers,
      rows,
      rowCount: rows.length,
    };
  } catch (error) {
    console.error(`Error parsing XLSX file: ${error}`);
    throw error;
  }
}

/**
 * Process a file in streaming mode with batch processing
 * @param filePath Path to the file
 * @param fileId File ID for database insertion
 * @param sourceId Source ID for provenance
 * @param format File format (csv or xlsx)
 * @param batchSize Number of rows to process in each batch
 * @param onProgress Optional callback for progress updates
 * @param onHeadersExtracted Optional callback when headers are extracted
 * @returns Promise with headers and row count, or a too_large indicator for very large files
 */
export async function processFileStreaming(
  filePath: string,
  fileId: string,
  sourceId: string,
  format: string,
  batchSize: number = 1000,
  onProgress?: (processed: number) => void,
  onHeadersExtracted?: (headers: string[]) => void
): Promise<{ headers: string[]; rowCount: number }> {
  console.log(`Processing file in streaming mode: ${filePath} (${format})`);

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
 */
export async function updateFileStatus(
  fileId: string,
  status: FileStatus
): Promise<void> {
  try {
    await executeQuery(`
      UPDATE files
      SET status = '${status}'
      WHERE id = '${fileId}'
    `);
    console.log(`Updated file ${fileId} status to ${status}`);
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
      // Don't throw the error, just log it and continue
    } else {
      console.error(`Error updating file status: ${error}`);
      throw error;
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

    // Create table with provenance columns
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS file_${fileId} (
        ${columnDefs},
        source_id TEXT,
        ingested_at TIMESTAMP
      )
    `);

    console.log(`Created table file_${fileId}`);
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
        `DuckDB operation skipped (server environment): Unable to create table for file ${fileId}`
      );
      // Don't throw the error, just log it and continue
    } else {
      console.error(`Error creating file table: ${error}`);
      throw error;
    }
  }
}

/**
 * Insert data into a DuckDB table
 * @param fileId File ID
 * @param rows Data rows with provenance columns
 */
export async function insertDataIntoTable(
  fileId: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  try {
    // Get column names from first row
    if (rows.length === 0) {
      console.log(`No data to insert for file ${fileId}`);
      return;
    }

    const firstRow = rows[0];
    const columnNames = Object.keys(firstRow)
      .map((col) => `"${col}"`)
      .join(", ");

    // Insert data in batches
    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      // Create values string for each row
      const valueStrings = batch
        .map((row) => {
          const values = Object.values(row)
            .map((val) => {
              if (val === null || val === undefined) {
                return "NULL";
              } else if (typeof val === "string") {
                return `'${val.replace(/'/g, "''")}'`;
              } else {
                return val;
              }
            })
            .join(", ");

          return `(${values})`;
        })
        .join(", ");

      try {
        // Insert batch
        await executeQuery(`
          INSERT INTO file_${fileId} (${columnNames})
          VALUES ${valueStrings}
        `);

        console.log(
          `Inserted ${batch.length} rows into file_${fileId} (batch ${
            i / BATCH_SIZE + 1
          })`
        );
      } catch (batchError) {
        // Check if this is a DuckDB server environment error
        if (
          batchError instanceof Error &&
          (batchError.message.includes(
            "DuckDB is only available in browser environments"
          ) ||
            batchError.message.includes("Worker is not defined") ||
            batchError.message ===
              "DuckDB is not available in server environments")
        ) {
          console.warn(
            `DuckDB operation skipped (server environment): Unable to insert batch ${
              i / BATCH_SIZE + 1
            } for file ${fileId}`
          );
          // Break the loop since all subsequent batches will also fail
          break;
        } else {
          // For other errors, throw them
          throw batchError;
        }
      }
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
        `DuckDB operation skipped (server environment): Unable to insert data for file ${fileId}`
      );
      // Don't throw the error, just log it and continue
    } else {
      console.error(`Error inserting data into table: ${error}`);
      throw error;
    }
  }
}
