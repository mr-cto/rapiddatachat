import React, { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import Head from "next/head";

interface CachePageProps {
  user: {
    email: string;
    name?: string;
  };
}

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

interface UserQuery {
  id: string;
  naturalLanguageQuery: string;
  timestamp: Date;
  expiresAt?: Date;
  accessCount?: number;
}

/**
 * Cache management page
 * @param props Component props
 * @returns JSX.Element
 */
export default function CachePage({ user }: CachePageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [userQueries, setUserQueries] = useState<UserQuery[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pruneCount, setPruneCount] = useState(10);

  // Fetch cache statistics on page load
  useEffect(() => {
    fetchCacheStats();
  }, []);

  /**
   * Fetch cache statistics from the API
   */
  const fetchCacheStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/cache-management");
      if (!response.ok) {
        throw new Error("Failed to fetch cache statistics");
      }

      const data = await response.json();
      setStats(data.stats);
      setUserQueries(data.userQueries || []);
    } catch (error) {
      console.error("Error fetching cache statistics:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear the cache
   */
  const clearCache = async () => {
    if (!confirm("Are you sure you want to clear the entire cache?")) {
      return;
    }

    try {
      setActionLoading(true);
      setActionMessage(null);

      const response = await fetch("/api/cache-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "clear",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear cache");
      }

      const data = await response.json();
      setActionMessage(data.message);
      fetchCacheStats();
    } catch (error) {
      console.error("Error clearing cache:", error);
      setActionMessage(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Prune the cache
   */
  const pruneCache = async () => {
    try {
      setActionLoading(true);
      setActionMessage(null);

      const response = await fetch("/api/cache-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "prune",
          count: pruneCount,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to prune cache");
      }

      const data = await response.json();
      setActionMessage(data.message);
      setStats(data.stats);
    } catch (error) {
      console.error("Error pruning cache:", error);
      setActionMessage(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Delete a shared query from the cache
   * @param id Shared query ID
   */
  const deleteSharedQuery = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shared query?")) {
      return;
    }

    try {
      setActionLoading(true);
      setActionMessage(null);

      const response = await fetch("/api/cache-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete shared query");
      }

      const data = await response.json();
      setActionMessage(data.message);
      fetchCacheStats();
    } catch (error) {
      console.error("Error deleting shared query:", error);
      setActionMessage(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Format date
   * @param date Date to format
   * @returns Formatted date string
   */
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <>
      <Head>
        <title>Cache Management | RapidDataChat</title>
        <meta name="description" content="Cache management for RapidDataChat" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black dark:text-black">
              Cache Management
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage the shared query cache
            </p>
            {user && (
              <p className="mt-1 text-sm text-gray-500">
                Logged in as: {user.name || user.email}
              </p>
            )}
          </div>

          {actionMessage && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-700">{actionMessage}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cache Statistics */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-black dark:text-black">
                Cache Statistics
              </h2>
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <svg
                    className="animate-spin h-8 w-8 text-blue-600"
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
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-500">
                        Cache Hits
                      </h3>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.hits}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-500">
                        Cache Misses
                      </h3>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.misses}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-500">
                        Cached Items
                      </h3>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.keys}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-500">
                        Hit Ratio
                      </h3>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.hits + stats.misses > 0
                          ? `${Math.round(
                              (stats.hits / (stats.hits + stats.misses)) * 100
                            )}%`
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between">
                      <button
                        onClick={clearCache}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-red-300"
                      >
                        Clear Cache
                      </button>

                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={pruneCount}
                          onChange={(e) =>
                            setPruneCount(parseInt(e.target.value) || 10)
                          }
                          min="1"
                          className="w-16 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={pruneCache}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:bg-yellow-300"
                        >
                          Prune Cache
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={fetchCacheStats}
                      disabled={loading || actionLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
                    >
                      Refresh Stats
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No cache statistics available</p>
              )}
            </div>

            {/* User Queries */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-black dark:text-black">
                Your Shared Queries
              </h2>
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <svg
                    className="animate-spin h-8 w-8 text-blue-600"
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
                </div>
              ) : userQueries.length > 0 ? (
                <div className="overflow-y-auto max-h-96">
                  <ul className="divide-y divide-gray-200">
                    {userQueries.map((query) => (
                      <li key={query.id} className="py-4">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {query.naturalLanguageQuery}
                            </p>
                            <p className="text-xs text-gray-500">
                              Shared on {formatDate(query.timestamp)}
                              {query.expiresAt && (
                                <span className="ml-2">
                                  • Expires on {formatDate(query.expiresAt)}
                                </span>
                              )}
                              {query.accessCount !== undefined && (
                                <span className="ml-2">
                                  • Viewed {query.accessCount}{" "}
                                  {query.accessCount === 1 ? "time" : "times"}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center">
                            <a
                              href={`/shared/${query.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 mr-4"
                            >
                              View
                            </a>
                            <button
                              onClick={() => deleteSharedQuery(query.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-gray-500">No shared queries found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Redirect to sign in if not authenticated
  if (!session || !session.user) {
    return {
      redirect: {
        destination: "/auth/signin?callbackUrl=/admin/cache",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: {
        email: session.user.email || "",
        name: session.user.name || "",
      },
    },
  };
};
