import React, { useState } from "react";
import {
  SchemaVersion,
  SchemaComparisonResult,
} from "../../lib/schemaVersionService";

interface SchemaVersionComparisonProps {
  schemaId: string;
  fromVersion: number;
  toVersion: number;
  onClose?: () => void;
}

/**
 * Component for comparing schema versions
 */
const SchemaVersionComparison: React.FC<SchemaVersionComparisonProps> = ({
  schemaId,
  fromVersion,
  toVersion,
  onClose,
}) => {
  const [comparison, setComparison] = useState<SchemaComparisonResult | null>(
    null
  );
  const [fromVersionData, setFromVersionData] = useState<SchemaVersion | null>(
    null
  );
  const [toVersionData, setToVersionData] = useState<SchemaVersion | null>(
    null
  );
  const [changeScript, setChangeScript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);

  // Fetch comparison data
  React.useEffect(() => {
    const fetchComparison = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/schema-versions/compare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schemaId,
            fromVersion,
            toVersion,
            generateScript: true,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch comparison");
        }

        const data = await response.json();
        setComparison(data.comparison);
        setFromVersionData(data.fromVersion);
        setToVersionData(data.toVersion);
        setChangeScript(data.changeScript);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [schemaId, fromVersion, toVersion]);

  /**
   * Format date
   */
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!comparison || !fromVersionData || !toVersionData) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-md text-gray-700 dark:text-gray-300">
        No comparison data available.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Schema Version Comparison
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Comparing Version {fromVersion} (
            {formatDate(fromVersionData.createdAt)}) to Version {toVersion} (
            {formatDate(toVersionData.createdAt)})
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <span className="sr-only">Close</span>
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
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
      </div>

      <div className="px-4 py-5 sm:p-6">
        {/* Summary */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
              Added Columns
            </h4>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {comparison.added.length}
            </p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
              Removed Columns
            </h4>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {comparison.removed.length}
            </p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              Modified Columns
            </h4>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {comparison.modified.length}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
          <ul className="flex flex-wrap -mb-px">
            <li className="mr-2">
              <button
                className={`inline-block py-2 px-4 border-b-2 ${
                  !showScript
                    ? "border-accent-primary text-accent-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                onClick={() => setShowScript(false)}
              >
                Changes
              </button>
            </li>
            <li className="mr-2">
              <button
                className={`inline-block py-2 px-4 border-b-2 ${
                  showScript
                    ? "border-accent-primary text-accent-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                onClick={() => setShowScript(true)}
              >
                Change Script
              </button>
            </li>
          </ul>
        </div>

        {/* Content */}
        {!showScript ? (
          <div>
            {/* Added columns */}
            {comparison.added.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Added Columns
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Required
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {comparison.added.map((column) => (
                        <tr key={`added-${column.name}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {column.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {column.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {column.isRequired ? "Yes" : "No"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {column.description || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Removed columns */}
            {comparison.removed.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Removed Columns
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Required
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {comparison.removed.map((column) => (
                        <tr key={`removed-${column.name}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {column.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {column.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {column.isRequired ? "Yes" : "No"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {column.description || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modified columns */}
            {comparison.modified.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Modified Columns
                </h4>
                <div className="space-y-4">
                  {comparison.modified.map((mod) => (
                    <div
                      key={`modified-${mod.columnName}`}
                      className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden"
                    >
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {mod.columnName}
                        </h5>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Before
                          </h6>
                          <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded-md text-xs overflow-auto">
                            {JSON.stringify(mod.before, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            After
                          </h6>
                          <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded-md text-xs overflow-auto">
                            {JSON.stringify(mod.after, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unchanged columns */}
            {comparison.unchanged.length > 0 && (
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Unchanged Columns ({comparison.unchanged.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Required
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {comparison.unchanged.map((column) => (
                        <tr key={`unchanged-${column.name}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {column.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {column.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {column.isRequired ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Change Script
            </h4>
            {changeScript ? (
              <div className="relative">
                <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md text-sm overflow-auto max-h-96">
                  {changeScript}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(changeScript);
                    alert("Change script copied to clipboard");
                  }}
                  className="absolute top-2 right-2 p-1 bg-white dark:bg-gray-800 rounded-md shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Copy to clipboard"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-500 dark:text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                No change script available.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemaVersionComparison;
