import React, { useState, useEffect, useRef } from "react";
import Modal from "./Modal";

import { ViewStateManager } from "../lib/viewStateManager";
import { useGlobalSchema } from "../lib/contexts/GlobalSchemaContext";

interface ColumnFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns?: string[]; // Make columns optional since we'll fetch them
  initialVisibleColumns?: string[];
  onApplyFilters: (visibleColumns: string[]) => void;
  viewStateManager?: ViewStateManager;
  fileId?: string; // Add fileId to fetch schema columns
  projectId?: string; // Add projectId to fetch schema columns
}

const ColumnFilterModal: React.FC<ColumnFilterModalProps> = ({
  isOpen,
  onClose,
  columns: propColumns,
  initialVisibleColumns,
  onApplyFilters,
  viewStateManager,
  fileId,
  projectId,
}) => {
  // Basic log to confirm the component is being rendered
  console.log("[ColumnFilterModal] Rendering with isOpen:", isOpen);
  // Get schema columns from the global context
  const {
    schemaColumns: globalSchemaColumns,
    activeSchema,
    isLoading: isLoadingGlobalSchema,
    error: globalSchemaError,
  } = useGlobalSchema();

  // Log the active schema when it changes
  useEffect(() => {
    if (activeSchema) {
      console.log("[ColumnFilterModal] Active schema changed:", {
        name: activeSchema.name,
        columnsCount: activeSchema.columns.length,
        columns: activeSchema.columns.map((col) => col.name),
      });
    }
  }, [activeSchema]);

  // Combine prop columns with schema columns, with prop columns taking precedence
  // Make sure we're using the columns from the active schema if available
  const columns =
    propColumns ||
    (activeSchema && activeSchema.columns
      ? activeSchema.columns.map((col) => col.name)
      : globalSchemaColumns);

  // Log the final columns being used
  useEffect(() => {
    if (isOpen) {
      console.log("[ColumnFilterModal] Final columns being used:", {
        count: columns.length,
        columns: columns,
      });
    }
  }, [isOpen, columns]);

  // Log the columns for debugging
  useEffect(() => {
    if (isOpen) {
      console.log("ColumnFilterModal columns:", {
        propColumns: propColumns?.length || 0,
        globalSchemaColumns: globalSchemaColumns.length,
        combined: columns.length,
        fileId,
        projectId,
      });

      // Log the actual columns
      console.log(
        "[ColumnFilterModal] Global schema columns:",
        globalSchemaColumns
      );
      console.log("[ColumnFilterModal] Prop columns:", propColumns || []);
      console.log("[ColumnFilterModal] Combined columns:", columns);
    }
  }, [isOpen, propColumns, globalSchemaColumns, columns, fileId, projectId]);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    initialVisibleColumns || columns
  );
  const [orderedColumns, setOrderedColumns] = useState<string[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // We no longer need to fetch schema columns here as they come from the global context

  // Reset visible columns when columns change or load from viewStateManager
  useEffect(() => {
    if (initialVisibleColumns) {
      setVisibleColumns(initialVisibleColumns);
    } else if (viewStateManager) {
      const state = viewStateManager.getViewState();
      if (state.hiddenColumns && state.hiddenColumns.length > 0) {
        // Convert hidden columns to visible columns
        const calculatedVisibleColumns = columns.filter(
          (col) => !state.hiddenColumns.includes(col)
        );
        // Ensure at least one column is visible
        if (calculatedVisibleColumns.length > 0) {
          setVisibleColumns(calculatedVisibleColumns);
        } else {
          setVisibleColumns(columns);
        }
      } else {
        setVisibleColumns(columns);
      }
    } else {
      setVisibleColumns(columns);
    }
  }, [columns, initialVisibleColumns, viewStateManager]);

  // Initialize ordered columns based on visible columns
  useEffect(() => {
    // Filter columns to only include visible ones and preserve their order
    const ordered = columns.filter((col) => visibleColumns.includes(col));

    // Add any visible columns that might not be in the columns array
    // (like merged columns that were added dynamically)
    visibleColumns.forEach((col) => {
      if (!ordered.includes(col)) {
        ordered.push(col);
      }
    });

    setOrderedColumns(ordered);
  }, [columns, visibleColumns]);

  // Ensure any new columns are added to visibleColumns
  useEffect(() => {
    const newColumns = columns.filter((col) => !visibleColumns.includes(col));
    if (newColumns.length > 0) {
      console.log("Adding new columns to visible columns:", newColumns);
      setVisibleColumns((prev) => [...prev, ...newColumns]);

      // Also add new columns to ordered columns
      setOrderedColumns((current) => [...current, ...newColumns]);
    }
  }, [columns]); // Only run when columns change, not when visibleColumns changes

  const toggleColumnVisibility = (column: string) => {
    if (visibleColumns.includes(column)) {
      // Don't allow hiding all columns
      if (visibleColumns.length > 1) {
        setVisibleColumns(visibleColumns.filter((col) => col !== column));
        // Also remove from ordered columns
        setOrderedColumns(orderedColumns.filter((col) => col !== column));
      }
    } else {
      setVisibleColumns([...visibleColumns, column]);
      // Add to ordered columns if not already there
      if (!orderedColumns.includes(column)) {
        setOrderedColumns([...orderedColumns, column]);
      }
    }
  };

  const selectAllColumns = () => {
    setVisibleColumns([...columns]);
    // Reset ordered columns to match columns order
    setOrderedColumns([...columns]);

    // Update viewStateManager if available
    if (viewStateManager) {
      viewStateManager.setHiddenColumns([]);
    }
  };

  const deselectAllColumns = () => {
    // Keep at least one column visible
    if (columns.length > 0) {
      setVisibleColumns([columns[0]]);
      setOrderedColumns([columns[0]]);

      // Update viewStateManager if available
      if (viewStateManager) {
        const hiddenColumns = columns.filter((col) => col !== columns[0]);
        viewStateManager.setHiddenColumns(hiddenColumns);
      }
    }
  };

  const handleApply = () => {
    // Apply filters with ordered visible columns
    const orderedVisibleColumns = orderedColumns.filter((col) =>
      visibleColumns.includes(col)
    );

    // Save to viewStateManager if available
    if (viewStateManager) {
      const hiddenColumns = columns.filter(
        (col) => !orderedVisibleColumns.includes(col)
      );
      viewStateManager.setHiddenColumns(hiddenColumns);
    }

    onApplyFilters(orderedVisibleColumns);
    onClose();
  };

  // Drag and drop handlers
  const handleDragStart = (
    e: React.DragEvent<HTMLLabelElement>,
    column: string
  ) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = "move";
    // Required for Firefox
    e.dataTransfer.setData("text/plain", column);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLLabelElement>,
    column: string
  ) => {
    e.preventDefault();
    if (draggedColumn === column) return;
    setDragOverColumn(column);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLLabelElement>,
    targetColumn: string
  ) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumn) return;

    const newOrderedColumns = [...orderedColumns];
    const draggedIndex = newOrderedColumns.indexOf(draggedColumn);
    const targetIndex = newOrderedColumns.indexOf(targetColumn);

    // Remove the dragged column
    newOrderedColumns.splice(draggedIndex, 1);
    // Insert it at the target position
    newOrderedColumns.splice(targetIndex, 0, draggedColumn);

    setOrderedColumns(newOrderedColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Visible Columns"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {isLoadingGlobalSchema ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-primary"></div>
            <span className="ml-2 text-gray-400">Loading columns...</span>
          </div>
        ) : globalSchemaError ? (
          <div className="p-4 bg-red-900/30 text-red-400 rounded-md">
            <p className="font-medium">Error loading columns</p>
            <p className="text-sm">{globalSchemaError}</p>
            <p className="text-sm mt-2">Using available columns instead.</p>
          </div>
        ) : null}

        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-400">
            Select which columns to display in the results table.
            <br />
            <span className="text-xs text-accent-primary">
              Drag and drop to reorder columns.
            </span>
          </p>
          <div className="flex space-x-2">
            <button
              onClick={selectAllColumns}
              className="text-xs text-accent-primary hover:text-accent-primary-hover"
            >
              Select All
            </button>
            <button
              onClick={deselectAllColumns}
              className="text-xs text-accent-primary hover:text-accent-primary-hover"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Visible columns section */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Visible Columns
              <span className="ml-2 text-xs bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded-full">
                {
                  orderedColumns.filter((col) => visibleColumns.includes(col))
                    .length
                }{" "}
                columns
              </span>
            </h4>
            <div className="max-h-60 overflow-y-auto p-2 border border-ui-border rounded-md">
              <div className="flex flex-wrap gap-2">
                {orderedColumns
                  .filter((column) => visibleColumns.includes(column))
                  .map((column) => (
                    <label
                      key={column}
                      draggable
                      onDragStart={(e) => handleDragStart(e, column)}
                      onDragOver={(e) => handleDragOver(e, column)}
                      onDrop={(e) => handleDrop(e, column)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center space-x-2 text-sm cursor-move
                        ${
                          draggedColumn === column
                            ? "opacity-50 bg-accent-primary/20"
                            : "bg-ui-secondary"
                        }
                        ${
                          dragOverColumn === column
                            ? "border-2 border-accent-primary"
                            : "border border-ui-border"
                        }
                        px-2 py-1 rounded hover:border-accent-primary/50 transition-colors`}
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleColumnVisibility(column)}
                        className="rounded text-accent-primary focus:ring-accent-primary"
                      />
                      <span className="text-gray-300">{column}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-gray-500 ml-1"
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
                    </label>
                  ))}
              </div>
            </div>
          </div>

          {/* Hidden columns section */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Hidden Columns
              <span className="ml-2 text-xs bg-ui-tertiary text-gray-400 px-2 py-0.5 rounded-full">
                {columns.filter((col) => !visibleColumns.includes(col)).length}{" "}
                columns
              </span>
            </h4>
            <div className="max-h-40 overflow-y-auto p-2 border border-ui-border rounded-md">
              <div className="flex flex-wrap gap-2">
                {columns
                  .filter((column) => !visibleColumns.includes(column))
                  .map((column) => (
                    <label
                      key={column}
                      className="flex items-center space-x-2 text-sm bg-ui-secondary px-2 py-1 rounded border border-ui-border hover:border-accent-primary/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleColumnVisibility(column)}
                        className="rounded text-accent-primary focus:ring-accent-primary"
                      />
                      <span className="text-gray-400">{column}</span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-ui-border text-gray-300 rounded-md hover:bg-ui-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover"
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ColumnFilterModal;
