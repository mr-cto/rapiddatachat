import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

/**
 * Schema Cache Admin Page
 */
const SchemaCachePage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheKeys, setCacheKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch cache stats
  useEffect(() => {
    const fetchCacheStats = async () => {
      if (status !== "authenticated") return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/admin/cache-stats");

        if (!response.ok) {
          throw new Error("Failed to fetch cache stats");
        }

        const data = await response.json();
        setCacheStats(data.stats);
        setCacheKeys(data.keys || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCacheStats();
  }, [status]);

  /**
   * Handle clearing the entire cache
   */
  const handleClearAllCache = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/schema-retrieval?all=true", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear cache");
      }

      const data = await response.json();

      if (data.success) {
        setSuccessMessage("Cache cleared successfully");
        // Refresh stats
        setCacheStats({
          hits: 0,
          misses: 0,
          keys: 0,
          ksize: 0,
          vsize: 0,
        });
        setCacheKeys([]);
      } else {
        throw new Error("Failed to clear cache");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle clearing a specific key from the cache
   */
  const handleClearKey = async (key: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/admin/clear-cache-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear cache key");
      }

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Cache key '${key}' cleared successfully`);
        // Remove the key from the list
        setCacheKeys(cacheKeys.filter((k) => k !== key));
        // Update stats
        if (cacheStats) {
          setCacheStats({
            ...cacheStats,
            keys: cacheStats.keys - 1,
          });
        }
      } else {
        throw new Error("Failed to clear cache key");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Format bytes for display
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-primary dark:text-primary">
        Schema Cache Administration
      </h1>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 mb-6">
          {successMessage}
        </div>
      )}

      {/* Cache stats */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Cache Statistics
        </h2>

        {cacheStats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                Hit Ratio
              </h3>
              <p className="text-2xl font-bold">
                {cacheStats.hits + cacheStats.misses > 0
                  ? Math.round(
                      (cacheStats.hits /
                        (cacheStats.hits + cacheStats.misses)) *
                        100
                    )
                  : 0}
                %
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {cacheStats.hits} hits, {cacheStats.misses} misses
              </p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <h3 className="font-medium text-green-700 dark:text-green-300 mb-2">
                Keys
              </h3>
              <p className="text-2xl font-bold">{cacheStats.keys}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Total cached items
              </p>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
              <h3 className="font-medium text-purple-700 dark:text-purple-300 mb-2">
                Memory Usage
              </h3>
              <p className="text-2xl font-bold">
                {formatBytes(cacheStats.ksize + cacheStats.vsize)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Keys: {formatBytes(cacheStats.ksize)}, Values:{" "}
                {formatBytes(cacheStats.vsize)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            No cache statistics available.
          </p>
        )}

        <div className="mt-6">
          <button
            onClick={handleClearAllCache}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Clear Entire Cache
          </button>
        </div>
      </div>

      {/* Cache keys */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Cached Keys ({cacheKeys.length})
        </h2>

        {cacheKeys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {cacheKeys.map((key) => (
                  <tr key={key}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {key}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {key.startsWith("schema:") && !key.includes(":columns")
                        ? "Schema"
                        : key.includes(":columns")
                        ? "Schema Columns"
                        : key.startsWith("schemas:user:")
                        ? "User Schemas"
                        : key.startsWith("schemas:project:")
                        ? "Project Schemas"
                        : "Other"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleClearKey(key)}
                        className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800"
                      >
                        Clear
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            No cached keys available.
          </p>
        )}
      </div>
    </div>
  );
};

export default SchemaCachePage;
