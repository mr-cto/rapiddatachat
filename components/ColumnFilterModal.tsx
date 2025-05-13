import React, { useState, useEffect, useRef } from "react";
import Modal from "./Modal";

import { ViewStateManager } from "../lib/viewStateManager";

interface ColumnFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: string[];
  initialVisibleColumns?: string[];
  onApplyFilters: (visibleColumns: string[]) => void;
  viewStateManager?: ViewStateManager;
}

const ColumnFilterModal: React.FC<ColumnFilterModalProps> = ({
  isOpen,
  onClose,
  columns,
  initialVisibleColumns,
  onApplyFilters,
  viewStateManager,
}) => {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    initialVisibleColumns || columns
  );
  const [orderedColumns, setOrderedColumns] = useState<string[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-600">
            Select which columns to display in the results table.
            <br />
            <span className="text-xs text-indigo-600">
              Drag and drop to reorder columns.
            </span>
          </p>
          <div className="flex space-x-2">
            <button
              onClick={selectAllColumns}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              Select All
            </button>
            <button
              onClick={deselectAllColumns}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Visible columns section */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">
              Visible Columns
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {
                  orderedColumns.filter((col) => visibleColumns.includes(col))
                    .length
                }{" "}
                columns
              </span>
            </h4>
            <div className="max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-md">
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
                            ? "opacity-50 bg-indigo-100"
                            : "bg-slate-50"
                        }
                        ${
                          dragOverColumn === column
                            ? "border-2 border-indigo-500"
                            : "border border-slate-200"
                        }
                        px-2 py-1 rounded hover:border-indigo-200 transition-colors`}
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleColumnVisibility(column)}
                        className="rounded text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700">{column}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-slate-400 ml-1"
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
            <h4 className="text-sm font-medium text-slate-700 mb-2">
              Hidden Columns
              <span className="ml-2 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                {columns.filter((col) => !visibleColumns.includes(col)).length}{" "}
                columns
              </span>
            </h4>
            <div className="max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-md">
              <div className="flex flex-wrap gap-2">
                {columns
                  .filter((column) => !visibleColumns.includes(column))
                  .map((column) => (
                    <label
                      key={column}
                      className="flex items-center space-x-2 text-sm bg-slate-50 px-2 py-1 rounded border border-slate-200 hover:border-indigo-200 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleColumnVisibility(column)}
                        className="rounded text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-slate-500">{column}</span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ColumnFilterModal;
