import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { getSession } from "next-auth/react";
import { GetServerSideProps } from "next";
import SchemaManagementInterface from "../../../../../components/schema/SchemaManagementInterface";

interface SchemaColumnsPageProps {
  projectId: string;
  schemaId?: string;
}

const SchemaColumnsPage: React.FC<SchemaColumnsPageProps> = ({
  projectId,
  schemaId,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSchemaId, setActiveSchemaId] = useState<string | null>(
    schemaId || null
  );

  // Fetch active schema if not provided
  useEffect(() => {
    if (!schemaId) {
      fetchActiveSchema();
    } else {
      setLoading(false);
    }
  }, [schemaId]);

  // Fetch active schema
  const fetchActiveSchema = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `/api/schema-information?projectId=${projectId}&activeOnly=true`
      );

      if (response.data && response.data.length > 0) {
        setActiveSchemaId(response.data[0].id);
      } else {
        setError("No active schema found for this project");
      }
    } catch (err) {
      console.error("Error fetching active schema:", err);
      setError("Failed to load schema data");
    } finally {
      setLoading(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="spinner mb-4"></div>
            <p className="text-gray-600">Loading schema data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error || !activeSchemaId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error || "No active schema found"}</p>
        </div>
        <div className="mt-4">
          <button
            onClick={() => router.push(`/project/${projectId}/schema/create`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create New Schema
          </button>
        </div>
      </div>
    );
  }

  // Render schema management interface
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Schema Management</h1>
        <p className="text-gray-600">
          View and manage your global schema columns, versions, and file
          contributions.
        </p>
      </div>

      <SchemaManagementInterface
        projectId={projectId}
        schemaId={activeSchemaId}
      />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: "/auth/signin",
        permanent: false,
      },
    };
  }

  try {
    const { id: projectId, schemaId } = context.query;

    if (!projectId) {
      return {
        redirect: {
          destination: "/project",
          permanent: false,
        },
      };
    }

    return {
      props: {
        projectId,
        schemaId: schemaId || null,
      },
    };
  } catch (error) {
    console.error("Error in getServerSideProps:", error);
    return {
      props: {
        projectId: context.query.id,
        error: "Failed to load schema data",
      },
    };
  }
};

export default SchemaColumnsPage;
