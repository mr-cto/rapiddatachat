import React, { useState, useEffect } from "react";
import {
  GlobalSchema,
  SchemaColumn,
  ColumnMapping,
} from "../lib/schemaManagement";
import Modal from "./Modal";

interface SchemaColumnMapperProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileColumns: string[];
  userId: string;
  projectId?: string;
  onMappingComplete?: (mapping: ColumnMapping) => void;
}

/**
 * SchemaColumnMapper component for mapping file columns to schema columns
 */
const SchemaColumnMapper: React.FC<SchemaColumnMapperProps> = ({
  isOpen,
  onClose,
  fileId,
  fileColumns,
  userId,
  projectId,
  onMappingComplete,
}) => {
  const [schemas, setSchemas] = useState<GlobalSchema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<GlobalSchema | null>(
    null
  );
  const [mappings, setMappings] = useState<
    Array<{
      fileColumn: string;
      schemaColumn: string;
      addToSchema?: boolean;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select-schema" | "map-columns" | "review">(
    "select-schema"
  );

  // Fetch schemas on component mount
  useEffect(() => {
    if (isOpen && userId) {
      fetchSchemas();
    }
  }, [isOpen, userId, projectId]);

  // Initialize mappings when schema is selected
  useEffect(() => {
    if (selectedSchema && fileColumns.length > 0) {
      initializeMappings();
    }
  }, [selectedSchema, fileColumns]);

  // Fetch all schemas for the user
  const fetchSchemas = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use project-specific endpoint if projectId is provided
      const endpoint = projectId
        ? `/api/schema-management?projectId=${projectId}`
        : "/api/schema-management";

      console.log(`Fetching schemas from: ${endpoint}`);

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch schemas: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Schemas response:", data);

      if (!data.schemas || !Array.isArray(data.schemas)) {
        console.error("Invalid schemas response:", data);
        throw new Error("Invalid schemas response from server");
      }

      const userSchemas = data.schemas;
      setSchemas(userSchemas);

      console.log(`Found ${userSchemas.length} schemas`);

      // Set active schema as default if available
      const activeSchema = userSchemas.find(
        (schema: GlobalSchema) => schema.isActive
      );

      if (activeSchema) {
        console.log("Found active schema:", activeSchema.name);
        setSelectedSchema(activeSchema);
      } else if (userSchemas.length > 0) {
        // If no active schema but schemas exist, use the first one
        console.log(
          "No active schema found, using first schema:",
          userSchemas[0].name
        );
        setSelectedSchema(userSchemas[0]);
      }

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch schemas");
      setIsLoading(false);
    }
  };

  // Initialize mappings based on column name similarity
  const initializeMappings = () => {
    if (!selectedSchema) return;

    const initialMappings = fileColumns.map((fileColumn) => {
      // Try to find a matching schema column by name
      const matchingSchemaColumn = findMatchingSchemaColumn(
        fileColumn,
        selectedSchema.columns
      );

      return {
        fileColumn,
        schemaColumn: matchingSchemaColumn?.name || "",
        addToSchema: false,
      };
    });

    setMappings(initialMappings);
  };

  // Find a matching schema column based on name similarity
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

  // Handle schema selection
  const handleSchemaSelect = (schemaId: string) => {
    const schema = schemas.find((s) => s.id === schemaId);
    setSelectedSchema(schema || null);
    setStep("map-columns");
  };

  // Update a mapping
  const updateMapping = (fileColumn: string, schemaColumn: string) => {
    setMappings(
      mappings.map((m) =>
        m.fileColumn === fileColumn ? { ...m, schemaColumn } : m
      )
    );
  };

  // Toggle add to schema option
  const toggleAddToSchema = (fileColumn: string) => {
    setMappings(
      mappings.map((m) =>
        m.fileColumn === fileColumn ? { ...m, addToSchema: !m.addToSchema } : m
      )
    );
  };

  // Save the column mapping
  const saveMapping = async () => {
    if (!selectedSchema) return;

    try {
      setIsLoading(true);
      setError(null);

      // Identify columns to add to schema
      const columnsToAdd = mappings
        .filter((m) => !m.schemaColumn && m.addToSchema)
        .map((m) => ({
          name: m.fileColumn,
          type: "text", // Default type
          description: `Added from file column: ${m.fileColumn}`,
          isRequired: false,
          isNewColumn: true,
        }));

      // If there are columns to add to the schema, update the schema first
      if (columnsToAdd.length > 0) {
        console.log(`Adding ${columnsToAdd.length} new columns to schema`);

        // Create a copy of the schema with new columns
        const updatedSchema = {
          ...selectedSchema,
          columns: [...selectedSchema.columns, ...columnsToAdd],
        };

        // Update the schema
        const schemaResponse = await fetch(`/api/schema-management`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedSchema),
        });

        if (!schemaResponse.ok) {
          throw new Error("Failed to update schema with new columns");
        }

        const schemaData = await schemaResponse.json();
        setSelectedSchema(schemaData.schema);

        // Update mappings to map new columns to themselves
        setMappings(
          mappings.map((m) => {
            if (!m.schemaColumn && m.addToSchema) {
              return {
                ...m,
                schemaColumn: m.fileColumn,
              };
            }
            return m;
          })
        );
      }

      // Filter out mappings with empty schema columns (that aren't being added to schema)
      const validMappings = mappings.filter(
        (m) => m.schemaColumn || (m.addToSchema && columnsToAdd.length > 0)
      );

      // Convert array of mappings to Record<string, string> format
      const mappingsRecord: Record<string, string> = {};
      validMappings.forEach((mapping) => {
        // If this is a column we just added to the schema, use the file column name
        // as both the file column and schema column
        if (!mapping.schemaColumn && mapping.addToSchema) {
          mappingsRecord[mapping.fileColumn] = mapping.fileColumn;
        } else {
          mappingsRecord[mapping.fileColumn] = mapping.schemaColumn;
        }
      });

      const columnMapping: ColumnMapping = {
        fileId,
        schemaId: selectedSchema.id,
        mappings: mappingsRecord,
        newColumnsAdded: columnsToAdd.length,
      };

      const response = await fetch("/api/column-mappings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(columnMapping),
      });

      if (!response.ok) {
        throw new Error("Failed to save column mapping");
      }

      const data = await response.json();

      if (data.success) {
        if (onMappingComplete) {
          // Include information about new columns added in the response
          const responseData = {
            ...columnMapping,
            newColumnsAdded:
              data.newColumnsAdded || columnMapping.newColumnsAdded || 0,
          };
          onMappingComplete(responseData);
        }
        onClose();
      } else {
        setError("Failed to save column mapping");
      }

      setIsLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save column mapping"
      );
      setIsLoading(false);
    }
  };

  // Navigate to the next step
  const nextStep = () => {
    if (step === "select-schema") {
      setStep("map-columns");
    } else if (step === "map-columns") {
      setStep("review");
    }
  };

  // Navigate to the previous step
  const prevStep = () => {
    if (step === "map-columns") {
      setStep("select-schema");
    } else if (step === "review") {
      setStep("map-columns");
    }
  };

  // Render the schema selection step
  const renderSchemaSelection = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Select a schema to map your file columns to:
      </p>

      {schemas.length === 0 ? (
        <div className="p-4 text-center text-gray-500 border border-dashed border-gray-300 rounded-md">
          No schemas available. Please create a schema first.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {schemas.map((schema) => (
            <div
              key={schema.id}
              className={`p-3 border rounded-md cursor-pointer ${
                selectedSchema?.id === schema.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:border-indigo-300"
              }`}
              onClick={() => handleSchemaSelect(schema.id)}
            >
              <h3 className="font-medium">{schema.name}</h3>
              {schema.description && (
                <p className="text-sm text-gray-500">{schema.description}</p>
              )}
              <p className="text-xs text-gray-400">
                {schema.columns.length} columns
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={nextStep}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          disabled={!selectedSchema || isLoading}
        >
          Next
        </button>
      </div>
    </div>
  );

  // Render the column mapping step
  const renderColumnMapping = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Map your file columns to schema columns:
      </p>

      <div className="max-h-80 overflow-y-auto">
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
                Add to Schema
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mappings.map((mapping, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {mapping.fileColumn}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <select
                    value={mapping.schemaColumn}
                    onChange={(e) =>
                      updateMapping(mapping.fileColumn, e.target.value)
                    }
                  >
                    <option value="">-- Not Mapped --</option>
                    {selectedSchema?.columns.map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name} ({column.type})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {!mapping.schemaColumn && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`add-to-schema-${index}`}
                        checked={mapping.addToSchema || false}
                        onChange={() => toggleAddToSchema(mapping.fileColumn)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor={`add-to-schema-${index}`}
                        className="ml-2 text-sm text-gray-600"
                      >
                        Add to schema
                      </label>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <button
          onClick={prevStep}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={nextStep}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          disabled={isLoading}
        >
          Review
        </button>
      </div>
    </div>
  );

  // Render the review step
  const renderReview = () => {
    // Count mapped and unmapped columns
    const mappedCount = mappings.filter((m) => m.schemaColumn).length;
    const unmappedCount = mappings.length - mappedCount;

    // Get required schema columns that are not mapped
    const requiredSchemaColumns =
      selectedSchema?.columns.filter((c) => c.isRequired) || [];
    const unmappedRequiredColumns = requiredSchemaColumns.filter(
      (rc) => !mappings.some((m) => m.schemaColumn === rc.name)
    );

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Review your column mapping:</p>

        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="font-medium">Mapping Summary</h3>
          <ul className="mt-2 text-sm">
            <li>
              Schema:{" "}
              <span className="font-medium">{selectedSchema?.name}</span>
            </li>
            <li>
              Total file columns:{" "}
              <span className="font-medium">{fileColumns.length}</span>
            </li>
            <li>
              Mapped columns: <span className="font-medium">{mappedCount}</span>
            </li>
            <li>
              Unmapped columns:{" "}
              <span className="font-medium">{unmappedCount}</span>
            </li>
          </ul>

          {unmappedRequiredColumns.length > 0 && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-700">
                Warning: {unmappedRequiredColumns.length} required schema
                columns are not mapped:
              </p>
              <ul className="mt-1 text-xs text-yellow-600 list-disc list-inside">
                {unmappedRequiredColumns.map((col) => (
                  <li key={col.name}>{col.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="max-h-60 overflow-y-auto">
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
                  Added to Schema
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mappings
                .filter((m) => m.schemaColumn || m.addToSchema)
                .map((mapping, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {mapping.fileColumn}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mapping.schemaColumn}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mapping.addToSchema && !mapping.schemaColumn && (
                        <span className="px-2 py-1 text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Yes
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button
            onClick={prevStep}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={saveMapping}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Mapping"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Map Columns to Schema"
      maxWidth="max-w-4xl"
    >
      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {isLoading && step !== "review" ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Step indicator */}
          <div className="mb-6">
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step === "select-schema"
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-100 text-indigo-600"
                }`}
              >
                1
              </div>
              <div
                className={`flex-1 h-1 mx-2 ${
                  step === "select-schema" ? "bg-gray-200" : "bg-indigo-600"
                }`}
              ></div>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step === "map-columns"
                    ? "bg-indigo-600 text-white"
                    : step === "review"
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                2
              </div>
              <div
                className={`flex-1 h-1 mx-2 ${
                  step === "review" ? "bg-indigo-600" : "bg-gray-200"
                }`}
              ></div>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step === "review"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                3
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <div
                className={
                  step === "select-schema"
                    ? "text-indigo-600 font-medium"
                    : "text-gray-500"
                }
              >
                Select Schema
              </div>
              <div
                className={
                  step === "map-columns"
                    ? "text-indigo-600 font-medium"
                    : "text-gray-500"
                }
              >
                Map Columns
              </div>
              <div
                className={
                  step === "review"
                    ? "text-indigo-600 font-medium"
                    : "text-gray-500"
                }
              >
                Review
              </div>
            </div>
          </div>

          {step === "select-schema" && renderSchemaSelection()}
          {step === "map-columns" && renderColumnMapping()}
          {step === "review" && renderReview()}
        </>
      )}
    </Modal>
  );
};

export default SchemaColumnMapper;
