import React, { useState, useEffect } from "react";

/**
 * Interface for transformation rule
 */
export interface TransformationRule {
  id: string;
  name: string;
  description?: string;
  type: string;
  params: Record<string, any>;
}

/**
 * Props for TransformationRuleForm component
 */
interface TransformationRuleFormProps {
  onAddRule: (rule: TransformationRule) => void;
  onCancel: () => void;
  fileColumnName?: string;
  schemaColumnName?: string;
  existingRules?: TransformationRule[];
}

/**
 * Component for defining transformation rules
 */
const TransformationRuleForm: React.FC<TransformationRuleFormProps> = ({
  onAddRule,
  onCancel,
  fileColumnName,
  schemaColumnName,
  existingRules = [],
}) => {
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [ruleType, setRuleType] = useState("format");
  const [formatType, setFormatType] = useState("uppercase");
  const [replacePattern, setReplacePattern] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [truncateLength, setTruncateLength] = useState(10);
  const [padLength, setPadLength] = useState(10);
  const [padChar, setPadChar] = useState(" ");
  const [padDirection, setPadDirection] = useState("left");
  const [numberFormat, setNumberFormat] = useState("fixed");
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [customFormula, setCustomFormula] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Available transformation types
   */
  const transformationTypes = [
    { value: "format", label: "Format" },
    { value: "replace", label: "Replace" },
    { value: "truncate", label: "Truncate" },
    { value: "pad", label: "Pad" },
    { value: "number", label: "Number Format" },
    { value: "date", label: "Date Format" },
    { value: "custom", label: "Custom Formula" },
  ];

  /**
   * Available format types
   */
  const formatTypes = [
    { value: "uppercase", label: "Uppercase" },
    { value: "lowercase", label: "Lowercase" },
    { value: "capitalize", label: "Capitalize" },
    { value: "trim", label: "Trim" },
  ];

  /**
   * Available number formats
   */
  const numberFormats = [
    { value: "fixed", label: "Fixed Decimal Places" },
    { value: "currency", label: "Currency" },
    { value: "percentage", label: "Percentage" },
  ];

  /**
   * Available date formats
   */
  const dateFormats = [
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
    { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
    { value: "YYYY-MM-DD HH:mm:ss", label: "YYYY-MM-DD HH:mm:ss" },
  ];

  /**
   * Initialize rule name based on column names
   */
  useEffect(() => {
    if (fileColumnName && schemaColumnName) {
      setRuleName(`Transform ${fileColumnName} to ${schemaColumnName}`);
    } else if (fileColumnName) {
      setRuleName(`Transform ${fileColumnName}`);
    } else if (schemaColumnName) {
      setRuleName(`Transform to ${schemaColumnName}`);
    }
  }, [fileColumnName, schemaColumnName]);

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Check rule name
    if (!ruleName.trim()) {
      newErrors.name = "Rule name is required";
    }

    // Check custom formula
    if (ruleType === "custom" && !customFormula.trim()) {
      newErrors.customFormula = "Custom formula is required";
    }

    // Check replace pattern and value
    if (ruleType === "replace") {
      if (!replacePattern.trim()) {
        newErrors.replacePattern = "Replace pattern is required";
      }
    }

    // Check truncate length
    if (ruleType === "truncate") {
      if (truncateLength <= 0) {
        newErrors.truncateLength = "Truncate length must be greater than 0";
      }
    }

    // Check pad length and character
    if (ruleType === "pad") {
      if (padLength <= 0) {
        newErrors.padLength = "Pad length must be greater than 0";
      }
      if (!padChar.trim()) {
        newErrors.padChar = "Pad character is required";
      }
    }

    // Check decimal places
    if (ruleType === "number" && numberFormat === "fixed") {
      if (decimalPlaces < 0) {
        newErrors.decimalPlaces = "Decimal places must be 0 or greater";
      }
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

    // Create rule params based on rule type
    let params: Record<string, any> = {};

    switch (ruleType) {
      case "format":
        params = { formatType };
        break;
      case "replace":
        params = { pattern: replacePattern, value: replaceValue };
        break;
      case "truncate":
        params = { length: truncateLength };
        break;
      case "pad":
        params = { length: padLength, char: padChar, direction: padDirection };
        break;
      case "number":
        params = { format: numberFormat, decimalPlaces };
        break;
      case "date":
        params = { format: dateFormat };
        break;
      case "custom":
        params = { formula: customFormula };
        break;
    }

    // Create rule
    const rule: TransformationRule = {
      id: `rule_${Date.now()}`,
      name: ruleName,
      description: ruleDescription || undefined,
      type: ruleType,
      params,
    };

    onAddRule(rule);
  };

  /**
   * Render form fields based on rule type
   */
  const renderRuleTypeFields = () => {
    switch (ruleType) {
      case "format":
        return (
          <div className="mb-4">
            <label
              htmlFor="formatType"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Format Type *
            </label>
            <select
              id="formatType"
              value={formatType}
              onChange={(e) => setFormatType(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {formatTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formatType === "uppercase"
                ? "Convert text to UPPERCASE"
                : formatType === "lowercase"
                ? "Convert text to lowercase"
                : formatType === "capitalize"
                ? "Convert First Letter Of Each Word To Uppercase"
                : "Remove whitespace from beginning and end of text"}
            </p>
          </div>
        );

      case "replace":
        return (
          <>
            <div className="mb-4">
              <label
                htmlFor="replacePattern"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Replace Pattern *
              </label>
              <input
                type="text"
                id="replacePattern"
                value={replacePattern}
                onChange={(e) => setReplacePattern(e.target.value)}
                className={`w-full p-2 border rounded-md ${
                  errors.replacePattern
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                placeholder="Text or regex pattern to replace"
              />
              {errors.replacePattern && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.replacePattern}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter text or a regular expression pattern to replace
              </p>
            </div>
            <div className="mb-4">
              <label
                htmlFor="replaceValue"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Replace With
              </label>
              <input
                type="text"
                id="replaceValue"
                value={replaceValue}
                onChange={(e) => setReplaceValue(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Text to replace with (leave empty to remove)"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter the text to replace with (leave empty to remove matches)
              </p>
            </div>
          </>
        );

      case "truncate":
        return (
          <div className="mb-4">
            <label
              htmlFor="truncateLength"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Maximum Length *
            </label>
            <input
              type="number"
              id="truncateLength"
              value={truncateLength}
              onChange={(e) => setTruncateLength(parseInt(e.target.value))}
              min="1"
              className={`w-full p-2 border rounded-md ${
                errors.truncateLength
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
            />
            {errors.truncateLength && (
              <p className="mt-1 text-sm text-red-500">
                {errors.truncateLength}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Truncate text to this maximum length
            </p>
          </div>
        );

      case "pad":
        return (
          <>
            <div className="mb-4">
              <label
                htmlFor="padLength"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Target Length *
              </label>
              <input
                type="number"
                id="padLength"
                value={padLength}
                onChange={(e) => setPadLength(parseInt(e.target.value))}
                min="1"
                className={`w-full p-2 border rounded-md ${
                  errors.padLength
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              />
              {errors.padLength && (
                <p className="mt-1 text-sm text-red-500">{errors.padLength}</p>
              )}
            </div>
            <div className="mb-4">
              <label
                htmlFor="padChar"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Pad Character *
              </label>
              <input
                type="text"
                id="padChar"
                value={padChar}
                onChange={(e) =>
                  setPadChar(e.target.value ? e.target.value[0] : "")
                }
                maxLength={1}
                className={`w-full p-2 border rounded-md ${
                  errors.padChar
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              />
              {errors.padChar && (
                <p className="mt-1 text-sm text-red-500">{errors.padChar}</p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pad Direction
              </label>
              <div className="flex space-x-4">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="padLeft"
                    name="padDirection"
                    value="left"
                    checked={padDirection === "left"}
                    onChange={() => setPadDirection("left")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label
                    htmlFor="padLeft"
                    className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                  >
                    Left
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="padRight"
                    name="padDirection"
                    value="right"
                    checked={padDirection === "right"}
                    onChange={() => setPadDirection("right")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label
                    htmlFor="padRight"
                    className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                  >
                    Right
                  </label>
                </div>
              </div>
            </div>
          </>
        );

      case "number":
        return (
          <>
            <div className="mb-4">
              <label
                htmlFor="numberFormat"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Number Format *
              </label>
              <select
                id="numberFormat"
                value={numberFormat}
                onChange={(e) => setNumberFormat(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {numberFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
            {numberFormat === "fixed" && (
              <div className="mb-4">
                <label
                  htmlFor="decimalPlaces"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Decimal Places *
                </label>
                <input
                  type="number"
                  id="decimalPlaces"
                  value={decimalPlaces}
                  onChange={(e) => setDecimalPlaces(parseInt(e.target.value))}
                  min="0"
                  className={`w-full p-2 border rounded-md ${
                    errors.decimalPlaces
                      ? "border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
                />
                {errors.decimalPlaces && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.decimalPlaces}
                  </p>
                )}
              </div>
            )}
          </>
        );

      case "date":
        return (
          <div className="mb-4">
            <label
              htmlFor="dateFormat"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Date Format *
            </label>
            <select
              id="dateFormat"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {dateFormats.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Format dates according to the selected pattern
            </p>
          </div>
        );

      case "custom":
        return (
          <div className="mb-4">
            <label
              htmlFor="customFormula"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Custom Formula *
            </label>
            <textarea
              id="customFormula"
              value={customFormula}
              onChange={(e) => setCustomFormula(e.target.value)}
              className={`w-full p-2 border rounded-md ${
                errors.customFormula
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`}
              rows={3}
              placeholder="e.g., CONCAT(value, ' suffix') or ROUND(value * 1.1, 2)"
            />
            {errors.customFormula && (
              <p className="mt-1 text-sm text-red-500">
                {errors.customFormula}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use &apos;value&apos; to refer to the column value. Supported
              functions: CONCAT, SUBSTRING, REPLACE, ROUND, FLOOR, CEILING, ABS,
              etc.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
        Add Transformation Rule
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Rule Name */}
        <div className="mb-4">
          <label
            htmlFor="ruleName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Rule Name *
          </label>
          <input
            type="text"
            id="ruleName"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
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

        {/* Rule Description */}
        <div className="mb-4">
          <label
            htmlFor="ruleDescription"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Description
          </label>
          <textarea
            id="ruleDescription"
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            rows={2}
          />
        </div>

        {/* Rule Type */}
        <div className="mb-4">
          <label
            htmlFor="ruleType"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Transformation Type *
          </label>
          <select
            id="ruleType"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {transformationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Rule Type Specific Fields */}
        {renderRuleTypeFields()}

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
            Add Rule
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransformationRuleForm;
