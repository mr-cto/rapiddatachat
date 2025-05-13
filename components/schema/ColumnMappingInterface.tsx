import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import ColumnMappingDisplay from "./ColumnMappingDisplay";
import NewColumnForm from "./NewColumnForm";
import TransformationRuleForm, {
  TransformationRule,
} from "./TransformationRuleForm";
import {
  FileColumnMetadata,
  SchemaColumnMetadata,
  ColumnMapping,
} from "../../lib/columnMappingService";
import transformationService from "../../lib/transformationService";

/**
 * Props for ColumnMappingInterface component
 */
interface ColumnMappingInterfaceProps {
  fileId: string;
  schemaId: string;
  onComplete?: (mappings: ColumnMapping[]) => void;
  onCancel?: () => void;
}

/**
 * Component for mapping columns from a file to a schema
 */
const ColumnMappingInterface: React.FC<ColumnMappingInterfaceProps> = ({
  fileId,
  schemaId,
  onComplete,
  onCancel,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileColumns, setFileColumns] = useState<FileColumnMetadata[]>([]);
  const [schemaColumns, setSchemaColumns] = useState<SchemaColumnMetadata[]>(
    []
  );
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [suggestedMappings, setSuggestedMappings] = useState<
    Record<string, string>
  >({});
  const [selectedFileColumn, setSelectedFileColumn] =
    useState<FileColumnMetadata | null>(null);
  const [selectedSchemaColumn, setSelectedSchemaColumn] =
    useState<SchemaColumnMetadata | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showMappingSuccess, setShowMappingSuccess] = useState(false);
  const [showNewColumnForm, setShowNewColumnForm] = useState(false);
  const [newColumnSuccess, setNewColumnSuccess] = useState(false);
  const [showTransformationForm, setShowTransformationForm] = useState(false);
  const [transformationSuccess, setTransformationSuccess] = useState(false);
  const [transformationRules, setTransformationRules] = useState<
    Record<string, TransformationRule[]>
  >({});

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [fileId, schemaId]);

  /**
   * Load data from API
   */
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all data in one request
      const response = await fetch(
        `/api/column-mapping?fileId=${fileId}&schemaId=${schemaId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch column mapping data");
      }

      const data = await response.json();
      setFileColumns(data.fileColumns || []);
      setSchemaColumns(data.schemaColumns || []);
      setMappings(data.mappings || []);
      setSuggestedMappings(data.suggestions || {});

      // Load transformation rules if available
      if (data.transformationRules) {
        setTransformationRules(data.transformationRules);
      }

      // Load preview data
      await loadPreviewData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load preview data
   */
  const loadPreviewData = async () => {
    try {
      // Fetch sample data for preview
      const response = await fetch(`/api/file-parsed-data/${fileId}?limit=5`);

      if (!response.ok) {
        throw new Error("Failed to fetch preview data");
      }

      const data = await response.json();
      setPreviewData(data.data || []);
    } catch (err) {
      console.error("Error loading preview data:", err);
      // Don't set error state here, as this is not critical
    }
  };

  /**
   * Handle file column selection
   */
  const handleSelectFileColumn = (column: FileColumnMetadata) => {
    setSelectedFileColumn(column);

    // If there's a suggested mapping for this column, select the corresponding schema column
    if (suggestedMappings[column.name]) {
      const suggestedSchemaColumn = schemaColumns.find(
        (sc) => sc.id === suggestedMappings[column.name]
      );
      if (suggestedSchemaColumn) {
        setSelectedSchemaColumn(suggestedSchemaColumn);
      }
    }
  };

  /**
   * Handle schema column selection
   */
  const handleSelectSchemaColumn = (column: SchemaColumnMetadata) => {
    setSelectedSchemaColumn(column);
  };

  /**
   * Create a mapping between selected columns
   */
  const handleCreateMapping = () => {
    if (!selectedFileColumn || !selectedSchemaColumn) {
      return;
    }

    // Check if mapping already exists
    const existingMappingIndex = mappings.findIndex(
      (m) => m.fileColumnName === selectedFileColumn.name
    );

    if (existingMappingIndex !== -1) {
      // Update existing mapping
      const updatedMappings = [...mappings];
      updatedMappings[existingMappingIndex] = {
        fileColumnName: selectedFileColumn.name,
        schemaColumnId: selectedSchemaColumn.id,
      };
      setMappings(updatedMappings);
    } else {
      // Create new mapping
      setMappings([
        ...mappings,
        {
          fileColumnName: selectedFileColumn.name,
          schemaColumnId: selectedSchemaColumn.id,
        },
      ]);
    }

    // Clear selections
    setSelectedFileColumn(null);
    setSelectedSchemaColumn(null);

    // Show success message
    setShowMappingSuccess(true);
    setTimeout(() => {
      setShowMappingSuccess(false);
    }, 3000);
  };

  /**
   * Remove a mapping
   */
  const handleRemoveMapping = (fileColumnName: string) => {
    setMappings(mappings.filter((m) => m.fileColumnName !== fileColumnName));

    // Also remove any transformation rules for this mapping
    const updatedRules = { ...transformationRules };
    delete updatedRules[fileColumnName];
    setTransformationRules(updatedRules);
  };

  /**
   * Apply automatic mappings
   */
  const handleAutoMap = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Call API to auto-map columns
      const response = await fetch("/api/column-mapping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          schemaId,
          action: "auto-map",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to auto-map columns");
      }

      const data = await response.json();
      setMappings(data.mappings || []);
      setSuggestedMappings(data.suggestions || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Save mappings
   */
  const handleSaveMappings = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Call API to save mappings
      const response = await fetch("/api/column-mapping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          schemaId,
          action: "save-mappings",
          mappings,
          transformationRules,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save mappings");
      }

      // Call onComplete callback if provided
      if (onComplete) {
        onComplete(mappings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle adding a new column to the schema
   */
  const handleAddNewColumn = async (column: any) => {
    try {
      setIsSaving(true);
      setError(null);

      // Call API to add new column to schema
      const response = await fetch(`/api/schema-columns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schemaId,
          column: {
            ...column,
            id: `col_${Date.now()}`,
            isNewColumn: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add new column to schema");
      }

      const data = await response.json();

      // Add the new column to the schema columns
      setSchemaColumns([
        ...schemaColumns,
        {
          ...column,
          id: data.columnId || `col_${Date.now()}`,
          isNewColumn: true,
        },
      ]);

      // Hide the new column form
      setShowNewColumnForm(false);

      // Show success message
      setNewColumnSuccess(true);
      setTimeout(() => {
        setNewColumnSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle adding a transformation rule
   */
  const handleAddTransformationRule = (rule: TransformationRule) => {
    if (!selectedFileColumn) {
      return;
    }

    const fileColumnName = selectedFileColumn.name;

    // Add or update transformation rules for the selected file column
    const updatedRules = { ...transformationRules };

    if (!updatedRules[fileColumnName]) {
      updatedRules[fileColumnName] = [];
    }

    updatedRules[fileColumnName].push(rule);
    setTransformationRules(updatedRules);

    // Hide the transformation form
    setShowTransformationForm(false);

    // Show success message
    setTransformationSuccess(true);
    setTimeout(() => {
      setTransformationSuccess(false);
    }, 3000);
  };

  /**
   * Remove a transformation rule
   */
  const handleRemoveTransformationRule = (
    fileColumnName: string,
    ruleId: string
  ) => {
    const updatedRules = { ...transformationRules };

    if (updatedRules[fileColumnName]) {
      updatedRules[fileColumnName] = updatedRules[fileColumnName].filter(
        (rule) => rule.id !== ruleId
      );

      if (updatedRules[fileColumnName].length === 0) {
        delete updatedRules[fileColumnName];
      }

      setTransformationRules(updatedRules);
    }
  };

  /**
   * Get mapped schema column for a file column
   */
  const getMappedSchemaColumn = (fileColumnName: string) => {
    const mapping = mappings.find((m) => m.fileColumnName === fileColumnName);
    if (mapping) {
      return schemaColumns.find((sc) => sc.id === mapping.schemaColumnId);
    }
    return null;
  };

  /**
   * Get mapped file column for a schema column
   */
  const getMappedFileColumn = (schemaColumnId: string) => {
    const mapping = mappings.find((m) => m.schemaColumnId === schemaColumnId);
    if (mapping) {
      return fileColumns.find((fc) => fc.name === mapping.fileColumnName);
    }
    return null;
  };

  /**
   * Get preview of mapped data
   */
  const getMappedPreview = () => {
    if (!previewData || previewData.length === 0) {
      return [];
    }

    return previewData.map((row) => {
      const mappedRow: Record<string, any> = {};
      mappings.forEach((mapping) => {
        const schemaColumn = schemaColumns.find(
          (sc) => sc.id === mapping.schemaColumnId
        );
        if (schemaColumn) {
          let value = row[mapping.fileColumnName];

          // Apply transformation rules if any
          const rules = transformationRules[mapping.fileColumnName];
          if (rules && rules.length > 0) {
            value = transformationService.applyTransformations(value, rules);
          }

          mappedRow[schemaColumn.name] = value;
        }
      });
      return mappedRow;
    });
  };

  /**
   * Get existing column names
   */
  const getExistingColumnNames = () => {
    return schemaColumns.map((column) => column.name);
  };

  /**
   * Get transformation rules for a file column
   */
  const getTransformationRules = (fileColumnName: string) => {
    return transformationRules[fileColumnName] || [];
  };

  /**
   * Show transformation form for a file column
   */
  const showTransformationFormForColumn = (fileColumn: FileColumnMetadata) => {
    setSelectedFileColumn(fileColumn);
    setShowTransformationForm(true);
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">
        Column Mapping
      </h2>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
      )}

      {/* Success messages */}
      {showMappingSuccess && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 mb-6">
          Mapping created successfully!
        </div>
      )}

      {newColumnSuccess && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 mb-6">
          New column added successfully!
        </div>
      )}

      {transformationSuccess && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 mb-6">
          Transformation rule added successfully!
        </div>
      )}

      {/* New Column Form */}
      {showNewColumnForm ? (
        <div className="mb-6">
          <NewColumnForm
            onAddColumn={handleAddNewColumn}
            onCancel={() => setShowNewColumnForm(false)}
            existingColumnNames={getExistingColumnNames()}
          />
        </div>
      ) : showTransformationForm ? (
        <div className="mb-6">
          <TransformationRuleForm
            onAddRule={handleAddTransformationRule}
            onCancel={() => setShowTransformationForm(false)}
            fileColumnName={selectedFileColumn?.name}
            schemaColumnName={
              selectedFileColumn
                ? getMappedSchemaColumn(selectedFileColumn.name)?.name
                : undefined
            }
            existingRules={
              selectedFileColumn
                ? getTransformationRules(selectedFileColumn.name)
                : []
            }
          />
        </div>
      ) : (
        <>
          {/* Actions */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={handleAutoMap}
              disabled={isLoading || isSaving}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Processing..." : "Auto-Map Columns"}
            </button>
            <button
              onClick={handleCreateMapping}
              disabled={
                !selectedFileColumn ||
                !selectedSchemaColumn ||
                isLoading ||
                isSaving
              }
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Map Selected Columns
            </button>
            <button
              onClick={() => setShowNewColumnForm(true)}
              disabled={isLoading || isSaving}
              className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add New Column
            </button>
            <button
              onClick={handleSaveMappings}
              disabled={mappings.length === 0 || isLoading || isSaving}
              className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save Mappings"}
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={isLoading || isSaving}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Mapping status */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
              Mapping Status
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">File Columns:</span>{" "}
                  {fileColumns.length}
                </div>
                <div>
                  <span className="font-medium">Schema Columns:</span>{" "}
                  {schemaColumns.length}
                </div>
                <div>
                  <span className="font-medium">Mapped Columns:</span>{" "}
                  {mappings.length}
                </div>
                <div>
                  <span className="font-medium">
                    Columns with Transformations:
                  </span>{" "}
                  {Object.keys(transformationRules).length}
                </div>
              </div>
            </div>
          </div>

          {/* Column mapping display */}
          <ColumnMappingDisplay
            fileColumns={fileColumns}
            schemaColumns={schemaColumns}
            isLoading={isLoading}
            onSelectFileColumn={handleSelectFileColumn}
            onSelectSchemaColumn={handleSelectSchemaColumn}
            selectedFileColumn={selectedFileColumn}
            selectedSchemaColumn={selectedSchemaColumn}
            suggestedMappings={suggestedMappings}
          />

          {/* Current mappings */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
              Current Mappings
            </h3>
            {mappings.length === 0 ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400">
                No mappings created yet. Select a file column and a schema
                column, then click "Map Selected Columns".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 rounded-md overflow-hidden">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                        File Column
                      </th>
                      <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                        Schema Column
                      </th>
                      <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                        Transformations
                      </th>
                      <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping) => {
                      const fileColumn = fileColumns.find(
                        (fc) => fc.name === mapping.fileColumnName
                      );
                      const schemaColumn = schemaColumns.find(
                        (sc) => sc.id === mapping.schemaColumnId
                      );
                      const rules =
                        transformationRules[mapping.fileColumnName] || [];

                      return (
                        <tr
                          key={mapping.fileColumnName}
                          className="border-t border-gray-200 dark:border-gray-700"
                        >
                          <td className="py-2 px-4">
                            <div className="font-medium">
                              {mapping.fileColumnName}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {fileColumn?.type || "Unknown type"}
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="font-medium">
                              {schemaColumn?.name || "Unknown column"}
                              {schemaColumn?.isNewColumn && (
                                <span className="ml-2 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">
                                  New
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {schemaColumn?.type || "Unknown type"}
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            {rules.length > 0 ? (
                              <div>
                                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                  {rules.length} rule
                                  {rules.length !== 1 ? "s" : ""}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {rules.map((rule) => rule.name).join(", ")}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                No transformations
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex space-x-2">
                              <button
                                onClick={() =>
                                  showTransformationFormForColumn(fileColumn!)
                                }
                                className="text-blue-500 hover:text-blue-700"
                              >
                                Add Transform
                              </button>
                              <button
                                onClick={() =>
                                  handleRemoveMapping(mapping.fileColumnName)
                                }
                                className="text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Transformation rules */}
          {Object.keys(transformationRules).length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                Transformation Rules
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 rounded-md overflow-hidden">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                        File Column
                      </th>
                      <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                        Rule Name
                      </th>
                      <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                        Type
                      </th>
                      <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(transformationRules).flatMap(
                      ([fileColumnName, rules]) =>
                        rules.map((rule) => (
                          <tr
                            key={rule.id}
                            className="border-t border-gray-200 dark:border-gray-700"
                          >
                            <td className="py-2 px-4">{fileColumnName}</td>
                            <td className="py-2 px-4">
                              <div className="font-medium">{rule.name}</div>
                              {rule.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {rule.description}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-4">
                              <div className="capitalize">{rule.type}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {rule.type === "format"
                                  ? rule.params.formatType
                                  : rule.type === "replace"
                                  ? `Replace "${rule.params.pattern}" with "${
                                      rule.params.value || ""
                                    }"`
                                  : rule.type === "truncate"
                                  ? `Max length: ${rule.params.length}`
                                  : rule.type === "pad"
                                  ? `Pad to ${rule.params.length} with "${rule.params.char}"`
                                  : rule.type === "number"
                                  ? rule.params.format
                                  : rule.type === "date"
                                  ? rule.params.format
                                  : "Custom formula"}
                              </div>
                            </td>
                            <td className="py-2 px-4">
                              <button
                                onClick={() =>
                                  handleRemoveTransformationRule(
                                    fileColumnName,
                                    rule.id
                                  )
                                }
                                className="text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && mappings.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                Preview
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 rounded-md overflow-hidden">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      {Object.keys(getMappedPreview()[0] || {}).map((key) => (
                        <th
                          key={key}
                          className="py-2 px-4 text-left text-gray-700 dark:text-gray-300"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getMappedPreview().map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        {Object.values(row).map((value, valueIndex) => (
                          <td key={valueIndex} className="py-2 px-4">
                            {value !== null && value !== undefined
                              ? String(value)
                              : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ColumnMappingInterface;
