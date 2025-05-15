import React, { useState } from "react";
import Modal from "./Modal";
import { downloadCSV } from "../utils/exportUtils";

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
   * Download the results as a CSV file
   */
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
    // Note: This is a simplified implementation as we don't have access to the actual
    // expressions evaluation logic here. In a real implementation, you would need to
    // evaluate the expressions or ensure they're already evaluated in the results.
    if (virtualColumns && virtualColumns.length > 0) {
      // Ensure virtual columns are included in the export
      // In a real implementation, these would be calculated based on their expressions
      virtualColumns.forEach((vc) => {
        processedResults.forEach((row: Record<string, unknown>) => {
          // If the virtual column is not already in the results (it should be if properly passed)
          if (row[vc.name] === undefined) {
            // Set a placeholder value or calculate it if possible
            row[vc.name] = row[vc.name] || `[Virtual: ${vc.name}]`;
          }
        });
      });
    }

    // We no longer need to reorder the data here since we're passing the columnOrder to downloadCSV
    // The convertToCSV function will handle the ordering
    // This ensures that the column order is respected in the CSV file

    return processedResults;
  };

  /**
   * Download the results as a CSV file, respecting merged columns and column order
   */
  const handleDownloadCSV = () => {
    try {
      const filename = `query-results-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      // Process the results to include merged columns and virtual columns
      const processedResults = processResultsForExport();

      // Use the column order exactly as provided - don't modify it
      // This ensures that columns appear in the exact order specified by the user
      // If columnOrder is not provided, we'll use the default order from the data
      const effectiveColumnOrder = columnOrder ? [...columnOrder] : undefined;

      // Download the processed results with the effective column order
      downloadCSV(processedResults, filename, effectiveColumnOrder);
    } catch (error) {
      console.error("Error downloading CSV:", error);
      setError("Failed to download CSV. Please try again.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Query Results">
      <div className="space-y-6">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Export Options</h4>
          <p className="text-xs text-slate-500">
            Download the results as a CSV file.
          </p>
        </div>

        {/* Download CSV Section */}
        <div>
          <button
            onClick={handleDownloadCSV}
            disabled={results.length === 0}
            className={`flex items-center px-4 py-2 rounded-md text-white font-medium ${
              results.length === 0
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 transition-all"
            }`}
          >
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
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Download the current view as a CSV file for use in spreadsheet
            applications.
          </p>
        </div>

        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ShareModal;
