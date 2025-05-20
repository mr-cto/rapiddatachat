import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { ViewStateManager } from "../lib/viewStateManager";
import {
  syncColumnMergesToViewState,
  loadColumnMergesFromViewState,
} from "./ColumnMergeManagerViewState";

interface ColumnMerge {
  id: string;
  mergeName: string;
  columnList: string[];
  delimiter: string;
}

interface ColumnMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  columns: string[];
  initialColumnMerges?: ColumnMerge[];
  onColumnMergesChange?: (columnMerges: ColumnMerge[]) => void;
  data: Record<string, unknown>[];
  viewStateManager?: ViewStateManager;
}

const ColumnMergeModal: React.FC<ColumnMergeModalProps> = ({
  isOpen,
  onClose,
  fileId,
  columns,
  initialColumnMerges = [],
  onColumnMergesChange,
  data,
  viewStateManager,
}) => {
  // Initialize column merges from view state if available
  const [columnMerges, setColumnMerges] = useState<ColumnMerge[]>(
    viewStateManager
      ? loadColumnMergesFromViewState(viewStateManager)
      : initialColumnMerges
  );

  // Update column merges when initialColumnMerges changes
  useEffect(() => {
    if (initialColumnMerges && initialColumnMerges.length > 0) {
      setColumnMerges(initialColumnMerges);
    }
  }, [initialColumnMerges]);
  const [newMergeName, setNewMergeName] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [delimiter, setDelimiter] = useState(" ");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);

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

  // Sync with view state manager when column merges change
  useEffect(() => {
    if (viewStateManager && columnMerges.length > 0) {
      syncColumnMergesToViewState(viewStateManager, columnMerges);
    }
  }, [viewStateManager, columnMerges]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewMergeName("");
      setSelectedColumns([]);
      setDelimiter(" ");
      setShowPreview(false);
      setPreviewData([]);
      setError(null);
    }
  }, [isOpen]);

  // Ensure we have all columns from the data
  useEffect(() => {
    if (data && data.length > 0) {
      // Get all unique keys from all data objects
      const allKeys = new Set<string>();
      data.forEach((row) => {
        Object.keys(row).forEach((key) => {
          allKeys.add(key);
        });
      });

      // Update columns if we found new ones
      const allColumns = Array.from(allKeys);
      if (allColumns.length > columns.length) {
        // This assumes the parent component will update its columns prop
        console.log("Found additional columns in data:", allColumns);
      }
    }
  }, [data, columns]);

  // Toggle column selection
  const toggleColumnSelection = (column: string) => {
    if (selectedColumns.includes(column)) {
      setSelectedColumns(selectedColumns.filter((col) => col !== column));
    } else {
      setSelectedColumns([...selectedColumns, column]);
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
  };

  // Move a column down in the order
  const moveColumnDown = (index: number) => {
    if (index >= selectedColumns.length - 1) return;
    const newOrder = [...selectedColumns];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    setSelectedColumns(newOrder);
  };

  // Generate a preview of the merged column
  const generatePreview = async () => {
    if (!newMergeName || selectedColumns.length === 0) {
      setError("Merge name and at least one column are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
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

  // Update preview when column order changes
  useEffect(() => {
    // Only regenerate preview if we're already showing it
    if (showPreview && selectedColumns.length > 0) {
      generatePreview();
    }
  }, [selectedColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  // Automatically generate preview when more than 1 column is selected
  useEffect(() => {
    if (selectedColumns.length > 1 && newMergeName) {
      generatePreview();
    }
  }, [selectedColumns.length, newMergeName, delimiter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create a new column merge
  const createColumnMerge = async () => {
    if (!newMergeName || selectedColumns.length === 0) {
      setError("Merge name and at least one column are required");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create a temporary column merge object
      const tempColumnMerge = {
        id: `merge-${Date.now()}`,
        mergeName: newMergeName,
        columnList: selectedColumns,
        delimiter,
      };

      // Add the temporary column merge to the state
      const newMerges = [...columnMerges, tempColumnMerge];
      setColumnMerges(newMerges);

      // Update view state manager if available
      if (viewStateManager) {
        viewStateManager.addColumnMerge(
          tempColumnMerge.id,
          tempColumnMerge.mergeName,
          tempColumnMerge.columnList,
          tempColumnMerge.delimiter
        );
      }

      // Apply the merge to the data immediately
      // This ensures the merged data is available when the modal closes
      const processedData = data.map((row) => {
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

      // Notify parent component of the change
      if (onColumnMergesChange) {
        onColumnMergesChange(newMerges);
      }

      // Reset form
      setNewMergeName("");
      setSelectedColumns([]);
      setDelimiter(" ");
      setShowPreview(false);

      // Close the modal
      onClose();
    } catch (err) {
      console.error("Error creating column merge:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a column merge
  const deleteColumnMerge = (mergeId: string) => {
    // Remove the merge from the state
    const newMerges = columnMerges.filter((merge) => merge.id !== mergeId);
    setColumnMerges(newMerges);

    // Update view state manager if available
    if (viewStateManager) {
      viewStateManager.removeColumnMerge(mergeId);
    }

    // Notify parent component of the change
    if (onColumnMergesChange) {
      onColumnMergesChange(newMerges);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Merge Columns"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Active column merges */}
        {columnMerges.length > 0 && (
          <div className="bg-ui-secondary p-3 rounded-lg border border-ui-border">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-gray-300">
                Active Column Merges
                <span className="ml-2 text-xs bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded-full">
                  {columnMerges.length}{" "}
                  {columnMerges.length === 1 ? "merge" : "merges"}
                </span>
              </h4>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {columnMerges.map((merge) => (
                <div
                  key={merge.id}
                  className="flex items-center space-x-2 text-sm bg-ui-primary px-3 py-2 rounded-md border border-ui-border"
                >
                  <div>
                    <span className="font-medium text-gray-300">
                      {merge.mergeName}
                    </span>
                    <span className="text-gray-400 ml-1">
                      ({merge.columnList.join(merge.delimiter)})
                    </span>
                  </div>
                  <button
                    onClick={() => deleteColumnMerge(merge.id)}
                    className="text-red-400 hover:text-red-300"
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
          </div>
        )}

        {/* Create new merge form */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-300">
            Create New Merge
          </h4>

          {error && (
            <div className="p-2 bg-red-900/30 text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Merge Name
              </label>
              <input
                type="text"
                value={newMergeName}
                onChange={(e) => setNewMergeName(e.target.value)}
                placeholder="e.g., full_name"
                className="w-full px-3 py-2 border border-ui-border bg-ui-primary text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Delimiter
              </label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                className="w-full px-3 py-2 border border-ui-border bg-ui-primary text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {delimiterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} {option.value ? `(${option.value})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Select Columns to Merge
            </label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-ui-border rounded-md">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center space-x-2 text-sm bg-ui-secondary px-2 py-1 rounded border border-ui-border hover:border-accent-primary/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => toggleColumnSelection(column)}
                    className="rounded text-accent-primary focus:ring-accent-primary"
                  />
                  <span className="text-gray-300">{column}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Combined interactive preview and reordering section */}
          {selectedColumns.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-gray-300">
                  Interactive Preview
                </h4>
                {/* Preview is now generated automatically when multiple columns are selected */}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Left column: Draggable column list */}
                <div className="md:col-span-1">
                  <div className="p-3 bg-ui-secondary border border-ui-border rounded-md">
                    <h5 className="text-sm font-medium text-gray-300 mb-2">
                      Drag to Reorder
                    </h5>
                    <div className="space-y-2">
                      {selectedColumns.map((column, index) => (
                        <div
                          key={column}
                          className="flex items-center justify-between bg-ui-primary p-2 rounded-md border border-ui-border cursor-move hover:border-accent-primary/50 hover:shadow-sm"
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "text/plain",
                              index.toString()
                            );
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedIndex = parseInt(
                              e.dataTransfer.getData("text/plain")
                            );
                            if (draggedIndex !== index) {
                              const newOrder = [...selectedColumns];
                              const temp = newOrder[draggedIndex];
                              // Remove the item from its original position
                              newOrder.splice(draggedIndex, 1);
                              // Insert it at the new position
                              newOrder.splice(index, 0, temp);
                              setSelectedColumns(newOrder);

                              // Update preview if it's showing
                              if (showPreview) {
                                generatePreview();
                              }
                            }
                          }}
                        >
                          <div className="flex items-center">
                            <span className="text-gray-500 mr-2">
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
                                  d="M4 8h16M4 16h16"
                                />
                              </svg>
                            </span>
                            <span className="text-sm text-gray-300">
                              {column}
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => moveColumnUp(index)}
                              disabled={index === 0}
                              className={`p-1 rounded ${
                                index === 0
                                  ? "text-gray-500 cursor-not-allowed"
                                  : "text-accent-primary hover:bg-ui-tertiary"
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
                                  ? "text-gray-500 cursor-not-allowed"
                                  : "text-accent-primary hover:bg-ui-tertiary"
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
                </div>

                {/* Right column: Live preview */}
                <div className="md:col-span-2">
                  {showPreview && previewData.length > 0 ? (
                    <div className="p-3 bg-ui-secondary border border-ui-border rounded-md">
                      <h5 className="text-sm font-medium text-gray-300 mb-2">
                        Live Preview
                        <span className="ml-2 text-xs text-gray-400">
                          (First {previewData.length}{" "}
                          {previewData.length === 1 ? "Row" : "Rows"})
                        </span>
                      </h5>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-ui-border">
                          <thead className="bg-ui-tertiary">
                            <tr>
                              {/* Column headers for selected columns */}
                              {selectedColumns.map((column) => (
                                <th
                                  key={column}
                                  scope="col"
                                  className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
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
                          <tbody className="bg-ui-primary divide-y divide-ui-border">
                            {previewData.map((row, rowIndex) => (
                              <tr
                                key={rowIndex}
                                className={
                                  rowIndex % 2 === 0
                                    ? "bg-ui-primary"
                                    : "bg-ui-secondary"
                                }
                              >
                                {/* Cells for selected columns */}
                                {selectedColumns.map((column) => (
                                  <td
                                    key={column}
                                    className="px-3 py-2 text-xs text-gray-300"
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
                    </div>
                  ) : (
                    <div className="p-8 bg-ui-secondary border border-ui-border rounded-md flex flex-col items-center justify-center h-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-gray-500 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                        />
                      </svg>
                      <p className="text-gray-400 text-center">
                        {selectedColumns.length === 0
                          ? "Select columns to merge"
                          : selectedColumns.length === 1
                          ? "Select at least one more column to see preview"
                          : !newMergeName
                          ? "Enter a merge name to see preview"
                          : "Loading preview..."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-4">
                {showPreview && (
                  <button
                    onClick={createColumnMerge}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-md text-white ${
                      isLoading
                        ? "bg-gray-600 cursor-not-allowed"
                        : "bg-accent-primary hover:bg-accent-primary-hover"
                    }`}
                  >
                    {isLoading ? "Creating..." : "Confirm Merge"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ColumnMergeModal;
