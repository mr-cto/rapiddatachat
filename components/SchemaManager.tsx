import React, { useState, useEffect } from "react";
import { GlobalSchema, SchemaColumn } from "../lib/schemaManagement";
import { ViewStateManager } from "../lib/viewStateManager";
import Modal from "./Modal";
import { v4 as uuidv4 } from "uuid";

interface ColumnManagerProps {
  userId: string;
  projectId: string;
  viewStateManager?: ViewStateManager;
  onColumnChange?: (column: GlobalSchema | null) => void;
}

/**
 * ColumnManager component for managing global columns
 */
export const ColumnManager: React.FC<ColumnManagerProps> = ({
  userId,
  projectId,
  viewStateManager,
  onColumnChange,
}) => {
  const [columns, setColumns] = useState<GlobalSchema[]>([]);
  const [activeColumn, setActiveColumn] = useState<GlobalSchema | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnDescription, setNewColumnDescription] = useState("");
  const [editingColumn, setEditingColumn] = useState<GlobalSchema | null>(null);
  const [createCustomColumn, setCreateCustomColumn] = useState(false);
  const [customColumns, setCustomColumns] = useState<SchemaColumn[]>([
    { id: uuidv4(), name: "", type: "text" },
  ]);

  // Fetch columns on component mount
  useEffect(() => {
    if (userId && projectId) {
      fetchColumns();
    }
  }, [userId, projectId]);

  // Fetch all columns for the user
  const fetchColumns = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/schema-management?projectId=${projectId}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch columns");
      }

      const data = await response.json();
      const userColumns = data.schemas;
      setColumns(userColumns);

      // Set active column if one is marked as active
      const active = userColumns.find(
        (column: GlobalSchema) => column.isActive
      );
      if (active) {
        setActiveColumn(active);
        // Don't call onColumnChange here to prevent modal from closing
        console.log(
          "Found active column, but not calling onColumnChange to prevent modal from closing"
        );
      }

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch columns");
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

  // Create a new column (either from files or with custom columns)
  const handleCreateColumn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate custom columns if creating a custom column
      if (createCustomColumn) {
        // Filter out empty columns
        const validColumns = customColumns.filter(
          (col) => col.name.trim() !== ""
        );

        if (validColumns.length === 0) {
          throw new Error("Please add at least one column with a name");
        }

        // Create column with custom columns
        const response = await fetch("/api/schema-management", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_with_columns",
            name: newColumnName,
            description: newColumnDescription,
            columns: validColumns,
            userId: userId,
            projectId: projectId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create custom column");
        }

        const data = await response.json();
        const newColumn = data.schema;

        setColumns([...columns, newColumn]);
        setShowCreateModal(false);
        setNewColumnName("");
        setNewColumnDescription("");
        setCustomColumns([{ id: uuidv4(), name: "", type: "text" }]);
        setCreateCustomColumn(false);
        setIsLoading(false);

        // Notify parent of column change
        if (onColumnChange) {
          onColumnChange(newColumn);
        }
      } else {
        // Create column from files (original behavior)
        const response = await fetch("/api/schema-management", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_from_files",
            name: newColumnName,
            description: newColumnDescription,
            userId: userId,
            projectId: projectId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.error || "Failed to create column";

          // Show a more helpful error message when there are no active files
          if (errorMessage.includes("No active files found")) {
            throw new Error(
              "No active files found. Please upload and activate at least one file before creating a column, or create a custom column instead."
            );
          } else {
            throw new Error(errorMessage);
          }
        }

        const data = await response.json();
        const newColumn = data.schema;

        setColumns([...columns, newColumn]);
        setShowCreateModal(false);
        setNewColumnName("");
        setNewColumnDescription("");
        setIsLoading(false);

        // Notify parent of column change
        if (onColumnChange) {
          onColumnChange(newColumn);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create column");
      setIsLoading(false);
    }
  };

  // Update an existing column
  const handleUpdateColumn = async () => {
    if (!editingColumn) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/schema-management", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingColumn),
      });

      if (!response.ok) {
        throw new Error("Failed to update column");
      }

      const data = await response.json();
      const updatedColumn = data.schema;

      if (updatedColumn) {
        setColumns(
          columns.map((c) => (c.id === updatedColumn.id ? updatedColumn : c))
        );

        // Update active column if it was the one edited
        if (activeColumn && activeColumn.id === updatedColumn.id) {
          setActiveColumn(updatedColumn);

          // Notify parent of column change
          if (onColumnChange) {
            onColumnChange(updatedColumn);
          }
        }
      }

      setShowEditModal(false);
      setEditingColumn(null);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update column");
      setIsLoading(false);
    }
  };

  // Delete a column
  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm("Are you sure you want to delete this column?")) return;

    try {
      console.log(`Attempting to delete column ${columnId}`);
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/schema-management?id=${columnId}`, {
        method: "DELETE",
      });

      console.log(`Delete response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error deleting column: ${errorText}`);
        throw new Error(`Failed to delete column: ${errorText}`);
      }

      const data = await response.json();
      console.log(`Delete response data:`, data);

      if (data.success) {
        console.log(`Column ${columnId} deleted successfully`);
        setColumns(columns.filter((c) => c.id !== columnId));

        // Clear active column if it was the one deleted
        if (activeColumn && activeColumn.id === columnId) {
          setActiveColumn(null);

          // We don't notify the parent when a column is deleted
          // This prevents the modal from closing automatically
        }
      } else {
        console.error(`Column deletion returned success: false`);
        throw new Error("Column deletion failed on the server");
      }

      setIsLoading(false);
    } catch (err) {
      console.error(`Error in handleDeleteColumn:`, err);
      setError(err instanceof Error ? err.message : "Failed to delete column");
      setIsLoading(false);
    }
  };

  // Set a column as active
  const handleSetActiveColumn = async (column: GlobalSchema) => {
    try {
      setIsLoading(true);
      setError(null);

      // Update the column to set it as active
      const response = await fetch("/api/schema-management", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: column.id,
          isActive: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to set active column");
      }

      const data = await response.json();

      // Refresh columns to get the updated list with correct active states
      await fetchColumns();

      setActiveColumn(column);

      // Apply the column to the view state if available
      if (viewStateManager) {
        // This would need to be handled differently since we can't directly call the service
        // For now, we'll rely on the parent component to handle this
      }

      // Notify parent of column change
      if (onColumnChange) {
        onColumnChange(column);
      }

      setIsLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set active column"
      );
      setIsLoading(false);
    }
  };

  // Open edit modal with column data
  const openEditModal = (column: GlobalSchema) => {
    setEditingColumn({ ...column });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Global Columns</h2>
        {columns.length === 0 && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            disabled={isLoading}
          >
            Create New Column
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md">{error}</div>
      )}

      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : columns.length === 0 ? (
        <div className="p-4 text-center text-gray-500 border border-dashed border-gray-300 rounded-md">
          No columns available. Create a new column to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {columns.map((column) => (
            <div
              key={column.id}
              className={`p-3 border rounded-md ${
                column.isActive
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{column.name}</h3>
                  {column.description && (
                    <p className="text-sm text-gray-500">
                      {column.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {column.columns.length} columns • Last updated:{" "}
                    {new Date(column.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {!column.isActive && (
                    <button
                      onClick={() => handleSetActiveColumn(column)}
                      className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(column)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteColumn(column.id)}
                    className="px-2 py-1 text-xs bg-red-500 text-white font-bold rounded hover:bg-red-600"
                  >
                    Delete Column
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Column Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateCustomColumn(false);
          setCustomColumns([{ id: uuidv4(), name: "", type: "text" }]);
        }}
        title="Create New Column"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Column Name
            </label>
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Enter column name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              value={newColumnDescription}
              onChange={(e) => setNewColumnDescription(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="Enter column description"
              rows={3}
            />
          </div>

          {/* Column Type Selection */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center space-x-4 mb-4">
              <button
                type="button"
                onClick={() => setCreateCustomColumn(false)}
                className={`px-3 py-2 rounded-md ${
                  !createCustomColumn
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300"
                }`}
              >
                Create from Files
              </button>
              <button
                type="button"
                onClick={() => setCreateCustomColumn(true)}
                className={`px-3 py-2 rounded-md ${
                  createCustomColumn
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300"
                }`}
              >
                Create Custom Column
              </button>
            </div>

            {createCustomColumn && (
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
                setCreateCustomColumn(false);
                setCustomColumns([{ id: uuidv4(), name: "", type: "text" }]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateColumn}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              disabled={
                !newColumnName ||
                isLoading ||
                (createCustomColumn &&
                  customColumns.every((col) => !col.name.trim()))
              }
            >
              {isLoading ? "Creating..." : "Create Column"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Column Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Column"
      >
        {editingColumn && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Column Name
              </label>
              <input
                type="text"
                value={editingColumn.name}
                onChange={(e) =>
                  setEditingColumn({ ...editingColumn, name: e.target.value })
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="Enter column name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                value={editingColumn.description || ""}
                onChange={(e) =>
                  setEditingColumn({
                    ...editingColumn,
                    description: e.target.value,
                  })
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="Enter column description"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Columns
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
                {editingColumn.columns.map((column, index) => (
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
                          const updatedColumns = [...editingColumn.columns];
                          updatedColumns[index] = {
                            ...column,
                            isRequired: e.target.checked,
                          };
                          setEditingColumn({
                            ...editingColumn,
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
                  editingColumn && handleDeleteColumn(editingColumn.id)
                }
                className="px-4 py-2 bg-red-500 text-white font-bold rounded-md hover:bg-red-600"
              >
                Delete Column
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateColumn}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  disabled={!editingColumn.name || isLoading}
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

export default ColumnManager;
