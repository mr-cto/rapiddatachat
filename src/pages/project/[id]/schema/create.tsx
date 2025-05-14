import React, { useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { getSession } from "next-auth/react";
import { GetServerSideProps } from "next";

interface CreateSchemaPageProps {
  projectId: string;
  userId: string;
}

const CreateSchemaPage: React.FC<CreateSchemaPageProps> = ({
  projectId,
  userId,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState({
    name: "",
    description: "",
  });

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSchema((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Validate form
      if (!schema.name) {
        setError("Schema name is required");
        setLoading(false);
        return;
      }

      // Create schema
      const response = await axios.post("/api/schema-management", {
        userId,
        projectId,
        name: schema.name,
        description: schema.description,
        columns: [],
      });

      // Redirect to schema columns page
      router.push(
        `/project/${projectId}/schema/columns?schemaId=${response.data.id}`
      );
    } catch (err) {
      console.error("Error creating schema:", err);
      setError("Failed to create schema");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create New Schema</h1>
        <p className="text-gray-600">
          Create a new global schema for your project.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-md shadow">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Schema Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={schema.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter schema name"
              required
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={schema.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter schema description"
            ></textarea>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Schema"}
            </button>
          </div>
        </form>
      </div>
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

  if (!session.user?.id) {
    return {
      redirect: {
        destination: "/auth/error",
        permanent: false,
      },
    };
  }

  try {
    const { id: projectId } = context.query;

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
        userId: session.user.id,
      },
    };
  } catch (error) {
    console.error("Error in getServerSideProps:", error);
    return {
      props: {
        projectId: context.query.id,
        userId: session.user.id,
        error: "Failed to load data",
      },
    };
  }
};

export default CreateSchemaPage;
