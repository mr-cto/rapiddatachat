import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import SchemaDocumentation from "../../../../../components/schema/SchemaDocumentation";
import { GlobalSchema } from "../../../../../lib/globalSchemaService";

/**
 * Schema Documentation Page
 */
const SchemaDocumentationPage: React.FC = () => {
  const router = useRouter();
  const { id: projectId, schemaId } = router.query;
  const { data: session, status } = useSession();
  const [schema, setSchema] = useState<GlobalSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  /**
   * Handle documentation update
   */
  const handleDocumentationUpdated = () => {
    // Refresh the schema data if needed
    // This is optional since the SchemaDocumentation component manages its own state
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

  if (!schema) {
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
          Schema Documentation
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
                `/project/${projectId}/schema/changes?schemaId=${schemaId}`
              )
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            View Changes
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

      <SchemaDocumentation
        schemaId={schemaId as string}
        onDocumentationUpdated={handleDocumentationUpdated}
      />
    </div>
  );
};

export default SchemaDocumentationPage;
