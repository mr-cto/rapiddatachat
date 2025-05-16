import React, { useState, useEffect } from "react";

interface FilterControlsProps {
  columns: string[];
  onApplyFilters: (filters: Record<string, unknown>) => void;
  onClearFilters: () => void;
  initialFilters?: Record<string, unknown>;
}

interface FilterCondition {
  column: string;
  operator: string;
  value: string;
}

/**
 * Filter controls component for query results
 * @param props Component props
 * @returns JSX.Element
 */
export const FilterControls: React.FC<FilterControlsProps> = ({
  columns,
  onApplyFilters,
  onClearFilters,
  initialFilters = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [activeFilters, setActiveFilters] =
    useState<Record<string, unknown>>(initialFilters);

  // Initialize conditions from initialFilters
  useEffect(() => {
    const initialConditions: FilterCondition[] = [];

    Object.entries(initialFilters).forEach(([column, value]) => {
      if (columns.includes(column)) {
        initialConditions.push({
          column,
          operator: "equals",
          value: String(value),
        });
      }
    });

    if (initialConditions.length > 0) {
      setConditions(initialConditions);
    } else {
      // Add an empty condition if none exist
      setConditions([
        { column: columns[0] || "", operator: "equals", value: "" },
      ]);
    }
  }, [columns, initialFilters]);

  // Add a new filter condition
  const addCondition = () => {
    setConditions([
      ...conditions,
      { column: columns[0] || "", operator: "equals", value: "" },
    ]);
  };

  // Remove a filter condition
  const removeCondition = (index: number) => {
    const newConditions = [...conditions];
    newConditions.splice(index, 1);
    setConditions(newConditions);
  };

  // Update a filter condition
  const updateCondition = (
    index: number,
    field: keyof FilterCondition,
    value: string
  ) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setConditions(newConditions);
  };

  // Apply filters
  const applyFilters = () => {
    const filters: Record<string, unknown> = {};

    conditions.forEach((condition) => {
      if (condition.column && condition.value) {
        let value: unknown = condition.value;

        // Convert value based on operator
        switch (condition.operator) {
          case "equals":
            // Try to convert to number if possible
            if (!isNaN(Number(value))) {
              value = Number(value);
            }
            filters[condition.column] = value;
            break;

          case "contains":
            filters[condition.column] = { contains: value };
            break;

          case "startsWith":
            filters[condition.column] = { startsWith: value };
            break;

          case "endsWith":
            filters[condition.column] = { endsWith: value };
            break;

          case "greaterThan":
            filters[condition.column] = { gt: Number(value) || value };
            break;

          case "lessThan":
            filters[condition.column] = { lt: Number(value) || value };
            break;

          case "greaterThanOrEqual":
            filters[condition.column] = { gte: Number(value) || value };
            break;

          case "lessThanOrEqual":
            filters[condition.column] = { lte: Number(value) || value };
            break;

          case "in":
            // Split by comma and trim
            const valueStr = String(value);
            const values = valueStr
              .split(",")
              .map((v: string) => v.trim())
              .filter((v: string) => v !== "");

            filters[condition.column] = { in: values };
            break;

          default:
            filters[condition.column] = value;
        }
      }
    });

    setActiveFilters(filters);
    onApplyFilters(filters);
    setIsOpen(false);
  };

  // Clear filters
  const clearFilters = () => {
    setConditions([
      { column: columns[0] || "", operator: "equals", value: "" },
    ]);
    setActiveFilters({});
    onClearFilters();
    setIsOpen(false);
  };

  // Get operator options
  const getOperatorOptions = () => {
    // This is a simplified version. In a real app, you would determine the column type
    // from the schema or from the data itself.
    const stringOperators = [
      { value: "equals", label: "Equals" },
      { value: "contains", label: "Contains" },
      { value: "startsWith", label: "Starts with" },
      { value: "endsWith", label: "Ends with" },
      { value: "in", label: "In (comma separated)" },
    ];

    // For simplicity, we'll use string operators for all columns
    // In a real app, you would determine the column type and return the appropriate operators
    return stringOperators;
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-1 bg-accent-primary text-white rounded-md text-sm hover:bg-accent-primary-hover focus:outline-none focus:ring-2 focus:ring-accent-primary"
          >
            {isOpen ? "Hide Filters" : "Show Filters"}
          </button>

          {Object.keys(activeFilters).length > 0 && (
            <span className="text-sm text-gray-400">
              {Object.keys(activeFilters).length} active filter(s)
            </span>
          )}
        </div>

        {Object.keys(activeFilters).length > 0 && (
          <button
            onClick={clearFilters}
            className="px-3 py-1 bg-ui-tertiary text-gray-300 rounded-md text-sm hover:bg-ui-tertiary focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Clear Filters
          </button>
        )}
      </div>

      {isOpen && (
        <div className="p-4 bg-ui-secondary border border-ui-border rounded-md mb-4">
          <h3 className="text-lg font-medium mb-2 text-gray-300">
            Filter Results
          </h3>

          {conditions.map((condition, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center mb-2 space-x-2"
            >
              <select
                value={condition.column}
                onChange={(e) =>
                  updateCondition(index, "column", e.target.value)
                }
                className="px-2 py-1 border border-ui-border bg-ui-primary text-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>

              <select
                value={condition.operator}
                onChange={(e) =>
                  updateCondition(index, "operator", e.target.value)
                }
                className="px-2 py-1 border border-ui-border bg-ui-primary text-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {getOperatorOptions().map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={condition.value}
                onChange={(e) =>
                  updateCondition(index, "value", e.target.value)
                }
                placeholder="Value"
                className="px-2 py-1 border border-ui-border bg-ui-primary text-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />

              <div className="flex items-center space-x-1">
                {index > 0 && (
                  <button
                    onClick={() => removeCondition(index)}
                    className="p-1 bg-red-900/30 text-red-400 rounded-md hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    title="Remove condition"
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
                )}

                {index === conditions.length - 1 && (
                  <button
                    onClick={addCondition}
                    className="p-1 bg-green-900/30 text-green-400 rounded-md hover:bg-green-900/50 focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Add condition"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-end mt-4">
            <button
              onClick={applyFilters}
              className="px-3 py-1 bg-accent-primary text-white rounded-md text-sm hover:bg-accent-primary-hover focus:outline-none focus:ring-2 focus:ring-accent-primary"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Active filters display */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(activeFilters).map(([column, value], index) => (
            <div
              key={index}
              className="px-2 py-1 bg-accent-primary/20 text-accent-primary rounded-md text-sm flex items-center"
            >
              <span>
                {column}:{" "}
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
              <button
                onClick={() => {
                  const newFilters = { ...activeFilters };
                  delete newFilters[column];
                  setActiveFilters(newFilters);
                  onApplyFilters(newFilters);
                }}
                className="ml-2 text-accent-primary hover:text-accent-primary-hover focus:outline-none"
                title="Remove filter"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
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
  );
};
