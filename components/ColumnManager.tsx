import React, { useState, useEffect } from "react";
import { GlobalSchema, SchemaColumn } from "../lib/schemaManagement";
import { ViewStateManager } from "../lib/viewStateManager";
import Modal from "./Modal";
import { v4 as uuidv4 } from "uuid";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCheck,
  FaDatabase,
  FaColumns,
  FaTable,
} from "react-icons/fa";

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

  // Get data type icon
  const getDataTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "text":
      case "string":
        return <span className="text-blue-400">Aa</span>;
      case "integer":
      case "numeric":
      case "number":
        return <span className="text-green-400">#</span>;
      case "boolean":
        return <span className="text-yellow-400">Y/N</span>;
      case "timestamp":
      case "date":
        return <span className="text-purple-400">📅</span>;
      default:
        return <span className="text-gray-400">?</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <FaColumns className="text-accent-primary" />
          <h2 className="text-lg font-semibold text-gray-200">Data Columns</h2>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          disabled={isLoading}
          className="flex items-center"
        >
          <FaPlus className="mr-2" /> Create Column
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded-md text-red-400 mb-4 flex items-center">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {error}
        </div>
      )}

      {isLoading && columns.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
        </div>
      ) : columns.length === 0 ? (
        <Card variant="outline" className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-ui-secondary p-4 rounded-full mb-4">
              <FaDatabase className="w-10 h-10 text-accent-primary opacity-70" />
            </div>
            <CardTitle className="mb-2">No columns available</CardTitle>
            <CardDescription className="max-w-md mb-6">
              Columns help organize your data structure. Create a new column to
              get started with your data analysis.
            </CardDescription>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center"
            >
              <FaPlus className="mr-2" /> Create New Column
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {columns.map((column) => (
            <Card
              key={column.id}
              variant={column.isActive ? "success" : "default"}
              className="transition-all duration-200 hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-gray-200">{column.name}</CardTitle>
                  {column.isActive && (
                    <Badge
                      variant="success"
                      size="sm"
                      icon={<FaCheck size={10} />}
                    >
                      Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {column.description && (
                  <CardDescription className="mb-3">
                    {column.description}
                  </CardDescription>
                )}
                <div className="flex items-center text-xs text-gray-400 mb-3">
                  <FaTable className="mr-1" />
                  <span>{column.columns.length} data columns</span>
                  <span className="mx-2">•</span>
                  <span>
                    Updated {new Date(column.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                {column.columns.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 max-h-24 overflow-y-auto pr-2">
                    {column.columns.slice(0, 6).map((col, idx) => (
                      <div
                        key={idx}
                        className="flex items-center text-xs bg-ui-secondary p-1.5 rounded"
                      >
                        <div className="mr-1.5">
                          {getDataTypeIcon(col.type)}
                        </div>
                        <span className="text-gray-300 truncate">
                          {col.name}
                        </span>
                      </div>
                    ))}
                    {column.columns.length > 6 && (
                      <div className="flex items-center justify-center text-xs bg-ui-secondary p-1.5 rounded text-gray-400">
                        +{column.columns.length - 6} more
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end space-x-2 pt-2 border-t border-ui-border">
                {!column.isActive && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSetActiveColumn(column)}
                  >
                    Set Active
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(column)}
                >
                  <FaEdit className="mr-1" /> Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteColumn(column.id)}
                >
                  <FaTrash className="mr-1" /> Delete
                </Button>
              </CardFooter>
            </Card>
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Column Name
            </label>
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="w-full px-3 py-2 bg-ui-secondary border border-ui-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-accent-primary text-gray-200"
              placeholder="Enter column name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={newColumnDescription}
              onChange={(e) => setNewColumnDescription(e.target.value)}
              className="w-full px-3 py-2 bg-ui-secondary border border-ui-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-accent-primary text-gray-200"
              placeholder="Enter column description"
              rows={3}
            />
          </div>

          {/* Column Type Selection */}
          <div className="border-t border-ui-border pt-4">
            <div className="flex flex-col space-y-3 mb-4">
              <h3 className="text-sm font-medium text-gray-300">
                Column Source
              </h3>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setCreateCustomColumn(false)}
                  className={`flex-1 px-3 py-2 rounded-md transition-colors ${
                    !createCustomColumn
                      ? "bg-accent-primary text-white"
                      : "bg-ui-secondary text-gray-300 hover:bg-ui-tertiary"
                  }`}
                >
                  From Files
                </button>
                <button
                  type="button"
                  onClick={() => setCreateCustomColumn(true)}
                  className={`flex-1 px-3 py-2 rounded-md transition-colors ${
                    createCustomColumn
                      ? "bg-accent-primary text-white"
                      : "bg-ui-secondary text-gray-300 hover:bg-ui-tertiary"
                  }`}
                >
                  Custom Column
                </button>
              </div>
            </div>

            {createCustomColumn && (
              <div className="space-y-3 border border-ui-border rounded-md p-4 bg-ui-secondary">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-300">
                    Custom Columns
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addCustomColumn}
                  >
                    <FaPlus className="mr-1" /> Add Column
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {customColumns.map((column, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-ui-tertiary p-2 rounded border border-ui-border"
                    >
                      <input
                        type="text"
                        value={column.name}
                        onChange={(e) =>
                          updateCustomColumn(index, "name", e.target.value)
                        }
                        className="flex-1 px-2 py-1 bg-ui-secondary border border-ui-border rounded text-sm text-gray-200"
                        placeholder="Column name"
                      />
                      <select
                        value={column.type}
                        onChange={(e) =>
                          updateCustomColumn(index, "type", e.target.value)
                        }
                        className="px-2 py-1 bg-ui-secondary border border-ui-border rounded text-sm text-gray-200"
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
                        className="text-red-400 hover:text-red-300 p-1"
                        disabled={customColumns.length <= 1}
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {customColumns.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    No columns added. Click "Add Column" to add one.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-ui-border">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setCreateCustomColumn(false);
                setCustomColumns([{ id: uuidv4(), name: "", type: "text" }]);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateColumn}
              isLoading={isLoading}
              disabled={
                !newColumnName ||
                isLoading ||
                (createCustomColumn &&
                  customColumns.every((col) => !col.name.trim()))
              }
            >
              Create Column
            </Button>
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Column Name
              </label>
              <input
                type="text"
                value={editingColumn.name}
                onChange={(e) =>
                  setEditingColumn({ ...editingColumn, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-ui-secondary border border-ui-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-accent-primary text-gray-200"
                placeholder="Enter column name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
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
                className="w-full px-3 py-2 bg-ui-secondary border border-ui-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-accent-primary text-gray-200"
                placeholder="Enter column description"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Data Columns
              </label>
              <div className="max-h-60 overflow-y-auto border border-ui-border rounded-md bg-ui-secondary p-3">
                {editingColumn.columns.map((column, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 border-b border-ui-border last:border-b-0 hover:bg-ui-tertiary rounded-sm"
                  >
                    <div className="flex items-center">
                      <div className="mr-2">{getDataTypeIcon(column.type)}</div>
                      <span className="font-medium text-gray-300">
                        {column.name}
                      </span>
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
                        className="mr-2 h-4 w-4 rounded border-ui-border bg-ui-tertiary focus:ring-accent-primary"
                      />
                      <label className="text-xs text-gray-400">Required</label>
                    </div>
                  </div>
                ))}

                {editingColumn.columns.length === 0 && (
                  <div className="py-4 text-center text-gray-500">
                    No data columns available
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between pt-4 border-t border-ui-border">
              <Button
                variant="danger"
                onClick={() =>
                  editingColumn && handleDeleteColumn(editingColumn.id)
                }
              >
                <FaTrash className="mr-1" /> Delete Column
              </Button>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleUpdateColumn}
                  isLoading={isLoading}
                  disabled={!editingColumn.name || isLoading}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ColumnManager;
