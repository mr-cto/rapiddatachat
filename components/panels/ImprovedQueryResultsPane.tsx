import React, { useState, useEffect } from "react";
import { ColumnMergeManager } from "../ColumnMergeManager";
import ShareModal from "../ShareModal";
import ColumnFilterModal from "../ColumnFilterModal";
import ColumnMergeModal from "../ColumnMergeModal";
import { ViewStateManager } from "../../lib/viewStateManager";
import { Button, Badge, Card } from "../ui";
import {
  syncColumnMergesToViewState,
  loadColumnMergesFromViewState,
} from "../ColumnMergeManagerViewState";
import {
  FaTable,
  FaFilter,
  FaColumns,
  FaFileExport,
  FaInfoCircle,
} from "react-icons/fa";

interface QueryResult {
  sqlQuery: string;
  explanation: string;
  results: Record<string, unknown>[];
  executionTime?: number;
  totalRows?: number;
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

interface ImprovedQueryResultsPaneProps {
  isLoading: boolean;
  error: string | null;
  result: QueryResult | null;
  currentQuery: string;
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
  projectId?: string; // Add projectId prop
}

const ImprovedQueryResultsPane: React.FC<ImprovedQueryResultsPaneProps> = ({
  isLoading,
  error,
  result,
  currentQuery,
  onSortChange,
  onApplyFilters,
  onColumnMergesChange,
  viewStateManager,
  userId,
  projectId, // Extract projectId from props
}) => {
  // State for modal visibility
  const [showColumnFilterModal, setShowColumnFilterModal] = useState(false);
  const [showColumnMergeModal, setShowColumnMergeModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSqlQuery, setShowSqlQuery] = useState(false);

  // State for visible columns
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [allAvailableColumns, setAllAvailableColumns] = useState<string[]>([]);

  // State to track the current SQL query for detecting pagination vs new queries
  const [currentSqlQuery, setCurrentSqlQuery] = useState<string>("");

  // State for processed results
  const [processedResults, setProcessedResults] = useState<
    Record<string, unknown>[]
  >([]);

  // State for column merges
  const [activeColumnMerges, setActiveColumnMerges] = useState<
    {
      id: string;
      mergeName: string;
      columnList: string[];
      delimiter: string;
    }[]
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
        const state = viewStateManager.getViewState();
        if (state.hiddenColumns && state.hiddenColumns.length > 0) {
          // Convert hidden columns to visible columns
          const calculatedVisibleColumns = allColumnsArray.filter(
            (col) => !state.hiddenColumns.includes(col)
          );

          // Ensure we have at least one visible column
          if (calculatedVisibleColumns.length > 0) {
            loadedVisibleColumns = calculatedVisibleColumns;
            setVisibleColumns(calculatedVisibleColumns);
          }
        }
      }

      // Check if this is a new query or just pagination
      const isNewQuery = result.sqlQuery !== currentSqlQuery;

      if (isNewQuery) {
        // If we didn't load from viewStateManager, use all columns
        if (!loadedVisibleColumns) {
          setVisibleColumns(allColumnsArray);
        }

        // Update the current SQL query
        setCurrentSqlQuery(result.sqlQuery);
      } else {
        // If we didn't load from viewStateManager, preserve current visible columns
        if (!loadedVisibleColumns) {
          // Ensure any new columns are added to visible columns
          const newColumns = allColumnsArray.filter(
            (col) =>
              !allAvailableColumns.includes(col) &&
              !visibleColumns.includes(col)
          );
          if (newColumns.length > 0) {
            setVisibleColumns((prev) => [...prev, ...newColumns]);
          }
        }
      }
    }
  }, [result]);

  // Initialize column merges from result or view state manager
  useEffect(() => {
    if (viewStateManager) {
      const mergesFromViewState =
        loadColumnMergesFromViewState(viewStateManager);
      if (mergesFromViewState && mergesFromViewState.length > 0) {
        setActiveColumnMerges(mergesFromViewState);
      } else if (result?.columnMerges && result.columnMerges.length > 0) {
        setActiveColumnMerges(result.columnMerges);
        syncColumnMergesToViewState(viewStateManager, result.columnMerges);
      }
    } else if (result?.columnMerges) {
      setActiveColumnMerges(result.columnMerges);
    }
  }, [viewStateManager, result?.columnMerges]);

  // Update visible columns when column merges change
  useEffect(() => {
    if (activeColumnMerges && activeColumnMerges.length > 0) {
      // Add merged column names to visible columns if they're not already there
      const mergedColumnNames = activeColumnMerges.map(
        (merge) => merge.mergeName
      );
      const newVisibleColumns = [...visibleColumns];
      let columnsAdded = false;

      mergedColumnNames.forEach((columnName) => {
        if (!newVisibleColumns.includes(columnName)) {
          newVisibleColumns.push(columnName);
          columnsAdded = true;
        }
      });

      if (columnsAdded) {
        setVisibleColumns(newVisibleColumns);
      }
    }
  }, [activeColumnMerges, visibleColumns]);

  // Handle column filter changes
  const handleApplyColumnFilters = (columns: string[]) => {
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
  };

  // If there's no query yet, show a welcome message
  if (!currentQuery && !result && !error && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 mb-6 text-accent-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-300 mb-4">
          Ask Questions About Your Data
        </h2>
        <p className="text-gray-400 max-w-lg mb-6">
          Type a question in natural language in the input field below to
          analyze your data. You can ask questions like "Show me the top 10
          customers by revenue" or "What's the average age by department?"
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="bg-ui-secondary p-4 rounded-lg border border-ui-border">
            <h3 className="font-medium text-gray-300 mb-2 flex items-center">
              <FaTable className="mr-2" /> Upload Data
            </h3>
            <p className="text-sm text-gray-400">
              Start by uploading your CSV or Excel files using the Upload Data
              section in the sidebar.
            </p>
          </div>
          <div className="bg-ui-secondary p-4 rounded-lg border border-ui-border">
            <h3 className="font-medium text-gray-300 mb-2 flex items-center">
              <FaFilter className="mr-2" /> Filter & Sort
            </h3>
            <p className="text-sm text-gray-400">
              Once you have results, you can filter, sort, and export your data
              using the tools above the table.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Enhanced header with controls */}
      {result && result.results.length > 0 && (
        <div className="py-3 px-4 bg-ui-primary border-b border-ui-border sticky top-0 z-10 w-full shadow-sm mb-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h3 className="text-lg font-semibold text-accent-primary">
                Query Results
              </h3>
              {result && result.executionTime && (
                <Badge variant="secondary" size="sm" className="ml-3">
                  {result.executionTime.toFixed(2)}ms
                </Badge>
              )}
              {result && result.totalRows !== undefined && (
                <Badge variant="info" size="sm" className="ml-2">
                  {result.totalRows.toLocaleString()}{" "}
                  {result.totalRows === 1 ? "row" : "rows"}
                  {result.totalRows > 10 && (
                    <span className="ml-1">(showing 10)</span>
                  )}
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setShowSqlQuery(!showSqlQuery)}
                variant={showSqlQuery ? "primary" : "secondary"}
                size="sm"
                className="flex items-center"
                title="View SQL Query"
              >
                <FaInfoCircle className="mr-1" />
                SQL Query
              </Button>
              <Button
                onClick={() => setShowColumnMergeModal(true)}
                variant={showColumnMergeModal ? "primary" : "secondary"}
                size="sm"
                className="flex items-center"
                title="Merge columns for better visualization"
              >
                <FaColumns className="mr-1" />
                Merge Columns
              </Button>
              <Button
                onClick={() => setShowColumnFilterModal(true)}
                variant={showColumnFilterModal ? "primary" : "secondary"}
                size="sm"
                className="flex items-center"
                title="Configure column display"
              >
                <FaFilter className="mr-1" />
                Columns
              </Button>
              <Button
                onClick={() => setShowShareModal(true)}
                variant={showShareModal ? "primary" : "secondary"}
                size="sm"
                className="flex items-center"
                title="Export results as CSV"
              >
                <FaFileExport className="mr-1" />
                Export
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Query Results Section */}
      <div className="flex-1 pt-2 px-0 pb-[80px] overflow-y-auto overflow-x-auto">
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
            <span className="ml-3 text-gray-300">Processing your query...</span>
          </div>
        )}

        {error && (
          <Card variant="danger" padding="md" className="animate-fadeIn">
            <h3 className="text-lg font-medium text-red-400 flex items-center">
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
            <p className="text-red-400 mt-2">{error}</p>
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-md">
              <p className="text-sm text-red-300">
                <strong>Troubleshooting:</strong> Make sure you have uploaded
                data files and that your query is clear. Try rephrasing your
                question or selecting a specific file from the sidebar.
              </p>
            </div>
          </Card>
        )}

        {result && (
          <div className="flex flex-col">
            {/* SQL Query and Explanation */}
            {showSqlQuery && result.sqlQuery && (
              <Card
                variant="default"
                padding="md"
                className="mb-4 animate-fadeIn"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2 text-gray-300 flex items-center">
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
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                    SQL Query
                  </h3>
                  <pre className="p-3 bg-ui-tertiary rounded-md overflow-x-auto text-sm">
                    <code>{result.sqlQuery}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2 text-gray-300 flex items-center">
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
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Explanation
                  </h3>
                  <p className="text-gray-400">{result.explanation}</p>
                </div>
              </Card>
            )}

            {/* Column Filter Modal */}
            <ColumnFilterModal
              isOpen={showColumnFilterModal}
              onClose={() => setShowColumnFilterModal(false)}
              columns={allAvailableColumns}
              initialVisibleColumns={visibleColumns}
              onApplyFilters={handleApplyColumnFilters}
              viewStateManager={viewStateManager}
            />

            {/* Column Merge Modal */}
            <ColumnMergeModal
              isOpen={showColumnMergeModal}
              onClose={() => setShowColumnMergeModal(false)}
              fileId="query-results"
              columns={allAvailableColumns}
              initialColumnMerges={activeColumnMerges}
              onColumnMergesChange={(merges) => {
                // Update local state
                setActiveColumnMerges(merges);

                // Update view state manager if available
                if (viewStateManager) {
                  syncColumnMergesToViewState(viewStateManager, merges);
                }

                // Call the original callback
                if (onColumnMergesChange) {
                  onColumnMergesChange(merges);
                }
              }}
              data={processedResults}
              viewStateManager={viewStateManager}
            />

            {/* Data Table with Column Merge Manager */}
            {result.results.length > 0 ? (
              <Card
                variant="default"
                padding="none"
                className="flex-1 overflow-hidden"
              >
                <ColumnMergeManager
                  fileId="query-results"
                  data={processedResults}
                  onSortChange={onSortChange}
                  totalRows={result.totalRows}
                  serverSideSort={true}
                  className="w-full"
                  initialColumnMerges={activeColumnMerges}
                  onColumnMergesChange={(merges) => {
                    // Update local state
                    setActiveColumnMerges(merges);

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
              </Card>
            ) : (
              <Card
                variant="default"
                padding="lg"
                className="flex flex-col items-center justify-center h-64"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-gray-500"
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
                <h3 className="mt-4 text-lg font-medium text-gray-300">
                  No Results Found
                </h3>
                <p className="mt-2 text-gray-400 text-center max-w-md">
                  Your query executed successfully, but didn&apos;t return any
                  data. Try modifying your query or checking your data source.
                </p>
              </Card>
            )}

            {/* Share Modal */}
            <ShareModal
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
              naturalLanguageQuery={currentQuery}
              sqlQuery={result.sqlQuery || ""}
              results={processedResults}
              columnMerges={activeColumnMerges}
              virtualColumns={result.virtualColumns || []}
              columnOrder={visibleColumns}
              projectId={projectId} // Pass projectId to ShareModal
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImprovedQueryResultsPane;
