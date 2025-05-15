import React, { useState } from "react";
import Link from "next/link";
import { FilterControls } from "./FilterControls";
import { ShareQueryResults } from "./ShareQueryResults";
import { DataTable } from "./DataTable";

interface NLToSQLQueryProps {
  onSubmit: (query: string, options?: QueryOptions) => void;
  isLoading: boolean;
  savedQueries?: string[];
  selectedFileId?: string;
}

interface QueryOptions {
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  filters?: Record<string, unknown>;
  fileId?: string;
}

/**
 * NLToSQLQuery component for the natural language to SQL query interface
 * @param props Component props
 * @returns JSX.Element
 */
export const NLToSQLQuery: React.FC<NLToSQLQueryProps> = ({
  onSubmit,
  isLoading,
  selectedFileId,
}) => {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(100);

  // Example queries for common data operations
  const exampleQueries = [
    "Extract first name, last name, email and domain from all email addresses",
    "Show me the top 10 rows sorted by the first column",
    "Count the number of rows in the table",
    "List all unique domains from the email addresses",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query, { pageSize, fileId: selectedFileId });
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  return (
    <div className="w-full bg-primary text-black">
      <form onSubmit={handleSubmit} className="flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your data..."
          className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className={`p-2 rounded-r-md text-white ${
            isLoading || !query.trim()
              ? "bg-gray-400"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isLoading ? (
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

import { ViewStateManager } from "../lib/viewStateManager";

interface NLToSQLResultProps {
  sqlQuery: string;
  explanation: string;
  results: Record<string, unknown>[];
  error?: string;
  executionTime?: number;
  totalRows?: number;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onSortChange?: (column: string, direction: "asc" | "desc") => void;
  onApplyFilters?: (filters: Record<string, unknown>) => void;
  filters?: Record<string, unknown>;
  viewStateManager?: ViewStateManager;
}

/**
 * NLToSQLResult component for displaying the results of a natural language query
 * @param props Component props
 * @returns JSX.Element
 */
export const NLToSQLResult: React.FC<NLToSQLResultProps> = ({
  sqlQuery,
  explanation,
  results,
  error,
  executionTime,
  totalRows,
  totalPages,
  currentPage = 1,
  onPageChange,
  onSortChange,
  onApplyFilters,
  filters = {},
  viewStateManager,
}) => {
  // State for sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // If there's no SQL query, don't render anything
  if (!sqlQuery && !error) {
    return null;
  }

  // Handle sort click
  const handleSortClick = (column: string) => {
    const newDirection =
      sortColumn === column && sortDirection === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortDirection(newDirection);

    if (onSortChange) {
      onSortChange(column, newDirection);
    }
  };

  return (
    <div
      className="w-full max-w-4xl mx-auto p-4 bg-ui-primary dark:bg-ui-primary rounded-lg shadow-md mt-4 animate-fadeIn"
      style={{ maxHeight: "600px", overflowY: "auto" }}
    >
      {error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-400">
            Error
          </h3>
          <p className="text-red-700 dark:text-red-300">{error}</p>

          {error.includes("No active tables") && (
            <div className="mt-4">
              <p className="text-secondary dark:text-secondary mb-2">
                To fix this issue:
              </p>
              <ol className="list-decimal pl-5 text-secondary dark:text-secondary">
                <li className="mb-1">
                  Go to the{" "}
                  <Link
                    href="/files"
                    className="text-accent-primary hover:underline"
                  >
                    Files page
                  </Link>
                </li>
                <li className="mb-1">
                  Upload a CSV or Excel file with your data
                </li>
                <li>Return to this page to query your data</li>
              </ol>
            </div>
          )}
        </div>
      ) : (
        <>
          {sqlQuery && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2 text-black dark:text-black">
                SQL Query
              </h3>
              <pre className="p-3 bg-ui-tertiary dark:bg-ui-tertiary rounded-md overflow-x-auto">
                <code>{sqlQuery}</code>
              </pre>
              <p className="text-xs text-tertiary dark:text-tertiary mt-1">
                This is the SQL query generated from your natural language
                question.
              </p>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2 text-black dark:text-black">
              Explanation
            </h3>
            <p className="text-secondary dark:text-secondary">{explanation}</p>
          </div>

          {executionTime !== undefined && (
            <p className="text-sm text-tertiary dark:text-tertiary mb-4">
              Execution time:{" "}
              <span className="font-medium">{executionTime}ms</span>
            </p>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium text-black dark:text-black">
                Results
              </h3>
              <div className="flex items-center space-x-4">
                {totalRows !== undefined && (
                  <span className="text-sm text-tertiary dark:text-tertiary">
                    <span className="font-medium">{totalRows}</span> total{" "}
                    {totalRows === 1 ? "result" : "results"}
                  </span>
                )}
              </div>
            </div>

            {/* Share Results Button */}
            {results.length > 0 && (
              <div className="mb-4">
                <ShareQueryResults
                  naturalLanguageQuery={explanation}
                  sqlQuery={sqlQuery}
                  results={results}
                />
              </div>
            )}

            {/* Add filter controls */}
            {results.length > 0 && onApplyFilters && (
              <FilterControls
                columns={Object.keys(results[0])}
                onApplyFilters={onApplyFilters}
                onClearFilters={() => onApplyFilters({})}
                initialFilters={filters}
              />
            )}

            {results.length === 0 ? (
              <p className="text-secondary dark:text-secondary">
                No results found
              </p>
            ) : (
              <DataTable
                data={results}
                onSortChange={onSortChange}
                initialSortColumn={sortColumn || undefined}
                initialSortDirection={sortDirection}
                onPageChange={onPageChange}
                currentPage={currentPage}
                totalPages={totalPages}
                totalRows={totalRows}
                serverSideSort={!!onSortChange}
                viewStateManager={viewStateManager}
              />
            )}

            {/* Pagination controls are now handled by the DataTable component */}
          </div>
        </>
      )}
    </div>
  );
};

interface NLToSQLHistoryProps {
  history: Array<{
    id: string;
    query: string;
    sqlQuery: string;
    timestamp: Date;
    status?: string;
    executionTime?: number;
    error?: string;
  }>;
  onSelectQuery: (query: string) => void;
}

/**
 * NLToSQLHistory component for displaying the history of natural language queries
 * @param props Component props
 * @returns JSX.Element
 */
export const NLToSQLHistory: React.FC<NLToSQLHistoryProps> = ({
  history,
  onSelectQuery,
}) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <div
      className="w-full max-w-4xl mx-auto p-4 bg-ui-primary dark:bg-ui-primary rounded-lg shadow-md mt-4"
      style={{ maxHeight: "400px", overflowY: "auto" }}
    >
      <h3 className="text-lg font-medium mb-2 text-black dark:text-black">
        Recent Queries
      </h3>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {history.map((item) => (
          <li key={item.id} className="py-3">
            <button
              onClick={() => onSelectQuery(item.query)}
              className="text-left w-full hover:bg-ui-secondary dark:hover:bg-ui-secondary p-2 rounded-md"
            >
              <p className="text-accent-primary font-medium">{item.query}</p>
              <p className="text-sm text-tertiary dark:text-tertiary">
                {new Date(item.timestamp).toLocaleString()}
                {item.executionTime !== undefined &&
                  ` • ${item.executionTime}ms`}
                {item.status && ` • ${item.status}`}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
