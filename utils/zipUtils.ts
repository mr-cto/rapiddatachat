import JSZip from "jszip";

/**
 * Create a ZIP file containing a CSV file
 * @param csvData CSV data as a string
 * @param fileName Name of the CSV file to include in the ZIP
 * @returns Promise<Blob> ZIP file as a Blob
 */
export const createZipWithCSV = async (
  csvData: string,
  fileName: string = "export.csv"
): Promise<Blob> => {
  // Create a new ZIP file
  const zip = new JSZip();

  // Add the CSV file to the ZIP
  zip.file(fileName, csvData);

  // Generate the ZIP file as a Blob
  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
};

/**
 * Download a ZIP file
 * @param zipBlob ZIP file as a Blob
 * @param fileName Name of the ZIP file to download
 */
export const downloadZip = (
  zipBlob: Blob,
  fileName: string = "export.zip"
): void => {
  // Create a download link
  const link = document.createElement("a");

  // Create a URL for the blob
  const url = URL.createObjectURL(zipBlob);

  // Set link properties
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";

  // Add link to document
  document.body.appendChild(link);

  // Click the link to download the file
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
