import React, { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import { Tab } from "@headlessui/react";

interface SchemaColumn {
  id: string;
  name: string;
  type: string;
  description?: string;
  isRequired?: boolean;
  isPrimaryKey?: boolean;
  defaultValue?: string;
  derivationFormula?: string;
  isNewColumn?: boolean;
}

interface GlobalSchema {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  columns: SchemaColumn[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  version: number;
  previousVersionId?: string;
}

interface SchemaVersion {
  id: string;
  schemaId: string;
  version: number;
  columns: SchemaColumn[];
  createdAt: Date;
  createdBy: string;
  comment?: string;
  changeLog?: SchemaChange[];
}

interface SchemaChange {
  type: "add" | "remove" | "modify";
  columnName: string;
  before?: Partial<SchemaColumn>;
  after?: Partial<SchemaColumn>;
}

interface FileContribution {
  fileId: string;
  fileName: string;
  uploadDate: Date;
  columnNames: string[];
}

interface SchemaManagementInterfaceProps {
  projectId: string;
  schemaId: string;
}

const SchemaManagementInterface: React.FC<SchemaManagementInterfaceProps> = ({
  projectId,
  schemaId,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<GlobalSchema | null>(null);
  const [versions, setVersions] = useState<SchemaVersion[]>([]);
  const [fileContributions, setFileContributions] = useState<
    FileContribution[]
  >([]);
  const [editingColumn, setEditingColumn] = useState<SchemaColumn | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumn, setNewColumn] = useState<Partial<SchemaColumn>>({
    name: "",
    type: "text",
    description: "",
    isRequired: false,
    isPrimaryKey: false,
  });

  // Fetch schema data when component mounts
  useEffect(() => {
    if (schemaId) {
      fetchSchemaData();
    }
  }, [schemaId]);

  // Fetch schema data
  const fetchSchemaData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch schema
      const schemaResponse = await axios.get(
        `/api/schema-information?schemaId=${schemaId}`
      );
      setSchema(schemaResponse.data);

      // Fetch schema versions
      const versionsResponse = await axios.get(
        `/api/schema-versions?schemaId=${schemaId}`
      );
      setVersions(versionsResponse.data);

      // Fetch file contributions
      const contributionsResponse = await axios.get(
        `/api/schema-file-contributions?schemaId=${schemaId}`
      );
      setFileContributions(contributionsResponse.data);
    } catch (err) {
      console.error("Error fetching schema data:", err);
      setError("Failed to load schema data");
    } finally {
      setLoading(false);
    }
  };

  // Handle column edit
  const handleEditColumn = (column: SchemaColumn) => {
    setEditingColumn({ ...column });
  };

  // Handle column update
  const handleUpdateColumn = async () => {
    if (!editingColumn || !schema) return;

    try {
      setLoading(true);
      setError(null);

      // Update column in schema
      const updatedColumns = schema.columns.map((col) =>
        col.id === editingColumn.id ? editingColumn : col
      );

      // Update schema
      const updatedSchema = {
        ...schema,
        columns: updatedColumns,
        version: schema.version + 1,
        previousVersionId: schema.id,
      };

      // Save schema
      const response = await axios.put(
        `/api/schema-management/${schemaId}`,
        updatedSchema
      );

      // Update state
      setSchema(response.data);
      setEditingColumn(null);

      // Refresh data
      fetchSchemaData();
    } catch (err) {
      console.error("Error updating column:", err);
      setError("Failed to update column");
    } finally {
      setLoading(false);
    }
  };

  // Handle column add
  const handleAddColumn = async () => {
    if (!schema) return;

    try {
      setLoading(true);
      setError(null);

      // Create new column with ID
      const columnWithId = {
        ...newColumn,
        id: `col_${Date.now()}`,
      } as SchemaColumn;

      // Add column to schema
      const updatedColumns = [...schema.columns, columnWithId];

      // Update schema
      const updatedSchema = {
        ...schema,
        columns: updatedColumns,
        version: schema.version + 1,
        previousVersionId: schema.id,
      };

      // Save schema
      const response = await axios.put(
        `/api/schema-management/${schemaId}`,
        updatedSchema
      );

      // Update state
      setSchema(response.data);
      setIsAddingColumn(false);
      setNewColumn({
        name: "",
        type: "text",
        description: "",
        isRequired: false,
        isPrimaryKey: false,
      });

      // Refresh data
      fetchSchemaData();
    } catch (err) {
      console.error("Error adding column:", err);
      setError("Failed to add column");
    } finally {
      setLoading(false);
    }
  };

  // Handle column delete
  const handleDeleteColumn = async (columnId: string) => {
    if (!schema) return;

    try {
      setLoading(true);
      setError(null);

      // Remove column from schema
      const updatedColumns = schema.columns.filter(
        (col) => col.id !== columnId
      );

      // Update schema
      const updatedSchema = {
        ...schema,
        columns: updatedColumns,
        version: schema.version + 1,
        previousVersionId: schema.id,
      };

      // Save schema
      const response = await axios.put(
        `/api/schema-management/${schemaId}`,
        updatedSchema
      );

      // Update state
      setSchema(response.data);

      // Refresh data
      fetchSchemaData();
    } catch (err) {
      console.error("Error deleting column:", err);
      setError("Failed to delete column");
    } finally {
      setLoading(false);
    }
  };

  // Handle schema rollback
  const handleRollbackSchema = async (versionId: string, version: number) => {
    try {
      setLoading(true);
      setError(null);

      // Rollback schema
      const response = await axios.post(`/api/schema-versions/rollback`, {
        schemaId,
        version,
      });

      // Update state
      setSchema(response.data.schema);

      // Refresh data
      fetchSchemaData();
    } catch (err) {
      console.error("Error rolling back schema:", err);
      setError("Failed to roll back schema");
    } finally {
      setLoading(false);
    }
  };

  // Render loading state
  if (loading && !schema) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p className="text-gray-600">Loading schema data...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !schema) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  // Render schema management interface
  return (
    <div className="space-y-6">
      {/* Schema header */}
      <div className="bg-white p-4 rounded-md shadow">
        <h2 className="text-xl font-bold mb-2">{schema?.name}</h2>
        <p className="text-gray-600">{schema?.description}</p>
        <div className="mt-2 flex items-center text-sm text-gray-500">
          <span className="mr-4">Version: {schema?.version}</span>
          <span className="mr-4">
            Updated: {schema?.updatedAt.toLocaleString()}
          </span>
          <span>Columns: {schema?.columns.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 ${
                selected
                  ? "bg-white shadow"
                  : "text-blue-500 hover:bg-white/[0.12] hover:text-blue-700"
              }`
            }
          >
            Columns
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 ${
                selected
                  ? "bg-white shadow"
                  : "text-blue-500 hover:bg-white/[0.12] hover:text-blue-700"
              }`
            }
          >
            Version History
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 ${
                selected
                  ? "bg-white shadow"
                  : "text-blue-500 hover:bg-white/[0.12] hover:text-blue-700"
              }`
            }
          >
            File Contributions
          </Tab>
        </Tab.List>
        <Tab.Panels className="mt-2">
          {/* Columns Tab */}
          <Tab.Panel className="rounded-xl bg-white p-3 shadow">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-medium">Schema Columns</h3>
              <button
                onClick={() => setIsAddingColumn(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Column
              </button>
            </div>

            {/* Add Column Form */}
            {isAddingColumn && (
              <div className="mb-6 bg-gray-50 p-4 rounded-md">
                <h4 className="text-md font-medium mb-2">Add New Column</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newColumn.name}
                      onChange={(e) =>
                        setNewColumn({ ...newColumn, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={newColumn.type}
                      onChange={(e) =>
                        setNewColumn({ ...newColumn, type: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="text">Text</option>
                      <option value="numeric">Numeric</option>
                      <option value="boolean">Boolean</option>
                      <option value="timestamp">Timestamp</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newColumn.description || ""}
                      onChange={(e) =>
                        setNewColumn({
                          ...newColumn,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newColumn.isRequired || false}
                        onChange={(e) =>
                          setNewColumn({
                            ...newColumn,
                            isRequired: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Required
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newColumn.isPrimaryKey || false}
                        onChange={(e) =>
                          setNewColumn({
                            ...newColumn,
                            isPrimaryKey: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Primary Key
                      </span>
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => setIsAddingColumn(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddColumn}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Add Column
                  </button>
                </div>
              </div>
            )}

            {/* Edit Column Form */}
            {editingColumn && (
              <div className="mb-6 bg-gray-50 p-4 rounded-md">
                <h4 className="text-md font-medium mb-2">Edit Column</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editingColumn.name}
                      onChange={(e) =>
                        setEditingColumn({
                          ...editingColumn,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={editingColumn.type}
                      onChange={(e) =>
                        setEditingColumn({
                          ...editingColumn,
                          type: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="text">Text</option>
                      <option value="numeric">Numeric</option>
                      <option value="boolean">Boolean</option>
                      <option value="timestamp">Timestamp</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editingColumn.description || ""}
                      onChange={(e) =>
                        setEditingColumn({
                          ...editingColumn,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingColumn.isRequired || false}
                        onChange={(e) =>
                          setEditingColumn({
                            ...editingColumn,
                            isRequired: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Required
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingColumn.isPrimaryKey || false}
                        onChange={(e) =>
                          setEditingColumn({
                            ...editingColumn,
                            isPrimaryKey: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Primary Key
                      </span>
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingColumn(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateColumn}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Update Column
                  </button>
                </div>
              </div>
            )}

            {/* Columns Table */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Properties
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schema?.columns.map((column) => (
                  <tr key={column.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {column.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {column.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {column.description || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {column.isRequired && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                          Required
                        </span>
                      )}
                      {column.isPrimaryKey && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Primary Key
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditColumn(column)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteColumn(column.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tab.Panel>

          {/* Version History Tab */}
          <Tab.Panel className="rounded-xl bg-white p-3 shadow">
            <h3 className="text-lg font-medium mb-4">Schema Version History</h3>
            <div className="space-y-4">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border border-gray-200 rounded-md p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-md font-medium">
                        Version {version.version}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Created on{" "}
                        {new Date(version.createdAt).toLocaleString()}
                      </p>
                      {version.comment && (
                        <p className="text-sm mt-1">{version.comment}</p>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        handleRollbackSchema(version.id, version.version)
                      }
                      className="px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Rollback to this version
                    </button>
                  </div>

                  {/* Change Log */}
                  {version.changeLog && version.changeLog.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm font-medium mb-2">Changes:</h5>
                      <ul className="text-sm space-y-1">
                        {version.changeLog.map((change, index) => (
                          <li key={index} className="flex items-start">
                            {change.type === "add" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">
                                Added
                              </span>
                            )}
                            {change.type === "remove" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mr-2">
                                Removed
                              </span>
                            )}
                            {change.type === "modify" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mr-2">
                                Modified
                              </span>
                            )}
                            <span>
                              {change.columnName}
                              {change.type === "modify" &&
                                change.before &&
                                change.after && (
                                  <span className="text-gray-500">
                                    {" "}
                                    (
                                    {Object.keys(change.after).map((key) => {
                                      const beforeVal =
                                        change.before?.[
                                          key as keyof typeof change.before
                                        ];
                                      const afterVal =
                                        change.after?.[
                                          key as keyof typeof change.after
                                        ];
                                      if (beforeVal !== afterVal) {
                                        return `${key}: ${beforeVal} → ${afterVal}`;
                                      }
                                      return null;
                                    })}
                                    )
                                  </span>
                                )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}

              {versions.length === 0 && (
                <p className="text-gray-500">No version history available.</p>
              )}
            </div>
          </Tab.Panel>

          {/* File Contributions Tab */}
          <Tab.Panel className="rounded-xl bg-white p-3 shadow">
            <h3 className="text-lg font-medium mb-4">File Contributions</h3>
            <div className="space-y-4">
              {fileContributions.map((contribution) => (
                <div
                  key={contribution.fileId}
                  className="border border-gray-200 rounded-md p-4"
                >
                  <h4 className="text-md font-medium">
                    {contribution.fileName}
                  </h4>
                  <p className="text-sm text-gray-500">
                    Uploaded on{" "}
                    {new Date(contribution.uploadDate).toLocaleString()}
                  </p>
                  <div className="mt-2">
                    <h5 className="text-sm font-medium mb-1">
                      Contributed Columns:
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {contribution.columnNames.map((columnName) => (
                        <span
                          key={columnName}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {columnName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {fileContributions.length === 0 && (
                <p className="text-gray-500">
                  No file contributions available.
                </p>
              )}
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default SchemaManagementInterface;
