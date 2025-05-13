import React, { useState, useEffect } from "react";
import { SchemaVersion, SchemaChange } from "../../lib/schemaVersionService";

interface SchemaVersionHistoryProps {
  schemaId: string;
  onVersionSelect?: (version: SchemaVersion) => void;
  onCompareSelect?: (fromVersion: number, toVersion: number) => void;
  onRollbackSelect?: (version: number) => void;
}

/**
 * Component for displaying schema version history
 */
const SchemaVersionHistory: React.FC<SchemaVersionHistoryProps> = ({
  schemaId,
  onVersionSelect,
  onCompareSelect,
  onRollbackSelect,
}) => {
  const [versions, setVersions] = useState<SchemaVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<SchemaVersion | null>(
    null
  );
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);

  // Fetch versions
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/schema-versions?schemaId=${schemaId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch schema versions");
        }

        const data = await response.json();
        setVersions(data.versions || []);

        // Select the latest version by default
        if (data.versions && data.versions.length > 0) {
          setSelectedVersion(data.versions[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersions();
  }, [schemaId]);

  /**
   * Handle version selection
   */
  const handleVersionSelect = (version: SchemaVersion) => {
    setSelectedVersion(version);
    if (onVersionSelect) {
      onVersionSelect(version);
    }
  };

  /**
   * Handle compare selection
   */
  const handleCompareSelect = () => {
    if (compareFrom !== null && compareTo !== null && onCompareSelect) {
      onCompareSelect(compareFrom, compareTo);
    }
  };

  /**
   * Handle rollback selection
   */
  const handleRollbackSelect = (version: number) => {
    if (onRollbackSelect) {
      if (
        window.confirm(
          `Are you sure you want to rollback to version ${version}?`
        )
      ) {
        onRollbackSelect(version);
      }
    }
  };

  /**
   * Format date
   */
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  /**
   * Get change type badge
   */
  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case "add":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Added
          </span>
        );
      case "remove":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Removed
          </span>
        );
      case "modify":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Modified
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            Unknown
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
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

  if (versions.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-md text-gray-700 dark:text-gray-300">
        No versions found for this schema.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Version comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
          Compare Versions
        </h3>
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label
              htmlFor="compare-from"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              From Version
            </label>
            <select
              id="compare-from"
              value={compareFrom || ""}
              onChange={(e) => setCompareFrom(parseInt(e.target.value, 10))}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-accent-primary focus:border-accent-primary dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select version</option>
              {versions.map((version) => (
                <option key={`from-${version.id}`} value={version.version}>
                  Version {version.version} ({formatDate(version.createdAt)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="compare-to"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              To Version
            </label>
            <select
              id="compare-to"
              value={compareTo || ""}
              onChange={(e) => setCompareTo(parseInt(e.target.value, 10))}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-accent-primary focus:border-accent-primary dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select version</option>
              {versions.map((version) => (
                <option key={`to-${version.id}`} value={version.version}>
                  Version {version.version} ({formatDate(version.createdAt)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleCompareSelect}
          disabled={compareFrom === null || compareTo === null}
          className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover disabled:opacity-50"
        >
          Compare Versions
        </button>
      </div>

      {/* Version list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Version History
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {versions.length} versions available
          </p>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {versions.map((version) => (
            <li
              key={version.id}
              className={`px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                selectedVersion?.id === version.id
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : ""
              }`}
              onClick={() => handleVersionSelect(version)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    Version {version.version}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created on {formatDate(version.createdAt)} by{" "}
                    {version.createdBy}
                  </p>
                  {version.comment && (
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {version.comment}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRollbackSelect(version.version);
                    }}
                    className="px-3 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-800"
                  >
                    Rollback
                  </button>
                </div>
              </div>

              {/* Change log */}
              {selectedVersion?.id === version.id &&
                version.changeLog &&
                version.changeLog.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Changes
                    </h5>
                    <ul className="space-y-2">
                      {version.changeLog.map((change: SchemaChange, index) => (
                        <li
                          key={`${change.columnName}-${index}`}
                          className="flex items-start"
                        >
                          <div className="mr-2 mt-0.5">
                            {getChangeTypeBadge(change.type)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {change.columnName}
                            </p>
                            {change.type === "modify" && (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <p>
                                  Before:{" "}
                                  {JSON.stringify(change.before, null, 2)}
                                </p>
                                <p>
                                  After: {JSON.stringify(change.after, null, 2)}
                                </p>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SchemaVersionHistory;
