import fs from "fs";
import path from "path";
import * as parquet from "parquetjs";
import { ParsedData } from "./fileIngestion";
import { PROCESSED_DIR } from "./fileUtils";

/**
 * Infer Parquet schema from data
 * @param headers Column headers
 * @param rows Sample data rows
 * @returns Parquet schema
 */
export function inferParquetSchema(
  headers: string[],
  rows: Record<string, unknown>[]
): parquet.ParquetSchema {
  if (rows.length === 0) {
    throw new Error("Cannot infer schema from empty data");
  }

  // Sample the first row to infer types
  const sampleRow = rows[0];
  const schemaFields: Record<string, { type: string }> = {};

  // Add fields based on headers
  headers.forEach((header) => {
    // Ensure the header exists in the schema even if the value is missing
    schemaFields[header] = { type: "UTF8" }; // Default to string type

    const value = sampleRow[header];

    if (value === null || value === undefined) {
      // Keep the default STRING for null/undefined values
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) {
        schemaFields[header] = { type: "INT64" };
      } else {
        schemaFields[header] = { type: "DOUBLE" };
      }
    } else if (typeof value === "boolean") {
      schemaFields[header] = { type: "BOOLEAN" };
    } else if (value instanceof Date) {
      schemaFields[header] = { type: "TIMESTAMP_MILLIS" };
    }
    // Otherwise keep the default string type
  });

  // Add provenance columns
  schemaFields["source_id"] = { type: "UTF8" };
  schemaFields["ingested_at"] = { type: "TIMESTAMP_MILLIS" };

  return new parquet.ParquetSchema(schemaFields);
}

/**
 * Convert data to Parquet format
 * @param data Parsed data with provenance columns
 * @param fileId File ID
 * @returns Path to the Parquet file
 */
export async function convertToParquet(
  data: ParsedData,
  fileId: string
): Promise<string> {
  try {
    // Ensure processed directory exists
    if (!fs.existsSync(PROCESSED_DIR)) {
      fs.mkdirSync(PROCESSED_DIR, { recursive: true });
    }

    // Add provenance columns to headers
    const headersWithProvenance = [...data.headers, "source_id", "ingested_at"];

    // Infer schema
    const schema = inferParquetSchema(headersWithProvenance, data.rows);

    // Create output file path
    const outputPath = path.join(PROCESSED_DIR, `${fileId}.parquet`);

    // Create writer
    const writer = await parquet.ParquetWriter.openFile(schema, outputPath);

    // Write data in batches
    const BATCH_SIZE = 1000;
    for (let i = 0; i < data.rows.length; i += BATCH_SIZE) {
      const batch = data.rows.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        // Convert any Date objects to timestamps and ensure all schema fields exist
        const processedRow: Record<string, unknown> = {};

        // First, initialize all fields from the schema with null values
        Object.keys(schema.fields).forEach((field) => {
          processedRow[field] = null;
        });

        // Then populate with actual values from the row
        Object.entries(row).forEach(([key, value]) => {
          if (value instanceof Date) {
            processedRow[key] = value.getTime();
          } else {
            processedRow[key] = value;
          }
        });

        await writer.appendRow(processedRow);
      }

      console.log(
        `Converted ${batch.length} rows to Parquet (batch ${
          i / BATCH_SIZE + 1
        })`
      );
    }

    // Close the writer
    await writer.close();

    console.log(`Converted data to Parquet: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Error converting to Parquet: ${error}`);
    throw error;
  }
}

/**
 * Read data from a Parquet file
 * @param filePath Path to the Parquet file
 * @returns Parsed data
 */
export async function readParquetFile(filePath: string): Promise<ParsedData> {
  try {
    // Open the parquet file
    const reader = await parquet.ParquetReader.openFile(filePath);

    // Get the schema
    const schema = reader.schema;
    const headers = Object.keys(schema.fields).filter(
      (field) => field !== "source_id" && field !== "ingested_at"
    );

    // Create a cursor
    const cursor = reader.getCursor();

    // Read all records
    const rows: Record<string, unknown>[] = [];
    let record = null;

    while ((record = await cursor.next())) {
      rows.push(record);
    }

    // Close the reader
    await reader.close();

    return {
      headers,
      rows,
      rowCount: rows.length,
    };
  } catch (error) {
    console.error(`Error reading Parquet file: ${error}`);
    throw error;
  }
}
