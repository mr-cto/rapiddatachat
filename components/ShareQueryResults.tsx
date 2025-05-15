import React from "react";
import { downloadCSV } from "../utils/exportUtils";

interface ShareQueryResultsProps {
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
  columnOrder?: string[]; // Array of column names in the desired order
}

/**
 * ExportQueryResults component for downloading query results as CSV
 * @param props Component props
 * @returns JSX.Element
 */
export const ShareQueryResults: React.FC<ShareQueryResultsProps> = ({
  results,
  columnMerges = [],
  columnOrder = [],
}) => {
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

    return processedResults;
  };

  /**
   * Download the results as a CSV file
   */
  const handleDownloadCSV = () => {
    try {
      const filename = `query-results-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      // Process the results to include merged columns
      const processedResults = processResultsForExport();

      // Use the column order exactly as provided
      const effectiveColumnOrder = columnOrder ? [...columnOrder] : undefined;

      // Download the processed results with the effective column order
      downloadCSV(processedResults, filename, effectiveColumnOrder);
    } catch (error) {
      console.error("Error downloading CSV:", error);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleDownloadCSV}
        disabled={results.length === 0}
        className={`flex items-center px-4 py-2 rounded-md text-white font-medium ${
          results.length === 0
            ? "bg-gray-400 cursor-not-allowed"
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
          />
        </svg>
        Download CSV
      </button>
    </div>
  );
};
