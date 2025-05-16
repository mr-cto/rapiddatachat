import React, { useState, useEffect } from "react";
import { ViewStateManager } from "../lib/viewStateManager";

interface DataTableProps {
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
  visibleColumns?: string[];
  viewStateManager?: ViewStateManager;
}

/**
 * Reusable DataTable component for displaying tabular data with sortable columns
 * and column selection functionality
 */
export const DataTable: React.FC<DataTableProps> = ({
  data,
  onSortChange,
  initialSortColumn = null,
  initialSortDirection = "asc",
  onPageChange,
  currentPage = 1,
  totalPages,
  totalRows,
  serverSideSort = false,
  className = "",
  visibleColumns: propVisibleColumns,
  viewStateManager,
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(
    initialSortColumn
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    initialSortDirection
  );
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  // Load hidden columns from viewStateManager on initial render
  useEffect(() => {
    if (viewStateManager) {
      const state = viewStateManager.getViewState();
      const allColumns = getAllUniqueColumns();

      if (state.hiddenColumns && state.hiddenColumns.length > 0) {
        // Convert hidden columns to visible columns
        const calculatedVisibleColumns = allColumns.filter(
          (col) => !state.hiddenColumns.includes(col)
        );
        setVisibleColumns(calculatedVisibleColumns);
      }
    }
  }, [viewStateManager]);

  // Helper function to get all unique columns from data
  const getAllUniqueColumns = () => {
    if (!flattenedData || flattenedData.length === 0) return [];

    const allKeys = new Set<string>();
    flattenedData.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "data") {
          allKeys.add(key);
        }
      });
    });

    return Array.from(allKeys);
  };
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [displayData, setDisplayData] = useState<Record<string, unknown>[]>([]);
  const [flattenedData, setFlattenedData] = useState<Record<string, unknown>[]>(
    []
  );

  // Log data structure for debugging
  useEffect(() => {
    if (data && data.length > 0) {
      console.log("DataTable received data:", data);
      console.log("First row:", data[0]);

      // Check if data has a nested 'data' property
      if (data[0] && typeof data[0] === "object" && data[0].data) {
        console.log("Found nested data property:", data[0].data);
      }

      // Check for merged columns
      const mergedColumns = Object.keys(data[0]).filter(
        (key) => !propVisibleColumns || !propVisibleColumns.includes(key)
      );

      if (mergedColumns.length > 0) {
        console.log("Found potential merged columns:", mergedColumns);
      }
    }
  }, [data, propVisibleColumns]);

  // Set flattened data directly from input data
  useEffect(() => {
    if (data && data.length > 0) {
      console.log("Setting flattened data from input data");
      setFlattenedData(data);
    } else {
      setFlattenedData([]);
    }
  }, [data]);

  // Format cell value based on data type
  const formatCellValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      if (value === null) {
        return (
          <span className="text-tertiary dark:text-tertiary italic">null</span>
        );
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          return (
            <span className="text-tertiary dark:text-tertiary italic">[]</span>
          );
        }

        // Format arrays
        return (
          <div className="max-h-32 overflow-y-auto">
            <ul className="list-disc pl-4 text-xs">
              {value.map((item, i) => (
                <li key={i} className="mb-1">
                  {formatCellValue(item)}
                </li>
              ))}
            </ul>
          </div>
        );
      } else if (value instanceof Date) {
        // Format dates
        return (
          <span className="text-accent-primary">{value.toLocaleString()}</span>
        );
      } else {
        // Format objects by displaying their properties in a readable format
        try {
          const objEntries = Object.entries(value as Record<string, unknown>);
          if (objEntries.length === 0) {
            return (
              <span className="text-tertiary dark:text-tertiary italic">
                {"{}"}
              </span>
            );
          }

          return (
            <div className="max-h-32 overflow-y-auto">
              <table className="text-xs w-full border-collapse">
                <tbody>
                  {objEntries.map(([key, val], i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 dark:border-gray-700"
                    >
                      <td className="pr-2 font-medium text-accent-primary">
                        {key}:
                      </td>
                      <td className="py-1">
                        {typeof val === "object" ? (
                          val === null ? (
                            <span className="text-tertiary dark:text-tertiary italic">
                              null
                            </span>
                          ) : (
                            <span className="text-tertiary dark:text-tertiary italic">
                              {Array.isArray(val)
                                ? `[Array(${val.length})]`
                                : "{Object}"}
                            </span>
                          )
                        ) : (
                          String(val)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        } catch {
          return (
            <span className="italic text-tertiary dark:text-tertiary">
              {JSON.stringify(value)}
            </span>
          );
        }
      }
    }

    // Format numbers with thousands separators
    if (typeof value === "number") {
      return (
        <span className="font-mono">
          {new Intl.NumberFormat().format(value)}
        </span>
      );
    }

    // Format booleans
    if (typeof value === "boolean") {
      return (
        <span
          className={
            value
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          {value ? "Yes" : "No"}
        </span>
      );
    }

    // Empty string
    if (value === "") {
      return (
        <span className="text-tertiary dark:text-tertiary italic">(empty)</span>
      );
    }

    // Default string representation
    return String(value);
  };

  // Initialize visible columns from props, viewStateManager, or flattened data
  useEffect(() => {
    if (flattenedData && flattenedData.length > 0) {
      const allColumnsArray = getAllUniqueColumns();
      console.log("All available columns:", allColumnsArray);

      // Priority: 1. propVisibleColumns, 2. viewStateManager, 3. all columns
      if (propVisibleColumns && propVisibleColumns.length > 0) {
        // Strictly use only the provided visible columns
        console.log("Using provided visible columns:", propVisibleColumns);

        // Filter to ensure we only show columns that actually exist in the data
        const validVisibleColumns = propVisibleColumns.filter((col) =>
          allColumnsArray.includes(col)
        );

        setVisibleColumns(validVisibleColumns);

        // Also update viewStateManager
        if (viewStateManager) {
          const hiddenColumns = allColumnsArray.filter(
            (col) => !validVisibleColumns.includes(col)
          );
          viewStateManager.setHiddenColumns(hiddenColumns);
        }
      } else if (viewStateManager) {
        // Check if we already loaded from viewStateManager
        const state = viewStateManager.getViewState();
        if (state.hiddenColumns && state.hiddenColumns.length > 0) {
          // We've already set this in the first useEffect, so don't override
        } else {
          // No hidden columns in viewStateManager, use all columns
          setVisibleColumns(allColumnsArray);
        }
      } else {
        // No visible columns provided or viewStateManager, use all columns
        setVisibleColumns(allColumnsArray);
      }
    }
  }, [flattenedData, propVisibleColumns]);

  // Update display data when flattened data changes
  useEffect(() => {
    if (!serverSideSort || !sortColumn) {
      setDisplayData(flattenedData);
      return;
    }

    // Client-side sorting
    const sortedData = [...flattenedData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aString = String(aValue || "");
      const bString = String(bValue || "");

      return sortDirection === "asc"
        ? aString.localeCompare(bString)
        : bString.localeCompare(aString);
    });

    setDisplayData(sortedData);
  }, [flattenedData, sortColumn, sortDirection, serverSideSort]);

  // Handle sort click
  const handleSortClick = (column: string) => {
    const newDirection =
      sortColumn === column && sortDirection === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortDirection(newDirection);

    if (onSortChange && serverSideSort) {
      onSortChange(column, newDirection);
    }
  };

  // Toggle column visibility
  const toggleColumnVisibility = (column: string) => {
    if (visibleColumns.includes(column)) {
      // Don't allow hiding all columns
      if (visibleColumns.length > 1) {
        const newVisibleColumns = visibleColumns.filter(
          (col) => col !== column
        );
        setVisibleColumns(newVisibleColumns);

        // Save to viewStateManager
        if (viewStateManager) {
          const allColumns = getAllUniqueColumns();
          const hiddenColumns = allColumns.filter(
            (col) => !newVisibleColumns.includes(col)
          );
          viewStateManager.setHiddenColumns(hiddenColumns);
        }
      }
    } else {
      const newVisibleColumns = [...visibleColumns, column];
      setVisibleColumns(newVisibleColumns);

      // Save to viewStateManager
      if (viewStateManager) {
        const allColumns = getAllUniqueColumns();
        const hiddenColumns = allColumns.filter(
          (col) => !newVisibleColumns.includes(col)
        );
        viewStateManager.setHiddenColumns(hiddenColumns);
      }
    }
  };

  // Reset column visibility
  const resetColumnVisibility = () => {
    if (flattenedData && flattenedData.length > 0) {
      const allColumns = getAllUniqueColumns();
      setVisibleColumns(allColumns);

      // Save to viewStateManager - all columns visible means no hidden columns
      if (viewStateManager) {
        viewStateManager.setHiddenColumns([]);
      }
    }
  };

  if (!flattenedData || flattenedData.length === 0) {
    return (
      <p className="text-secondary dark:text-secondary">No data available</p>
    );
  }

  const allColumns = visibleColumns;

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      {/* Column buttons removed as requested */}

      {/* Column selector */}
      {showColumnSelector && (
        <div className="mb-4 p-3 bg-ui-secondary dark:bg-ui-secondary rounded-md border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-secondary dark:text-secondary">
              Select visible columns
            </h4>
            <button
              onClick={resetColumnVisibility}
              className="text-xs text-accent-primary hover:text-accent-primary-hover"
            >
              Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allColumns.map((column) => (
              <label
                key={column}
                className="flex items-center space-x-2 text-sm text-secondary dark:text-secondary bg-ui-primary dark:bg-ui-primary px-2 py-1 rounded border border-gray-200 dark:border-gray-700"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column)}
                  onChange={() => toggleColumnVisibility(column)}
                  className="rounded text-accent-primary focus:ring-accent-primary"
                />
                <span>{column}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto relative">
        <table className="min-w-[1000px] divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap min-w-[150px]"
                  onClick={() => handleSortClick(column)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column}</span>
                    {sortColumn === column && (
                      <span className="ml-1">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-ui-primary dark:bg-ui-primary divide-y divide-gray-200 dark:divide-gray-700">
            {displayData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-ui-secondary dark:hover:bg-ui-secondary"
              >
                {visibleColumns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap min-w-[150px]"
                  >
                    {formatCellValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages && totalPages > 1 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between bg-ui-primary p-4 border-t border-ui-border">
          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
            <span className="text-sm text-gray-300">
              Showing page {currentPage} of {totalPages}
              {totalRows !== undefined && ` (${totalRows} total results)`}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange && onPageChange(1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 rounded-md text-sm ${
                currentPage === 1
                  ? "bg-ui-tertiary text-muted cursor-not-allowed"
                  : "bg-ui-tertiary text-secondary dark:text-secondary hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              aria-label="First page"
              title="First page"
            >
              <span aria-hidden="true">«</span>
            </button>

            <button
              onClick={() => {
                if (onPageChange) {
                  // Save current page to viewStateManager before changing
                  if (viewStateManager) {
                    viewStateManager.setPagination(
                      currentPage - 1,
                      viewStateManager.getViewState().pageSize
                    );
                  }
                  onPageChange(currentPage - 1);
                }
              }}
              disabled={currentPage === 1}
              className={`px-2 py-1 rounded-md text-sm ${
                currentPage === 1
                  ? "bg-ui-tertiary text-muted cursor-not-allowed"
                  : "bg-ui-tertiary text-secondary dark:text-secondary hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              aria-label="Previous page"
              title="Previous page"
            >
              <span aria-hidden="true">‹</span>
            </button>

            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Calculate page numbers to show (centered around current page)
              let pageNum;
              if (totalPages <= 5) {
                // Show all pages if 5 or fewer
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                // Show first 5 pages
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                // Show last 5 pages
                pageNum = totalPages - 4 + i;
              } else {
                // Show 2 pages before and after current page
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => {
                    if (onPageChange) {
                      // Save current page to viewStateManager before changing
                      if (viewStateManager) {
                        viewStateManager.setPagination(
                          pageNum,
                          viewStateManager.getViewState().pageSize
                        );
                      }
                      onPageChange(pageNum);
                    }
                  }}
                  disabled={pageNum === currentPage}
                  className={`px-3 py-1 rounded-md text-sm ${
                    pageNum === currentPage
                      ? "bg-accent-primary text-white"
                      : "bg-ui-tertiary text-secondary dark:text-secondary hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                  aria-label={`Page ${pageNum}`}
                  title={`Page ${pageNum}`}
                  aria-current={pageNum === currentPage ? "page" : undefined}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => {
                if (onPageChange) {
                  // Save current page to viewStateManager before changing
                  if (viewStateManager) {
                    viewStateManager.setPagination(
                      currentPage + 1,
                      viewStateManager.getViewState().pageSize
                    );
                  }
                  onPageChange(currentPage + 1);
                }
              }}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 rounded-md text-sm ${
                currentPage === totalPages
                  ? "bg-ui-tertiary text-muted cursor-not-allowed"
                  : "bg-ui-tertiary text-secondary dark:text-secondary hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              aria-label="Next page"
              title="Next page"
            >
              <span aria-hidden="true">›</span>
            </button>

            <button
              onClick={() => {
                if (onPageChange) {
                  // Save current page to viewStateManager before changing
                  if (viewStateManager) {
                    viewStateManager.setPagination(
                      totalPages,
                      viewStateManager.getViewState().pageSize
                    );
                  }
                  onPageChange(totalPages);
                }
              }}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 rounded-md text-sm ${
                currentPage === totalPages
                  ? "bg-ui-tertiary text-muted cursor-not-allowed"
                  : "bg-ui-tertiary text-secondary dark:text-secondary hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              aria-label="Last page"
              title="Last page"
            >
              <span aria-hidden="true">»</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
