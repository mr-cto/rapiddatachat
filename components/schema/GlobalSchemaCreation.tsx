import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { ColumnInfo } from "../../lib/fileParsingService";

interface SchemaColumn {
  name: string;
  type: string;
  description?: string;
  sourceFile?: string;
  sourceColumn?: string;
  isRequired?: boolean;
  isSelected?: boolean;
}

interface GlobalSchemaCreationProps {
  projectId: string;
  fileId: string;
}

/**
 * GlobalSchemaCreation component for creating a global schema from a file
 */
const GlobalSchemaCreation: React.FC<GlobalSchemaCreationProps> = ({
  projectId,
  fileId,
}) => {
  const router = useRouter();
  const [schemaName, setSchemaName] = useState("");
  const [schemaDescription, setSchemaDescription] = useState("");
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  // Fetch file columns
  useEffect(() => {
    const fetchFileColumns = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch file details
        const fileResponse = await fetch(`/api/files/${fileId}`);
        if (!fileResponse.ok) {
          throw new Error("Failed to fetch file details");
        }

        const fileData = await fileResponse.json();
        setFileName(fileData.filename || "Unknown File");

        // Fetch parsed columns using the new file-parsing API
        const response = await fetch(
          `/api/file-parsing/${fileId}?type=columns`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch file columns");
        }

        const data = await response.json();

        if (
          !data.columns ||
          !Array.isArray(data.columns) ||
          data.columns.length === 0
        ) {
          throw new Error("No columns found in the file");
        }

        // Convert to SchemaColumn objects
        const schemaColumns = data.columns.map((column: ColumnInfo) => ({
          name: column.name,
          type: mapDataTypeToSchemaType(column.dataType),
          description: "",
          sourceFile: fileData.filename || "Unknown",
          sourceColumn: column.name,
          isSelected: true,
        }));

        setColumns(schemaColumns);
        setSchemaName(`${fileData.filename || "File"} Schema`);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setIsLoading(false);
      }
    };

    if (fileId) {
      fetchFileColumns();
    }
  }, [fileId]);

  /**
   * Map data type from file parsing to schema type
   */
  const mapDataTypeToSchemaType = (dataType: string): string => {
    switch (dataType.toLowerCase()) {
      case "integer":
        return "integer";
      case "float":
      case "numeric":
        return "numeric";
      case "date":
      case "timestamp":
        return "timestamp";
      case "boolean":
        return "boolean";
      case "string":
      case "text":
      default:
        return "text";
    }
  };

  /**
   * Toggle column selection
   */
  const toggleColumnSelection = (index: number) => {
    setColumns(
      columns.map((column, i) =>
        i === index ? { ...column, isSelected: !column.isSelected } : column
      )
    );
  };

  /**
   * Update column type
   */
  const updateColumnType = (index: number, type: string) => {
    setColumns(
      columns.map((column, i) => (i === index ? { ...column, type } : column))
    );
  };

  /**
   * Update column description
   */
  const updateColumnDescription = (index: number, description: string) => {
    setColumns(
      columns.map((column, i) =>
        i === index ? { ...column, description } : column
      )
    );
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schemaName.trim()) {
      setError("Schema name is required");
      return;
    }

    // Check if at least one column is selected
    const selectedColumns = columns.filter((column) => column.isSelected);
    if (selectedColumns.length === 0) {
      setError("At least one column must be selected");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Call the API to create a global schema
      const response = await fetch("/api/schema-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          name: schemaName,
          description: schemaDescription,
          columns: selectedColumns.map(({ isSelected, ...column }) => column),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create schema");
      }

      const data = await response.json();

      // Redirect to the project dashboard
      router.push(`/project/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-primary dark:text-primary">
        Create Global Schema
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
            Schema Information
          </h2>

          <div className="mb-4">
            <label
              htmlFor="schemaName"
              className="block text-sm font-medium text-secondary dark:text-secondary mb-1"
            >
              Schema Name *
            </label>
            <input
              type="text"
              id="schemaName"
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
              placeholder="Enter schema name"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="schemaDescription"
              className="block text-sm font-medium text-secondary dark:text-secondary mb-1"
            >
              Description
            </label>
            <textarea
              id="schemaDescription"
              value={schemaDescription}
              onChange={(e) => setSchemaDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
              placeholder="Enter schema description (optional)"
              rows={3}
            />
          </div>
        </div>

        <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
            Schema Columns
          </h2>

          <div className="mb-4">
            <p className="text-sm text-secondary dark:text-secondary">
              Select the columns from <strong>{fileName}</strong> to include in
              your global schema. You can modify the data type and add
              descriptions.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Include
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Column Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Data Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {columns.map((column, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={column.isSelected}
                        onChange={() => toggleColumnSelection(index)}
                        className="h-4 w-4 text-accent-primary focus:ring-accent-primary border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {column.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={column.type}
                        onChange={(e) =>
                          updateColumnType(index, e.target.value)
                        }
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                        disabled={!column.isSelected}
                      >
                        <option value="text">Text</option>
                        <option value="integer">Integer</option>
                        <option value="numeric">Numeric</option>
                        <option value="boolean">Boolean</option>
                        <option value="timestamp">Timestamp</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        value={column.description || ""}
                        onChange={(e) =>
                          updateColumnDescription(index, e.target.value)
                        }
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                        placeholder="Optional description"
                        disabled={!column.isSelected}
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
            onClick={() => router.push(`/project/${projectId}`)}
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
            {isSubmitting ? "Creating..." : "Create Schema"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GlobalSchemaCreation;
