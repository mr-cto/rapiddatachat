import React from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../../lib/authOptions";
import MappingDefinitionForm from "../../../../../../components/dataTransformation/MappingDefinitionForm";

/**
 * Interface for create mapping definition page props
 */
interface CreateMappingDefinitionPageProps {
  projectId: string;
}

/**
 * Page for creating a new mapping definition
 */
const CreateMappingDefinitionPage: React.FC<
  CreateMappingDefinitionPageProps
> = ({ projectId }) => {
  const router = useRouter();

  /**
   * Handle form submission
   */
  const handleSubmit = async (values: any) => {
    try {
      // Submit form data to API
      const response = await fetch(
        "/api/data-transformation/mapping-definitions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create mapping definition");
      }

      // Redirect to mapping definitions list
      router.push(
        `/project/${projectId}/data-transformation/mapping-definitions`
      );
    } catch (error) {
      console.error("Error creating mapping definition:", error);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          Create Mapping Definition
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Define how data should be mapped between different structures.
        </p>
      </div>

      <MappingDefinitionForm
        projectId={projectId}
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

export default CreateMappingDefinitionPage;
