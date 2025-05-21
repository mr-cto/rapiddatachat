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

        // Parse the workbook from the array buffer with proper options
        workbook = xlsx.read(response.data, {
          type: "buffer",
          cellDates: true, // Convert date cells to JS dates
          cellNF: false, // Don't include number formats
          cellText: false, // Don't include rich text
        });
      } catch (downloadError) {
        console.error(`Error downloading XLSX file from URL: ${downloadError}`);
        throw downloadError;
      }
    } else {
      // Local file with proper options
      workbook = xlsx.readFile(filePath, {
        cellDates: true, // Convert date cells to JS dates
        cellNF: false, // Don't include number formats
        cellText: false, // Don't include rich text
      });
    }

    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get the range of the worksheet
    const range = xlsx.utils.decode_range(worksheet["!ref"] || "A1");

    // Extract headers from the first row with proper handling
    const headers: string[] = [];

    // First, try to convert the sheet to JSON to get the actual column names
    try {
      console.log("Converting XLSX worksheet to JSON with header row");

      // Convert the worksheet to JSON with header row
      const jsonData = xlsx.utils.sheet_to_json(worksheet, {
        header: 1, // Use first row as headers
        raw: false, // Convert values to appropriate types
        defval: null, // Default value for empty cells
      });

      console.log(`XLSX to JSON conversion result:`, {
        dataType: typeof jsonData,
        isArray: Array.isArray(jsonData),
        length: jsonData?.length || 0,
        firstRowType: jsonData?.length > 0 ? typeof jsonData[0] : "none",
        firstRowIsArray:
          jsonData?.length > 0 ? Array.isArray(jsonData[0]) : false,
        firstRowLength:
          jsonData?.length > 0 && Array.isArray(jsonData[0])
            ? jsonData[0].length
            : 0,
        firstFewRows: jsonData?.slice(0, 3),
      });

      // If we have data and the first row has values, use those as headers
      if (jsonData && jsonData.length > 0 && Array.isArray(jsonData[0])) {
        console.log("First row is an array, using as headers");
        const headerRow = jsonData[0];
        console.log("Header row:", headerRow);

        // Use the actual column names from the first row
        for (let i = 0; i < headerRow.length; i++) {
          const headerName = headerRow[i];
          // Only use generic column names if the header is empty
          headers.push(headerName ? String(headerName) : `Column${i + 1}`);
        }

        console.log(
          `Extracted ${headers.length} headers from XLSX using sheet_to_json`
        );

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

        // Process the data from jsonData
        console.log(`Processing ${jsonData.length - 1} rows from XLSX data`);

        // Skip the header row (index 0) and process all data rows
        let rowCount = 0;
        let batch: Record<string, unknown>[] = [];
        let batchCount = 0;
        const timestamp = new Date().toISOString();

        // Process a batch of rows
        const processBatch = async () => {
          if (batch.length === 0) return;

          try {
            console.log(
              `Processing batch ${batchCount + 1} with ${batch.length} rows`
            );

            // Log a sample row to help debug serialization issues
            if (batch.length > 0) {
              console.log(
                `Sample row data structure:`,
                JSON.stringify(batch[0], (_, value) =>
                  typeof value === "bigint" ? value.toString() : value
                ).substring(0, 500)
              );
            }

            // Add provenance columns to each row with better data type handling
            const rowsWithProvenance = batch.map((row) => {
              // Create a sanitized version of the row that handles complex Excel data types
              const sanitizedRow: Record<string, unknown> = {};
              for (const [key, value] of Object.entries(row)) {
                if (value instanceof Date) {
                  sanitizedRow[key] = value.toISOString();
                } else if (typeof value === "object" && value !== null) {
                  try {
                    sanitizedRow[key] = JSON.stringify(value);
                  } catch (jsonError) {
                    sanitizedRow[key] = String(value);
                  }
                } else if (typeof value === "bigint") {
                  sanitizedRow[key] = value.toString();
                } else {
                  sanitizedRow[key] = value;
                }
              }

              return {
                ...sanitizedRow,
                source_id: sourceId,
                ingested_at: timestamp,
              };
            });

            // Insert batch into database
            console.log(`Inserting batch ${batchCount + 1} into database`);
            await insertFileData(fileId, rowsWithProvenance);

            rowCount += batch.length;
            if (onProgress) {
              onProgress(rowCount);
            }

            console.log(
              `Successfully inserted batch ${
                batchCount + 1
              }, total rows processed: ${rowCount}`
            );
          } catch (error) {
            console.error(`Error processing batch ${batchCount + 1}:`, error);

            // Try individual row insertion as fallback
            console.log(`Attempting individual row insertion as fallback...`);
            let successCount = 0;

            for (const row of batch) {
              try {
                // Create a simplified version with string values
                const simplifiedRow: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(row)) {
                  if (value === null || value === undefined) {
                    simplifiedRow[key] = null;
                  } else if (value instanceof Date) {
                    simplifiedRow[key] = value.toISOString();
                  } else if (typeof value === "object") {
                    simplifiedRow[key] = String(value);
                  } else {
                    simplifiedRow[key] = value;
                  }
                }

                await insertFileData(fileId, [
                  {
                    ...simplifiedRow,
                    source_id: sourceId,
                    ingested_at: timestamp,
                  },
                ]);
                successCount++;
              } catch (rowError) {
                console.error(`Failed to insert individual row:`, rowError);
              }
            }

            console.log(
              `Individual insertion fallback: ${successCount}/${batch.length} rows inserted`
            );

            if (successCount === 0) {
              throw error; // Re-throw if no rows were inserted
            }

            // Update row count with successful insertions
            rowCount += successCount;
            if (onProgress) {
              onProgress(rowCount);
            }
          }

          // Clear the batch
          batch = [];
          batchCount++;
        };

        // Process each row (skip the header row)
        for (let i = 1; i < jsonData.length; i++) {
          const rowData = jsonData[i];

          if (!Array.isArray(rowData)) {
            console.warn(`Row ${i} is not an array, skipping`);
            continue;
          }

          const row: Record<string, unknown> = {};

          // Map the row data to column headers
          for (let j = 0; j < headers.length; j++) {
            if (j < rowData.length) {
              row[headers[j]] = rowData[j];
            } else {
              row[headers[j]] = null;
            }
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

        console.log(`Successfully processed ${rowCount} rows from XLSX data`);
        return { headers, rowCount };
      } else {
        console.log(
          "First row is not an array or no data found, falling back to alternative method"
        );
      }
    } catch (jsonError) {
      console.warn("Error extracting headers using sheet_to_json:", jsonError);
      // Continue with fallback method
    }

    // Fallback: Extract headers cell by cell
    console.log("Using fallback method to extract headers cell by cell");
    console.log("Worksheet range:", range);

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: range.s.r, c: col });
      const cell = worksheet[cellAddress];

      console.log(`Processing header cell at ${cellAddress}:`, cell);

      // Properly format header names
      let headerName = "";
      if (cell) {
        // Format the header based on cell type
        if (cell.t === "n") {
          // Number
          headerName = String(cell.v);
          console.log(`Header at ${cellAddress} is a number: ${headerName}`);
        } else if (cell.t === "d") {
          // Date
          headerName = cell.w || String(cell.v);
          console.log(`Header at ${cellAddress} is a date: ${headerName}`);
        } else if (cell.t === "b") {
          // Boolean
          headerName = String(cell.v);
          console.log(`Header at ${cellAddress} is a boolean: ${headerName}`);
        } else if (cell.t === "s") {
          // String
          headerName = String(cell.v);
          console.log(`Header at ${cellAddress} is a string: ${headerName}`);
        } else {
          headerName = cell.w || String(cell.v || "");
          console.log(
            `Header at ${cellAddress} is of type ${cell.t}: ${headerName}`
          );
        }
      } else {
        console.log(
          `No cell found at ${cellAddress}, using default column name`
        );
      }

      // Ensure we have a valid header name
      const finalHeaderName = headerName || `Column${col + 1}`;
      headers.push(finalHeaderName);
      console.log(`Added header: ${finalHeaderName}`);
    }

    console.log(
      `Extracted ${headers.length} headers from XLSX using fallback method`
    );

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
        console.log(
          `Processing batch ${batchCount + 1} with ${
            batch.length
          } rows (fallback method)`
        );

        // Log a sample row to help debug serialization issues
        if (batch.length > 0) {
          console.log(
            `Sample row data structure (fallback method):`,
            JSON.stringify(batch[0], (_, value) =>
              typeof value === "bigint" ? value.toString() : value
            ).substring(0, 500)
          );
        }

        // Add provenance columns to each row with better data type handling
        const rowsWithProvenance = batch.map((row) => {
          // Create a sanitized version of the row that handles complex Excel data types
          const sanitizedRow: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value instanceof Date) {
              sanitizedRow[key] = value.toISOString();
            } else if (typeof value === "object" && value !== null) {
              try {
                sanitizedRow[key] = JSON.stringify(value);
              } catch (jsonError) {
                sanitizedRow[key] = String(value);
              }
            } else if (typeof value === "bigint") {
              sanitizedRow[key] = value.toString();
            } else {
              sanitizedRow[key] = value;
            }
          }

          return {
            ...sanitizedRow,
            source_id: sourceId,
            ingested_at: timestamp,
          };
        });

        // Insert batch into database with dynamic batch sizing
        console.log(
          `Inserting batch ${batchCount + 1} into database (fallback method)`
        );
        await insertFileData(fileId, rowsWithProvenance);

        rowCount += batch.length;
        if (onProgress) {
          onProgress(rowCount);
        }

        console.log(
          `Successfully inserted batch ${
            batchCount + 1
          }, total rows processed: ${rowCount} (fallback method)`
        );
      } catch (error) {
        console.error(
          `Error processing batch ${batchCount + 1} (fallback method):`,
          error
        );

        // Try individual row insertion as fallback
        console.log(
          `Attempting individual row insertion as fallback (fallback method)...`
        );
        let successCount = 0;

        for (const row of batch) {
          try {
            // Create a simplified version with string values
            const simplifiedRow: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(row)) {
              if (value === null || value === undefined) {
                simplifiedRow[key] = null;
              } else if (value instanceof Date) {
                simplifiedRow[key] = value.toISOString();
              } else if (typeof value === "object") {
                simplifiedRow[key] = String(value);
              } else {
                simplifiedRow[key] = value;
              }
            }

            await insertFileData(fileId, [
              {
                ...simplifiedRow,
                source_id: sourceId,
                ingested_at: timestamp,
              },
            ]);
            successCount++;
          } catch (rowError) {
            console.error(
              `Failed to insert individual row (fallback method):`,
              rowError
            );
          }
        }

        console.log(
          `Individual insertion fallback: ${successCount}/${batch.length} rows inserted (fallback method)`
        );

        if (successCount === 0) {
          throw error; // Re-throw if no rows were inserted
        }

        // Update row count with successful insertions
        rowCount += successCount;
        if (onProgress) {
          onProgress(rowCount);
        }
      }

      // Clear the batch
      batch = [];
      batchCount++;
    };

    console.log(`Starting to process ${totalRows} rows using fallback method`);

    // Process each row (skip the header row)
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      if (r % 100 === 0) {
        console.log(`Processing row ${r} of ${range.e.r} (fallback method)`);
      }

      const row: Record<string, unknown> = {};

      // Process each cell in the row
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = xlsx.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        const header = headers[c - range.s.c];

        // Skip if header is undefined or null
        if (!header) {
          console.log(`Skipping cell at ${cellAddress} due to missing header`);
          continue;
        }

        // Properly handle different cell types
        if (!cell) {
          row[header] = null;
        } else {
          switch (cell.t) {
            case "n": // Number
              row[header] = cell.v;
              break;
            case "d": // Date
              // Format dates consistently
              if (cell.v instanceof Date) {
                row[header] = cell.v.toISOString();
              } else {
                row[header] = cell.w || cell.v;
              }
              break;
            case "b": // Boolean
              row[header] = Boolean(cell.v);
              break;
            case "s": // String
              row[header] = String(cell.v);
              break;
            case "e": // Error
              row[header] = null; // Treat error cells as null
              break;
            case "z": // Blank/stub
              row[header] = null;
              break;
            default:
              // For any other type, use the formatted string value if available
              row[header] =
                cell.w !== undefined
                  ? cell.w
                  : cell.v !== undefined
                  ? String(cell.v)
                  : null;
          }
        }
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

  // Normalize the format string by trimming and converting to lowercase
  const normalizedFormat = format.toLowerCase().trim();

  // Check if the format contains xlsx or xls
  if (
    normalizedFormat === "xlsx" ||
    normalizedFormat === "xls" ||
    normalizedFormat.includes("excel") ||
    normalizedFormat.endsWith(".xlsx") ||
    normalizedFormat.endsWith(".xls")
  ) {
    console.log(`Detected Excel format (${format}), using XLSX processor`);
    return processXLSXStreaming(
      filePath,
      fileId,
      sourceId,
      batchSize,
      onProgress,
      onHeadersExtracted
    );
  }
  // Check if the format contains csv
  else if (
    normalizedFormat === "csv" ||
    normalizedFormat.includes("csv") ||
    normalizedFormat.endsWith(".csv")
  ) {
    console.log(`Detected CSV format (${format}), using CSV processor`);
    return processCSVStreaming(
      filePath,
      fileId,
      sourceId,
      batchSize,
      onProgress,
      onHeadersExtracted
    );
  }
  // If we can't determine the format, try to guess from the file path
  else {
    console.warn(
      `Unknown format: ${format}, trying to determine from file path: ${filePath}`
    );

    if (
      filePath.toLowerCase().endsWith(".xlsx") ||
      filePath.toLowerCase().endsWith(".xls")
    ) {
      console.log(`Detected Excel format from file path, using XLSX processor`);
      return processXLSXStreaming(
        filePath,
        fileId,
        sourceId,
        batchSize,
        onProgress,
        onHeadersExtracted
      );
    } else if (filePath.toLowerCase().endsWith(".csv")) {
      console.log(`Detected CSV format from file path, using CSV processor`);
      return processCSVStreaming(
        filePath,
        fileId,
        sourceId,
        batchSize,
        onProgress,
        onHeadersExtracted
      );
    } else {
      throw new Error(
        `Unsupported file format for streaming: ${format} (path: ${filePath})`
      );
    }
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
  // Read the XLSX file with proper options
  const workbook = xlsx.readFile(filePath, {
    cellDates: true, // Convert date cells to JS dates
    cellNF: false, // Don't include number formats
    cellText: false, // Don't include rich text
  });

  // Get the first worksheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert the worksheet to JSON with proper options
  const jsonData = xlsx.utils.sheet_to_json(worksheet, {
    raw: false, // Convert values to appropriate types
    dateNF: "yyyy-mm-dd", // Date format
    defval: null, // Default value for empty cells
  });

  // Extract headers from the first row
  const headers = Object.keys(jsonData[0] || {});

  // Process the data to ensure consistent types
  const processedData = jsonData.map((row: Record<string, any>) => {
    const processedRow: Record<string, any> = {};

    // Process each field in the row
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) {
        // Convert dates to ISO strings for consistency
        processedRow[key] = value.toISOString();
      } else if (value === undefined) {
        // Convert undefined to null
        processedRow[key] = null;
      } else {
        processedRow[key] = value;
      }
    }

    return processedRow;
  });

  return {
    headers,
    rows: processedData,
    rowCount: processedData.length,
  };
}
