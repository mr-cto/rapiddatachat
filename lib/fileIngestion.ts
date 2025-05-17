// Use dynamic imports for Node.js modules to avoid client-side errors
import { executeQuery } from "./database";
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
 * Parse a CSV file
 * @param filePath Path to the CSV file
 * @returns Promise with parsed data
 */
export async function parseCSV(filePath: string): Promise<ParsedData> {
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
 * Parse an XLSX file
 * @param filePath Path to the XLSX file
 * @returns Promise with parsed data
 */
export async function parseXLSX(filePath: string): Promise<ParsedData> {
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
 * Parse a file based on its format
 * @param filePath Path to the file
 * @param format File format (csv or xlsx)
 * @returns Promise with parsed data
 */
export async function parseFile(
  filePath: string,
  format: string
): Promise<ParsedData> {
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
