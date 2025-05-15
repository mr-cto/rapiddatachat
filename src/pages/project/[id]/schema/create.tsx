import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/authOptions";
import { GetServerSideProps } from "next";

interface CreateSchemaPageProps {
  projectId: string;
  userId: string;
  isFirstUpload?: boolean;
  fileId?: string;
}

const CreateSchemaPage: React.FC<CreateSchemaPageProps> = ({
  projectId,
  userId,
  isFirstUpload,
  fileId,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState({
    name: "",
    description: "",
  });
  const [extractedColumns, setExtractedColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<{
    [key: string]: boolean;
  }>({});
  const [columnTypes, setColumnTypes] = useState<{ [key: string]: string }>({});

  // Load extracted columns from localStorage if this is a first upload
  useEffect(() => {
    if (isFirstUpload) {
      try {
        const storedColumns = localStorage.getItem("extractedColumns");
        if (storedColumns) {
          const columns = JSON.parse(storedColumns);
          console.log("Loaded columns from localStorage:", columns);
          setExtractedColumns(columns);

          // Initialize all columns as selected and with default types
          const initialSelectedState: { [key: string]: boolean } = {};
          const initialColumnTypes: { [key: string]: string } = {};

          columns.forEach((column: string) => {
            initialSelectedState[column] = true;
            initialColumnTypes[column] = determineColumnType(column);
          });

          setSelectedColumns(initialSelectedState);
          setColumnTypes(initialColumnTypes);

          // Set a default schema name based on the project
          setSchema({
            name: `${projectId} Schema`,
            description: "Automatically generated from uploaded file",
          });
        }
      } catch (err) {
        console.error("Error loading extracted columns:", err);
      }
    }
  }, [isFirstUpload, projectId]);

  // Fetch actual column names from the file if we have a fileId
  useEffect(() => {
    if (fileId && isFirstUpload) {
      const fetchFileColumns = async () => {
        try {
          console.log("Fetching columns for file:", fileId);

          // First try file-parsed-data endpoint
          const parsedDataResponse = await fetch(
            `/api/file-parsed-data/${fileId}`
          );

          if (parsedDataResponse.ok) {
            const parsedData = await parsedDataResponse.json();
            console.log("Parsed data response:", parsedData);

            // Extract columns from the parsed data response
            let actualColumns: string[] = [];

            // Try to get columns from the columns field first
            if (parsedData.columns) {
              if (Array.isArray(parsedData.columns)) {
                actualColumns = parsedData.columns;
                console.log("Using columns from columns array:", actualColumns);
              } else if (
                typeof parsedData.columns === "object" &&
                parsedData.columns !== null
              ) {
                // If columns is an object, try to extract column names
                actualColumns = Object.keys(parsedData.columns);
                console.log(
                  "Extracted column names from columns object:",
                  actualColumns
                );
              }
            }

            // If we still don't have columns, try to get them from the data
            if (
              actualColumns.length === 0 &&
              parsedData.data &&
              Array.isArray(parsedData.data) &&
              parsedData.data.length > 0
            ) {
              // Get column names from the first row of data
              if (
                typeof parsedData.data[0] === "object" &&
                parsedData.data[0] !== null
              ) {
                actualColumns = Object.keys(parsedData.data[0]);
                console.log("Extracted columns from data:", actualColumns);
              }
            }

            // If we found actual columns, update the state
            if (actualColumns.length > 0) {
              console.log("Setting actual columns:", actualColumns);
              setExtractedColumns(actualColumns);

              // Update selected columns and column types
              const updatedSelectedState: { [key: string]: boolean } = {};
              const updatedColumnTypes: { [key: string]: string } = {};

              actualColumns.forEach((column: string) => {
                updatedSelectedState[column] = true;
                updatedColumnTypes[column] = determineColumnType(column);
              });

              setSelectedColumns(updatedSelectedState);
              setColumnTypes(updatedColumnTypes);
            }
          } else {
            console.warn(
              "Failed to fetch parsed data, falling back to file-data endpoint"
            );

            // Fall back to file-data endpoint
            const fileDataResponse = await fetch(`/api/file-data/${fileId}`);

            if (fileDataResponse.ok) {
              const fileData = await fileDataResponse.json();

              // Extract columns from the file data response
              let actualColumns: string[] = [];

              if (
                fileData.data &&
                Array.isArray(fileData.data) &&
                fileData.data.length > 0
              ) {
                // Try to extract columns from the first row of data
                if (
                  typeof fileData.data[0] === "object" &&
                  fileData.data[0] !== null
                ) {
                  actualColumns = Object.keys(fileData.data[0]);
                  console.log(
                    "Extracted columns from file-data:",
                    actualColumns
                  );

                  // Update state with actual columns
                  if (actualColumns.length > 0) {
                    setExtractedColumns(actualColumns);

                    // Update selected columns and column types
                    const updatedSelectedState: { [key: string]: boolean } = {};
                    const updatedColumnTypes: { [key: string]: string } = {};

                    actualColumns.forEach((column: string) => {
                      updatedSelectedState[column] = true;
                      updatedColumnTypes[column] = determineColumnType(column);
                    });

                    setSelectedColumns(updatedSelectedState);
                    setColumnTypes(updatedColumnTypes);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error fetching file columns:", error);
        }
      };

      fetchFileColumns();
    }
  }, [fileId, isFirstUpload]);

  // Helper function to determine column type based on name
  const determineColumnType = (columnName: string): string => {
    const lowerName = columnName.toLowerCase();

    if (lowerName.includes("date") || lowerName.includes("time")) {
      return "timestamp";
    } else if (
      lowerName.includes("price") ||
      lowerName.includes("cost") ||
      lowerName.includes("amount")
    ) {
      return "numeric";
    } else if (
      lowerName.includes("count") ||
      lowerName.includes("number") ||
      lowerName.includes("qty") ||
      lowerName.includes("quantity")
    ) {
      return "integer";
    } else if (lowerName.includes("is_") || lowerName.includes("has_")) {
      return "boolean";
    } else {
      return "text";
    }
  };

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

      // For first upload, create schema with selected columns
      if (isFirstUpload && extractedColumns.length > 0) {
        // Create columns array from selected columns
        const columns = Object.entries(selectedColumns)
          .filter(([column, isSelected]) => isSelected)
          .map(([column]) => ({
            name: column,
            type: columnTypes[column] || "text",
            isRequired: false,
          }));

        if (columns.length === 0) {
          setError("Please select at least one column for your schema");
          setLoading(false);
          return;
        }

        // Create schema with columns
        const response = await axios.post("/api/schema-management", {
          action: "create_with_columns",
          userId,
          projectId,
          name: schema.name,
          description: schema.description,
          columns: columns,
        });

        // If we have a fileId, map the columns to the schema
        if (fileId) {
          // Create column mapping
          const mappings: Record<string, string> = {};
          console.log(
            "Creating column mappings for columns:",
            columns.map((col) => col.name)
          );
          columns.forEach((column) => {
            mappings[column.name] = column.name; // Direct mapping for first upload
            console.log(`Adding mapping: ${column.name} -> ${column.name}`);
          });

          console.log("Final mappings object:", mappings);
          await axios.post("/api/column-mappings", {
            fileId,
            schemaId: response.data.id,
            mappings: mappings,
          });
        }

        // Clear localStorage
        localStorage.removeItem("extractedColumns");
        localStorage.removeItem("uploadedFileId");

        // Redirect back to project dashboard with success message
        router.push({
          pathname: "/project/[id]/dashboard",
          query: { id: projectId, schemaCreated: "true" },
        });
      } else {
        // Regular schema creation (without columns)
        const response = await axios.post("/api/schema-management", {
          userId,
          projectId,
          name: schema.name,
          description: schema.description,
          columns: [],
        });

        // Redirect to schema columns page
        router.push({
          pathname: "/project/[id]/schema/columns",
          query: { id: projectId, schemaId: response.data.id },
        });
      }
    } catch (err) {
      console.error("Error creating schema:", err);
      setError("Failed to create schema");
      setLoading(false);
    }
  };

  // Toggle column selection
  const toggleColumnSelection = (column: string) => {
    setSelectedColumns({
      ...selectedColumns,
      [column]: !selectedColumns[column],
    });
  };

  // Update column type
  const updateColumnType = (column: string, type: string) => {
    setColumnTypes({
      ...columnTypes,
      [column]: type,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {isFirstUpload
            ? "Create Schema from Uploaded File"
            : "Create New Schema"}
        </h1>
        <p className="text-gray-600">
          {isFirstUpload
            ? "Review and select columns from your uploaded file to create a global schema."
            : "Create a new global schema for your project."}
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

          {/* Column selection for first upload */}
          {isFirstUpload && extractedColumns.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Select Columns for Schema
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                Select the columns from your uploaded file that you want to
                include in your schema.
              </p>

              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Include
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Column Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {extractedColumns.map((column, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedColumns[column] || false}
                            onChange={() => toggleColumnSelection(column)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {column}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <select
                            value={columnTypes[column] || "text"}
                            onChange={(e) =>
                              updateColumnType(column, e.target.value)
                            }
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            disabled={!selectedColumns[column]}
                          >
                            <option value="text">Text</option>
                            <option value="integer">Integer</option>
                            <option value="numeric">Numeric</option>
                            <option value="boolean">Boolean</option>
                            <option value="timestamp">Timestamp</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const newSelectedColumns = { ...selectedColumns };
                    extractedColumns.forEach((column) => {
                      newSelectedColumns[column] = true;
                    });
                    setSelectedColumns(newSelectedColumns);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newSelectedColumns = { ...selectedColumns };
                    extractedColumns.forEach((column) => {
                      newSelectedColumns[column] = false;
                    });
                    setSelectedColumns(newSelectedColumns);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

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
              {loading
                ? "Creating..."
                : isFirstUpload
                ? "Create Schema & Map Columns"
                : "Create Schema"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  const isDevelopment = process.env.NODE_ENV === "development";

  // Handle authentication
  if (!session && !isDevelopment) {
    return {
      redirect: {
        destination: "/auth/signin",
        permanent: false,
      },
    };
  }

  // Use a default user email for development
  // Check for test user email header (for testing purposes only)
  const testUserEmail = isDevelopment
    ? context.req.headers["x-test-user-email"]
    : null;
  const userEmail =
    session?.user?.email || (isDevelopment ? "dev@example.com" : "");
  const userId = testUserEmail ? String(testUserEmail) : userEmail || "unknown";

  try {
    const { id: projectId } = context.query;
    const { firstUpload, fileId } = context.query;

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
        userId,
        isFirstUpload: firstUpload === "true",
        fileId: fileId || null,
      },
    };
  } catch (error) {
    console.error("Error in getServerSideProps:", error);
    return {
      props: {
        projectId: context.query.id,
        userId,
        error: "Failed to load data",
      },
    };
  }
};

export default CreateSchemaPage;
