import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

interface SchemaColumn {
  name: string;
  type: string;
  description?: string;
  sourceFile?: string;
  sourceColumn?: string;
  isRequired?: boolean;
}

interface GlobalSchema {
  id: string;
  userId: string;
  name: string;
  description?: string;
  columns: SchemaColumn[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

interface FileColumn {
  name: string;
  type?: string;
  sample?: string;
}

interface ColumnMapping {
  fileColumn: string;
  schemaColumn: string;
  transformationRule?: string;
}

/**
 * SchemaMapping page for mapping file columns to global schema
 */
const SchemaMapping: React.FC = () => {
  const router = useRouter();
  const { id, fileId } = router.query;
  const { data: session, status } = useSession();
  const [schema, setSchema] = useState<GlobalSchema | null>(null);
  const [fileColumns, setFileColumns] = useState<FileColumn[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Redirect to project page if no fileId is provided
  useEffect(() => {
    if (status === "authenticated" && id && !fileId) {
      router.push(`/project/${id}`);
    }
  }, [id, fileId, status, router]);

  // Fetch schema and file columns
  useEffect(() => {
    const fetchData = async () => {
      if (status !== "authenticated" || !id || !fileId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch global schema
        const schemaResponse = await fetch(`/api/projects/${id}/schema`);
        if (!schemaResponse.ok) {
          throw new Error("Failed to fetch global schema");
        }
        const schemaData = await schemaResponse.json();
        setSchema(schemaData.schema);

        // Fetch file columns
        const fileResponse = await fetch(`/api/file-synopsis/${fileId}`);
        if (!fileResponse.ok) {
          throw new Error("Failed to fetch file columns");
        }
        const fileData = await fileResponse.json();

        // Extract columns from the response
        let extractedColumns: string[] = [];

        if (fileData.columns) {
          extractedColumns = Array.isArray(fileData.columns)
            ? fileData.columns
            : typeof fileData.columns === "object" && fileData.columns !== null
            ? Object.keys(fileData.columns)
            : [];
        } else if (fileData.metadata?.columns) {
          extractedColumns = Array.isArray(fileData.metadata.columns)
            ? fileData.metadata.columns
            : typeof fileData.metadata.columns === "object" &&
              fileData.metadata.columns !== null
            ? Object.keys(fileData.metadata.columns)
            : [];
        } else if (fileData.schema?.fields) {
          extractedColumns = Array.isArray(fileData.schema.fields)
            ? fileData.schema.fields.map((f: any) => f.name || f)
            : [];
        } else if (fileData.headers) {
          extractedColumns = Array.isArray(fileData.headers)
            ? fileData.headers
            : [];
        } else if (
          fileData.data &&
          Array.isArray(fileData.data) &&
          fileData.data.length > 0
        ) {
          // If we have data rows, try to extract column names from the first row
          if (
            typeof fileData.data[0] === "object" &&
            fileData.data[0] !== null
          ) {
            extractedColumns = Object.keys(fileData.data[0]);
          }
        }

        // Convert to FileColumn objects
        const fileColumnObjects = extractedColumns.map((column) => ({
          name: column,
          type: determineColumnType(column),
        }));

        setFileColumns(fileColumnObjects);

        // Initialize mappings with auto-matched columns
        initializeMappings(fileColumnObjects, schemaData.schema.columns);

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, fileId, status]);

  /**
   * Determine column type based on name
   */
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

  /**
   * Initialize mappings with auto-matched columns
   */
  const initializeMappings = (
    fileColumns: FileColumn[],
    schemaColumns: SchemaColumn[]
  ) => {
    const initialMappings = fileColumns.map((fileColumn) => {
      // Try to find a matching schema column by name
      const matchingSchemaColumn = findMatchingSchemaColumn(
        fileColumn.name,
        schemaColumns
      );

      return {
        fileColumn: fileColumn.name,
        schemaColumn: matchingSchemaColumn?.name || "",
        transformationRule: "",
      };
    });

    setMappings(initialMappings);
  };

  /**
   * Find a matching schema column based on name similarity
   */
  const findMatchingSchemaColumn = (
    fileColumn: string,
    schemaColumns: SchemaColumn[]
  ): SchemaColumn | undefined => {
    // Normalize the file column name
    const normalizedFileColumn = fileColumn
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    // First try exact match
    let match = schemaColumns.find(
      (sc) => sc.name.toLowerCase() === fileColumn.toLowerCase()
    );

    if (match) return match;

    // Then try normalized match
    match = schemaColumns.find(
      (sc) =>
        sc.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedFileColumn
    );

    if (match) return match;

    // Then try contains match
    match = schemaColumns.find(
      (sc) =>
        normalizedFileColumn.includes(
          sc.name.toLowerCase().replace(/[^a-z0-9]/g, "")
        ) ||
        sc.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .includes(normalizedFileColumn)
    );

    return match;
  };

  /**
   * Update a mapping
   */
  const updateMapping = (fileColumn: string, schemaColumn: string) => {
    setMappings(
      mappings.map((m) =>
        m.fileColumn === fileColumn ? { ...m, schemaColumn } : m
      )
    );
  };

  /**
   * Update a transformation rule
   */
  const updateTransformationRule = (
    fileColumn: string,
    transformationRule: string
  ) => {
    setMappings(
      mappings.map((m) =>
        m.fileColumn === fileColumn ? { ...m, transformationRule } : m
      )
    );
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schema) {
      setError("No schema selected");
      return;
    }

    // Check if at least one column is mapped
    const validMappings = mappings.filter((m) => m.schemaColumn);
    if (validMappings.length === 0) {
      setError("At least one column must be mapped");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Call the API to save the column mapping
      const response = await fetch("/api/column-mappings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: Array.isArray(fileId) ? fileId[0] : fileId,
          schemaId: schema.id,
          mappings: validMappings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save column mapping");
      }

      // Redirect to the project dashboard
      router.push(`/project/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
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
            onClick={() => router.push(`/project/${id}`)}
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
            onClick={() => router.push(`/project/${id}`)}
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
          No global schema found. Please create a schema first.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/project/${id}`)}
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

      <h1 className="text-3xl font-bold text-primary dark:text-primary mb-8">
        Map Columns to Global Schema
      </h1>

      <form onSubmit={handleSubmit}>
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
          </div>
        </div>

        <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
            Column Mapping
          </h2>

          <div className="mb-4">
            <p className="text-sm text-secondary dark:text-secondary">
              Map columns from your file to the global schema. You can also
              specify transformation rules for data normalization.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    File Column
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Schema Column
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Transformation Rule
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {mappings.map((mapping, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {mapping.fileColumn}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={mapping.schemaColumn}
                        onChange={(e) =>
                          updateMapping(mapping.fileColumn, e.target.value)
                        }
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                      >
                        <option value="">-- Not Mapped --</option>
                        {schema.columns.map((column) => (
                          <option key={column.name} value={column.name}>
                            {column.name} ({column.type})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        value={mapping.transformationRule || ""}
                        onChange={(e) =>
                          updateTransformationRule(
                            mapping.fileColumn,
                            e.target.value
                          )
                        }
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                        placeholder="e.g., UPPER, LOWER, TRIM"
                        disabled={!mapping.schemaColumn}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push(`/project/${id}`)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 bg-accent-primary text-white rounded-md ${
              isSubmitting
                ? "opacity-70 cursor-not-allowed"
                : "hover:bg-accent-primary-hover"
            }`}
          >
            {isSubmitting ? "Saving..." : "Save Mapping"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SchemaMapping;
