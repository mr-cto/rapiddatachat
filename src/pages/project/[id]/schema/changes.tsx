import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

// Define interfaces locally to avoid import issues
interface SchemaColumn {
  id: string;
  name: string;
  type: string;
  description?: string;
  isPrimaryKey?: boolean;
  isRequired?: boolean;
  defaultValue?: string;
  derivationFormula?: string;
}

interface GlobalSchema {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  columns: SchemaColumn[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  version: number;
  previousVersionId?: string;
}

interface SchemaChange {
  id: string;
  schemaId: string;
  changeType: string;
  description: string;
  details?: any;
  createdAt: Date;
  createdBy?: string;
}

/**
 * Schema Changes Page
 */
const SchemaChangesPage: React.FC = () => {
  const router = useRouter();
  const { id: projectId, schemaId } = router.query;
  const { data: session, status } = useSession();
  const [schema, setSchema] = useState<GlobalSchema | null>(null);
  const [changes, setChanges] = useState<SchemaChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch schema data
  useEffect(() => {
    const fetchSchema = async () => {
      if (status !== "authenticated" || !schemaId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/schema-management?id=${schemaId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch schema");
        }

        const data = await response.json();
        setSchema(data.schema);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchema();
  }, [schemaId, status]);

  // Fetch schema changes
  useEffect(() => {
    const fetchChanges = async () => {
      if (status !== "authenticated" || !schemaId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/schema-changes?schemaId=${schemaId}&limit=${pageSize}&offset=${
            page * pageSize
          }`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch schema changes");
        }

        const data = await response.json();
        setChanges(data.changes || []);
        setHasMore(data.pagination?.hasMore || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChanges();
  }, [schemaId, status, page]);

  /**
   * Format date for display
   */
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  /**
   * Get change type display text
   */
  const getChangeTypeDisplay = (changeType: string) => {
    switch (changeType) {
      case "create":
        return "Created";
      case "update":
        return "Updated";
      case "delete":
        return "Deleted";
      case "column_add":
        return "Added Column";
      case "column_update":
        return "Updated Column";
      case "column_delete":
        return "Deleted Column";
      default:
        return changeType;
    }
  };

  /**
   * Get change type color class
   */
  const getChangeTypeColorClass = (changeType: string) => {
    switch (changeType) {
      case "create":
        return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
      case "update":
        return "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
      case "delete":
        return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
      case "column_add":
        return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
      case "column_update":
        return "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
      case "column_delete":
        return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
    }
  };

  /**
   * Handle loading more changes
   */
  const handleLoadMore = () => {
    setPage(page + 1);
  };

  if (status === "loading" || (isLoading && !changes.length)) {
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
            onClick={() => router.push(`/project/${projectId}/dashboard`)}
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

  if (!schema) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.push(`/project/${projectId}/dashboard`)}
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

        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300">
          Schema not found. Please select a valid schema.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/project/${projectId}/dashboard`)}
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
          Schema Change History
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
            onClick={() =>
              router.push(
                `/project/${projectId}/schema/documentation?schemaId=${schemaId}`
              )
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            View Documentation
          </button>
        </div>
      </div>

      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Schema Information
        </h2>

        <div className="mb-4">
          <p className="text-secondary dark:text-secondary">
            <span className="font-medium">Schema Name:</span> {schema.name}
          </p>
          {schema.description && (
            <p className="text-secondary dark:text-secondary mt-2">
              <span className="font-medium">Description:</span>{" "}
              {schema.description}
            </p>
          )}
          <p className="text-secondary dark:text-secondary mt-2">
            <span className="font-medium">Columns:</span>{" "}
            {schema.columns.length}
          </p>
          <p className="text-secondary dark:text-secondary mt-2">
            <span className="font-medium">Version:</span> {schema.version}
          </p>
          <p className="text-secondary dark:text-secondary mt-2">
            <span className="font-medium">Status:</span>{" "}
            {schema.isActive ? (
              <span className="text-green-600 dark:text-green-400">Active</span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">Inactive</span>
            )}
          </p>
        </div>
      </div>

      {/* Changes list */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Change History
        </h2>

        {changes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No changes recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            {changes.map((change) => (
              <div
                key={change.id}
                className="border border-gray-200 dark:border-gray-700 rounded-md p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center mb-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getChangeTypeColorClass(
                          change.changeType
                        )} mr-2`}
                      >
                        {getChangeTypeDisplay(change.changeType)}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(change.createdAt)}
                      </span>
                    </div>
                    <p className="text-primary dark:text-primary font-medium">
                      {change.description}
                    </p>
                  </div>
                  {change.createdBy && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      By: {change.createdBy}
                    </div>
                  )}
                </div>

                {change.details && Object.keys(change.details).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        {JSON.stringify(change.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-center items-center h-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-primary"></div>
              </div>
            )}

            {hasMore && !isLoading && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleLoadMore}
                  className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover"
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemaChangesPage;
