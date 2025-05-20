import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import {
  ColumnMapping,
  GlobalSchema,
  SchemaColumn,
} from "../lib/schemaManagement";
import { v4 as uuidv4 } from "uuid";

interface ImprovedSchemaColumnMapperProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileColumns: string[];
  userId: string;
  projectId?: string;
  onMappingComplete?: (mapping: ColumnMapping) => void;
}

interface ColumnSample {
  name: string;
  sampleValues: string[];
  dataType: string;
}

interface ColumnMappingItem {
  fileColumn: string;
  schemaColumn: string;
  addToSchema?: boolean;
}

/**
 * ImprovedSchemaColumnMapper - A better approach to mapping file columns to schema columns
 * that focuses on correctly displaying the actual column names
 */
export const ImprovedSchemaColumnMapper: React.FC<
  ImprovedSchemaColumnMapperProps
> = ({
  isOpen,
  onClose,
  fileId,
  fileColumns: initialFileColumns,
  userId,
  projectId,
  onMappingComplete,
}) => {
  // State for schemas
  const [schemas, setSchemas] = useState<GlobalSchema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<GlobalSchema | null>(
    null
  );

  // State for file columns and sample data
  const [fileColumns, setFileColumns] = useState<string[]>(initialFileColumns);
  const [columnSamples, setColumnSamples] = useState<ColumnSample[]>([]);

  // State for column mappings
  const [mappings, setMappings] = useState<ColumnMappingItem[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select-schema" | "map-columns" | "review">(
    "select-schema"
  );
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Track if this component has already been processed for this file
  const [hasProcessed, setHasProcessed] = useState<boolean>(false);

  // Fetch schemas when component mounts
  useEffect(() => {
    if (isOpen && userId && !hasProcessed) {
      fetchSchemas();
    }
  }, [isOpen, userId, projectId, hasProcessed]);

  // Fetch actual column names and sample data when component mounts
  useEffect(() => {
    if (isOpen && fileId && !hasProcessed) {
      // Check if this file has already been processed
      checkFileProcessingStatus();
    }
  }, [isOpen, fileId, hasProcessed]);

  /**
   * Check if the file is already being processed or active
   */
  const checkFileProcessingStatus = async () => {
    try {
      const response = await fetch(`/api/files/${fileId}`);
      if (response.ok) {
        const data = await response.json();
        const fileStatus = data.file?.status;

        console.log(`File ${fileId} status: ${fileStatus}`);

        // If the file is already being processed or is active, don't show the mapper
        if (fileStatus === "processing" || fileStatus === "active") {
          console.log(
            `File ${fileId} is already ${fileStatus}, skipping column mapping`
          );
          setHasProcessed(true);
          onClose(); // Close the mapper

          // If there's a completion callback, call it with empty mapping
          if (onMappingComplete) {
            onMappingComplete({
              fileId,
              schemaId: "",
              mappings: {},
              newColumnsAdded: 0,
            });
          }
          return;
        }

        // Otherwise, fetch the column names
        fetchActualColumnNames();
      }
    } catch (err) {
      console.error("Error checking file status:", err);
      // Continue with column mapping if we can't check the status
      fetchActualColumnNames();
    }
  };

  // Initialize mappings when schema is selected
  useEffect(() => {
    if (selectedSchema && fileColumns.length > 0) {
      initializeMappings();
    }
  }, [selectedSchema, fileColumns]);

  /**
   * Fetch actual column names from the file
   */
  const fetchActualColumnNames = async () => {
    try {
      setIsLoading(true);

      // First try to get column names from file metadata
      const fileResponse = await fetch(`/api/files/${fileId}`);
      if (fileResponse.ok) {
        const fileData = await fileResponse.json();
        console.log("File metadata:", fileData);

        if (
          fileData.file?.metadata?.columns &&
          Array.isArray(fileData.file.metadata.columns) &&
          fileData.file.metadata.columns.length > 0
        ) {
          console.log(
            "Using columns from file metadata:",
            fileData.file.metadata.columns
          );
          setFileColumns(fileData.file.metadata.columns);

          // Initialize empty sample data
          const initialSamples = fileData.file.metadata.columns.map(
            (col: string) => ({
              name: col,
              sampleValues: [],
              dataType: "text",
            })
          );
          setColumnSamples(initialSamples);

          // Fetch sample data in the background
          fetchSampleData(fileData.file.metadata.columns);
          return;
        }
      }

      // If metadata doesn't have columns, try to get from parsed data
      const dataResponse = await fetch(
        `/api/file-parsed-data/${fileId}?limit=5`
      );
      if (dataResponse.ok) {
        const parsedData = await dataResponse.json();
        console.log("Parsed data:", parsedData);

        if (parsedData.data && parsedData.data.length > 0) {
          // Extract column names from the first row
          const extractedColumns = Object.keys(parsedData.data[0]);
          console.log("Extracted columns from parsed data:", extractedColumns);

          if (extractedColumns.length > 0) {
            setFileColumns(extractedColumns);

            // Extract sample values and detect data types
            const samples = extractSamplesFromData(
              extractedColumns,
              parsedData.data
            );
            setColumnSamples(samples);
            return;
          }
        }
      }

      // If all else fails, use the provided fileColumns
      console.log("Using provided file columns:", initialFileColumns);
      setFileColumns(initialFileColumns);

      // Initialize empty sample data
      const fallbackSamples = initialFileColumns.map((col) => ({
        name: col,
        sampleValues: [],
        dataType: "text",
      }));
      setColumnSamples(fallbackSamples);
    } catch (err) {
      console.error("Error fetching column names:", err);
      setError(
        "Failed to fetch column names. Using provided column names instead."
      );

      // Use provided columns as fallback
      setFileColumns(initialFileColumns);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Extract sample values and detect data types from parsed data
   */
  const extractSamplesFromData = (
    columns: string[],
    data: any[]
  ): ColumnSample[] => {
    return columns.map((column) => {
      // Extract up to 5 sample values
      const values = data
        .slice(0, 5)
        .map((row) => row[column])
        .filter((val) => val !== undefined && val !== null)
        .map((val) => String(val));

      // Detect data type
      let dataType = "text";
      if (values.length > 0) {
        const firstValue = values[0];
        if (!isNaN(Number(firstValue))) {
          dataType = "number";
        } else if (
          typeof firstValue === "string" &&
          !isNaN(Date.parse(firstValue))
        ) {
          dataType = "date";
        } else if (
          typeof firstValue === "string" &&
          (firstValue.toLowerCase() === "true" ||
            firstValue.toLowerCase() === "false")
        ) {
          dataType = "boolean";
        }
      }

      return {
        name: column,
        sampleValues: values,
        dataType,
      };
    });
  };

  /**
   * Fetch sample data for columns
   */
  const fetchSampleData = async (columns: string[]) => {
    try {
      const response = await fetch(`/api/file-parsed-data/${fileId}?limit=5`);
      if (response.ok) {
        const parsedData = await response.json();

        if (parsedData.data && parsedData.data.length > 0) {
          const samples = extractSamplesFromData(columns, parsedData.data);
          setColumnSamples(samples);
        }
      }
    } catch (err) {
      console.error("Error fetching sample data:", err);
      // Don't set error state to avoid blocking the UI
    }
  };

  /**
   * Fetch all schemas for the user
   */
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

  /**
   * Initialize mappings based on column name similarity
   */
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
   * Handle schema selection
   */
  const handleSchemaSelect = (schemaId: string) => {
    const schema = schemas.find((s) => s.id === schemaId);
    setSelectedSchema(schema || null);
    setStep("map-columns");
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
   * Toggle add to schema option
   */
  const toggleAddToSchema = (fileColumn: string) => {
    setMappings(
      mappings.map((m) =>
        m.fileColumn === fileColumn ? { ...m, addToSchema: !m.addToSchema } : m
      )
    );
  };

  /**
   * Save the column mapping
   */
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
        // Mark this file as processed to prevent duplicate processing
        setHasProcessed(true);

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

  /**
   * Navigate to the next step
   */
  const nextStep = () => {
    if (step === "select-schema") {
      setStep("map-columns");
    } else if (step === "map-columns") {
      setStep("review");
    }
  };

  /**
   * Navigate to the previous step
   */
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
  const renderColumnMapping = () => {
    // Filter mappings based on search term
    const filteredMappings = searchTerm
      ? mappings.filter((m) =>
          m.fileColumn.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : mappings;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Map your file columns to schema columns:
          </p>
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Column
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sample Data
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
              {filteredMappings.map((mapping, index) => {
                // Find sample data for this column
                const sampleData = columnSamples.find(
                  (col) => col.name === mapping.fileColumn
                );

                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex flex-col">
                        {/* Always show the actual column name from the file */}
                        <span className="font-semibold text-indigo-700">
                          {mapping.fileColumn}
                        </span>
                        <span className="text-xs text-gray-500">
                          {sampleData?.dataType || "text"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {sampleData?.sampleValues &&
                      sampleData.sampleValues.length > 0 ? (
                        <div className="max-w-xs overflow-hidden">
                          <div className="flex flex-wrap gap-1">
                            {sampleData.sampleValues
                              .slice(0, 3)
                              .map((value, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-1 bg-gray-100 rounded text-xs truncate max-w-[100px]"
                                  title={value}
                                >
                                  {value}
                                </span>
                              ))}
                            {sampleData.sampleValues.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{sampleData.sampleValues.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          No samples available
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <select
                        value={mapping.schemaColumn}
                        onChange={(e) =>
                          updateMapping(mapping.fileColumn, e.target.value)
                        }
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">-- Not Mapped --</option>
                        {selectedSchema?.columns.map((column) => (
                          <option key={column.name} value={column.name}>
                            {column.name} ({column.type})
                            {column.isRequired ? " *" : ""}
                          </option>
                        ))}
                      </select>
                      {mapping.schemaColumn && (
                        <div className="mt-1">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {selectedSchema?.columns.find(
                              (c) => c.name === mapping.schemaColumn
                            )?.type || "text"}
                          </span>
                          {selectedSchema?.columns.find(
                            (c) => c.name === mapping.schemaColumn
                          )?.isRequired && (
                            <span className="ml-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {!mapping.schemaColumn && (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`add-to-schema-${index}`}
                            checked={mapping.addToSchema || false}
                            onChange={() =>
                              toggleAddToSchema(mapping.fileColumn)
                            }
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
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredMappings.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No columns match your search
          </div>
        )}

        <div className="flex justify-between space-x-2 pt-4">
          <div>
            <button
              onClick={() => {
                // Auto-map all columns that have a good match
                const updatedMappings = [...mappings];
                updatedMappings.forEach((mapping) => {
                  if (!mapping.schemaColumn) {
                    const matchingColumn = findMatchingSchemaColumn(
                      mapping.fileColumn,
                      selectedSchema?.columns || []
                    );
                    if (matchingColumn) {
                      mapping.schemaColumn = matchingColumn.name;
                    }
                  }
                });
                setMappings(updatedMappings);
              }}
              className="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50"
            >
              Auto-map All
            </button>
          </div>
          <div className="flex space-x-2">
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
      </div>
    );
  };

  // Render the review step
  const renderReview = () => {
    // Count mapped and unmapped columns
    const mappedCount = mappings.filter((m) => m.schemaColumn).length;
    const unmappedCount = mappings.length - mappedCount;
    const newColumnsCount = mappings.filter(
      (m) => !m.schemaColumn && m.addToSchema
    ).length;

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
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <ul className="text-sm space-y-2">
                <li className="flex justify-between">
                  <span className="text-gray-600">Schema:</span>
                  <span className="font-medium">{selectedSchema?.name}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Total file columns:</span>
                  <span className="font-medium">{fileColumns.length}</span>
                </li>
              </ul>
            </div>
            <div>
              <ul className="text-sm space-y-2">
                <li className="flex justify-between">
                  <span className="text-gray-600">Mapped columns:</span>
                  <span className="font-medium text-green-600">
                    {mappedCount}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">New columns to add:</span>
                  <span className="font-medium text-blue-600">
                    {newColumnsCount}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Unmapped columns:</span>
                  <span className="font-medium text-gray-600">
                    {unmappedCount - newColumnsCount}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {unmappedRequiredColumns.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm font-medium text-yellow-700 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Warning: {unmappedRequiredColumns.length} required schema
                columns are not mapped
              </p>
              <ul className="mt-2 text-sm text-yellow-600 list-disc list-inside">
                {unmappedRequiredColumns.map((col) => (
                  <li key={col.name}>{col.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="max-h-60 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Column
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schema Column
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mappings
                .filter((m) => m.schemaColumn || m.addToSchema)
                .map((mapping, index) => {
                  // Find sample data for this column
                  const sampleData = columnSamples.find(
                    (col) => col.name === mapping.fileColumn
                  );

                  return (
                    <tr key={index}>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-indigo-700">
                            {mapping.fileColumn}
                          </span>
                          {sampleData && (
                            <span className="text-xs text-gray-500">
                              {sampleData.dataType} •{" "}
                              {sampleData.sampleValues.slice(0, 1).join(", ")}
                              {sampleData.sampleValues.length > 1 ? "..." : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {mapping.schemaColumn ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {mapping.schemaColumn}
                            </span>
                            <span className="text-xs text-gray-500">
                              {selectedSchema?.columns.find(
                                (c) => c.name === mapping.schemaColumn
                              )?.type || "text"}
                              {selectedSchema?.columns.find(
                                (c) => c.name === mapping.schemaColumn
                              )?.isRequired
                                ? " • Required"
                                : ""}
                            </span>
                          </div>
                        ) : mapping.addToSchema ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {mapping.fileColumn} (new)
                            </span>
                            <span className="text-xs text-gray-500">
                              Will be added as text
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not mapped</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {mapping.schemaColumn ? (
                          <span className="px-2 py-1 text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Mapped
                          </span>
                        ) : mapping.addToSchema ? (
                          <span className="px-2 py-1 text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            New Column
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Ignored
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
      title="Column Mapping"
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
