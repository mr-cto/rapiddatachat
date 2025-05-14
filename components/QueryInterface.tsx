import React, { useState, useEffect, useRef } from "react";
import { NLToSQLQuery, NLToSQLResult, NLToSQLHistory } from "./NLToSQLQuery";
import {
  ViewStateManager,
  createViewStateManager,
} from "../lib/viewStateManager";
import { GlobalSchema, SchemaService } from "../lib/schemaManagement";
import schemaService from "../lib/schemaManagement";

interface QueryInterfaceProps {
  user?: {
    email: string;
    name?: string;
    id?: string;
  };
}

/**
 * QueryInterface component that integrates the NL-to-SQL query components
 * This component serves as the main entry point for the natural language query interface
 * @param props Component props
 * @returns JSX.Element
 */
export const QueryInterface: React.FC<QueryInterfaceProps> = ({ user }) => {
  // State for query and results
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sqlQuery: string;
    explanation: string;
    results: Record<string, unknown>[];
    executionTime?: number;
    totalRows?: number;
    totalPages?: number;
    currentPage?: number;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      query: string;
      sqlQuery: string;
      timestamp: Date;
      status?: string;
      executionTime?: number;
      error?: string;
    }>
  >([]);

  // Pagination, sorting, and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentQuery, setCurrentQuery] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(
    {}
  );
  const [showSql, setShowSql] = useState<boolean>(true);

  // Schema state
  const [activeSchema, setActiveSchema] = useState<GlobalSchema | null>(null);
  const [showSchemaInfo, setShowSchemaInfo] = useState<boolean>(false);

  // View state management
  const viewStateManagerRef = useRef<ViewStateManager | null>(null);
  const schemaServiceRef = useRef<typeof schemaService | null>(null);

  // Initialize view state manager and fetch query history on page load
  useEffect(() => {
    // Initialize view state manager with user ID
    if (user?.email && !viewStateManagerRef.current) {
      viewStateManagerRef.current = createViewStateManager(user.email);

      // Initialize pagination from view state
      const viewState = viewStateManagerRef.current.getViewState();
      setCurrentPage(viewState.currentPage);
      setPageSize(viewState.pageSize);

      // Initialize sorting from view state
      if (viewState.sortConfig.length > 0) {
        const latestSort = viewState.sortConfig.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0];
        setSortColumn(latestSort.column);
        setSortDirection(latestSort.direction);
      }

      // Initialize filters from view state
      const filtersObj: Record<string, unknown> = {};
      viewState.filters.forEach((filter) => {
        filtersObj[filter.column] = filter.value;
      });
      setActiveFilters(filtersObj);
    }

    // Initialize schema service
    if (user?.id && !schemaServiceRef.current) {
      schemaServiceRef.current = schemaService;
      fetchActiveSchema(user.id);
    }

    fetchQueryHistory();
  }, [user?.email, user?.id]);

  /**
   * Fetch active schema for the user
   * @param userId User ID
   */
  const fetchActiveSchema = async (userId: string) => {
    try {
      if (!schemaServiceRef.current) {
        schemaServiceRef.current = schemaService;
      }

      // Get schemas for the user's project
      // Note: This is a simplified approach - in a real app, you'd need to get the user's project ID first
      const projectId = userId; // Using userId as projectId for simplicity
      const schemas = await schemaServiceRef.current.getGlobalSchemasForProject(
        projectId
      );

      // Find the active schema
      const active = schemas.find((schema: GlobalSchema) => schema.isActive);

      if (active) {
        setActiveSchema(active);

        // Apply schema to view state if available
        if (viewStateManagerRef.current) {
          // Apply schema columns to view state by setting non-hidden columns
          // Since there's no direct method to set available columns, we're not hiding any columns
          viewStateManagerRef.current.setHiddenColumns([]);
        }
      }
    } catch (error) {
      console.error("Error fetching active schema:", error);
    }
  };

  /**
   * Fetch query history from the API
   */
  const fetchQueryHistory = async () => {
    try {
      const response = await fetch("/api/query-history");
      if (!response.ok) {
        throw new Error("Failed to fetch query history");
      }
      const data = await response.json();
      setHistory(data.history);
    } catch (error) {
      console.error("Error fetching query history:", error);
    }
  };

  /**
   * Handle query submission
   * @param query Natural language query
   * @param options Query options
   */
  const handleSubmit = async (
    query: string,
    options?: { pageSize?: number }
  ) => {
    setIsLoading(true);
    setError(null);

    // Reset pagination when submitting a new query
    if (query !== currentQuery) {
      setCurrentPage(1);
      setCurrentQuery(query);
      setSortColumn(null);
      setSortDirection("asc");
      setActiveFilters({});

      // Reset view state for new query if it's significantly different
      if (
        viewStateManagerRef.current &&
        !query.includes(currentQuery) &&
        currentQuery.length > 0
      ) {
        viewStateManagerRef.current.resetViewState();

        // Re-apply schema to view state if available
        if (activeSchema && viewStateManagerRef.current) {
          // Apply schema columns to view state by setting non-hidden columns
          viewStateManagerRef.current.setHiddenColumns([]);
        }
      }
    }

    // Update page size if provided
    if (options?.pageSize) {
      setPageSize(options.pageSize);

      // Update view state pagination
      if (viewStateManagerRef.current) {
        viewStateManagerRef.current.setPagination(
          currentPage,
          options.pageSize
        );
      }
    }

    try {
      const queryOptions = {
        page: currentPage,
        pageSize,
        sortColumn,
        sortDirection,
        filters: activeFilters,
      };

      const response = await fetch("/api/nl-to-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          ...queryOptions,
          // Include view state information if available
          viewState: viewStateManagerRef.current
            ? JSON.stringify(viewStateManagerRef.current.getViewState())
            : undefined,
          // Include active schema if available
          schemaId: activeSchema?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process query");
      }

      if (data.error) {
        setError(data.error);
      } else {
        setResult({
          sqlQuery: data.sqlQuery,
          explanation: data.explanation,
          results: data.results,
          executionTime: data.executionTime,
          totalRows: data.totalRows,
          totalPages: data.totalPages,
          currentPage: data.currentPage,
        });

        // Update view state with new query information
        if (viewStateManagerRef.current && data.sqlQuery) {
          // Extract base table from SQL query
          const tableMatch = data.sqlQuery.match(/FROM\s+([^\s;]+)/i);
          const baseTable = tableMatch ? tableMatch[1] : "";

          // Set base query in view state
          viewStateManagerRef.current.setBaseQuery(data.sqlQuery, baseTable);

          // Extract and apply virtual columns from the query
          viewStateManagerRef.current.applyVirtualColumnsFromQuery(
            query,
            data.sqlQuery
          );
        }
      }

      // Refresh query history
      fetchQueryHistory();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle page change
   * @param page Page number
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);

    // Update view state pagination
    if (viewStateManagerRef.current) {
      viewStateManagerRef.current.setPagination(page, pageSize);
    }

    if (currentQuery) {
      // Show loading state
      setIsLoading(true);

      // Use a timeout to prevent UI flickering for fast queries
      setTimeout(async () => {
        try {
          const queryOptions = {
            page,
            pageSize,
            sortColumn,
            sortDirection,
            filters: activeFilters,
          };

          const response = await fetch("/api/nl-to-sql", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: currentQuery,
              ...queryOptions,
              // Include view state information if available
              viewState: viewStateManagerRef.current
                ? JSON.stringify(viewStateManagerRef.current.getViewState())
                : undefined,
              // Include active schema if available
              schemaId: activeSchema?.id,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to process query");
          }

          if (data.error) {
            setError(data.error);
          } else {
            setResult({
              sqlQuery: data.sqlQuery,
              explanation: data.explanation,
              results: data.results,
              executionTime: data.executionTime,
              totalRows: data.totalRows,
              totalPages: data.totalPages,
              currentPage: data.currentPage,
            });
          }
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "An unknown error occurred"
          );
        } finally {
          setIsLoading(false);
        }
      }, 100);
    }
  };

  /**
   * Handle sort change
   * @param column Column to sort by
   * @param direction Sort direction
   */
  const handleSortChange = (column: string, direction: "asc" | "desc") => {
    setSortColumn(column);
    setSortDirection(direction);

    // Update view state sorting
    if (viewStateManagerRef.current) {
      viewStateManagerRef.current.setSort(column, direction);
    }

    if (currentQuery) {
      // Reset to first page when sorting changes
      setCurrentPage(1);

      // Update view state pagination
      if (viewStateManagerRef.current) {
        viewStateManagerRef.current.setPagination(1, pageSize);
      }

      // Show loading state
      setIsLoading(true);

      // Use a timeout to prevent UI flickering for fast queries
      setTimeout(async () => {
        try {
          const queryOptions = {
            page: 1, // Reset to first page
            pageSize,
            sortColumn: column,
            sortDirection: direction,
            filters: activeFilters,
          };

          const response = await fetch("/api/nl-to-sql", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: currentQuery,
              ...queryOptions,
              // Include view state information if available
              viewState: viewStateManagerRef.current
                ? JSON.stringify(viewStateManagerRef.current.getViewState())
                : undefined,
              // Include active schema if available
              schemaId: activeSchema?.id,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to process query");
          }

          if (data.error) {
            setError(data.error);
          } else {
            setResult({
              sqlQuery: data.sqlQuery,
              explanation: data.explanation,
              results: data.results,
              executionTime: data.executionTime,
              totalRows: data.totalRows,
              totalPages: data.totalPages,
              currentPage: data.currentPage || 1,
            });
          }
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "An unknown error occurred"
          );
        } finally {
          setIsLoading(false);
        }
      }, 100);
    }
  };

  /**
   * Handle applying filters
   * @param filters Filters to apply
   */
  const handleApplyFilters = (filters: Record<string, unknown>) => {
    setActiveFilters(filters);

    // Update view state filters
    if (viewStateManagerRef.current) {
      // Clear existing filters
      Object.keys(activeFilters).forEach((column) => {
        viewStateManagerRef.current?.removeFilter(column);
      });

      // Add new filters
      Object.entries(filters).forEach(([column, value]) => {
        viewStateManagerRef.current?.addFilter(column, value, "equals");
      });
    }

    if (currentQuery) {
      // Reset to first page when filters change
      setCurrentPage(1);

      // Update view state pagination
      if (viewStateManagerRef.current) {
        viewStateManagerRef.current.setPagination(1, pageSize);
      }

      // Show loading state
      setIsLoading(true);

      // Use a timeout to prevent UI flickering for fast queries
      setTimeout(async () => {
        try {
          const queryOptions = {
            page: 1, // Reset to first page
            pageSize,
            sortColumn,
            sortDirection,
            filters,
          };

          const response = await fetch("/api/nl-to-sql", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: currentQuery,
              ...queryOptions,
              // Include view state information if available
              viewState: viewStateManagerRef.current
                ? JSON.stringify(viewStateManagerRef.current.getViewState())
                : undefined,
              // Include active schema if available
              schemaId: activeSchema?.id,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to process query");
          }

          if (data.error) {
            setError(data.error);
          } else {
            setResult({
              sqlQuery: data.sqlQuery,
              explanation: data.explanation,
              results: data.results,
              executionTime: data.executionTime,
              totalRows: data.totalRows,
              totalPages: data.totalPages,
              currentPage: data.currentPage || 1,
            });
          }
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "An unknown error occurred"
          );
        } finally {
          setIsLoading(false);
        }
      }, 100);
    }
  };

  /**
   * Handle selecting a query from history
   * @param query Natural language query
   */
  const handleSelectQuery = (query: string) => {
    handleSubmit(query);
  };

  /**
   * Toggle SQL visibility
   */
  const toggleSqlVisibility = () => {
    setShowSql(!showSql);
  };

  /**
   * Toggle schema info visibility
   */
  const toggleSchemaInfo = () => {
    setShowSchemaInfo(!showSchemaInfo);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="mt-2 text-sm text-gray-600">
            Ask questions about your data in plain English
          </p>
          {user && (
            <p className="mt-1 text-sm text-gray-500">
              Logged in as: {user.name || user.email}
            </p>
          )}

          {/* Active Schema Info */}
          {activeSchema && (
            <div className="mt-2 flex items-center">
              <span className="text-sm text-indigo-600 font-medium">
                Active Schema: {activeSchema.name}
              </span>
              <button
                onClick={toggleSchemaInfo}
                className="ml-2 text-xs text-indigo-500 hover:text-indigo-700"
              >
                {showSchemaInfo ? "Hide Details" : "Show Details"}
              </button>
            </div>
          )}

          {/* Schema Details */}
          {activeSchema && showSchemaInfo && (
            <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-md">
              <h4 className="text-sm font-medium text-indigo-800">
                Schema: {activeSchema.name}
              </h4>
              {activeSchema.description && (
                <p className="text-xs text-indigo-700 mt-1">
                  {activeSchema.description}
                </p>
              )}
              <div className="mt-2">
                <h5 className="text-xs font-medium text-indigo-800">
                  Columns:
                </h5>
                <div className="mt-1 max-h-40 overflow-y-auto">
                  <table className="min-w-full divide-y divide-indigo-200 text-xs">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-2 py-1 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-2 py-1 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">
                          Required
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-100">
                      {activeSchema.columns.map((column, index) => (
                        <tr key={index}>
                          <td className="px-2 py-1 whitespace-nowrap text-indigo-800">
                            {column.name}
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap text-indigo-600">
                            {column.type}
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap text-indigo-600">
                            {column.isRequired ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Query Input */}
          <NLToSQLQuery onSubmit={handleSubmit} isLoading={isLoading} />

          {/* SQL Toggle */}
          {result && result.sqlQuery && (
            <div className="flex justify-end">
              <button
                onClick={toggleSqlVisibility}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                {showSql ? "Hide SQL" : "Show SQL"}
              </button>
            </div>
          )}

          {/* Query Results */}
          {result && (
            <NLToSQLResult
              sqlQuery={showSql ? result.sqlQuery : ""}
              explanation={result.explanation}
              results={result.results}
              onPageChange={handlePageChange}
              onSortChange={handleSortChange}
              onApplyFilters={handleApplyFilters}
              currentPage={result.currentPage || currentPage}
              totalPages={result.totalPages || 1}
              totalRows={result.totalRows || 0}
              executionTime={result.executionTime}
              viewStateManager={viewStateManagerRef.current || undefined}
            />
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error processing query
                  </h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Query History */}
          <NLToSQLHistory history={history} onSelectQuery={handleSelectQuery} />
        </div>
      </div>
    </div>
  );
};

export default QueryInterface;
