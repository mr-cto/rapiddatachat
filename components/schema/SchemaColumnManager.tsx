import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { SchemaColumn } from "../../lib/globalSchemaService";

interface SchemaColumnManagerProps {
  schemaId: string;
  initialColumns?: SchemaColumn[];
  onColumnsUpdated?: (columns: SchemaColumn[]) => void;
  readOnly?: boolean;
}

/**
 * Component for managing schema columns
 */
const SchemaColumnManager: React.FC<SchemaColumnManagerProps> = ({
  schemaId,
  initialColumns = [],
  onColumnsUpdated,
  readOnly = false,
}) => {
  const router = useRouter();
  const [columns, setColumns] = useState<SchemaColumn[]>(initialColumns);
  const [newColumn, setNewColumn] = useState<SchemaColumn>({
    name: "",
    type: "text",
    description: "",
    isRequired: false,
  });
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactAnalysis, setImpactAnalysis] = useState<{
    warnings: string[];
  } | null>(null);
  const [createNewVersion, setCreateNewVersion] = useState(false);

  // Update columns state when initialColumns prop changes
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  // Available column types
  const columnTypes = ["text", "integer", "numeric", "boolean", "timestamp"];

  /**
   * Handle adding a new column
   */
  const handleAddColumn = async () => {
    try {
      // Validate the new column
      if (!newColumn.name) {
        setError("Column name is required");
        return;
      }

      // Check for duplicate column names
      if (
        columns.some(
          (c) => c.name.toLowerCase() === newColumn.name.toLowerCase()
        )
      ) {
        setError(`Column name '${newColumn.name}' already exists`);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Call the API to add the column
      const response = await fetch("/api/schema-columns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schemaId,
          columns: [newColumn],
          createNewVersion,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add column");
      }

      const data = await response.json();

      // Update the columns state
      setColumns(data.schema.columns);

      // Set impact analysis warnings
      if (data.impactAnalysis && data.impactAnalysis.warnings) {
        setImpactAnalysis(data.impactAnalysis);
      } else {
        setImpactAnalysis(null);
      }

      // Reset the new column form
      setNewColumn({
        name: "",
        type: "text",
        description: "",
        isRequired: false,
      });

      // Notify parent component
      if (onColumnsUpdated) {
        onColumnsUpdated(data.schema.columns);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle updating a column
   */
  const handleUpdateColumn = async (index: number) => {
    try {
      const columnToUpdate = columns[index];

      setIsLoading(true);
      setError(null);

      // Call the API to update the column
      const response = await fetch("/api/schema-columns", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schemaId,
          columnName: columnToUpdate.name,
          column: columnToUpdate,
          createNewVersion,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update column");
      }

      const data = await response.json();

      // Update the columns state
      setColumns(data.schema.columns);

      // Set impact analysis warnings
      if (data.impactAnalysis && data.impactAnalysis.warnings) {
        setImpactAnalysis(data.impactAnalysis);
      } else {
        setImpactAnalysis(null);
      }

      // Exit editing mode
      setEditingColumnIndex(null);

      // Notify parent component
      if (onColumnsUpdated) {
        onColumnsUpdated(data.schema.columns);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle removing a column
   */
  const handleRemoveColumn = async (index: number) => {
    try {
      const columnToRemove = columns[index];

      // Confirm deletion
      if (
        !window.confirm(
          `Are you sure you want to remove the column '${columnToRemove.name}'?`
        )
      ) {
        return;
      }

      setIsLoading(true);
      setError(null);

      // Call the API to remove the column
      const response = await fetch("/api/schema-columns", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schemaId,
          columnName: columnToRemove.name,
          createNewVersion,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove column");
      }

      const data = await response.json();

      // Update the columns state
      setColumns(data.schema.columns);

      // Reset impact analysis
      setImpactAnalysis(null);

      // Notify parent component
      if (onColumnsUpdated) {
        onColumnsUpdated(data.schema.columns);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle editing a column
   */
  const handleEditColumn = (index: number) => {
    setEditingColumnIndex(index);
  };

  /**
   * Handle canceling column edit
   */
  const handleCancelEdit = () => {
    setEditingColumnIndex(null);
  };

  /**
   * Handle changing a column property
   */
  const handleColumnChange = (index: number, field: string, value: any) => {
    const updatedColumns = [...columns];
    updatedColumns[index] = {
      ...updatedColumns[index],
      [field]: value,
    };
    setColumns(updatedColumns);
  };

  /**
   * Handle changing a new column property
   */
  const handleNewColumnChange = (field: string, value: any) => {
    setNewColumn({
      ...newColumn,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Impact analysis warnings */}
      {impactAnalysis && impactAnalysis.warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300">
          <h3 className="font-semibold mb-2">Warnings:</h3>
          <ul className="list-disc list-inside">
            {impactAnalysis.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Version control option */}
      {!readOnly && (
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="createNewVersion"
            checked={createNewVersion}
            onChange={(e) => setCreateNewVersion(e.target.checked)}
            className="mr-2 h-4 w-4 text-accent-primary focus:ring-accent-primary border-gray-300 rounded"
          />
          <label
            htmlFor="createNewVersion"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            Create a new version when making changes
          </label>
        </div>
      )}

      {/* Existing columns */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Schema Columns
        </h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Required
                </th>
                {!readOnly && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {columns.map((column, index) => (
                <tr key={index}>
                  {editingColumnIndex === index ? (
                    // Editing mode
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={column.name}
                          disabled={true} // Don't allow changing the column name
                          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm bg-gray-100 dark:bg-gray-800"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={column.type}
                          onChange={(e) =>
                            handleColumnChange(index, "type", e.target.value)
                          }
                          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                        >
                          {columnTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={column.description || ""}
                          onChange={(e) =>
                            handleColumnChange(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={column.isRequired || false}
                          onChange={(e) =>
                            handleColumnChange(
                              index,
                              "isRequired",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 text-accent-primary focus:ring-accent-primary border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleUpdateColumn(index)}
                          disabled={isLoading}
                          className="mr-2 px-3 py-1 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    // View mode
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {column.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {column.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {column.description || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {column.isRequired ? "Yes" : "No"}
                      </td>
                      {!readOnly && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleEditColumn(index)}
                            className="mr-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveColumn(index)}
                            className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {columns.length === 0 && (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            No columns defined yet.
          </div>
        )}
      </div>

      {/* Add new column form */}
      {!readOnly && (
        <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
            Add New Column
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newColumn.name}
                onChange={(e) => handleNewColumnChange("name", e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                placeholder="Column name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={newColumn.type}
                onChange={(e) => handleNewColumnChange("type", e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
              >
                {columnTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newColumn.description || ""}
                onChange={(e) =>
                  handleNewColumnChange("description", e.target.value)
                }
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary text-sm"
                placeholder="Column description"
              />
            </div>

            <div className="flex items-center">
              <div className="mt-5">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={newColumn.isRequired || false}
                  onChange={(e) =>
                    handleNewColumnChange("isRequired", e.target.checked)
                  }
                  className="mr-2 h-4 w-4 text-accent-primary focus:ring-accent-primary border-gray-300 rounded"
                />
                <label
                  htmlFor="isRequired"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Required
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleAddColumn}
              disabled={isLoading}
              className={`px-4 py-2 bg-accent-primary text-white rounded-md ${
                isLoading
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:bg-accent-primary-hover"
              }`}
            >
              {isLoading ? "Adding..." : "Add Column"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaColumnManager;
