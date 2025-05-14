import React, { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/router";

interface FileColumn {
  name: string;
  originalName: string;
  type: string;
  sampleValues: any[];
}

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

interface ColumnMapping {
  fileColumn: FileColumn;
  schemaColumn?: SchemaColumn;
  matchType: "exact" | "fuzzy" | "none";
  confidence?: number;
}

interface SchemaEvolutionOptions {
  addNewColumns?: boolean;
  migrateData?: boolean;
  updateExistingRecords?: boolean;
  createNewVersion?: boolean;
}

interface SchemaEvolutionPanelProps {
  projectId: string;
  schemaId: string;
  fileId: string;
  fileColumns: FileColumn[];
  onComplete?: () => void;
}

const SchemaEvolutionPanel: React.FC<SchemaEvolutionPanelProps> = ({
  projectId,
  schemaId,
  fileId,
  fileColumns,
  onComplete,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [options, setOptions] = useState<SchemaEvolutionOptions>({
    addNewColumns: true,
    migrateData: false,
    updateExistingRecords: false,
    createNewVersion: true,
  });

  // Fetch column mappings when component mounts
  useEffect(() => {
    if (fileColumns.length > 0) {
      identifyNewColumns();
    }
  }, [fileColumns]);

  // Identify new columns
  const identifyNewColumns = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        "/api/schema-evolution?action=identify",
        {
          fileColumns,
          schemaId,
        }
      );

      setMappings(response.data.mappings);

      // Pre-select all new columns
      const newColumnNames = response.data.newColumns.map(
        (mapping: ColumnMapping) => mapping.fileColumn.name
      );
      setSelectedColumns(newColumnNames);
    } catch (err) {
      console.error("Error identifying new columns:", err);
      setError("Failed to identify new columns");
    } finally {
      setLoading(false);
    }
  };

  // Handle column selection
  const handleColumnSelection = (columnName: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(columnName)) {
        return prev.filter((name) => name !== columnName);
      } else {
        return [...prev, columnName];
      }
    });
  };

  // Handle option change
  const handleOptionChange = (
    option: keyof SchemaEvolutionOptions,
    value: boolean
  ) => {
    setOptions((prev) => ({
      ...prev,
      [option]: value,
    }));
  };

  // Apply schema evolution
  const applySchemaEvolution = async () => {
    try {
      setLoading(true);
      setError(null);

      // Filter selected columns
      const columnsToAdd = mappings
        .filter(
          (mapping) =>
            mapping.matchType === "none" &&
            selectedColumns.includes(mapping.fileColumn.name)
        )
        .map((mapping) => mapping.fileColumn);

      if (columnsToAdd.length === 0) {
        setError("No columns selected for addition");
        setLoading(false);
        return;
      }

      // Evolve schema
      const response = await axios.post("/api/schema-evolution?action=evolve", {
        schemaId,
        newColumns: columnsToAdd,
        options,
      });

      if (response.data.success) {
        if (onComplete) {
          onComplete();
        } else {
          // Redirect to schema page
          router.push(`/project/${projectId}/schema/columns`);
        }
      } else {
        setError(response.data.message || "Failed to evolve schema");
      }
    } catch (err) {
      console.error("Error evolving schema:", err);
      setError("Failed to evolve schema");
    } finally {
      setLoading(false);
    }
  };

  // Render column mappings
  const renderColumnMappings = () => {
    const newColumns = mappings.filter(
      (mapping) => mapping.matchType === "none"
    );
    const exactMatches = mappings.filter(
      (mapping) => mapping.matchType === "exact"
    );
    const fuzzyMatches = mappings.filter(
      (mapping) => mapping.matchType === "fuzzy"
    );

    return (
      <div className="space-y-6">
        {/* New Columns */}
        {newColumns.length > 0 && (
          <div className="bg-white p-4 rounded-md shadow">
            <h3 className="text-lg font-medium mb-2">New Columns</h3>
            <p className="text-sm text-gray-500 mb-4">
              These columns were found in the uploaded file but do not exist in
              the global schema. Select the columns you want to add to the
              schema.
            </p>
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
                    Original Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sample Values
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {newColumns.map((mapping) => (
                  <tr key={mapping.fileColumn.name}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(
                          mapping.fileColumn.name
                        )}
                        onChange={() =>
                          handleColumnSelection(mapping.fileColumn.name)
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.fileColumn.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.fileColumn.originalName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.fileColumn.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.fileColumn.sampleValues?.slice(0, 3).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Exact Matches */}
        {exactMatches.length > 0 && (
          <div className="bg-white p-4 rounded-md shadow">
            <h3 className="text-lg font-medium mb-2">Exact Matches</h3>
            <p className="text-sm text-gray-500 mb-4">
              These columns were found in both the uploaded file and the global
              schema with exact name matches.
            </p>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Column
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schema Column
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exactMatches.map((mapping) => (
                  <tr key={mapping.fileColumn.name}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.fileColumn.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.schemaColumn?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.fileColumn.type} → {mapping.schemaColumn?.type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fuzzy Matches */}
        {fuzzyMatches.length > 0 && (
          <div className="bg-white p-4 rounded-md shadow">
            <h3 className="text-lg font-medium mb-2">Similar Columns</h3>
            <p className="text-sm text-gray-500 mb-4">
              These columns from the uploaded file have similar names to columns
              in the global schema.
            </p>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Column
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schema Column
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fuzzyMatches.map((mapping) => (
                  <tr key={mapping.fileColumn.name}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.fileColumn.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.schemaColumn?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.confidence
                        ? `${Math.round(mapping.confidence * 100)}%`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-md shadow">
        <h2 className="text-xl font-bold mb-4">Schema Evolution</h2>
        <p className="text-gray-600 mb-4">
          This file contains columns that are not in your global schema. You can
          add these columns to your schema to include them in your data.
        </p>

        {loading && <div className="text-center py-4">Loading...</div>}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!loading && mappings.length > 0 && renderColumnMappings()}

        {/* Options */}
        <div className="mt-6 bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium mb-2">Options</h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="addNewColumns"
                checked={options.addNewColumns}
                onChange={(e) =>
                  handleOptionChange("addNewColumns", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label
                htmlFor="addNewColumns"
                className="ml-2 block text-sm text-gray-900"
              >
                Add new columns to global schema
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="migrateData"
                checked={options.migrateData}
                onChange={(e) =>
                  handleOptionChange("migrateData", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label
                htmlFor="migrateData"
                className="ml-2 block text-sm text-gray-900"
              >
                Migrate existing data to include new columns
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="updateExistingRecords"
                checked={options.updateExistingRecords}
                onChange={(e) =>
                  handleOptionChange("updateExistingRecords", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label
                htmlFor="updateExistingRecords"
                className="ml-2 block text-sm text-gray-900"
              >
                Update existing records (only applies if migrating data)
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="createNewVersion"
                checked={options.createNewVersion}
                onChange={(e) =>
                  handleOptionChange("createNewVersion", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label
                htmlFor="createNewVersion"
                className="ml-2 block text-sm text-gray-900"
              >
                Create new schema version
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              if (onComplete) onComplete();
            }}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applySchemaEvolution}
            disabled={loading || selectedColumns.length === 0}
            className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              loading || selectedColumns.length === 0
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Applying..." : "Apply Schema Evolution"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchemaEvolutionPanel;
