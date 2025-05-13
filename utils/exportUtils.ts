/**
 * Convert data to CSV format
 * @param data Array of objects to convert to CSV
 * @returns CSV string
 */
export const convertToCSV = (data: Record<string, unknown>[]): string => {
  if (!data || data.length === 0) return "";

  // Get headers from the first object
  const headers = Object.keys(data[0]);

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
 */
export const downloadCSV = (
  data: Record<string, unknown>[],
  filename: string = "export.csv"
): void => {
  const csv = convertToCSV(data);

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
};
