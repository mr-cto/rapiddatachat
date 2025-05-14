import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { ColumnMapping } from "../../lib/dataTransformation/mappingEngine";

/**
 * Interface for mapping definition form props
 */
interface MappingDefinitionFormProps {
  projectId: string;
  initialValues?: {
    id?: string;
    name?: string;
    description?: string;
    sourceType?: string;
    targetType?: string;
    mappings?: ColumnMapping[];
    transformationRules?: Record<string, any[]>;
  };
  onSubmit?: (values: any) => void;
  onCancel?: () => void;
}

/**
 * Component for creating and editing mapping definitions
 */
const MappingDefinitionForm: React.FC<MappingDefinitionFormProps> = ({
  projectId,
  initialValues = {},
  onSubmit,
  onCancel,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(initialValues.name || "");
  const [description, setDescription] = useState(
    initialValues.description || ""
  );
  const [sourceType, setSourceType] = useState(
    initialValues.sourceType || "file"
  );
  const [targetType, setTargetType] = useState(
    initialValues.targetType || "schema"
  );
  const [mappings, setMappings] = useState<ColumnMapping[]>(
    initialValues.mappings || []
  );
  const [transformationRules, setTransformationRules] = useState<
    Record<string, any[]>
  >(initialValues.transformationRules || {});

  // Source and target options
  const sourceTypeOptions = [
    { value: "file", label: "File" },
    { value: "api", label: "API" },
    { value: "database", label: "Database" },
  ];

  const targetTypeOptions = [
    { value: "schema", label: "Schema" },
    { value: "api", label: "API" },
    { value: "database", label: "Database" },
  ];

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      setError(null);

      // Validate form
      if (!name.trim()) {
        throw new Error("Name is required");
      }

      if (!sourceType) {
        throw new Error("Source type is required");
      }

      if (!targetType) {
        throw new Error("Target type is required");
      }

      // Prepare form data
      const formData: any = {
        name,
        description: description.trim() || undefined,
        sourceType,
        targetType,
        mappings,
        transformationRules:
          Object.keys(transformationRules).length > 0
            ? transformationRules
            : undefined,
        projectId,
      };

      // Add ID if editing
      if (initialValues.id) {
        formData.id = initialValues.id;
      }

      // Submit form
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // Default submission logic
        const url = initialValues.id
          ? "/api/data-transformation/mapping-definitions"
          : "/api/data-transformation/mapping-definitions";

        const method = initialValues.id ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to save mapping definition");
        }

        // Show success message
        setSuccess("Mapping definition saved successfully");

        // Redirect after a delay
        setTimeout(() => {
          router.push(
            `/project/${projectId}/data-transformation/mapping-definitions`
          );
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Add a mapping
   */
  const addMapping = (fileColumnName: string, schemaColumnId: string) => {
    // Check if mapping already exists
    const existingIndex = mappings.findIndex(
      (m) => m.fileColumnName === fileColumnName
    );

    if (existingIndex !== -1) {
      // Update existing mapping
      const updatedMappings = [...mappings];
      updatedMappings[existingIndex] = {
        fileColumnName,
        schemaColumnId,
      };
      setMappings(updatedMappings);
    } else {
      // Add new mapping
      setMappings([
        ...mappings,
        {
          fileColumnName,
          schemaColumnId,
        },
      ]);
    }
  };

  /**
   * Remove a mapping
   */
  const removeMapping = (fileColumnName: string) => {
    setMappings(mappings.filter((m) => m.fileColumnName !== fileColumnName));

    // Also remove any transformation rules for this mapping
    const updatedRules = { ...transformationRules };
    delete updatedRules[fileColumnName];
    setTransformationRules(updatedRules);
  };

  /**
   * Add a transformation rule
   */
  const addTransformationRule = (fileColumnName: string, rule: any) => {
    const updatedRules = { ...transformationRules };

    if (!updatedRules[fileColumnName]) {
      updatedRules[fileColumnName] = [];
    }

    updatedRules[fileColumnName].push(rule);
    setTransformationRules(updatedRules);
  };

  /**
   * Remove a transformation rule
   */
  const removeTransformationRule = (
    fileColumnName: string,
    ruleIndex: number
  ) => {
    const updatedRules = { ...transformationRules };

    if (updatedRules[fileColumnName]) {
      updatedRules[fileColumnName] = updatedRules[fileColumnName].filter(
        (_, index) => index !== ruleIndex
      );

      if (updatedRules[fileColumnName].length === 0) {
        delete updatedRules[fileColumnName];
      }

      setTransformationRules(updatedRules);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">
        {initialValues.id
          ? "Edit Mapping Definition"
          : "Create Mapping Definition"}
      </h2>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 mb-6">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div className="mb-4">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Name *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            rows={3}
          />
        </div>

        {/* Source Type */}
        <div className="mb-4">
          <label
            htmlFor="sourceType"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Source Type *
          </label>
          <select
            id="sourceType"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          >
            {sourceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target Type */}
        <div className="mb-4">
          <label
            htmlFor="targetType"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Target Type *
          </label>
          <select
            id="targetType"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          >
            {targetTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Mappings */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
            Mappings
          </h3>

          {mappings.length === 0 ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400">
              No mappings defined yet. Add mappings using the mapping interface.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white dark:bg-gray-800 rounded-md overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                      Source Column
                    </th>
                    <th className="py-2 px-4 text-left text-gray-700 dark:text-gray-300">
                      Target Column
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
                  {mappings.map((mapping) => (
                    <tr
                      key={mapping.fileColumnName}
                      className="border-t border-gray-200 dark:border-gray-700"
                    >
                      <td className="py-2 px-4">{mapping.fileColumnName}</td>
                      <td className="py-2 px-4">{mapping.schemaColumnId}</td>
                      <td className="py-2 px-4">
                        {transformationRules[mapping.fileColumnName]?.length ||
                          0}{" "}
                        rules
                      </td>
                      <td className="py-2 px-4">
                        <button
                          type="button"
                          onClick={() => removeMapping(mapping.fileColumnName)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Saving..." : initialValues.id ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MappingDefinitionForm;
