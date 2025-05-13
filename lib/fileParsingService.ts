import fs from "fs";
import path from "path";
import csv from "csv-parser";
import * as XLSX from "xlsx";
import { Readable } from "stream";

/**
 * Interface for column information
 */
export interface ColumnInfo {
  name: string;
  index: number;
  dataType: string;
  sampleValues: any[];
  uniqueValues?: number;
  nullCount?: number;
  min?: any;
  max?: any;
}

/**
 * Interface for file parsing result
 */
export interface FileParsingResult {
  columns: ColumnInfo[];
  rowCount: number;
  sampleData: any[];
  fileType: string;
}

/**
 * Detect data type of a value
 * @param value Value to detect type for
 * @returns Detected data type
 */
function detectDataType(value: any): string {
  if (value === null || value === undefined || value === "") {
    return "null";
  }

  // Try to convert to number
  const numberValue = Number(value);
  if (!isNaN(numberValue)) {
    // Check if it's an integer
    if (Number.isInteger(numberValue)) {
      return "integer";
    }
    return "float";
  }

  // Check if it's a date
  const dateValue = new Date(value);
  if (!isNaN(dateValue.getTime()) && value.includes("-")) {
    return "date";
  }

  // Check if it's a boolean
  if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
    return "boolean";
  }

  // Default to string
  return "string";
}

/**
 * Analyze column data to determine data type and statistics
 * @param columnData Array of values for a column
 * @returns Column information
 */
function analyzeColumnData(columnData: any[]): Partial<ColumnInfo> {
  // Filter out null values
  const nonNullValues = columnData.filter(
    (value) => value !== null && value !== undefined && value !== ""
  );

  // Count null values
  const nullCount = columnData.length - nonNullValues.length;

  // Get unique values
  const uniqueValues = new Set(columnData).size;

  // Determine data type based on non-null values
  let dataType = "string";
  if (nonNullValues.length > 0) {
    // Get the most common data type
    const typeCount: Record<string, number> = {};
    nonNullValues.forEach((value) => {
      const type = detectDataType(value);
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    // Find the most common type
    let maxCount = 0;
    Object.entries(typeCount).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dataType = type;
      }
    });
  }

  // Calculate min and max for numeric data
  let min: any = undefined;
  let max: any = undefined;

  if (dataType === "integer" || dataType === "float") {
    const numericValues = nonNullValues.map((v) => Number(v));
    min = Math.min(...numericValues);
    max = Math.max(...numericValues);
  } else if (dataType === "date") {
    const dateValues = nonNullValues.map((v) => new Date(v).getTime());
    min = new Date(Math.min(...dateValues)).toISOString();
    max = new Date(Math.max(...dateValues)).toISOString();
  } else if (dataType === "string") {
    // For strings, min and max are based on length
    const lengths = nonNullValues.map((v) => String(v).length);
    min = Math.min(...lengths);
    max = Math.max(...lengths);
  }

  return {
    dataType,
    uniqueValues,
    nullCount,
    min,
    max,
  };
}

/**
 * Parse a CSV file and extract column information
 * @param filePath Path to the CSV file
 * @param sampleSize Number of rows to sample
 * @returns Promise with file parsing result
 */
export async function parseCSV(
  filePath: string,
  sampleSize: number = 100
): Promise<FileParsingResult> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const columnData: Record<string, any[]> = {};

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers: string[]) => {
        // Initialize column data arrays
        headers.forEach((header) => {
          columnData[header] = [];
        });
      })
      .on("data", (data) => {
        // Store sample data
        if (results.length < sampleSize) {
          results.push(data);
        }

        // Store column data for analysis
        Object.entries(data).forEach(([key, value]) => {
          if (columnData[key]) {
            columnData[key].push(value);
          }
        });
      })
      .on("end", () => {
        // Create column information
        const columns: ColumnInfo[] = Object.entries(columnData).map(
          ([name, values], index) => {
            const analysis = analyzeColumnData(values);
            return {
              name,
              index,
              dataType: analysis.dataType || "string",
              sampleValues: values.slice(0, 5),
              uniqueValues: analysis.uniqueValues,
              nullCount: analysis.nullCount,
              min: analysis.min,
              max: analysis.max,
            };
          }
        );

        resolve({
          columns,
          rowCount: Object.values(columnData)[0]?.length || 0,
          sampleData: results,
          fileType: "csv",
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Parse an XLSX file and extract column information
 * @param filePath Path to the XLSX file
 * @param sampleSize Number of rows to sample
 * @returns Promise with file parsing result
 */
export async function parseXLSX(
  filePath: string,
  sampleSize: number = 100
): Promise<FileParsingResult> {
  try {
    // Read the XLSX file
    const workbook = XLSX.readFile(filePath);

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

    // Get sample data
    const sampleData = data.slice(0, sampleSize);

    // Extract column information
    const columnData: Record<string, any[]> = {};

    // Initialize column data arrays
    if (sampleData.length > 0) {
      Object.keys(sampleData[0]).forEach((header) => {
        columnData[header] = [];
      });
    }

    // Populate column data
    data.forEach((row) => {
      Object.entries(row as Record<string, any>).forEach(([key, value]) => {
        if (columnData[key]) {
          columnData[key].push(value);
        }
      });
    });

    // Create column information
    const columns: ColumnInfo[] = Object.entries(columnData).map(
      ([name, values], index) => {
        const analysis = analyzeColumnData(values);
        return {
          name,
          index,
          dataType: analysis.dataType || "string",
          sampleValues: values.slice(0, 5),
          uniqueValues: analysis.uniqueValues,
          nullCount: analysis.nullCount,
          min: analysis.min,
          max: analysis.max,
        };
      }
    );

    return {
      columns,
      rowCount: data.length,
      sampleData,
      fileType: "xlsx",
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Parse a file and extract column information
 * @param filePath Path to the file
 * @param sampleSize Number of rows to sample
 * @returns Promise with file parsing result
 */
export async function parseFile(
  filePath: string,
  sampleSize: number = 100
): Promise<FileParsingResult> {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".csv":
      return parseCSV(filePath, sampleSize);
    case ".xlsx":
    case ".xls":
      return parseXLSX(filePath, sampleSize);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

/**
 * Get column information from a file
 * @param filePath Path to the file
 * @param sampleSize Number of rows to sample
 * @returns Promise with column information
 */
export async function getColumnInfo(
  filePath: string,
  sampleSize: number = 100
): Promise<ColumnInfo[]> {
  const result = await parseFile(filePath, sampleSize);
  return result.columns;
}

/**
 * Get sample data from a file
 * @param filePath Path to the file
 * @param sampleSize Number of rows to sample
 * @returns Promise with sample data
 */
export async function getSampleData(
  filePath: string,
  sampleSize: number = 100
): Promise<any[]> {
  const result = await parseFile(filePath, sampleSize);
  return result.sampleData;
}

/**
 * Get file parsing result
 * @param filePath Path to the file
 * @param sampleSize Number of rows to sample
 * @returns Promise with file parsing result
 */
export async function getFileParsingResult(
  filePath: string,
  sampleSize: number = 100
): Promise<FileParsingResult> {
  return parseFile(filePath, sampleSize);
}
