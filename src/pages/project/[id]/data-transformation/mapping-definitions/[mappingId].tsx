import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../../lib/authOptions";
import MappingDefinitionForm from "../../../../../../components/dataTransformation/MappingDefinitionForm";

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
 * Interface for edit mapping definition page props
 */
interface EditMappingDefinitionPageProps {
  projectId: string;
  mappingId: string;
}

/**
 * Page for editing an existing mapping definition
 */
const EditMappingDefinitionPage: React.FC<EditMappingDefinitionPageProps> = ({
  projectId,
  mappingId,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mappingDefinition, setMappingDefinition] =
    useState<MappingDefinition | null>(null);

  // Load mapping definition on component mount
  useEffect(() => {
    loadMappingDefinition();
  }, [mappingId]);

  /**
   * Load mapping definition from API
   */
  const loadMappingDefinition = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch mapping definition
      const response = await fetch(
        `/api/data-transformation/mapping-definitions?id=${mappingId}`
      );

      if (!response.ok) {
        throw new Error("Failed to load mapping definition");
      }

      const data = await response.json();
      setMappingDefinition(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (values: any) => {
    try {
      // Submit form data to API
      const response = await fetch(
        "/api/data-transformation/mapping-definitions",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update mapping definition");
      }

      // Redirect to mapping definitions list
      router.push(
        `/project/${projectId}/data-transformation/mapping-definitions`
      );
    } catch (error) {
      console.error("Error updating mapping definition:", error);
      throw error;
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    router.push(
      `/project/${projectId}/data-transformation/mapping-definitions`
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !mappingDefinition) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
          {error || "Mapping definition not found"}
        </div>
        <div className="mt-4">
          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/data-transformation/mapping-definitions`
              )
            }
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Back to Mapping Definitions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          Edit Mapping Definition
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Update how data should be mapped between different structures.
        </p>
      </div>

      <MappingDefinitionForm
        projectId={projectId}
        initialValues={mappingDefinition}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
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

  // Get project ID and mapping ID from URL
  const { id: projectId, mappingId } = context.params || {};

  if (!projectId || !mappingId) {
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
      mappingId,
    },
  };
};

export default EditMappingDefinitionPage;
