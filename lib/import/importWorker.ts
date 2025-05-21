import { ImportJobStatus } from "../queue/importQueue";
import { getPrismaClient } from "../prisma/replicaClient";
import { put, del, list } from "@vercel/blob";
import { parse } from "csv-parse";
import * as XLSX from "xlsx";
import { Readable } from "stream";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import axios from "axios";

/**
 * Process an import job
 * @param importJobId The ID of the import job to process
 * @returns Processing result
 */
export async function processImportJob(
  importJobId: string,
  onProgress?: (processed: number, total?: number) => void
): Promise<{ success: boolean; rowCount: number }> {
  const prisma = getPrismaClient();

  // Get the import job details
  const importJob = await prisma.$queryRaw<any[]>`
    SELECT * FROM import_jobs WHERE id = ${importJobId} LIMIT 1
  `;

  if (!importJob || importJob.length === 0) {
    throw new Error(`Import job ${importJobId} not found`);
  }

  const job = importJob[0];
  const { project_id: projectId, blob_url: blobUrl, filename } = job;

  try {
    // Update job status to PROCESSING
    await prisma.$executeRaw`
      UPDATE import_jobs 
      SET status = ${ImportJobStatus.PROCESSING}, 
          started_at = ${new Date()} 
      WHERE id = ${importJobId}
    `;

    console.log(`Processing import job ${importJobId} for file ${filename}`);

    // Determine file format from filename
    const fileFormat = filename.toLowerCase().endsWith(".xlsx")
      ? "xlsx"
      : "csv";

    // Download the file from Vercel Blob to a temporary file
    const tempFilePath = join(tmpdir(), `${randomUUID()}-${filename}`);
    await downloadBlobToFile(blobUrl, tempFilePath);

    // Process the file based on its format
    let result;
    if (fileFormat === "xlsx") {
      result = await processXlsxFile(tempFilePath, projectId, onProgress);
    } else {
      result = await processCsvFile(tempFilePath, projectId, onProgress);
    }

    // Clean up the temporary file
    await unlink(tempFilePath);

    // Delete the blob now that we've processed it
    await del(blobUrl);

    // Update job status to READY
    await prisma.$executeRaw`
      UPDATE import_jobs
      SET status = ${ImportJobStatus.READY},
          completed_at = ${new Date()},
          blob_deleted_at = ${new Date()},
          rows_processed = ${result.rowCount},
          total_rows = ${result.rowCount}
      WHERE id = ${importJobId}
    `;

    console.log(
      `Import job ${importJobId} completed successfully. Processed ${result.rowCount} rows.`
    );

    return { success: true, rowCount: result.rowCount };
  } catch (error) {
    console.error(`Error processing import job ${importJobId}:`, error);

    // Update job status to ERROR
    await prisma.$executeRaw`
      UPDATE import_jobs 
      SET status = ${ImportJobStatus.ERROR}, 
          error_message = ${
            error instanceof Error ? error.message : String(error)
          }
      WHERE id = ${importJobId}
    `;

    throw error;
  }
}

/**
 * Download a file from Vercel Blob to a local file
 * @param blobUrl The URL of the blob
 * @param filePath The path to save the file to
 */
async function downloadBlobToFile(
  blobUrl: string,
  filePath: string
): Promise<void> {
  const response = await axios({
    method: "GET",
    url: blobUrl,
    responseType: "stream",
  });

  const writer = createWriteStream(filePath);

  await pipeline(response.data, writer);

  console.log(`Downloaded blob to ${filePath}`);
}

/**
 * Process a CSV file
 * @param filePath The path to the CSV file
 * @param projectId The ID of the project
 * @param onProgress Optional progress callback
 * @returns Processing result
 */
async function processCsvFile(
  filePath: string,
  projectId: string,
  onProgress?: (processed: number, total?: number) => void
): Promise<{ rowCount: number }> {
  const prisma = getPrismaClient();
  const batchSize = 5000;
  let rowCount = 0;

  // Create a read stream for the file
  const fileStream = createReadStream(filePath, {
    highWaterMark: 64 * 1024, // 64KB chunks
    encoding: "utf8",
  });

  // Parse the CSV file in streaming mode
  const parser = fileStream.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  );

  let batch: any[] = [];
  let headers: string[] = [];
  let tableName = `project_${projectId.replace(/-/g, "")}_data`;
  let tableCreated = false;

  // Process the file in batches
  for await (const record of parser) {
    // If this is the first record, extract the headers
    if (rowCount === 0) {
      headers = Object.keys(record);

      // Create the table if it doesn't exist
      if (!tableCreated) {
        await createOrUpdateTable(prisma, tableName, headers, projectId);
        tableCreated = true;
      }
    }

    // Add the record to the batch
    batch.push(record);
    rowCount++;

    // Process the batch when it reaches the batch size
    if (batch.length >= batchSize) {
      await insertBatch(prisma, tableName, batch, projectId);

      // Call the progress callback if provided
      if (onProgress) {
        onProgress(rowCount);
      }

      // Clear the batch
      batch = [];
    }
  }

  // Process any remaining records
  if (batch.length > 0) {
    await insertBatch(prisma, tableName, batch, projectId);

    // Call the progress callback if provided
    if (onProgress) {
      onProgress(rowCount);
    }
  }

  console.log(`Processed ${rowCount} rows from CSV file`);

  return { rowCount };
}

/**
 * Process an XLSX file
 * @param filePath The path to the XLSX file
 * @param projectId The ID of the project
 * @param onProgress Optional progress callback
 * @returns Processing result
 */
async function processXlsxFile(
  filePath: string,
  projectId: string,
  onProgress?: (processed: number, total?: number) => void
): Promise<{ rowCount: number }> {
  const prisma = getPrismaClient();
  const batchSize = 5000;
  let rowCount = 0;

  // Read the XLSX file
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    cellText: false,
  });

  // Check if the workbook has multiple sheets
  if (workbook.SheetNames.length > 1) {
    throw new Error(
      "XLSX files with multiple sheets are not supported. Please use a file with a single sheet."
    );
  }

  // Get the first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert the sheet to JSON with header: true to ensure consistent column names
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  // Debug: Log the first row of data
  if (jsonData.length > 0) {
    console.log("First row of XLSX data (headers):", jsonData[0]);
  }

  // If there's no data, return early
  if (jsonData.length <= 1) {
    // Need at least headers and one data row
    return { rowCount: 0 };
  }

  // Extract headers from the first row
  const extractedHeaders = jsonData[0] as string[];
  console.log("Extracted headers:", extractedHeaders);

  // Convert the data to a format similar to CSV
  const records = [];
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    const record: Record<string, any> = {};

    // Map each column value to its header
    extractedHeaders.forEach((header, index) => {
      record[header] = row[index];
    });

    records.push(record);
  }

  console.log(`Converted ${records.length} rows from XLSX to record format`);
  if (records.length > 0) {
    console.log("Sample converted record:", records[0]);
  }

  // Use the headers we extracted
  const headers = extractedHeaders;

  // Use the same table name format as CSV files
  let tableName = `project_${projectId.replace(/-/g, "")}_data`;

  // Create or update the table
  await createOrUpdateTable(prisma, tableName, headers, projectId);

  // Process the data in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    // Debug: Log the batch being sent to insertBatch
    console.log(`Sending batch of ${batch.length} rows to insertBatch`);
    if (batch.length > 0) {
      console.log("First row in batch:", batch[0]);
      console.log(
        "Keys in first row of batch:",
        Object.keys(batch[0] as object)
      );
    }

    try {
      await insertBatch(prisma, tableName, batch, projectId);
      console.log(`Successfully inserted batch of ${batch.length} rows`);
    } catch (error) {
      console.error("Error inserting batch:", error);
      throw error;
    }

    rowCount += batch.length;

    // Call the progress callback if provided
    if (onProgress) {
      onProgress(rowCount, jsonData.length);
    }
  }

  console.log(`Processed ${rowCount} rows from XLSX file`);

  return { rowCount };
}

/**
 * Create or update a table for the imported data
 * @param prisma The Prisma client
 * @param tableName The name of the table
 * @param headers The column headers
 * @param projectId The ID of the project
 */
async function createOrUpdateTable(
  prisma: any,
  tableName: string,
  headers: string[],
  projectId: string
): Promise<void> {
  // Check if the table exists
  const tableExists = await checkTableExists(prisma, tableName);

  if (!tableExists) {
    // Create the table
    const columnDefs = headers
      .map((header) => {
        // Sanitize the column name
        const columnName = header.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
        return `"${columnName}" TEXT`;
      })
      .join(", ");

    await prisma.$executeRaw`
      CREATE TABLE ${tableName} (
        id SERIAL PRIMARY KEY,
        ${columnDefs},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        project_id TEXT NOT NULL
      )
    `;

    console.log(`Created table ${tableName}`);
  } else {
    // Table exists, check if we need to add any columns
    for (const header of headers) {
      // Sanitize the column name
      const columnName = header.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

      // Check if the column exists
      const columnExists = await checkColumnExists(
        prisma,
        tableName,
        columnName
      );

      if (!columnExists) {
        // Add the column
        await prisma.$executeRaw`
          ALTER TABLE ${tableName} 
          ADD COLUMN IF NOT EXISTS "${columnName}" TEXT
        `;

        console.log(`Added column ${columnName} to table ${tableName}`);
      }
    }
  }

  // Store the schema metadata
  for (const header of headers) {
    // Sanitize the column name
    const columnName = header.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

    // Check if the schema metadata exists
    const metadataExists = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count 
      FROM project_schema_meta 
      WHERE project_id = ${projectId} 
        AND table_name = ${tableName} 
        AND column_name = ${columnName}
    `;

    if (!metadataExists || metadataExists[0].count === 0) {
      // Insert the schema metadata
      await prisma.$executeRaw`
        INSERT INTO project_schema_meta (
          id, project_id, table_name, column_name, data_type, is_nullable, created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${projectId}, ${tableName}, ${columnName}, 'TEXT', true, ${new Date()}, ${new Date()}
        )
      `;

      console.log(
        `Added schema metadata for column ${columnName} in table ${tableName}`
      );
    }
  }
}

/**
 * Check if a table exists
 * @param prisma The Prisma client
 * @param tableName The name of the table
 * @returns Whether the table exists
 */
async function checkTableExists(
  prisma: any,
  tableName: string
): Promise<boolean> {
  const result = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = ${tableName}
    ) as exists
  `;

  return result[0].exists;
}

/**
 * Check if a column exists in a table
 * @param prisma The Prisma client
 * @param tableName The name of the table
 * @param columnName The name of the column
 * @returns Whether the column exists
 */
async function checkColumnExists(
  prisma: any,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const result = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = ${tableName} AND column_name = ${columnName}
    ) as exists
  `;

  return result[0].exists;
}

/**
 * Insert a batch of records into a table
 * @param prisma The Prisma client
 * @param tableName The name of the table
 * @param batch The batch of records to insert
 * @param projectId The ID of the project
 */
async function insertBatch(
  prisma: any,
  tableName: string,
  batch: any[],
  projectId?: string
): Promise<void> {
  if (batch.length === 0) {
    return;
  }

  console.log(`Inserting ${batch.length} records into ${tableName}`);

  try {
    // Insert directly into file_data table using Prisma
    console.log("Inserting data directly into file_data table");

    // Prepare data for insertion
    const dataToInsert = batch.map((row) => {
      try {
        return {
          fileId: tableName.replace(/^project_(.+)_data.*$/, "$1"),
          data: JSON.parse(
            JSON.stringify(row, (_, value) =>
              typeof value === "bigint" ? value.toString() : value
            )
          ),
        };
      } catch (parseError) {
        console.error(`Error parsing row data: ${parseError}`);
        // Return a simplified version of the row
        return {
          fileId: tableName.replace(/^project_(.+)_data.*$/, "$1"),
          data: Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              typeof value === "bigint"
                ? value.toString()
                : value === null || value === undefined
                ? null
                : String(value),
            ])
          ),
        };
      }
    });

    console.log(
      `Prepared ${dataToInsert.length} rows for insertion into file_data table`
    );

    // Insert data in chunks to avoid memory issues
    const chunkSize = 100;
    for (let i = 0; i < dataToInsert.length; i += chunkSize) {
      const chunk = dataToInsert.slice(i, i + chunkSize);

      try {
        const result = await prisma.fileData.createMany({
          data: chunk,
          skipDuplicates: true,
        });

        console.log(
          `Successfully inserted ${
            result.count
          } rows into file_data table (chunk ${Math.floor(i / chunkSize) + 1})`
        );
      } catch (insertError) {
        console.error(`Error with createMany: ${insertError}`);

        // Fall back to individual inserts if batch insert fails
        console.log("Falling back to individual inserts");
        for (const item of chunk) {
          try {
            await prisma.fileData.create({
              data: item,
            });
          } catch (individualError) {
            console.error(`Error with individual insert: ${individualError}`);
          }
        }
      }
    }

    console.log(
      `Successfully processed ${dataToInsert.length} records for ${tableName}`
    );
  } catch (error) {
    console.error(`Error inserting batch into ${tableName}:`, error);
    throw error;
  }
}
