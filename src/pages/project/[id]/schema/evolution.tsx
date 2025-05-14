import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import SchemaEvolutionPanel from "../../../../../components/schema/SchemaEvolutionPanel";
import { getSession } from "next-auth/react";
import { GetServerSideProps } from "next";

interface FileColumn {
  name: string;
  originalName: string;
  type: string;
  sampleValues: any[];
}

interface SchemaEvolutionPageProps {
  projectId: string;
  schemaId: string;
  fileId: string;
  fileColumns: FileColumn[];
}

const SchemaEvolutionPage: React.FC<SchemaEvolutionPageProps> = ({
  projectId,
  schemaId,
  fileId,
  fileColumns,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle completion
  const handleComplete = () => {
    router.push(`/project/${projectId}/schema/columns`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Schema Evolution</h1>
        <p className="text-gray-600">
          Review and add new columns from your uploaded file to the global
          schema.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <SchemaEvolutionPanel
        projectId={projectId}
        schemaId={schemaId}
        fileId={fileId}
        fileColumns={fileColumns}
        onComplete={handleComplete}
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
    const { id: projectId, fileId, schemaId } = context.query;

    if (!projectId || !fileId || !schemaId) {
      return {
        redirect: {
          destination: `/project/${projectId}/schema/columns`,
          permanent: false,
        },
      };
    }

    // Fetch file columns
    const fileDataResponse = await axios.get(
      `${process.env.NEXTAUTH_URL}/api/file-parsed-data/${fileId}`,
      {
        headers: {
          Cookie: context.req.headers.cookie || "",
        },
      }
    );

    // Extract columns from file data
    const fileData = fileDataResponse.data;
    const fileColumns: FileColumn[] = [];

    if (fileData && fileData.columns) {
      for (const column of fileData.columns) {
        fileColumns.push({
          name: column.name,
          originalName: column.originalName || column.name,
          type: column.type || "text",
          sampleValues: column.sampleValues || [],
        });
      }
    }

    return {
      props: {
        projectId,
        schemaId,
        fileId,
        fileColumns,
      },
    };
  } catch (error) {
    console.error("Error fetching data for schema evolution page:", error);
    return {
      props: {
        projectId: context.query.id,
        schemaId: context.query.schemaId || "",
        fileId: context.query.fileId || "",
        fileColumns: [],
        error: "Failed to load file data",
      },
    };
  }
};

export default SchemaEvolutionPage;
