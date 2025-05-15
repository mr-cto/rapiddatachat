import React, { useState, useEffect } from "react";
import "../../styles/animations.css";
import { ColumnMergeManager } from "../ColumnMergeManager";
import ShareModal from "../ShareModal";
import ColumnFilterModal from "../ColumnFilterModal";
import ColumnMergeModal from "../ColumnMergeModal";
import { ViewStateManager } from "../../lib/viewStateManager";
import {
  syncColumnMergesToViewState,
  loadColumnMergesFromViewState,
} from "../ColumnMergeManagerViewState";

interface QueryResult {
  sqlQuery: string;
  explanation: string;
  results: Record<string, unknown>[];
  executionTime?: number;
  totalRows?: number;
  totalPages?: number;
  currentPage?: number;
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
}

interface QueryResultsPaneProps {
  isLoading: boolean;
  error: string | null;
  result: QueryResult | null;
  currentQuery: string;
  onPageChange: (page: number) => void;
  onSortChange: (column: string, direction: "asc" | "desc") => void;
  onApplyFilters: (filters: Record<string, unknown>) => void;
  onColumnMergesChange?: (
    columnMerges: {
      id: string;
      mergeName: string;
      columnList: string[];
      delimiter: string;
    }[]
  ) => void;
  viewStateManager?: ViewStateManager;
  userId?: string;
}

const QueryResultsPane: React.FC<QueryResultsPaneProps> = ({
  isLoading,
  error,
  result,
  currentQuery,
  onPageChange,
  onSortChange,
  onApplyFilters,
  onColumnMergesChange,
  viewStateManager,
  userId,
}) => {
  // State for modal visibility
  const [showColumnFilterModal, setShowColumnFilterModal] = useState(false);
  const [showColumnMergeModal, setShowColumnMergeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // State for visible columns
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [allAvailableColumns, setAllAvailableColumns] = useState<string[]>([]);

  // State to track the current SQL query for detecting pagination vs new queries
  const [currentSqlQuery, setCurrentSqlQuery] = useState<string>("");

  // State for processed results
  const [processedResults, setProcessedResults] = useState<
    Record<string, unknown>[]
  >([]);

  // Process results to extract nested data
  useEffect(() => {
    if (result && result.results.length > 0) {
      // Process the results to extract nested data
      const processed = result.results.map((row) => {
        // If the row has a data property that's an object, extract its properties
        if (
          row.data &&
          typeof row.data === "object" &&
          !Array.isArray(row.data)
        ) {
          // Extract all properties from the data object
          const extractedData = { ...(row.data as Record<string, unknown>) };

          // Return only the extracted data
          return extractedData;
        }
        return row;
      });

      setProcessedResults(processed);

      // Get all unique keys from processed data for visible columns
      const allKeys = new Set<string>();
      processed.forEach((row) => {
        Object.keys(row).forEach((key) => {
          allKeys.add(key);
        });
      });

      // Include any merged columns from the result
      if (result.columnMerges && result.columnMerges.length > 0) {
        console.log("Adding merged columns to available columns");
        result.columnMerges.forEach((merge) => {
          allKeys.add(merge.mergeName);
        });
      }

      // Store all available columns
      const allColumnsArray = Array.from(allKeys);
      setAllAvailableColumns(allColumnsArray);

      // Always load column visibility from viewStateManager first if available
      let loadedVisibleColumns: string[] | null = null;

      if (viewStateManager) {
        console.log("Checking viewStateManager for saved column visibility");
        const state = viewStateManager.getViewState();
        if (state.hiddenColumns && state.hiddenColumns.length > 0) {
          // Convert hidden columns to visible columns
          const calculatedVisibleColumns = allColumnsArray.filter(
            (col) => !state.hiddenColumns.includes(col)
          );

          // Ensure we have at least one visible column
          if (calculatedVisibleColumns.length > 0) {
            console.log("Using saved column visibility from viewStateManager");
            loadedVisibleColumns = calculatedVisibleColumns;
            setVisibleColumns(calculatedVisibleColumns);
          }
        }
      }

      // Check if this is a new query or just pagination
      const isNewQuery = result.sqlQuery !== currentSqlQuery;

      if (isNewQuery) {
        console.log("New query detected");

        // If we didn't load from viewStateManager, use all columns
        if (!loadedVisibleColumns) {
          console.log("No saved column filters, using all columns");
          setVisibleColumns(allColumnsArray);
        }

        // Update the current SQL query
        setCurrentSqlQuery(result.sqlQuery);
      } else {
        console.log("Pagination detected");

        // If we didn't load from viewStateManager, preserve current visible columns
        if (!loadedVisibleColumns) {
          // Ensure any new columns are added to visible columns
          const newColumns = allColumnsArray.filter(
            (col) =>
              !allAvailableColumns.includes(col) &&
              !visibleColumns.includes(col)
          );
          if (newColumns.length > 0) {
            console.log("Adding new columns to visible columns:", newColumns);
            setVisibleColumns((prev) => [...prev, ...newColumns]);
          }
        }
      }
    }
  }, [result]);

  // Sync column merges with view state manager when they change
  useEffect(() => {
    if (viewStateManager && result?.columnMerges) {
      syncColumnMergesToViewState(viewStateManager, result.columnMerges);
    }
  }, [viewStateManager, result?.columnMerges]);

  // Update visible columns when column merges change
  useEffect(() => {
    if (result?.columnMerges && result.columnMerges.length > 0) {
      // Add merged column names to visible columns if they're not already there
      const mergedColumnNames = result.columnMerges.map(
        (merge) => merge.mergeName
      );
      const newVisibleColumns = [...visibleColumns];
      let columnsAdded = false;

      mergedColumnNames.forEach((columnName) => {
        if (!newVisibleColumns.includes(columnName)) {
          console.log(`Adding merged column to visible columns: ${columnName}`);
          newVisibleColumns.push(columnName);
          columnsAdded = true;
        }
      });

      if (columnsAdded) {
        setVisibleColumns(newVisibleColumns);
      }
    }
  }, [result?.columnMerges, visibleColumns]);

  // Handle column filter changes
  const handleApplyColumnFilters = (columns: string[]) => {
    console.log("Applying column filters with order:", columns);

    // Ensure merged columns are included in the visible columns
    if (result?.columnMerges && result.columnMerges.length > 0) {
      const mergedColumnNames = result.columnMerges.map(
        (merge) => merge.mergeName
      );

      // Check if all merged columns are included in the visible columns
      const missingMergedColumns = mergedColumnNames.filter(
        (col) => !columns.includes(col)
      );

      if (missingMergedColumns.length > 0) {
        console.log(
          "Adding missing merged columns to visible columns:",
          missingMergedColumns
        );
        setVisibleColumns([...columns, ...missingMergedColumns]);

        // Save to viewStateManager
        if (viewStateManager) {
          const hiddenColumns = allAvailableColumns.filter(
            (col) => ![...columns, ...missingMergedColumns].includes(col)
          );
          viewStateManager.setHiddenColumns(hiddenColumns);
        }
      } else {
        setVisibleColumns(columns);

        // Save to viewStateManager
        if (viewStateManager) {
          const hiddenColumns = allAvailableColumns.filter(
            (col) => !columns.includes(col)
          );
          viewStateManager.setHiddenColumns(hiddenColumns);
        }
      }
    } else {
      setVisibleColumns(columns);

      // Save to viewStateManager
      if (viewStateManager) {
        const hiddenColumns = allAvailableColumns.filter(
          (col) => !columns.includes(col)
        );
        viewStateManager.setHiddenColumns(hiddenColumns);
      }
    }

    // Note: We don't update allAvailableColumns here, so we preserve all columns
    // even when they're hidden from the current view
  };
  return (
    <div className="h-full w-screen max-w-full flex flex-col">
      {/* Enhanced header with controls */}
      <div className="py-3 px-4 bg-white border-b border-slate-200 sticky top-0 z-10 w-full shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-indigo-700">
              Query Results
            </h3>
            {result && result.executionTime && (
              <span className="ml-3 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                {result.executionTime.toFixed(2)}ms
              </span>
            )}
          </div>

          {result && result.results.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowColumnMergeModal(true)}
                className={`px-3 py-1.5 text-sm ${
                  showColumnMergeModal
                    ? "bg-indigo-200 text-indigo-800"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                } rounded-md transition-all flex items-center`}
                title="Merge columns for better visualization"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v6a2 2 0 002 2h2"
                  />
                </svg>
                Merge Columns
              </button>
              <button
                onClick={() => setShowColumnFilterModal(true)}
                className={`px-3 py-1.5 text-sm ${
                  showColumnFilterModal
                    ? "bg-indigo-200 text-indigo-800"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                } rounded-md transition-all flex items-center`}
                title="Configure column display"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                Columns
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className={`px-3 py-1.5 text-sm ${
                  showShareModal
                    ? "bg-indigo-200 text-indigo-800"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                } rounded-md transition-all flex items-center`}
                title="Export results as CSV"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Query Results Section - Enhanced with better spacing and visual hierarchy */}
      <div className="flex-1 pt-2 px-0 pb-[80px] overflow-y-auto overflow-x-auto">
        {isLoading && (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600 border-r-2 border-r-indigo-200"></div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md shadow-sm animate-fadeIn">
            <h3 className="text-lg font-medium text-red-800 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Error
            </h3>
            <p className="text-red-700 mt-2">{error}</p>
          </div>
        )}

        {result && result.results.length > 0 && (
          <div className="flex flex-col">
            {/* Column Filter Modal */}
            <ColumnFilterModal
              isOpen={showColumnFilterModal}
              onClose={() => setShowColumnFilterModal(false)}
              columns={allAvailableColumns} // Use allAvailableColumns to show all possible columns
              initialVisibleColumns={visibleColumns}
              onApplyFilters={handleApplyColumnFilters}
              viewStateManager={viewStateManager}
            />

            {/* Column Merge Modal */}
            <ColumnMergeModal
              isOpen={showColumnMergeModal}
              onClose={() => setShowColumnMergeModal(false)}
              fileId="query-results"
              columns={allAvailableColumns} // Use allAvailableColumns to show all possible columns
              initialColumnMerges={result.columnMerges}
              onColumnMergesChange={onColumnMergesChange}
              data={processedResults}
              viewStateManager={viewStateManager}
            />

            {/* Data Table with Column Merge Manager */}
            <div className="flex-1 mb-4 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <ColumnMergeManager
                fileId="query-results"
                data={processedResults}
                onSortChange={onSortChange}
                onPageChange={onPageChange}
                currentPage={result.currentPage}
                totalPages={result.totalPages}
                totalRows={result.totalRows}
                serverSideSort={true}
                className="w-full"
                initialColumnMerges={
                  viewStateManager
                    ? loadColumnMergesFromViewState(viewStateManager)
                    : result.columnMerges
                }
                onColumnMergesChange={(merges) => {
                  // Update view state manager if available
                  if (viewStateManager) {
                    syncColumnMergesToViewState(viewStateManager, merges);
                  }

                  // Call the original callback
                  if (onColumnMergesChange) {
                    onColumnMergesChange(merges);
                  }
                }}
                visibleColumns={visibleColumns}
                viewStateManager={viewStateManager}
              />
            </div>

            {/* Share Modal */}
            <ShareModal
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
              naturalLanguageQuery={currentQuery}
              sqlQuery={result.sqlQuery || ""}
              results={processedResults}
              columnMerges={result.columnMerges}
              virtualColumns={result.virtualColumns || []}
              columnOrder={visibleColumns}
            />
          </div>
        )}

        {result && result.results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border border-slate-200 shadow-sm p-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-slate-700">
              No Results Found
            </h3>
            <p className="mt-2 text-slate-500 text-center max-w-md">
              Your query executed successfully, but didn&apos;t return any data.
              Try modifying your query or checking your data source.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryResultsPane;
