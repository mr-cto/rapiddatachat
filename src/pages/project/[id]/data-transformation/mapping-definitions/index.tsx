import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../api/auth/[...nextauth]";

/**
 * Interface for mapping definition
 */
interface MappingDefinition {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  targetType: string;
  mappings: Array<{
    fileColumnName: string;
    schemaColumnId: string;
  }>;
  transformationRules?: Record<string, any[]>;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  projectId: string;
}

/**
 * Interface for mapping definitions page props
 */
interface MappingDefinitionsPageProps {
  projectId: string;
}

/**
 * Page for displaying and managing mapping definitions
 */
const MappingDefinitionsPage: React.FC<MappingDefinitionsPageProps> = ({
  projectId,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mappingDefinitions, setMappingDefinitions] = useState<
    MappingDefinition[]
  >([]);

  // Load mapping definitions on component mount
  useEffect(() => {
    loadMappingDefinitions();
  }, [projectId]);

  /**
   * Load mapping definitions from API
   */
  const loadMappingDefinitions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch mapping definitions
      const response = await fetch(
        `/api/data-transformation/mapping-definitions?projectId=${projectId}`
      );

      if (!response.ok) {
        throw new Error("Failed to load mapping definitions");
      }

      const data = await response.json();
      setMappingDefinitions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a mapping definition
   */
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this mapping definition?")) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Delete mapping definition
      const response = await fetch(
        `/api/data-transformation/mapping-definitions?id=${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete mapping definition");
      }

      // Reload mapping definitions
      await loadMappingDefinitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Navigate to create mapping definition page
   */
  const handleCreateNew = () => {
    router.push(
      `/project/${projectId}/data-transformation/mapping-definitions/create`
    );
  };

  /**
   * Navigate to edit mapping definition page
   */
  const handleEdit = (id: string) => {
    router.push(
      `/project/${projectId}/data-transformation/mapping-definitions/${id}`
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          Mapping Definitions
        </h1>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Create New
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : mappingDefinitions.length === 0 ? (
        <div className="p-8 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No mapping definitions found for this project.
          </p>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Create Your First Mapping Definition
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="py-3 px-4 text-left text-gray-700 dark:text-gray-300">
                  Name
                </th>
                <th className="py-3 px-4 text-left text-gray-700 dark:text-gray-300">
                  Source Type
                </th>
                <th className="py-3 px-4 text-left text-gray-700 dark:text-gray-300">
                  Target Type
                </th>
                <th className="py-3 px-4 text-left text-gray-700 dark:text-gray-300">
                  Mappings
                </th>
                <th className="py-3 px-4 text-left text-gray-700 dark:text-gray-300">
                  Last Updated
                </th>
                <th className="py-3 px-4 text-left text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {mappingDefinitions.map((definition) => (
                <tr
                  key={definition.id}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {definition.name}
                    </div>
                    {definition.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {definition.description}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                    {definition.sourceType}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                    {definition.targetType}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                    {definition.mappings.length}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                    {new Date(definition.updatedAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(definition.id)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(definition.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Check authentication
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/auth/signin",
        permanent: false,
      },
    };
  }

  // Get project ID from URL
  const { id: projectId } = context.params || {};

  if (!projectId) {
    return {
      redirect: {
        destination: "/projects",
        permanent: false,
      },
    };
  }

  return {
    props: {
      projectId,
    },
  };
};

export default MappingDefinitionsPage;
