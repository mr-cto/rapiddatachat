import React, { useState } from "react";

/**
 * Interface for column definition
 */
export interface NewColumnDefinition {
  name: string;
  type: string;
  description?: string;
  isRequired?: boolean;
  isPrimaryKey?: boolean;
  defaultValue?: string;
  derivationFormula?: string;
}

/**
 * Props for NewColumnForm component
 */
interface NewColumnFormProps {
  onAddColumn: (column: NewColumnDefinition) => void;
  onCancel: () => void;
  existingColumnNames?: string[];
}

/**
 * Component for adding a new column to the schema
 */
const NewColumnForm: React.FC<NewColumnFormProps> = ({
  onAddColumn,
  onCancel,
  existingColumnNames = [],
}) => {
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState("text");
  const [columnDescription, setColumnDescription] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [isPrimaryKey, setIsPrimaryKey] = useState(false);
  const [columnSource, setColumnSource] = useState<"constant" | "derived">(
    "constant"
  );
  const [defaultValue, setDefaultValue] = useState("");
  const [derivationFormula, setDerivationFormula] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Available column types
   */
  const columnTypes = [
    { value: "text", label: "Text" },
    { value: "integer", label: "Integer" },
    { value: "float", label: "Float" },
    { value: "boolean", label: "Boolean" },
    { value: "date", label: "Date" },
    { value: "datetime", label: "DateTime" },
  ];

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Check column name
    if (!columnName.trim()) {
      newErrors.name = "Column name is required";
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(columnName)) {
      newErrors.name =
        "Column name must start with a letter and contain only letters, numbers, and underscores";
    } else if (existingColumnNames.includes(columnName)) {
      newErrors.name = "Column name already exists";
    }

    // Check default value for constant columns
    if (columnSource === "constant" && !defaultValue.trim()) {
      newErrors.defaultValue = "Default value is required for constant columns";
    }

    // Check derivation formula for derived columns
    if (columnSource === "derived" && !derivationFormula.trim()) {
      newErrors.derivationFormula =
        "Derivation formula is required for derived columns";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const newColumn: NewColumnDefinition = {
      name: columnName,
      type: columnType,
      description: columnDescription || undefined,
      isRequired,
      isPrimaryKey,
    };

    if (columnSource === "constant") {
      newColumn.defaultValue = defaultValue;
    } else if (columnSource === "derived") {
      newColumn.derivationFormula = derivationFormula;
    }

    onAddColumn(newColumn);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
        Add New Column
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Column Name */}
        <div className="mb-4">
          <label
            htmlFor="columnName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Column Name *
          </label>
          <input
            type="text"
            id="columnName"
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            className={`w-full p-2 border rounded-md ${
              errors.name
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Column Type */}
        <div className="mb-4">
          <label
            htmlFor="columnType"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Column Type *
          </label>
          <select
            id="columnType"
            value={columnType}
            onChange={(e) => setColumnType(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {columnTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Column Description */}
        <div className="mb-4">
          <label
            htmlFor="columnDescription"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Description
          </label>
          <textarea
            id="columnDescription"
            value={columnDescription}
            onChange={(e) => setColumnDescription(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            rows={2}
          />
        </div>

        {/* Column Flags */}
        <div className="mb-4 flex space-x-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isRequired"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="isRequired"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Required
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPrimaryKey"
              checked={isPrimaryKey}
              onChange={(e) => setIsPrimaryKey(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="isPrimaryKey"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Primary Key
            </label>
          </div>
        </div>

        {/* Column Source */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Column Source *
          </label>
          <div className="flex space-x-4">
            <div className="flex items-center">
              <input
                type="radio"
                id="constantSource"
                name="columnSource"
                value="constant"
                checked={columnSource === "constant"}
                onChange={() => setColumnSource("constant")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label
                htmlFor="constantSource"
                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
              >
                Constant Value
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="derivedSource"
                name="columnSource"
                value="derived"
                checked={columnSource === "derived"}
                onChange={() => setColumnSource("derived")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label
                htmlFor="derivedSource"
                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
              >
                Derived Value
              </label>
            </div>
          </div>
        </div>

        {/* Constant Value */}
        {columnSource === "constant" && (
          <div className="mb-4">
            <label
              htmlFor="defaultValue"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Default Value *
            </label>
            <input
              type="text"
              id="defaultValue"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              className={`w-full p-2 border rounded-md ${
                errors.defaultValue
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              placeholder={`Enter a ${columnType} value`}
            />
            {errors.defaultValue && (
              <p className="mt-1 text-sm text-red-500">{errors.defaultValue}</p>
            )}
          </div>
        )}

        {/* Derivation Formula */}
        {columnSource === "derived" && (
          <div className="mb-4">
            <label
              htmlFor="derivationFormula"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Derivation Formula *
            </label>
            <textarea
              id="derivationFormula"
              value={derivationFormula}
              onChange={(e) => setDerivationFormula(e.target.value)}
              className={`w-full p-2 border rounded-md ${
                errors.derivationFormula
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              rows={3}
              placeholder="e.g., CONCAT(first_name, ' ', last_name) or price * quantity"
            />
            {errors.derivationFormula && (
              <p className="mt-1 text-sm text-red-500">
                {errors.derivationFormula}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use column names from the schema to create a formula. Supported
              operations: +, -, *, /, CONCAT(), UPPER(), LOWER(), TRIM(),
              SUBSTRING(), etc.
            </p>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Add Column
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewColumnForm;
