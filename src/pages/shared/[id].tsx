import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { DataTable } from "../../../components/DataTable";
import { ColumnMergeManager } from "../../../components/ColumnMergeManager";

interface SharedQueryData {
  id: string;
  naturalLanguageQuery: string;
  sqlQuery: string;
  results: Record<string, unknown>[];
  timestamp: Date;
  executionTime?: number;
  userId?: string;
  expiresAt?: Date;
  accessCount?: number;
  columnMerges?: {
    id: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }[];
}

/**
 * SharedQueryPage component for displaying shared query results
 * @param props Component props
 * @returns JSX.Element
 */
export default function SharedQueryPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryData, setQueryData] = useState<SharedQueryData | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch shared query data
  useEffect(() => {
    if (!id) return;

    const fetchSharedQuery = async () => {
      try {
        setLoading(true);

        // Fetch shared query data from API
        const response = await fetch(`/api/shared/${id}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load shared query");
        }

        const data = await response.json();

        // Convert timestamp string to Date object if needed
        if (typeof data.timestamp === "string") {
          data.timestamp = new Date(data.timestamp);
        }

        setQueryData(data);
        setError(null);
      } catch (error) {
        console.error("Error fetching shared query:", error);
        setError(
          "Failed to load shared query. The link may be invalid or expired."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSharedQuery();
  }, [id]);

  // Handle sort click
  const handleSortClick = (column: string) => {
    const newDirection =
      sortColumn === column && sortDirection === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortDirection(newDirection);

    if (queryData && queryData.results) {
      const sortedResults = [...queryData.results].sort((a, b) => {
        const aValue = a[column];
        const bValue = b[column];

        if (typeof aValue === "number" && typeof bValue === "number") {
          return newDirection === "asc" ? aValue - bValue : bValue - aValue;
        }

        const aString = String(aValue || "");
        const bString = String(bValue || "");

        return newDirection === "asc"
          ? aString.localeCompare(bString)
          : bString.localeCompare(aString);
      });

      setQueryData({
        ...queryData,
        results: sortedResults,
      });
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <>
      <Head>
        <title>Shared Query Results | RapidDataChat</title>
        <meta
          name="description"
          content="Shared query results from RapidDataChat"
        />
        <meta
          property="og:title"
          content="Shared Query Results | RapidDataChat"
        />
        <meta
          property="og:description"
          content="View shared query results from RapidDataChat"
        />
        <meta property="og:type" content="website" />
      </Head>

      <div className="min-h-screen bg-ui-secondary dark:bg-ui-primary py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white dark:text-white">
                Shared Query Results
              </h1>
              <p className="mt-2 text-sm text-secondary dark:text-secondary">
                These results have been shared with you
              </p>
            </div>
            <div>
              <Link
                href="/"
                className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover transition-all"
              >
                Try RapidDataChat
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="w-full max-w-4xl mx-auto p-8 bg-ui-primary dark:bg-ui-primary rounded-lg shadow-md flex justify-center items-center">
              <div className="flex flex-col items-center">
                <svg
                  className="animate-spin h-10 w-10 text-accent-primary"
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
                <p className="mt-4 text-secondary dark:text-secondary">
                  Loading shared query results...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="w-full max-w-4xl mx-auto p-4 bg-ui-primary dark:bg-ui-primary rounded-lg shadow-md">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <h3 className="text-lg font-medium text-red-800 dark:text-red-400">
                  Error
                </h3>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          ) : queryData ? (
            <div className="space-y-6">
              <div className="w-full max-w-4xl mx-auto p-4 bg-ui-primary dark:bg-ui-primary rounded-lg shadow-md animate-fadeIn">
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2 text-white dark:text-white">
                    Query
                  </h3>
                  <p className="text-secondary dark:text-secondary">
                    {queryData.naturalLanguageQuery}
                  </p>
                  <p className="text-sm text-tertiary dark:text-tertiary mt-2">
                    Shared on {formatDate(queryData.timestamp)}
                    {queryData.expiresAt && (
                      <span className="ml-2">
                        • Expires on {formatDate(queryData.expiresAt)}
                      </span>
                    )}
                    {queryData.accessCount !== undefined && (
                      <span className="ml-2">
                        • Viewed {queryData.accessCount}{" "}
                        {queryData.accessCount === 1 ? "time" : "times"}
                      </span>
                    )}
                  </p>
                </div>

                {/* <div className="mb-4">
                  <h3 className="text-lg font-medium mb-2 text-black dark:text-black">
                    SQL Query
                  </h3>
                  <pre className="p-3 bg-ui-tertiary dark:bg-ui-tertiary rounded-md overflow-x-auto">
                    <code>{queryData.sqlQuery}</code>
                  </pre>
                </div> */}

                {queryData.executionTime !== undefined && (
                  <p className="text-sm text-tertiary dark:text-tertiary mb-4">
                    Execution time:{" "}
                    <span className="font-medium">
                      {queryData.executionTime}ms
                    </span>
                  </p>
                )}

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium text-white dark:text-white">
                      Results
                    </h3>
                    <span className="text-sm text-tertiary dark:text-tertiary">
                      <span className="font-medium">
                        {queryData.results.length}
                      </span>{" "}
                      total{" "}
                      {queryData.results.length === 1 ? "result" : "results"}
                    </span>
                  </div>

                  {queryData.results.length === 0 ? (
                    <p className="text-secondary dark:text-secondary">
                      No results found
                    </p>
                  ) : (
                    <ColumnMergeManager
                      fileId="query-results"
                      data={queryData.results}
                      initialSortColumn={sortColumn || undefined}
                      initialSortDirection={sortDirection}
                      serverSideSort={false}
                      initialColumnMerges={queryData.columnMerges || []}
                    />
                  )}
                </div>
              </div>

              <div className="w-full max-w-4xl mx-auto p-4 bg-ui-primary dark:bg-ui-primary rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-black dark:text-black">
                      Powered by RapidDataChat
                    </h3>
                    <p className="text-sm text-secondary dark:text-secondary mt-1">
                      Ask questions about your data in plain English
                    </p>
                  </div>
                  <Link
                    href="/"
                    className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover transition-all"
                  >
                    Try it now
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
