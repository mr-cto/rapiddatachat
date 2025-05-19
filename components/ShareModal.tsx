import React, { useState } from "react";
import Modal from "./Modal";
import { downloadCSV } from "../utils/exportUtils";
import { createZipWithCSV, downloadZip } from "../utils/zipUtils";
import { convertToCSV } from "../utils/exportUtils";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryId?: string;
  naturalLanguageQuery: string;
  sqlQuery: string;
  results: Record<string, unknown>[];
  columnMerges?: {
    id: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }[];
  virtualColumns?: {
    name: string;
    expression: string;
  }[];
  columnOrder?: string[]; // Array of column names in the desired order
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  queryId,
  naturalLanguageQuery,
  sqlQuery,
  results,
  columnMerges = [],
  virtualColumns = [],
  columnOrder = [],
}) => {
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  } | null>(null);

  /**
   * Generate a shareable link for the query results
   */
  const generateShareLink = async () => {
    setIsGeneratingLink(true);
    setError(null);
    setCopied(false);

    try {
      // Call the share-query API endpoint
      const response = await fetch("/api/share-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queryId,
          naturalLanguageQuery,
          sqlQuery,
          results,
          columnMerges,
          virtualColumns,
          columnOrder,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to share query");
      }

      setShareLink(data.shareUrl);
    } catch (error) {
      console.error("Error generating share link:", error);
      setError("Failed to generate share link. Please try again.");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  /**
   * Copy the share link to the clipboard
   */
  const copyToClipboard = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);

      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      setError("Failed to copy link. Please try manually.");
    }
  };

  /**
   * Process results to include merged columns, virtual columns, and respect column order
   * @returns Processed results with all columns properly handled
   */
  const processResultsForExport = () => {
    if (!results || results.length === 0) return [];

    // Create a deep copy of the results to avoid modifying the original
    const processedResults = JSON.parse(JSON.stringify(results));

    // Process merged columns if they exist
    if (columnMerges && columnMerges.length > 0) {
      processedResults.forEach((row: Record<string, unknown>) => {
        // For each column merge definition
        columnMerges.forEach((merge) => {
          const { mergeName, columnList, delimiter } = merge;

          // Create the merged value by joining the values of the columns in the list
          const mergedValue = columnList
            .map((col) => {
              const value = row[col];
              return value !== null && value !== undefined ? String(value) : "";
            })
            .filter(Boolean) // Remove empty values
            .join(delimiter || " ");

          // Add the merged column to the row
          row[mergeName] = mergedValue;
        });
      });
    }

    // Process virtual columns if they exist
    if (virtualColumns && virtualColumns.length > 0) {
      virtualColumns.forEach((vc) => {
        processedResults.forEach((row: Record<string, unknown>) => {
          if (row[vc.name] === undefined) {
            row[vc.name] = row[vc.name] || `[Virtual: ${vc.name}]`;
          }
        });
      });
    }

    return processedResults;
  };

  /**
   * Download the results as a CSV file, respecting merged columns and column order
   * Uses chunked processing for Vercel compatibility
   */
  const handleDownloadCSV = async () => {
    try {
      setIsGeneratingLink(true); // Show loading state
      setError(null);
      setExportProgress(null);

      const filename = `query-results-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      // First, get metadata about the export
      const metadataResponse = await fetch("/api/export-all-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({
          sqlQuery,
          columnMerges,
          virtualColumns,
          chunk: 0, // Request metadata
        }),
      });

      if (!metadataResponse.ok) {
        const errorData = await metadataResponse.json();
        throw new Error(errorData.error || "Failed to get export metadata");
      }

      const metadata = await metadataResponse.json();
      const { totalRows, totalChunks, chunkSize } = metadata;

      console.log(
        `Export metadata: ${totalRows} rows in ${totalChunks} chunks of ${chunkSize} rows each`
      );

      // If there's no data, show an error
      if (totalRows === 0) {
        setError("No data to export");
        setIsGeneratingLink(false);
        return;
      }

      // For small datasets (single chunk), use the simple approach
      if (totalChunks === 1) {
        setExportProgress({ current: 0, total: 1, percentage: 0 });

        const dataResponse = await fetch("/api/export-all-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Include cookies for authentication
          body: JSON.stringify({
            sqlQuery,
            columnMerges,
            virtualColumns,
            chunk: 1, // Get the first (and only) chunk
          }),
        });

        if (!dataResponse.ok) {
          const errorData = await dataResponse.json();

          // Check if it's a response size limit error (status 413)
          if (dataResponse.status === 413) {
            console.warn(
              "Response size limit exceeded, retrying with smaller chunk size"
            );
            // The server has already reduced the chunk size, so we can try again
            setError(
              "Export chunk size was too large. Retrying with a smaller chunk size..."
            );

            // Wait a moment before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Clear the error and retry
            setError(null);
            return handleDownloadCSV();
          }

          throw new Error(errorData.error || "Failed to export data");
        }

        const data = await dataResponse.json();
        setExportProgress({ current: 1, total: 1, percentage: 100 });

        // Use the column order exactly as provided
        const effectiveColumnOrder = columnOrder ? [...columnOrder] : undefined;

        // Download the data
        await downloadCSV(data.results, filename, effectiveColumnOrder);

        setSuccessMessage(
          `Successfully exported ${totalRows.toLocaleString()} rows`
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      }
      // For large datasets, use chunked processing
      else {
        // Create an array to hold all chunks
        const allData: Record<string, unknown>[] = [];

        // Process each chunk
        for (let i = 1; i <= totalChunks; i++) {
          setExportProgress({
            current: i,
            total: totalChunks,
            percentage: Math.round((i / totalChunks) * 100),
          });

          const chunkResponse = await fetch("/api/export-all-data", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include", // Include cookies for authentication
            body: JSON.stringify({
              sqlQuery,
              columnMerges,
              virtualColumns,
              chunk: i,
            }),
          });

          if (!chunkResponse.ok) {
            const errorData = await chunkResponse.json();

            // Check if it's a response size limit error (status 413)
            if (chunkResponse.status === 413) {
              console.warn(
                "Response size limit exceeded, retrying with smaller chunk size"
              );
              // The server has already reduced the chunk size, so we can try again
              setError(
                "Export chunk size was too large. Retrying with a smaller chunk size..."
              );

              // Wait a moment before retrying
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Clear the error and retry
              setError(null);
              return handleDownloadCSV();
            }

            throw new Error(errorData.error || `Failed to export chunk ${i}`);
          }

          const chunkData = await chunkResponse.json();

          // Add this chunk's data to the full dataset
          allData.push(...chunkData.results);
        }

        // Use the column order exactly as provided
        const effectiveColumnOrder = columnOrder ? [...columnOrder] : undefined;

        // Convert to CSV
        const csvData = convertToCSV(allData, effectiveColumnOrder);

        // Create a ZIP file with the CSV data
        const zipBlob = await createZipWithCSV(csvData, filename);

        // Download the ZIP file
        downloadZip(zipBlob, `${filename.replace(/\.csv$/, "")}.zip`);

        setSuccessMessage(
          `Successfully exported ${totalRows.toLocaleString()} rows (ZIP compressed)`
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      }

      console.log(`Exported ${totalRows} rows of data`);
    } catch (error) {
      console.error("Error downloading CSV:", error);
      setError("Failed to download CSV. Please try again.");
    } finally {
      setIsGeneratingLink(false); // Hide loading state
      setExportProgress(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Query Results">
      <div className="space-y-6">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Export Options</h4>
          <p className="text-xs text-gray-400">
            Download the results as a CSV file.
          </p>
        </div>

        {/* Download CSV Section */}
        <div>
          <button
            onClick={handleDownloadCSV}
            disabled={results.length === 0 || isGeneratingLink}
            className={`flex items-center px-4 py-2 rounded-md text-white font-medium ${
              results.length === 0 || isGeneratingLink
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-accent-primary hover:bg-accent-primary-hover transition-all"
            }`}
          >
            {isGeneratingLink ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {exportProgress
                  ? `Exporting... ${exportProgress.percentage}%`
                  : "Preparing Export..."}
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  ></path>
                </svg>
                Download as CSV
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Download the complete dataset as a CSV file for use in spreadsheet
            applications. Large datasets will be automatically compressed.
          </p>
        </div>

        {error && (
          <div className="mt-2 p-3 bg-red-900/30 border border-red-800 rounded-md text-sm text-red-400">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-2 p-3 bg-green-900/30 border border-green-800 rounded-md text-sm text-green-400 flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            {successMessage}
          </div>
        )}

        {exportProgress && (
          <div className="mt-2">
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-accent-primary h-2.5 rounded-full"
                style={{ width: `${exportProgress.percentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Processing chunk {exportProgress.current} of{" "}
              {exportProgress.total}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ShareModal;
