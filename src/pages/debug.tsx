import React, { useState, useEffect, useCallback } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import Head from "next/head";
import { authOptions } from "../../lib/authOptions";

interface DebugPageProps {
  user: {
    email: string;
    name?: string;
  };
}

interface LogConfig {
  debugMode: boolean;
  logLevel: string;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logDir: string;
  maxLogSize: string;
  maxLogAge: string;
  enableRequestLogging: boolean;
  enableResponseLogging: boolean;
  enableErrorLogging: boolean;
  enablePerformanceLogging: boolean;
  enableQueryLogging: boolean;
  enableFileOperationLogging: boolean;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Debug page component
 * @param props Component props
 * @returns JSX.Element
 */
export default function DebugPage({ user }: DebugPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [config, setConfig] = useState<LogConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logType, setLogType] = useState<string>("all");
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  /**
   * Fetch debug status from the API
   */
  const fetchDebugStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/debug?action=config");
      if (!response.ok) {
        throw new Error("Failed to fetch debug status");
      }

      const data = await response.json();
      setDebugMode(data.debugMode);
      setConfig(data.config);

      // Fetch logs after getting config
      await fetchLogs();
    } catch (error) {
      console.error("Error fetching debug status:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch logs from the API
   */
  const fetchLogs = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch(`/api/debug?action=logs&type=${logType}`);
      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    }
  }, [logType]);

  // Fetch debug status on page load
  useEffect(() => {
    fetchDebugStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchDebugStatus is not in deps array to avoid unnecessary re-renders

  // Set up auto-refresh
  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(() => {
        fetchLogs();
        setLastRefresh(new Date());
      }, refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, logType, fetchLogs]);

  /**
   * Toggle debug mode
   */
  const toggleDebugMode = async () => {
    try {
      setLoading(true);
      setError(null);

      const action = debugMode ? "disable" : "enable";
      const response = await fetch("/api/debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} debug mode`);
      }

      const data = await response.json();
      setDebugMode(data.debugMode);

      // Refresh config
      await fetchDebugStatus();
    } catch (error) {
      console.error("Error toggling debug mode:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate test logs
   */
  const generateTestLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "test",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate test logs");
      }

      // Refresh logs
      await fetchLogs();
    } catch (error) {
      console.error("Error generating test logs:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset logging configuration
   */
  const resetConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reset",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset configuration");
      }

      const data = await response.json();
      setConfig(data.config);
      setDebugMode(data.config.debugMode);
    } catch (error) {
      console.error("Error resetting configuration:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format date
   * @param dateString Date string
   * @returns Formatted date string
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  /**
   * Get log level color
   * @param level Log level
   * @returns CSS color class
   */
  const getLogLevelColor = (level?: string) => {
    if (!level) return "text-gray-600"; // Default color for undefined level

    switch (level.toLowerCase()) {
      case "error":
        return "text-red-600";
      case "warn":
        return "text-yellow-600";
      case "info":
        return "text-blue-600";
      case "http":
        return "text-purple-600";
      case "debug":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <>
      <Head>
        <title>Debug | RapidDataChat</title>
        <meta name="description" content="Debug page for RapidDataChat" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black dark:text-black">
              Debug Console
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              View logs and manage debug settings
            </p>
            {user && (
              <p className="mt-1 text-sm text-gray-500">
                Logged in as: {user.name || user.email}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Debug Controls */}
            <div className="bg-white rounded-lg shadow-md p-6 md:col-span-1">
              <h2 className="text-xl font-semibold mb-4 text-black dark:text-black">
                Debug Controls
              </h2>
              {loading && !config ? (
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
              ) : config ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Debug Mode
                    </span>
                    <button
                      onClick={toggleDebugMode}
                      disabled={loading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                        debugMode ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          debugMode ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Log Level
                    </span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        config.logLevel === "debug"
                          ? "bg-green-100 text-green-800"
                          : config.logLevel === "info"
                          ? "bg-blue-100 text-blue-800"
                          : config.logLevel === "warn"
                          ? "bg-yellow-100 text-yellow-800"
                          : config.logLevel === "error"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {config.logLevel.toUpperCase()}
                    </span>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-black dark:text-black mb-2">
                      Log Settings
                    </h3>
                    <ul className="space-y-1">
                      <li className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          File Logging
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            config.enableFileLogging
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        ></span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Console Logging
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            config.enableConsoleLogging
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        ></span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Request Logging
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            config.enableRequestLogging
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        ></span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Response Logging
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            config.enableResponseLogging
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        ></span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Error Logging
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            config.enableErrorLogging
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        ></span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Performance Logging
                        </span>
                        <span
                          className={`w-3 h-3 rounded-full ${
                            config.enablePerformanceLogging
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        ></span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-black dark:text-black mb-2">
                      Actions
                    </h3>
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={generateTestLogs}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
                      >
                        Generate Test Logs
                      </button>
                      <button
                        onClick={resetConfig}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:bg-gray-300"
                      >
                        Reset Configuration
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No configuration available</p>
              )}
            </div>

            {/* Logs Viewer */}
            <div className="bg-white rounded-lg shadow-md p-6 md:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-black dark:text-black">
                  Logs
                </h2>
                <div className="flex space-x-2">
                  <select
                    value={logType}
                    onChange={(e) => setLogType(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Logs</option>
                    <option value="application">Application</option>
                    <option value="error">Errors</option>
                  </select>
                  <select
                    value={refreshInterval?.toString() || ""}
                    onChange={(e) =>
                      setRefreshInterval(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Manual Refresh</option>
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                  </select>
                  <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="p-1 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {refreshInterval && (
                <div className="mb-2 text-xs text-gray-500 text-right">
                  Last refreshed: {lastRefresh.toLocaleTimeString()}
                </div>
              )}

              <div className="overflow-y-auto max-h-[600px] border border-gray-200 rounded-md">
                {logs.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Time
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Level
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Message
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.map((log, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            console.log("Log details:", log);
                            alert(
                              `Log Details:\n${JSON.stringify(log, null, 2)}`
                            );
                          }}
                        >
                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getLogLevelColor(
                                log.level
                              )} bg-opacity-10`}
                            >
                              {log.level?.toUpperCase() || "INFO"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-900">
                            {log.message}
                            {log.metadata &&
                              Object.keys(log.metadata).length > 0 && (
                                <span className="ml-2 text-gray-400">
                                  [+metadata]
                                </span>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex justify-center items-center h-40">
                    <p className="text-gray-500">No logs available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Allow access in development mode
  const isDevelopment = process.env.NODE_ENV === "development";
  if (!isDevelopment && (!session || !session.user)) {
    return {
      redirect: {
        destination: "/auth/signin?callbackUrl=/debug",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: session?.user
        ? {
            email: session.user.email || "",
            name: session.user.name || "",
          }
        : {
            email: "development@example.com",
            name: "Development User",
          },
    },
  };
};
