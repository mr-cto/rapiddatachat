import React, { useState, useEffect } from "react";
import { DataTable } from "./DataTable";

import { ViewStateManager } from "../lib/viewStateManager";

interface ColumnMergeManagerProps {
  fileId: string;
  data: Record<string, unknown>[];
  onSortChange?: (column: string, direction: "asc" | "desc") => void;
  initialSortColumn?: string;
  initialSortDirection?: "asc" | "desc";
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalPages?: number;
  totalRows?: number;
  serverSideSort?: boolean;
  className?: string;
  initialColumnMerges?: {
    id: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }[];
  onColumnMergesChange?: (
    columnMerges: {
      id: string;
      mergeName: string;
      columnList: string[];
      delimiter: string;
    }[]
  ) => void;
  visibleColumns?: string[];
  viewStateManager?: ViewStateManager;
}

interface ColumnMerge {
  id: string;
  mergeName: string;
  columnList: string[];
  delimiter: string;
}

/**
 * ColumnMergeManager component for managing column merges and displaying data with merged columns
 */
export const ColumnMergeManager: React.FC<ColumnMergeManagerProps> = ({
  fileId,
  data,
  onSortChange,
  initialSortColumn,
  initialSortDirection,
  onPageChange,
  currentPage,
  totalPages,
  totalRows,
  serverSideSort,
  className,
  initialColumnMerges = [],
  onColumnMergesChange,
  visibleColumns,
  viewStateManager,
}) => {
  // Listen for the custom event from the QueryResultsPane
  React.useEffect(() => {
    const handleToggleMergeForm = () => {
      setShowMergeForm((prev) => !prev);
    };

    // Add event listener
    document.addEventListener("toggle-merge-form", handleToggleMergeForm);

    // Clean up
    return () => {
      document.removeEventListener("toggle-merge-form", handleToggleMergeForm);
    };
  }, []);
  const [mergedData, setMergedData] = useState<Record<string, unknown>[]>([]);
  const [columnMerges, setColumnMerges] = useState<ColumnMerge[]>(
    initialColumnMerges as ColumnMerge[]
  );
  const [showMergeForm, setShowMergeForm] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [newMergeName, setNewMergeName] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [delimiter, setDelimiter] = useState(" ");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewValue, setPreviewValue] = useState("");
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [showColumnMerges, setShowColumnMerges] = useState(true);

  // Fetch column merges for this file
  useEffect(() => {
    if (fileId) {
      fetchColumnMerges();
    }
  }, [fileId, initialColumnMerges]);

  // Load column merges from view state manager if available
  useEffect(() => {
    if (viewStateManager) {
      console.log("Loading column merges from view state manager");
      const viewState = viewStateManager.getViewState();
      if (viewState.columnMerges.length > 0) {
        console.log(
          "Found column merges in view state:",
          viewState.columnMerges
        );
        // Convert view state column merges to the format expected by ColumnMergeManager
        const loadedMerges = viewState.columnMerges.map((cm) => ({
          id: cm.id,
          mergeName: cm.name,
          columnList: cm.columns,
          delimiter: cm.delimiter,
        }));

        // Only update if different from current merges
        if (JSON.stringify(loadedMerges) !== JSON.stringify(columnMerges)) {
          console.log("Updating column merges from view state:", loadedMerges);
          setColumnMerges(loadedMerges);

          // Notify parent component of the change
          if (onColumnMergesChange) {
            onColumnMergesChange(loadedMerges);
          }
        }
      }
    }
  }, [viewStateManager, viewStateManager?.getViewState()]);

  // Update preview when selected columns or delimiter changes
  useEffect(() => {
    if (showPreview) {
      generatePreview();
    }
  }, [selectedColumns, delimiter]);

  // Extract available columns from data
  useEffect(() => {
    // Extract all columns from data
    const extractColumnsFromData = () => {
      const allKeys = new Set<string>();
      if (data && data.length > 0) {
        data.forEach((row) => {
          // If row has a 'data' property that's an object, use its keys
          if (
            row.data &&
            typeof row.data === "object" &&
            !Array.isArray(row.data)
          ) {
            Object.keys(row.data as Record<string, unknown>).forEach((key) => {
              allKeys.add(key);
            });
          } else {
            // Otherwise use the row's keys
            Object.keys(row).forEach((key) => {
              if (key !== "data") {
                allKeys.add(key);
              }
            });
          }
        });
      }
      return Array.from(allKeys);
    };

    // Get all data columns
    const dataColumns = extractColumnsFromData();

    // Add merged column names
    const mergedColumnNames = columnMerges.map((merge) => merge.mergeName);

    // Combine all possible columns
    const allPossibleColumns = [
      ...new Set([...dataColumns, ...mergedColumnNames]),
    ];

    console.log("All possible columns:", allPossibleColumns);

    if (visibleColumns && visibleColumns.length > 0) {
      // If visibleColumns is provided, use it but ensure merged columns are included
      console.log("Using provided visible columns:", visibleColumns);

      // Filter visibleColumns to only include columns that exist in the data or are merged columns
      const filteredVisibleColumns = visibleColumns.filter((col) =>
        allPossibleColumns.includes(col)
      );

      // Make sure all merged columns are included
      const missingMergedColumns = mergedColumnNames.filter(
        (col) => !filteredVisibleColumns.includes(col)
      );

      if (missingMergedColumns.length > 0) {
        console.log(
          "Adding missing merged columns to visible columns:",
          missingMergedColumns
        );
        setAvailableColumns([
          ...filteredVisibleColumns,
          ...missingMergedColumns,
        ]);
      } else {
        setAvailableColumns(filteredVisibleColumns);
      }
    } else {
      // No visibleColumns provided, use all columns
      setAvailableColumns(allPossibleColumns);
    }
  }, [data, visibleColumns, columnMerges]);

  // Apply column merges to data
  useEffect(() => {
    if (data && data.length > 0 && columnMerges.length > 0) {
      console.log("Applying column merges:", columnMerges);
      // Use data directly and just apply column merges
      const processedData = data.map((row) => {
        // Create a copy of the row
        const newRow = { ...row };

        // Process each column merge
        columnMerges.forEach((merge) => {
          // Get values for each column in the merge
          const values = merge.columnList.map((col) => {
            const value = row[col];
            // Convert to string and trim whitespace
            return value !== undefined && value !== null
              ? String(value).trim()
              : "";
          });

          // Create the merged value - filter out empty values before joining
          const mergedValue = values
            .filter((value) => value !== "")
            .join(merge.delimiter);

          // Add the merged column to the row
          newRow[merge.mergeName] = mergedValue;
        });

        return newRow;
      });

      setMergedData(processedData);
      console.log("Merged data updated:", processedData);
    } else {
      setMergedData(data);
    }
  }, [data, columnMerges]);

  // Fetch column merges from the API
  const fetchColumnMerges = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // If initialColumnMerges are provided and not empty, use them
      if (initialColumnMerges && initialColumnMerges.length > 0) {
        console.log(
          "Using provided initial column merges:",
          initialColumnMerges
        );
        // Explicitly set column merges to ensure they're applied
        setColumnMerges(initialColumnMerges);

        // If we have a view state manager, sync the column merges to it
        if (viewStateManager) {
          // Clear existing merges first
          const viewState = viewStateManager.getViewState();
          viewState.columnMerges.forEach((cm) => {
            viewStateManager.removeColumnMerge(cm.id);
          });

          // Add the initial merges
          initialColumnMerges.forEach((merge) => {
            viewStateManager.addColumnMerge(
              merge.id,
              merge.mergeName,
              merge.columnList,
              merge.delimiter
            );
          });
          console.log("Synced initial column merges to view state manager");
        }

        setIsLoading(false);
        return;
      }

      // Special handling for query results
      if (fileId === "query-results") {
        // For query results, we don't fetch from the server
        // since these are temporary and not stored in the database
        setColumnMerges([]);
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/column-merges?fileId=${fileId}`);

      if (!response.ok) {
        let errorMessage = `Failed to fetch column merges: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Fetched column merges from API:", data.columnMerges || []);
      setColumnMerges(data.columnMerges || []);
    } catch (err) {
      console.error("Error fetching column merges:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [fileId, initialColumnMerges]);

  // Generate a preview of the merged column
  const generatePreview = async () => {
    if (!newMergeName || selectedColumns.length === 0) {
      setError("Merge name and at least one column are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // For query results or if we have less than 5 rows, generate preview client-side
      if (fileId === "query-results" || data.length <= 5) {
        // Check if we have data
        if (data.length === 0) {
          setPreviewValue("No data available for preview");
          setPreviewData([]);
          setShowPreview(true);
          setIsLoading(false);
          return;
        }

        // Get up to 5 rows for preview
        const previewRows = data.slice(0, 5);

        // Process each row for preview
        // Use data directly without transformation
        const processedPreviewData = previewRows.map((row) => {
          // Create a copy of the row
          const newRow = { ...row };

          // Get values for each selected column
          const values = selectedColumns.map((col) => {
            const value = row[col];
            // Convert to string and trim whitespace
            return value !== undefined && value !== null
              ? String(value).trim()
              : "";
          });

          // Create the merged value - filter out empty values before joining
          const mergedValue = values
            .filter((value) => value !== "")
            .join(delimiter);

          // Add the merged column to the row
          newRow[newMergeName] = mergedValue;

          return newRow;
        });

        // Set the preview data
        setPreviewData(processedPreviewData);

        // Also set the preview value for the first row (for backward compatibility)
        if (processedPreviewData.length > 0) {
          setPreviewValue(String(processedPreviewData[0][newMergeName] || ""));
        } else {
          setPreviewValue("");
        }
      } else {
        // For regular files with more than 5 rows, use the server-side API
        const response = await fetch("/api/column-merges/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileId,
            columnList: selectedColumns,
            delimiter,
            limit: 5,
          }),
        });

        if (!response.ok) {
          let errorMessage = `Failed to generate preview: ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // Ignore JSON parsing errors
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Process the preview data
        const processedPreviewData = data.previewData.map(
          (row: Record<string, unknown>) => {
            // Rename the mergedColumn to the user-specified name
            const { mergedColumn, ...rest } = row;
            return {
              ...rest,
              [newMergeName]: mergedColumn,
            };
          }
        );

        // Set the preview data
        setPreviewData(processedPreviewData);

        // Also set the preview value for the first row (for backward compatibility)
        if (processedPreviewData.length > 0) {
          setPreviewValue(String(processedPreviewData[0][newMergeName] || ""));
        } else {
          setPreviewValue("");
        }
      }

      setShowPreview(true);
    } catch (error) {
      console.error("Error generating preview:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unknown error generating preview"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Move a column up in the order
  const moveColumnUp = (index: number) => {
    if (index <= 0) return;
    const newOrder = [...selectedColumns];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;
    setSelectedColumns(newOrder);

    // Update preview with new order
    void generatePreview();
  };

  // Move a column down in the order
  const moveColumnDown = (index: number) => {
    if (index >= selectedColumns.length - 1) return;
    const newOrder = [...selectedColumns];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    setSelectedColumns(newOrder);

    // Update preview with new order
    void generatePreview();
  };

  // Create a new column merge
  const createColumnMerge = async () => {
    if (!newMergeName || selectedColumns.length === 0) {
      setError("Merge name and at least one column are required");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setShowPreview(false);

      // Special handling for query results
      if (fileId === "query-results") {
        // For query results, we create a temporary column merge object
        // This won't be stored in the database but will be used in the UI
        const tempColumnMerge = {
          id: `query-results-${Date.now()}`,
          userId: "current-user",
          fileId: "query-results",
          mergeName: newMergeName,
          columnList: selectedColumns,
          delimiter,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Add the temporary column merge to the state
        setColumnMerges((prevMerges) => {
          const newMerges = [...prevMerges, tempColumnMerge];

          // Notify parent component of the change
          if (onColumnMergesChange) {
            onColumnMergesChange(newMerges);
          }

          // Update view state manager if available
          if (viewStateManager) {
            viewStateManager.addColumnMerge(
              tempColumnMerge.id,
              tempColumnMerge.mergeName,
              tempColumnMerge.columnList,
              tempColumnMerge.delimiter
            );
          }

          // Update available columns to include the new merged column
          setAvailableColumns((prevColumns) => {
            if (!prevColumns.includes(newMergeName)) {
              console.log(
                `Adding new merged column to available columns: ${newMergeName}`
              );
              return [...prevColumns, newMergeName];
            }
            return prevColumns;
          });

          return newMerges;
        });

        // Reset form
        setNewMergeName("");
        setSelectedColumns([]);
        setDelimiter("");
        setShowMergeForm(false);

        return;
      }

      // For regular files, create the column merge via API
      const response = await fetch("/api/column-merges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          mergeName: newMergeName,
          columnList: selectedColumns,
          delimiter,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to create column merge: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        throw new Error(errorMessage);
      }

      // The API endpoint will handle creating the PostgreSQL view
      const data = await response.json();
      console.log("Column merge created successfully:", data.columnMerge);

      // Reset form
      setNewMergeName("");
      setSelectedColumns([]);
      setDelimiter("");
      setShowMergeForm(false);

      // Refresh column merges
      fetchColumnMerges().then(() => {
        // Notify parent component of the change with the latest column merges
        if (onColumnMergesChange) {
          // Get the latest column merges after the fetch
          setColumnMerges((currentMerges) => {
            // Notify parent with the updated merges
            onColumnMergesChange(currentMerges);
            return currentMerges;
          });
        }
      });
    } catch (err) {
      console.error("Error creating column merge:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a column merge
  const deleteColumnMerge = async (mergeId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Find the merge to be deleted to get its name
      const mergeToDelete = columnMerges.find((merge) => merge.id === mergeId);

      // If the merge doesn't exist in our local state, just update the UI state
      if (!mergeToDelete) {
        console.warn(
          `Column merge with ID ${mergeId} not found in local state, removing from UI only`
        );

        // Update local state to remove the non-existent merge
        setColumnMerges((prevMerges) => {
          const newMerges = prevMerges.filter((merge) => merge.id !== mergeId);

          // Notify parent component of the change
          if (onColumnMergesChange) {
            onColumnMergesChange(newMerges);
          }

          // Update view state manager if available
          if (viewStateManager) {
            viewStateManager.removeColumnMerge(mergeId);
          }

          return newMerges;
        });

        setIsLoading(false);
        return;
      }

      const mergeNameToDelete = mergeToDelete.mergeName;

      console.log(
        `Deleting column merge: ${mergeId}, name: ${mergeNameToDelete}`
      );

      // For temporary column merges (created in the modal with IDs starting with "merge-"),
      // skip the API call and just update the UI state
      if (mergeId.startsWith("merge-")) {
        console.log(`Skipping API call for temporary column merge: ${mergeId}`);

        // Update local state to remove the temporary merge
        setColumnMerges((prevMerges) => {
          const newMerges = prevMerges.filter((merge) => merge.id !== mergeId);

          // Notify parent component of the change
          if (onColumnMergesChange) {
            onColumnMergesChange(newMerges);
          }

          // Update view state manager if available
          if (viewStateManager) {
            viewStateManager.removeColumnMerge(mergeId);
          }

          // Check if this merged column name is used by any other merges
          const isColumnNameStillUsed = newMerges.some(
            (merge) => merge.mergeName === mergeNameToDelete
          );

          // If the column name is no longer used, remove it from available columns
          if (!isColumnNameStillUsed && mergeNameToDelete) {
            // Only remove from available columns if it's not a regular column
            // This check prevents removing original columns that might have the same name
            const isOriginalColumn = data.some((row) =>
              Object.keys(row).includes(mergeNameToDelete)
            );

            if (!isOriginalColumn) {
              console.log(
                `Removing merged column from available columns: ${mergeNameToDelete}`
              );
              setAvailableColumns((prev) =>
                prev.filter((col) => col !== mergeNameToDelete)
              );
            }
          }

          return newMerges;
        });

        setIsLoading(false);
        return;
      }

      // For non-temporary column merges, delete via API
      const deleteResponse = await fetch(`/api/column-merges/${mergeId}`, {
        method: "DELETE",
      });

      if (!deleteResponse.ok) {
        // If the merge is not found on the server (404), just update the UI state
        if (deleteResponse.status === 404) {
          console.warn(
            `Column merge with ID ${mergeId} not found on server, removing from UI only`
          );

          // Continue with UI updates as if deletion was successful
        } else {
          // For other errors, throw an exception
          let errorMessage = `Failed to delete column merge: ${deleteResponse.statusText}`;
          try {
            const errorData = await deleteResponse.json();
            if (errorData && errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // Ignore JSON parsing errors
          }
          throw new Error(errorMessage);
        }
      }

      // For query results, manually update the UI
      if (mergeId.startsWith("query-results-")) {
        setColumnMerges((prevMerges) => {
          const newMerges = prevMerges.filter((merge) => merge.id !== mergeId);

          // Notify parent component of the change
          if (onColumnMergesChange) {
            onColumnMergesChange(newMerges);
          }

          // Update view state manager if available
          if (viewStateManager) {
            viewStateManager.removeColumnMerge(mergeId);
          }

          // Check if this merged column name is used by any other merges
          const isColumnNameStillUsed = newMerges.some(
            (merge) => merge.mergeName === mergeNameToDelete
          );

          // If the column name is no longer used, remove it from available columns
          if (!isColumnNameStillUsed && mergeNameToDelete) {
            // Only remove from available columns if it's not a regular column
            // This check prevents removing original columns that might have the same name
            const isOriginalColumn = data.some((row) =>
              Object.keys(row).includes(mergeNameToDelete)
            );

            if (!isOriginalColumn) {
              console.log(
                `Removing merged column from available columns: ${mergeNameToDelete}`
              );
              setAvailableColumns((prev) =>
                prev.filter((col) => col !== mergeNameToDelete)
              );
            }
          }

          return newMerges;
        });
      } else {
        // Refresh column merges from the server
        fetchColumnMerges().then(() => {
          // Notify parent component of the change with the latest column merges
          if (onColumnMergesChange) {
            // Get the latest column merges after the fetch
            setColumnMerges((currentMerges) => {
              // Notify parent with the updated merges
              onColumnMergesChange(currentMerges);

              // Update view state manager if available
              if (viewStateManager) {
                // Remove all existing column merges
                const viewState = viewStateManager.getViewState();
                viewState.columnMerges.forEach((cm) => {
                  viewStateManager.removeColumnMerge(cm.id);
                });

                // Add current merges
                currentMerges.forEach((merge) => {
                  viewStateManager.addColumnMerge(
                    merge.id,
                    merge.mergeName,
                    merge.columnList,
                    merge.delimiter
                  );
                });
              }

              // Update available columns based on current merges
              const mergeNames = currentMerges.map((merge) => merge.mergeName);
              setAvailableColumns((prev) => {
                const originalColumns = prev.filter((col) =>
                  data.some((row) => Object.keys(row).includes(col))
                );
                return [...new Set([...originalColumns, ...mergeNames])];
              });

              return currentMerges;
            });
          }
        });
      }
    } catch (err) {
      console.error("Error deleting column merge:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle column selection
  const toggleColumnSelection = (column: string) => {
    if (selectedColumns.includes(column)) {
      setSelectedColumns(selectedColumns.filter((col) => col !== column));
    } else {
      setSelectedColumns([...selectedColumns, column]);
    }
  };

  // Common delimiter options for better UX
  const delimiterOptions = [
    { value: " ", label: "Space" },
    { value: ", ", label: "Comma" },
    { value: " - ", label: "Dash" },
    { value: " | ", label: "Pipe" },
    { value: ": ", label: "Colon" },
    { value: ".", label: "Dot" },
    { value: "/", label: "Slash" },
    { value: "", label: "None" },
  ];

  return (
    <div className={`column-merge-manager ${className}`}>
      {/* Column merge management UI */}
      <div className="mb-4">
        {/* Hidden button for event handling */}
        <button
          data-merge-toggle
          onClick={() => setShowMergeForm(!showMergeForm)}
          className="hidden"
        />

        {/* Active column merges with improved UI */}
        {columnMerges.length > 0 && (
          <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-slate-700">
                Active Column Merges
              </h4>
              <button
                onClick={() => setShowColumnMerges(!showColumnMerges)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
              >
                {showColumnMerges ? "Hide" : "Show"}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 ml-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={showColumnMerges ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"}
                  />
                </svg>
              </button>
            </div>

            {showColumnMerges && (
              <div className="flex flex-wrap gap-2 mt-3">
                {columnMerges.map((merge) => (
                  <div
                    key={merge.id}
                    className="flex items-center space-x-2 text-sm text-secondary dark:text-secondary bg-ui-secondary dark:bg-ui-secondary px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700"
                  >
                    <div>
                      <span className="font-medium">{merge.mergeName}</span>
                      <span className="text-tertiary dark:text-tertiary ml-1">
                        ({merge.columnList.join(merge.delimiter)})
                      </span>
                    </div>
                    <button
                      onClick={() => deleteColumnMerge(merge.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete merge"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Column merge form */}
        {showMergeForm && (
          <div className="mb-4 p-4 bg-ui-secondary dark:bg-ui-secondary rounded-md border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-secondary dark:text-secondary mb-3">
              Create Column Merge
            </h4>

            {error && (
              <div className="mb-3 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-secondary dark:text-secondary mb-1">
                  Merge Name
                </label>
                <input
                  type="text"
                  value={newMergeName}
                  onChange={(e) => setNewMergeName(e.target.value)}
                  placeholder="e.g., full_name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-ui-primary dark:bg-ui-primary text-secondary dark:text-secondary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary dark:text-secondary mb-1">
                  Delimiter
                </label>
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-ui-primary dark:bg-ui-primary text-secondary dark:text-secondary"
                >
                  <option value=" ">Space ( )</option>
                  <option value=",">Comma (,)</option>
                  <option value="-">Hyphen (-)</option>
                  <option value="_">Underscore (_)</option>
                  <option value=".">Period (.)</option>
                  <option value="">No delimiter</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-secondary dark:text-secondary mb-1">
                Select Columns to Merge
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-ui-primary dark:bg-ui-primary">
                {availableColumns.map((column) => (
                  <label
                    key={column}
                    className="flex items-center space-x-2 text-sm text-secondary dark:text-secondary bg-ui-secondary dark:bg-ui-secondary px-2 py-1 rounded border border-gray-200 dark:border-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column)}
                      onChange={() => toggleColumnSelection(column)}
                      className="rounded text-accent-primary focus:ring-accent-primary"
                    />
                    <span>{column}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preview section */}
            {showPreview ? (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-secondary dark:text-secondary mb-2">
                  Preview and Reorder Columns
                </h4>

                {/* Column reordering */}
                <div className="p-3 bg-ui-primary dark:bg-ui-primary border border-gray-300 dark:border-gray-600 rounded-md mb-3">
                  <h5 className="text-sm font-medium text-secondary dark:text-secondary mb-2">
                    Column Order
                  </h5>
                  <div className="space-y-2">
                    {selectedColumns.map((column, index) => (
                      <div
                        key={column}
                        className="flex items-center justify-between bg-ui-secondary dark:bg-ui-secondary p-2 rounded-md"
                      >
                        <span>{column}</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => moveColumnUp(index)}
                            disabled={index === 0}
                            className={`p-1 rounded ${
                              index === 0
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-accent-primary hover:bg-accent-primary/10"
                            }`}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveColumnDown(index)}
                            disabled={index === selectedColumns.length - 1}
                            className={`p-1 rounded ${
                              index === selectedColumns.length - 1
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-accent-primary hover:bg-accent-primary/10"
                            }`}
                            title="Move down"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview data table */}
                <div className="p-3 bg-ui-primary dark:bg-ui-primary border border-gray-300 dark:border-gray-600 rounded-md mb-3">
                  <h5 className="text-sm font-medium text-secondary dark:text-secondary mb-2">
                    Preview Data (First {previewData.length}{" "}
                    {previewData.length === 1 ? "Row" : "Rows"})
                  </h5>

                  {previewData.length === 0 ? (
                    <div className="text-tertiary dark:text-tertiary italic">
                      No data available for preview
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-ui-secondary dark:bg-ui-secondary">
                          <tr>
                            {/* Column headers for selected columns */}
                            {selectedColumns.map((column) => (
                              <th
                                key={column}
                                scope="col"
                                className="px-3 py-2 text-left text-xs font-medium text-secondary dark:text-secondary uppercase tracking-wider"
                              >
                                {column}
                              </th>
                            ))}
                            {/* Header for merged column */}
                            <th
                              scope="col"
                              className="px-3 py-2 text-left text-xs font-medium text-accent-primary uppercase tracking-wider"
                            >
                              {newMergeName}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-ui-primary dark:bg-ui-primary divide-y divide-gray-200 dark:divide-gray-700">
                          {previewData.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className={
                                rowIndex % 2 === 0
                                  ? "bg-ui-primary dark:bg-ui-primary"
                                  : "bg-ui-secondary dark:bg-ui-secondary"
                              }
                            >
                              {/* Cells for selected columns */}
                              {selectedColumns.map((column) => (
                                <td
                                  key={column}
                                  className="px-3 py-2 text-xs text-secondary dark:text-secondary"
                                >
                                  {row[column] !== undefined &&
                                  row[column] !== null
                                    ? String(row[column])
                                    : ""}
                                </td>
                              ))}
                              {/* Cell for merged column */}
                              <td className="px-3 py-2 text-xs font-medium text-accent-primary">
                                {row[newMergeName] !== undefined &&
                                row[newMergeName] !== null
                                  ? String(row[newMergeName])
                                  : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-secondary dark:text-secondary hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Back
                  </button>
                  <button
                    onClick={createColumnMerge}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-md text-white ${
                      isLoading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-accent-primary hover:bg-accent-primary-hover"
                    }`}
                  >
                    {isLoading ? "Creating..." : "Confirm Merge"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={() => void generatePreview()}
                  disabled={
                    isLoading || !newMergeName || selectedColumns.length === 0
                  }
                  className={`px-4 py-2 rounded-md text-white ${
                    isLoading || !newMergeName || selectedColumns.length === 0
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-accent-primary hover:bg-accent-primary-hover"
                  }`}
                >
                  Preview Merge
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data table with merged columns - accounting for chat bar */}
      <div className="max-h-[calc(100vh-310px)] overflow-auto w-full">
        {columnMerges.length > 0 && (
          <div className="mb-2 px-2">
            <div className="inline-flex items-center bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full">
              <span className="font-medium">
                {columnMerges.length} active{" "}
                {columnMerges.length === 1 ? "merge" : "merges"}
              </span>
            </div>
          </div>
        )}
        <DataTable
          data={mergedData}
          onSortChange={onSortChange}
          initialSortColumn={initialSortColumn}
          initialSortDirection={initialSortDirection}
          onPageChange={onPageChange}
          currentPage={currentPage}
          totalPages={totalPages}
          totalRows={totalRows}
          serverSideSort={serverSideSort}
          className={className}
          visibleColumns={visibleColumns || availableColumns}
          viewStateManager={viewStateManager}
        />
      </div>
    </div>
  );
};
