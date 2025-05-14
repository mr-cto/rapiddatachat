import React, { useState, useEffect } from "react";
import { GlobalSchema, SchemaColumn } from "../lib/schemaManagement";
import { ViewStateManager } from "../lib/viewStateManager";
import Modal from "./Modal";
import { v4 as uuidv4 } from "uuid";

interface SchemaManagerProps {
  userId: string;
  viewStateManager?: ViewStateManager;
  onSchemaChange?: (schema: GlobalSchema | null) => void;
}

/**
 * SchemaManager component for managing global schemas
 */
export const SchemaManager: React.FC<SchemaManagerProps> = ({
  userId,
  viewStateManager,
  onSchemaChange,
}) => {
  const [schemas, setSchemas] = useState<GlobalSchema[]>([]);
  const [activeSchema, setActiveSchema] = useState<GlobalSchema | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState("");
  const [newSchemaDescription, setNewSchemaDescription] = useState("");
  const [editingSchema, setEditingSchema] = useState<GlobalSchema | null>(null);
  const [createCustomSchema, setCreateCustomSchema] = useState(false);
  const [customColumns, setCustomColumns] = useState<SchemaColumn[]>([
    { id: uuidv4(), name: "", type: "text" },
  ]);

  // Fetch schemas on component mount
  useEffect(() => {
    if (userId) {
      fetchSchemas();
    }
  }, [userId]);

  // Fetch all schemas for the user
  const fetchSchemas = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/schema-management");
      if (!response.ok) {
        throw new Error("Failed to fetch schemas");
      }

      const data = await response.json();
      const userSchemas = data.schemas;
      setSchemas(userSchemas);

      // Set active schema if one is marked as active
      const active = userSchemas.find(
        (schema: GlobalSchema) => schema.isActive
      );
      if (active) {
        setActiveSchema(active);
        // Don't call onSchemaChange here to prevent modal from closing
        console.log(
          "Found active schema, but not calling onSchemaChange to prevent modal from closing"
        );
      }

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch schemas");
      setIsLoading(false);
    }
  };

  // Add a custom column to the schema
  const addCustomColumn = () => {
    setCustomColumns([
      ...customColumns,
      { id: uuidv4(), name: "", type: "text" },
    ]);
  };

  // Remove a custom column from the schema
  const removeCustomColumn = (index: number) => {
    const updatedColumns = [...customColumns];
    updatedColumns.splice(index, 1);
    setCustomColumns(updatedColumns);
  };

  // Update a custom column
  const updateCustomColumn = (
    index: number,
    field: keyof SchemaColumn,
    value: string
  ) => {
    const updatedColumns = [...customColumns];
    updatedColumns[index] = { ...updatedColumns[index], [field]: value };
    setCustomColumns(updatedColumns);
  };

  // Create a new schema (either from files or with custom columns)
  const handleCreateSchema = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate custom columns if creating a custom schema
      if (createCustomSchema) {
        // Filter out empty columns
        const validColumns = customColumns.filter(
          (col) => col.name.trim() !== ""
        );

        if (validColumns.length === 0) {
          throw new Error("Please add at least one column with a name");
        }

        // Create schema with custom columns
        const response = await fetch("/api/schema-management", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_with_columns",
            name: newSchemaName,
            description: newSchemaDescription,
            columns: validColumns,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create custom schema");
        }

        const data = await response.json();
        const newSchema = data.schema;

        setSchemas([...schemas, newSchema]);
        setShowCreateModal(false);
        setNewSchemaName("");
        setNewSchemaDescription("");
        setCustomColumns([{ id: uuidv4(), name: "", type: "text" }]);
        setCreateCustomSchema(false);
        setIsLoading(false);

        // Notify parent of schema change
        if (onSchemaChange) {
          onSchemaChange(newSchema);
        }
      } else {
        // Create schema from files (original behavior)
        const response = await fetch("/api/schema-management", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_from_files",
            name: newSchemaName,
            description: newSchemaDescription,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error || "Failed to create schema";

          // Show a more helpful error message when there are no active files
          if (errorMessage.includes("No active files found")) {
            throw new Error(
              "No active files found. Please upload and activate at least one file before creating a schema, or create a custom schema instead."
            );
          } else {
            throw new Error(errorMessage);
          }
        }

        const data = await response.json();
        const newSchema = data.schema;

        setSchemas([...schemas, newSchema]);
        setShowCreateModal(false);
        setNewSchemaName("");
        setNewSchemaDescription("");
        setIsLoading(false);

        // Notify parent of schema change
        if (onSchemaChange) {
          onSchemaChange(newSchema);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schema");
      setIsLoading(false);
    }
  };

  // Update an existing schema
  const handleUpdateSchema = async () => {
    if (!editingSchema) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/schema-management", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingSchema),
      });

      if (!response.ok) {
        throw new Error("Failed to update schema");
      }

      const data = await response.json();
      const updatedSchema = data.schema;

      if (updatedSchema) {
        setSchemas(
          schemas.map((s) => (s.id === updatedSchema.id ? updatedSchema : s))
        );

        // Update active schema if it was the one edited
        if (activeSchema && activeSchema.id === updatedSchema.id) {
          setActiveSchema(updatedSchema);

          // Notify parent of schema change
          if (onSchemaChange) {
            onSchemaChange(updatedSchema);
          }
        }
      }

      setShowEditModal(false);
      setEditingSchema(null);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update schema");
      setIsLoading(false);
    }
  };

  // Delete a schema
  const handleDeleteSchema = async (schemaId: string) => {
    if (!confirm("Are you sure you want to delete this schema?")) return;

    try {
      console.log(`Attempting to delete schema ${schemaId}`);
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/schema-management?id=${schemaId}`, {
        method: "DELETE",
      });

      console.log(`Delete response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error deleting schema: ${errorText}`);
        throw new Error(`Failed to delete schema: ${errorText}`);
      }

      const data = await response.json();
      console.log(`Delete response data:`, data);

      if (data.success) {
        console.log(`Schema ${schemaId} deleted successfully`);
        setSchemas(schemas.filter((s) => s.id !== schemaId));

        // Clear active schema if it was the one deleted
        if (activeSchema && activeSchema.id === schemaId) {
          setActiveSchema(null);

          // We don't notify the parent when a schema is deleted
          // This prevents the modal from closing automatically
        }
      } else {
        console.error(`Schema deletion returned success: false`);
        throw new Error("Schema deletion failed on the server");
      }

      setIsLoading(false);
    } catch (err) {
      console.error(`Error in handleDeleteSchema:`, err);
      setError(err instanceof Error ? err.message : "Failed to delete schema");
      setIsLoading(false);
    }
  };

  // Set a schema as active
  const handleSetActiveSchema = async (schema: GlobalSchema) => {
    try {
      setIsLoading(true);
      setError(null);

      // Update the schema to set it as active
      const response = await fetch("/api/schema-management", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: schema.id,
          isActive: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to set active schema");
      }

      const data = await response.json();

      // Refresh schemas to get the updated list with correct active states
      await fetchSchemas();

      setActiveSchema(schema);

      // Apply the schema to the view state if available
      if (viewStateManager) {
        // This would need to be handled differently since we can't directly call the service
        // For now, we'll rely on the parent component to handle this
      }

      // Notify parent of schema change
      if (onSchemaChange) {
        onSchemaChange(schema);
      }

      setIsLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set active schema"
      );
      setIsLoading(false);
    }
  };

  // Open edit modal with schema data
  const openEditModal = (schema: GlobalSchema) => {
    setEditingSchema({ ...schema });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Global Schemas</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          disabled={isLoading}
        >
          Create New Schema
        </button>
      </div>

      <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">
        <p>
          Manage your schemas here. You can create, edit, and delete schemas to
          organize your data.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md">{error}</div>
      )}

      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : schemas.length === 0 ? (
        <div className="p-4 text-center text-gray-500 border border-dashed border-gray-300 rounded-md">
          No schemas available. Create a new schema to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {schemas.map((schema) => (
            <div
              key={schema.id}
              className={`p-3 border rounded-md ${
                schema.isActive
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{schema.name}</h3>
                  {schema.description && (
                    <p className="text-sm text-gray-500">
                      {schema.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {schema.columns.length} columns • Last updated:{" "}
                    {new Date(schema.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {!schema.isActive && (
                    <button
                      onClick={() => handleSetActiveSchema(schema)}
                      className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(schema)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSchema(schema.id)}
                    className="px-2 py-1 text-xs bg-red-500 text-white font-bold rounded hover:bg-red-600"
                  >
                    Delete Schema
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Schema Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateCustomSchema(false);
          setCustomColumns([{ id: uuidv4(), name: "", type: "text" }]);
        }}
        title="Create New Schema"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Schema Name
            </label>
            <input
              type="text"
              value={newSchemaName}
              onChange={(e) => setNewSchemaName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Enter schema name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              value={newSchemaDescription}
              onChange={(e) => setNewSchemaDescription(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Enter schema description"
              rows={3}
            />
          </div>

          {/* Schema Type Selection */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center space-x-4 mb-4">
              <button
                type="button"
                onClick={() => setCreateCustomSchema(false)}
                className={`px-3 py-2 rounded-md ${
                  !createCustomSchema
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300"
                }`}
              >
                Create from Files
              </button>
              <button
                type="button"
                onClick={() => setCreateCustomSchema(true)}
                className={`px-3 py-2 rounded-md ${
                  createCustomSchema
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300"
                }`}
              >
                Create Custom Schema
              </button>
            </div>

            {createCustomSchema && (
              <div className="space-y-3 border border-gray-200 rounded-md p-3 bg-gray-50">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-700">
                    Custom Columns
                  </h3>
                  <button
                    type="button"
                    onClick={addCustomColumn}
                    className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Add Column
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {customColumns.map((column, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-white p-2 rounded border border-gray-200"
                    >
                      <input
                        type="text"
                        value={column.name}
                        onChange={(e) =>
                          updateCustomColumn(index, "name", e.target.value)
                        }
                        className="flex-1 border border-gray-300 rounded-md p-1 text-sm"
                        placeholder="Column name"
                      />
                      <select
                        value={column.type}
                        onChange={(e) =>
                          updateCustomColumn(index, "type", e.target.value)
                        }
                        className="border border-gray-300 rounded-md p-1 text-sm"
                      >
                        <option value="text">Text</option>
                        <option value="integer">Integer</option>
                        <option value="numeric">Numeric</option>
                        <option value="boolean">Boolean</option>
                        <option value="timestamp">Timestamp</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeCustomColumn(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={customColumns.length <= 1}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {customColumns.length === 0 && (
                  <div className="text-center text-gray-500 py-2">
                    No columns added. Click &quot;Add Column&quot; to add one.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setCreateCustomSchema(false);
                setCustomColumns([{ id: uuidv4(), name: "", type: "text" }]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSchema}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              disabled={
                !newSchemaName ||
                isLoading ||
                (createCustomSchema &&
                  customColumns.every((col) => !col.name.trim()))
              }
            >
              {isLoading ? "Creating..." : "Create Schema"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Schema Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Schema"
      >
        {editingSchema && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Schema Name
              </label>
              <input
                type="text"
                value={editingSchema.name}
                onChange={(e) =>
                  setEditingSchema({ ...editingSchema, name: e.target.value })
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="Enter schema name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                value={editingSchema.description || ""}
                onChange={(e) =>
                  setEditingSchema({
                    ...editingSchema,
                    description: e.target.value,
                  })
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="Enter schema description"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Columns
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
                {editingSchema.columns.map((column, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0"
                  >
                    <div>
                      <span className="font-medium">{column.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({column.type})
                      </span>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={column.isRequired || false}
                        onChange={(e) => {
                          const updatedColumns = [...editingSchema.columns];
                          updatedColumns[index] = {
                            ...column,
                            isRequired: e.target.checked,
                          };
                          setEditingSchema({
                            ...editingSchema,
                            columns: updatedColumns,
                          });
                        }}
                        className="mr-2"
                      />
                      <label className="text-xs">Required</label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between space-x-2">
              <button
                onClick={() =>
                  editingSchema && handleDeleteSchema(editingSchema.id)
                }
                className="px-4 py-2 bg-red-500 text-white font-bold rounded-md hover:bg-red-600"
              >
                Delete Schema
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSchema}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  disabled={!editingSchema.name || isLoading}
                >
                  {isLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SchemaManager;
