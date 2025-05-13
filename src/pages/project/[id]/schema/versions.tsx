import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { GlobalSchema } from "../../../../lib/globalSchemaService";

/**
 * Schema Versions Page
 */
const SchemaVersionsPage: React.FC = () => {
  const router = useRouter();
  const { id: projectId, schemaId } = router.query;
  const { data: session, status } = useSession();
  const [versions, setVersions] = useState<GlobalSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch schema versions
  useEffect(() => {
    const fetchVersions = async () => {
      if (status !== "authenticated" || !schemaId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/schema-versions/${schemaId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch schema versions");
        }

        const data = await response.json();
        setVersions(data.versions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersions();
  }, [schemaId, status]);

  /**
   * Handle version selection for comparison
   */
  const handleVersionSelect = (versionId: string) => {
    if (selectedVersions.includes(versionId)) {
      setSelectedVersions(selectedVersions.filter((id) => id !== versionId));
    } else {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, versionId]);
      }
    }
  };

  /**
   * Toggle compare mode
   */
  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedVersions([]);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  /**
   * Get column differences between two versions
   */
  const getColumnDifferences = (
    version1: GlobalSchema,
    version2: GlobalSchema
  ) => {
    const columns1 = version1.columns;
    const columns2 = version2.columns;

    // Find added columns (in version1 but not in version2)
    const addedColumns = columns1.filter(
      (col1) => !columns2.some((col2) => col2.name === col1.name)
    );

    // Find removed columns (in version2 but not in version1)
    const removedColumns = columns2.filter(
      (col2) => !columns1.some((col1) => col1.name === col2.name)
    );

    // Find modified columns (in both but with different properties)
    const modifiedColumns = columns1.filter((col1) => {
      const col2 = columns2.find((c) => c.name === col1.name);
      if (!col2) return false;

      // Check if any property is different
      return (
        col1.type !== col2.type ||
        col1.description !== col2.description ||
        col1.isRequired !== col2.isRequired ||
        col1.isPrimaryKey !== col2.isPrimaryKey ||
        col1.isForeignKey !== col2.isForeignKey
      );
    });

    return {
      addedColumns,
      removedColumns,
      modifiedColumns,
    };
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            className="flex items-center text-accent-primary hover:text-accent-primary-hover"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Project
          </button>
        </div>

        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/project/${projectId}`)}
          className="flex items-center text-accent-primary hover:text-accent-primary-hover"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Back to Project
        </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary dark:text-primary">
          Schema Version History
        </h1>

        <div className="flex space-x-4">
          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/schema/columns?schemaId=${schemaId}`
              )
            }
            className="px-4 py-2 bg-accent-secondary text-white rounded-md hover:bg-accent-secondary-hover"
          >
            Manage Columns
          </button>

          <button
            onClick={toggleCompareMode}
            className={`px-4 py-2 ${
              compareMode
                ? "bg-accent-primary text-white hover:bg-accent-primary-hover"
                : "border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            } rounded-md`}
          >
            {compareMode ? "Exit Compare Mode" : "Compare Versions"}
          </button>
        </div>
      </div>

      {compareMode && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-blue-700 dark:text-blue-300">
            {selectedVersions.length === 0
              ? "Select two versions to compare"
              : selectedVersions.length === 1
              ? "Select one more version to compare"
              : "Comparing two versions"}
          </p>
        </div>
      )}

      {/* Version list */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Available Versions
        </h2>

        {versions.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            No versions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {compareMode && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Select
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Columns
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {versions.map((version, index) => (
                  <tr
                    key={version.id}
                    className={
                      version.isActive ? "bg-green-50 dark:bg-green-900/10" : ""
                    }
                  >
                    {compareMode && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedVersions.includes(version.id)}
                          onChange={() => handleVersionSelect(version.id)}
                          disabled={
                            selectedVersions.length >= 2 &&
                            !selectedVersions.includes(version.id)
                          }
                          className="h-4 w-4 text-accent-primary focus:ring-accent-primary border-gray-300 rounded"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {version.version}
                      {index === 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                          Latest
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(version.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {version.columns.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {version.isActive ? (
                        <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() =>
                          router.push(
                            `/project/${projectId}/schema/columns?schemaId=${version.id}`
                          )
                        }
                        className="mr-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        View
                      </button>
                      {!version.isActive && (
                        <button
                          onClick={() => {
                            // Activate this version
                            // This would be implemented in a real application
                            alert(
                              "This would activate version " + version.version
                            );
                          }}
                          className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800"
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Version comparison */}
      {compareMode && selectedVersions.length === 2 && (
        <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
            Version Comparison
          </h2>

          {(() => {
            const version1 = versions.find((v) => v.id === selectedVersions[0]);
            const version2 = versions.find((v) => v.id === selectedVersions[1]);

            if (!version1 || !version2) {
              return (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  Error loading versions for comparison.
                </div>
              );
            }

            const differences = getColumnDifferences(version1, version2);

            return (
              <div>
                <div className="flex justify-between mb-4">
                  <div className="w-1/2 pr-4">
                    <h3 className="text-lg font-medium mb-2">
                      Version {version1.version}
                      {version1.isActive && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                          Active
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Created: {formatDate(version1.createdAt)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Columns: {version1.columns.length}
                    </p>
                  </div>
                  <div className="w-1/2 pl-4">
                    <h3 className="text-lg font-medium mb-2">
                      Version {version2.version}
                      {version2.isActive && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                          Active
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Created: {formatDate(version2.createdAt)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Columns: {version2.columns.length}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">Changes</h3>

                  {differences.addedColumns.length === 0 &&
                  differences.removedColumns.length === 0 &&
                  differences.modifiedColumns.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400">
                      No differences found between these versions.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {/* Added columns */}
                      {differences.addedColumns.length > 0 && (
                        <div>
                          <h4 className="text-md font-medium mb-2 text-green-600 dark:text-green-400">
                            Added Columns ({differences.addedColumns.length})
                          </h4>
                          <ul className="list-disc list-inside pl-4 space-y-1">
                            {differences.addedColumns.map((column) => (
                              <li key={column.name} className="text-sm">
                                <span className="font-medium">
                                  {column.name}
                                </span>{" "}
                                ({column.type})
                                {column.isRequired && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                                {column.description && (
                                  <span className="text-gray-500 ml-2">
                                    - {column.description}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Removed columns */}
                      {differences.removedColumns.length > 0 && (
                        <div>
                          <h4 className="text-md font-medium mb-2 text-red-600 dark:text-red-400">
                            Removed Columns ({differences.removedColumns.length}
                            )
                          </h4>
                          <ul className="list-disc list-inside pl-4 space-y-1">
                            {differences.removedColumns.map((column) => (
                              <li key={column.name} className="text-sm">
                                <span className="font-medium">
                                  {column.name}
                                </span>{" "}
                                ({column.type})
                                {column.isRequired && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                                {column.description && (
                                  <span className="text-gray-500 ml-2">
                                    - {column.description}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Modified columns */}
                      {differences.modifiedColumns.length > 0 && (
                        <div>
                          <h4 className="text-md font-medium mb-2 text-blue-600 dark:text-blue-400">
                            Modified Columns (
                            {differences.modifiedColumns.length})
                          </h4>
                          <ul className="list-disc list-inside pl-4 space-y-1">
                            {differences.modifiedColumns.map((column) => {
                              const oldColumn = version2.columns.find(
                                (c) => c.name === column.name
                              );
                              return (
                                <li key={column.name} className="text-sm">
                                  <span className="font-medium">
                                    {column.name}
                                  </span>
                                  {column.type !== oldColumn?.type && (
                                    <span className="ml-2">
                                      Type:{" "}
                                      <span className="line-through text-red-500">
                                        {oldColumn?.type}
                                      </span>{" "}
                                      →{" "}
                                      <span className="text-green-500">
                                        {column.type}
                                      </span>
                                    </span>
                                  )}
                                  {column.isRequired !==
                                    oldColumn?.isRequired && (
                                    <span className="ml-2">
                                      Required:{" "}
                                      <span className="line-through text-red-500">
                                        {oldColumn?.isRequired ? "Yes" : "No"}
                                      </span>{" "}
                                      →{" "}
                                      <span className="text-green-500">
                                        {column.isRequired ? "Yes" : "No"}
                                      </span>
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default SchemaVersionsPage;
