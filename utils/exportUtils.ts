import { createZipWithCSV, downloadZip } from "./zipUtils";

// Define the threshold for when to use ZIP compression (in rows)
const ZIP_THRESHOLD = 10000;

/**
 * Convert data to CSV format
 * @param data Array of objects to convert to CSV
 * @param columnOrder Optional column order
 * @returns CSV string
 */
export const convertToCSV = (
  data: Record<string, unknown>[],
  columnOrder?: string[]
): string => {
  if (!data || data.length === 0) return "";

  // Get all possible headers from all objects in the data
  const allHeaders = new Set<string>();
  data.forEach((obj) => {
    Object.keys(obj).forEach((key) => allHeaders.add(key));
  });

  // Default headers (all headers from all objects)
  let headers = Array.from(allHeaders);

  // Use columnOrder if provided
  if (columnOrder && columnOrder.length > 0) {
    // Start with the specified column order
    const orderedHeaders: string[] = [];

    // Add columns in the specified order if they exist in the data
    columnOrder.forEach((col) => {
      if (headers.includes(col)) {
        orderedHeaders.push(col);
      }
    });

    // Add any remaining headers not specified in columnOrder
    headers.forEach((header) => {
      if (!orderedHeaders.includes(header)) {
        orderedHeaders.push(header);
      }
    });

    // Use the ordered headers
    headers = orderedHeaders;
  }

  // Create CSV header row
  const headerRow = headers.join(",");

  // Create CSV data rows
  const rows = data.map((obj) => {
    return headers
      .map((header) => {
        const value = obj[header];

        // Handle different data types
        if (value === null || value === undefined) {
          return "";
        } else if (typeof value === "object") {
          // Convert objects to JSON strings
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        } else if (typeof value === "string") {
          // Escape quotes in strings
          return `"${value.replace(/"/g, '""')}"`;
        } else {
          return value;
        }
      })
      .join(",");
  });

  // Combine header and data rows
  return [headerRow, ...rows].join("\n");
};

/**
 * Download data as a CSV file
 * @param data Array of objects to download as CSV
 * @param filename Name of the file to download
 * @param columnOrder Optional column order
 * @param forceZip Force ZIP compression regardless of data size
 */
export const downloadCSV = async (
  data: Record<string, unknown>[],
  filename: string = "export.csv",
  columnOrder?: string[],
  forceZip: boolean = false
): Promise<void> => {
  const csv = convertToCSV(data, columnOrder);

  // Determine if we should use ZIP compression
  const useZip = forceZip || data.length >= ZIP_THRESHOLD;

  if (useZip) {
    // Get the base filename without extension
    const baseFilename = filename.replace(/\.csv$/, "");

    // Create a ZIP file with the CSV
    const zipBlob = await createZipWithCSV(csv, filename);

    // Download the ZIP file
    downloadZip(zipBlob, `${baseFilename}.zip`);

    console.log(`Downloaded ${data.length} rows as ZIP file`);
  } else {
    // Create a blob with the CSV data
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // Create a download link
    const link = document.createElement("a");

    // Create a URL for the blob
    const url = URL.createObjectURL(blob);

    // Set link properties
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    // Add link to document
    document.body.appendChild(link);

    // Click the link to download the file
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`Downloaded ${data.length} rows as CSV file`);
  }
};
