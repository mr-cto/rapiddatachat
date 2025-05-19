import React, { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button, Card } from "./ui";
import {
  FaArrowsAlt,
  FaTrash,
  FaMerge,
  FaCheck,
  FaTimes,
} from "react-icons/fa";

interface CsvPreviewProps {
  file: File;
  onMappingComplete?: (mapping: Record<string, string>) => void;
  onCancel?: () => void;
  existingSchema?: Array<{ id: string; name: string }>;
  projectId?: string;
}

interface ColumnConfig {
  id: string;
  originalName: string;
  displayName: string;
  selected: boolean;
  merged: boolean;
  mergedWith: string[];
}

interface DragItem {
  type: string;
  id: string;
  index: number;
}

const ColumnHeader: React.FC<{
  column: ColumnConfig;
  index: number;
  moveColumn: (dragIndex: number, hoverIndex: number) => void;
  toggleColumnSelection: (id: string) => void;
  startMerge: (id: string) => void;
  isMergeMode: boolean;
  isSelected: boolean;
}> = ({
  column,
  index,
  moveColumn,
  toggleColumnSelection,
  startMerge,
  isMergeMode,
  isSelected,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: "COLUMN",
    item: { type: "COLUMN", id: column.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: !isMergeMode,
  });

  const [{ isOver }, drop] = useDrop({
    accept: "COLUMN",
    hover: (item: DragItem, monitor) => {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Get horizontal middle
      const hoverMiddleX =
        (hoverBoundingRect.right - hoverBoundingRect.left) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the left
      const hoverClientX = clientOffset!.x - hoverBoundingRect.left;

      // Only perform the move when the mouse has crossed half of the items width
      // When dragging rightward, only move when the cursor is after 50%
      // When dragging leftward, only move when the cursor is before 50%

      // Dragging rightward
      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
        return;
      }

      // Dragging leftward
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
        return;
      }

      // Time to actually perform the action
      moveColumn(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`px-3 py-2 font-medium text-sm ${
        isDragging ? "opacity-50" : "opacity-100"
      } ${isOver ? "bg-accent-primary/10" : ""} ${
        column.merged ? "bg-purple-500/20" : ""
      } ${isSelected && isMergeMode ? "bg-accent-primary/20" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {!isMergeMode && (
            <FaArrowsAlt className="mr-2 text-gray-400 cursor-move" />
          )}
          <span className="truncate max-w-[150px]" title={column.displayName}>
            {column.displayName}
          </span>
          {column.merged && (
            <span className="ml-2 text-xs bg-purple-500/30 px-1 rounded">
              Merged
            </span>
          )}
        </div>
        <div className="flex space-x-1">
          {isMergeMode ? (
            <button
              onClick={() => toggleColumnSelection(column.id)}
              className={`p-1 rounded ${
                isSelected ? "text-accent-primary" : "text-gray-400"
              }`}
            >
              {isSelected ? (
                <FaCheck className="w-3 h-3" />
              ) : (
                <FaCheck className="w-3 h-3" />
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => startMerge(column.id)}
                className="p-1 text-blue-400 hover:text-blue-300"
                title="Merge with other columns"
              >
                <FaMerge className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CsvPreview: React.FC<CsvPreviewProps> = ({
  file,
  onMappingComplete,
  onCancel,
  existingSchema,
  projectId,
}) => {
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMergeMode, setIsMergeMode] = useState<boolean>(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [mergeColumnName, setMergeColumnName] = useState<string>("");
  const [primaryMergeColumn, setPrimaryMergeColumn] = useState<string | null>(
    null
  );

  // Parse the CSV file on component mount
  useEffect(() => {
    const parseFile = async () => {
      setLoading(true);
      setError(null);

      try {
        Papa.parse(file, {
          header: true,
          preview: 5, // Only parse 5 rows for the preview
          skipEmptyLines: true,
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              setPreviewData(results.data);

              // Extract column names and create column config
              const headers =
                results.meta.fields || Object.keys(results.data[0]);
              const columnConfigs = headers.map((header, index) => ({
                id: `col-${index}`,
                originalName: header,
                displayName: header,
                selected: false,
                merged: false,
                mergedWith: [],
              }));

              setColumns(columnConfigs);
            } else {
              setError("No data found in the file");
            }
            setLoading(false);
          },
          error: (err) => {
            setError(`Error parsing CSV: ${err.message}`);
            setLoading(false);
          },
        });
      } catch (err) {
        setError(
          `Error parsing file: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        setLoading(false);
      }
    };

    parseFile();
  }, [file]);

  // Move column (reorder)
  const moveColumn = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const draggedColumn = columns[dragIndex];
      const newColumns = [...columns];
      newColumns.splice(dragIndex, 1);
      newColumns.splice(hoverIndex, 0, draggedColumn);
      setColumns(newColumns);
    },
    [columns]
  );

  // Toggle column selection for merge
  const toggleColumnSelection = useCallback((id: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(id)) {
        return prev.filter((colId) => colId !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  // Start merge mode
  const startMerge = useCallback(
    (id: string) => {
      setIsMergeMode(true);
      setPrimaryMergeColumn(id);
      setSelectedColumns([id]);

      // Set initial merge name based on the primary column
      const column = columns.find((col) => col.id === id);
      if (column) {
        setMergeColumnName(column.displayName);
      }
    },
    [columns]
  );

  // Cancel merge mode
  const cancelMerge = useCallback(() => {
    setIsMergeMode(false);
    setSelectedColumns([]);
    setPrimaryMergeColumn(null);
    setMergeColumnName("");
  }, []);

  // Complete merge
  const completeMerge = useCallback(() => {
    if (
      selectedColumns.length < 2 ||
      !primaryMergeColumn ||
      !mergeColumnName.trim()
    ) {
      return;
    }

    setColumns((prevColumns) => {
      const newColumns = [...prevColumns];

      // Find the primary column
      const primaryColumnIndex = newColumns.findIndex(
        (col) => col.id === primaryMergeColumn
      );

      if (primaryColumnIndex === -1) return prevColumns;

      // Update the primary column
      newColumns[primaryColumnIndex] = {
        ...newColumns[primaryColumnIndex],
        displayName: mergeColumnName.trim(),
        merged: true,
        mergedWith: selectedColumns.filter((id) => id !== primaryMergeColumn),
      };

      // Mark other selected columns as merged
      selectedColumns.forEach((colId) => {
        if (colId !== primaryMergeColumn) {
          const colIndex = newColumns.findIndex((col) => col.id === colId);
          if (colIndex !== -1) {
            newColumns[colIndex] = {
              ...newColumns[colIndex],
              merged: true,
              mergedWith: [primaryMergeColumn],
            };
          }
        }
      });

      return newColumns;
    });

    // Reset merge state
    setIsMergeMode(false);
    setSelectedColumns([]);
    setPrimaryMergeColumn(null);
    setMergeColumnName("");
  }, [selectedColumns, primaryMergeColumn, mergeColumnName]);

  // Generate mapping and complete
  const completeMapping = useCallback(() => {
    // Create mapping from file columns to schema columns
    const mapping: Record<string, string> = {};

    columns.forEach((column) => {
      if (!column.merged || (column.merged && column.mergedWith.length > 0)) {
        mapping[column.originalName] = column.displayName;

        // If this is a merged column, add mappings for all merged columns
        if (column.merged && column.mergedWith.length > 0) {
          column.mergedWith.forEach((mergedColId) => {
            const mergedCol = columns.find((c) => c.id === mergedColId);
            if (mergedCol) {
              mapping[mergedCol.originalName] = column.displayName;
            }
          });
        }
      }
    });

    if (onMappingComplete) {
      onMappingComplete(mapping);
    }
  }, [columns, onMappingComplete]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary mx-auto"></div>
        <p className="mt-4 text-gray-300">Loading preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 mx-auto"
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
        </div>
        <p className="text-red-500">{error}</p>
        <Button variant="secondary" className="mt-4" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="bg-ui-primary rounded-lg overflow-hidden">
        <div className="p-4 border-b border-ui-border">
          <h2 className="text-lg font-medium text-gray-200">
            Preview: {file.name}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Drag columns to reorder or merge them before importing
          </p>
        </div>

        {isMergeMode && (
          <div className="p-4 bg-accent-primary/10 border-b border-ui-border">
            <h3 className="text-sm font-medium text-gray-200 mb-2">
              Merge Columns
            </h3>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={mergeColumnName}
                onChange={(e) => setMergeColumnName(e.target.value)}
                placeholder="Enter merged column name"
                className="flex-1 px-3 py-2 bg-ui-secondary border border-ui-border rounded-md text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={completeMerge}
                disabled={selectedColumns.length < 2 || !mergeColumnName.trim()}
              >
                Merge
              </Button>
              <Button variant="secondary" size="sm" onClick={cancelMerge}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Select columns to merge and provide a name for the merged column
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ui-border">
            <thead className="bg-ui-secondary">
              <tr>
                {columns.map((column, index) => (
                  <th key={column.id} className="sticky top-0 bg-ui-secondary">
                    <ColumnHeader
                      column={column}
                      index={index}
                      moveColumn={moveColumn}
                      toggleColumnSelection={toggleColumnSelection}
                      startMerge={startMerge}
                      isMergeMode={isMergeMode}
                      isSelected={selectedColumns.includes(column.id)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-ui-primary divide-y divide-ui-border">
              {previewData.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {columns.map((column) => (
                    <td
                      key={`${rowIndex}-${column.id}`}
                      className={`px-3 py-2 text-sm text-gray-300 ${
                        column.merged && column.mergedWith.length === 0
                          ? "opacity-50"
                          : ""
                      }`}
                    >
                      {row[column.originalName]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-ui-border flex justify-between">
          <div>
            <p className="text-xs text-gray-400">
              Showing preview of first 5 rows
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={completeMapping}
              disabled={isMergeMode}
            >
              Import with these settings
            </Button>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default CsvPreview;
