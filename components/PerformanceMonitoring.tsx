import React, { useEffect, useState } from "react";

interface PerformanceMetrics {
  executionTime: number;
  querySize: number;
  resultSize: number;
  timestamp: Date;
  queryId?: string;
  userId?: string;
}

interface PerformanceStats {
  count: number;
  avgExecutionTime: number;
  medianExecutionTime: number;
  p95ExecutionTime: number;
}

/**
 * Performance monitoring component
 * @returns JSX.Element
 */
export const PerformanceMonitoring: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [percentileMetrics, setPercentileMetrics] = useState<{
    executionTime: number;
    querySize: number;
    resultSize: number;
  } | null>(null);
  const [recentMetrics, setRecentMetrics] = useState<PerformanceMetrics[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // seconds
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Fetch performance metrics
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/performance-metrics");

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const data = await response.json();

      setPercentileMetrics(data.percentileMetrics);
      setRecentMetrics(data.recentMetrics);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching performance metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh metrics
  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  // Format time in ms
  const formatTime = (ms: number) => {
    return `${ms.toFixed(2)}ms`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-black dark:text-black">
          Performance Monitoring
        </h2>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label
              htmlFor="refreshInterval"
              className="text-sm font-medium text-gray-700"
            >
              Refresh every:
            </label>
            <select
              id="refreshInterval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!autoRefresh}
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="autoRefresh"
              className="text-sm font-medium text-gray-700"
            >
              Auto-refresh
            </label>
          </div>

          <button
            onClick={fetchMetrics}
            className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-lg font-medium text-red-800">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Performance Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-800">Total Queries</h3>
            <p className="text-2xl font-bold text-blue-900">{stats.count}</p>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-sm font-medium text-green-800">
              Average Execution Time
            </h3>
            <p className="text-2xl font-bold text-green-900">
              {formatTime(stats.avgExecutionTime)}
            </p>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h3 className="text-sm font-medium text-yellow-800">
              Median Execution Time
            </h3>
            <p className="text-2xl font-bold text-yellow-900">
              {formatTime(stats.medianExecutionTime)}
            </p>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-sm font-medium text-red-800">
              95th Percentile Execution Time
            </h3>
            <p className="text-2xl font-bold text-red-900">
              {formatTime(stats.p95ExecutionTime)}
            </p>
          </div>
        </div>
      )}

      {/* Recent Queries */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Recent Queries</h3>

        {recentMetrics.length === 0 ? (
          <p className="text-gray-700">No recent queries</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Execution Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Query Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Result Size
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentMetrics.map((metric, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(metric.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(metric.executionTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {metric.querySize} chars
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {metric.resultSize} rows
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 95th Percentile Metrics */}
      {percentileMetrics && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">95th Percentile Metrics</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <h4 className="text-sm font-medium text-gray-800">
                Execution Time
              </h4>
              <p className="text-xl font-bold text-gray-900">
                {formatTime(percentileMetrics.executionTime)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <h4 className="text-sm font-medium text-gray-800">Query Size</h4>
              <p className="text-xl font-bold text-gray-900">
                {percentileMetrics.querySize} chars
              </p>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
              <h4 className="text-sm font-medium text-gray-800">Result Size</h4>
              <p className="text-xl font-bold text-gray-900">
                {percentileMetrics.resultSize} rows
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
