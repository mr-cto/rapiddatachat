import React, { useState, useEffect } from "react";
import { TransformationRule } from "./TransformationRuleForm";
import transformationService from "../../lib/transformationService";

/**
 * Interface for column mapping
 */
interface ColumnMapping {
  fileColumnName: string;
  schemaColumnId: string;
}

/**
 * Interface for file column metadata
 */
interface FileColumnMetadata {
  name: string;
  originalName: string;
  type: string;
  index: number;
  sampleValues?: string[];
}

/**
 * Interface for schema column metadata
 */
interface SchemaColumnMetadata {
  id: string;
  name: string;
  type: string;
  description?: string;
  isRequired?: boolean;
  isPrimaryKey?: boolean;
  isNewColumn?: boolean;
}

/**
 * Props for MappingPreview component
 */
interface MappingPreviewProps {
  fileId: string;
  schemaId: string;
  mappings: ColumnMapping[];
  fileColumns: FileColumnMetadata[];
  schemaColumns: SchemaColumnMetadata[];
  transformationRules?: Record<string, TransformationRule[]>;
  sampleData?: any[];
  onValidationIssues?: (issues: ValidationIssue[]) => void;
}

/**
 * Interface for validation issue
 */
interface ValidationIssue {
  rowIndex: number;
  columnName: string;
  schemaColumnId: string;
  issueType: "missing" | "type" | "format";
  message: string;
  severity: "warning" | "error";
}

/**
 * Component for displaying mapping preview
 */
const MappingPreview: React.FC<MappingPreviewProps> = ({
  fileId,
  schemaId,
  mappings,
  fileColumns,
  schemaColumns,
  transformationRules = {},
  sampleData: initialSampleData,
  onValidationIssues,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [mappedData, setMappedData] = useState<any[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    []
  );
  const [showOriginalData, setShowOriginalData] = useState(false);
  const [showMappedData, setShowMappedData] = useState(true);
  const [showValidationIssues, setShowValidationIssues] = useState(true);

  // Load data on component mount or when props change
  useEffect(() => {
    if (initialSampleData && initialSampleData.length > 0) {
      setSampleData(initialSampleData);
      setIsLoading(false);
    } else {
      loadSampleData();
    }
  }, [fileId, initialSampleData]);

  // Update mapped data when mappings, sample data, or transformation rules change
  useEffect(() => {
    if (sampleData.length > 0 && mappings.length > 0) {
      const newMappedData = mapData();
      setMappedData(newMappedData);
      validateMappedData(newMappedData);
    }
  }, [sampleData, mappings, transformationRules, schemaColumns]);

  /**
   * Load sample data from API
   */
  const loadSampleData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch sample data
      const response = await fetch(`/api/file-parsed-data/${fileId}?limit=10`);

      if (!response.ok) {
        throw new Error("Failed to fetch sample data");
      }

      const data = await response.json();
      setSampleData(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Map data using mappings and transformation rules
   */
  const mapData = (): any[] => {
    return sampleData.map((row) => {
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
   * Validate mapped data against schema
   */
  const validateMappedData = (data: any[]) => {
    const issues: ValidationIssue[] = [];

    data.forEach((row, rowIndex) => {
      // Check for required fields
      schemaColumns.forEach((schemaColumn) => {
        if (schemaColumn.isRequired) {
          const value = row[schemaColumn.name];
          if (value === undefined || value === null || value === "") {
            issues.push({
              rowIndex,
              columnName: schemaColumn.name,
              schemaColumnId: schemaColumn.id,
              issueType: "missing",
              message: `Required field "${schemaColumn.name}" is missing or empty`,
              severity: "error",
            });
          }
        }
      });

      // Check for type mismatches
      Object.entries(row).forEach(([columnName, value]) => {
        const schemaColumn = schemaColumns.find((sc) => sc.name === columnName);
        if (schemaColumn) {
          const valueType = typeof value;

          if (value !== null && value !== undefined) {
            if (
              schemaColumn.type === "integer" &&
              !Number.isInteger(Number(value))
            ) {
              issues.push({
                rowIndex,
                columnName,
                schemaColumnId: schemaColumn.id,
                issueType: "type",
                message: `Value "${value}" is not a valid integer for column "${columnName}"`,
                severity: "warning",
              });
            } else if (schemaColumn.type === "float" && isNaN(Number(value))) {
              issues.push({
                rowIndex,
                columnName,
                schemaColumnId: schemaColumn.id,
                issueType: "type",
                message: `Value "${value}" is not a valid number for column "${columnName}"`,
                severity: "warning",
              });
            } else if (
              schemaColumn.type === "boolean" &&
              typeof value !== "boolean" &&
              !["true", "false", "0", "1"].includes(String(value).toLowerCase())
            ) {
              issues.push({
                rowIndex,
                columnName,
                schemaColumnId: schemaColumn.id,
                issueType: "type",
                message: `Value "${value}" is not a valid boolean for column "${columnName}"`,
                severity: "warning",
              });
            } else if (
              schemaColumn.type === "date" &&
              isNaN(Date.parse(String(value)))
            ) {
              issues.push({
                rowIndex,
                columnName,
                schemaColumnId: schemaColumn.id,
                issueType: "type",
                message: `Value "${value}" is not a valid date for column "${columnName}"`,
                severity: "warning",
              });
            }
          }
        }
      });
    });

    setValidationIssues(issues);

    // Call onValidationIssues callback if provided
    if (onValidationIssues) {
      onValidationIssues(issues);
    }
  };

  /**
   * Get file column name for a schema column
   */
  const getFileColumnName = (schemaColumnId: string) => {
    const mapping = mappings.find((m) => m.schemaColumnId === schemaColumnId);
    return mapping ? mapping.fileColumnName : null;
  };

  /**
   * Get schema column for a file column
   */
  const getSchemaColumn = (fileColumnName: string) => {
    const mapping = mappings.find((m) => m.fileColumnName === fileColumnName);
    if (mapping) {
      return schemaColumns.find((sc) => sc.id === mapping.schemaColumnId);
    }
    return null;
  };

  /**
   * Get validation issues for a specific column and row
   */
  const getIssuesForCell = (rowIndex: number, columnName: string) => {
    return validationIssues.filter(
      (issue) => issue.rowIndex === rowIndex && issue.columnName === columnName
    );
  };

  /**
   * Export mapped data as CSV
   */
  const handleExportCSV = () => {
    if (mappedData.length === 0) {
      return;
    }

    // Get column headers
    const headers = Object.keys(mappedData[0]);

    // Convert data to CSV
    const csvContent = [
      headers.join(","),
      ...mappedData.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Handle values with commas by wrapping in quotes
            if (value === null || value === undefined) {
              return "";
            } else if (typeof value === "string" && value.includes(",")) {
              return `"${value}"`;
            } else {
              return String(value);
            }
          })
          .join(",")
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mapped_data_${fileId}_${schemaId}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Export mapping configuration as JSON
   */
  const handleExportConfig = () => {
    const config = {
      fileId,
      schemaId,
      mappings,
      transformationRules,
      timestamp: new Date().toISOString(),
    };

    // Create download link
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mapping_config_${fileId}_${schemaId}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (sampleData.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300">
        No sample data available for preview.
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300">
        No mappings defined yet. Create mappings to see a preview.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Mapping Preview
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportConfig}
            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm"
          >
            Export Config
          </button>
        </div>
      </div>

      {/* Display options */}
      <div className="flex space-x-4 mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showOriginalData}
            onChange={(e) => setShowOriginalData(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Show Original Data
          </span>
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showMappedData}
            onChange={(e) => setShowMappedData(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Show Mapped Data
          </span>
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showValidationIssues}
            onChange={(e) => setShowValidationIssues(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Show Validation Issues
          </span>
        </label>
      </div>

      {/* Validation summary */}
      {showValidationIssues && validationIssues.length > 0 && (
        <div className="mb-4">
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-300">
              Validation Issues ({validationIssues.length})
            </h4>
            <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-200 max-h-32 overflow-y-auto">
              {validationIssues.slice(0, 5).map((issue, index) => (
                <li key={index} className="mb-1">
                  <span className="font-medium">
                    Row {issue.rowIndex + 1}, {issue.columnName}:
                  </span>{" "}
                  {issue.message}
                </li>
              ))}
              {validationIssues.length > 5 && (
                <li className="italic">
                  ...and {validationIssues.length - 5} more issues
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Original data */}
      {showOriginalData && (
        <div className="mb-6">
          <h4 className="text-md font-medium mb-2 text-gray-700 dark:text-gray-300">
            Original Data
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-800 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  {Object.keys(sampleData[0]).map((key) => (
                    <th
                      key={key}
                      className="py-2 px-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleData.slice(0, 5).map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    {Object.entries(row).map(([key, value], colIndex) => (
                      <td
                        key={`${rowIndex}-${colIndex}`}
                        className="py-2 px-3 text-sm text-gray-800 dark:text-gray-200"
                      >
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
          {sampleData.length > 5 && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-right">
              Showing 5 of {sampleData.length} rows
            </div>
          )}
        </div>
      )}

      {/* Mapped data */}
      {showMappedData && (
        <div>
          <h4 className="text-md font-medium mb-2 text-gray-700 dark:text-gray-300">
            Mapped Data
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-800 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  {Object.keys(mappedData[0] || {}).map((key) => (
                    <th
                      key={key}
                      className="py-2 px-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappedData.slice(0, 5).map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    {Object.entries(row).map(([key, value], colIndex) => {
                      const issues = getIssuesForCell(rowIndex, key);
                      const hasIssues = issues.length > 0;
                      const hasErrors = issues.some(
                        (i) => i.severity === "error"
                      );

                      return (
                        <td
                          key={`${rowIndex}-${colIndex}`}
                          className={`py-2 px-3 text-sm ${
                            hasErrors
                              ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                              : hasIssues
                              ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200"
                              : "text-gray-800 dark:text-gray-200"
                          }`}
                          title={
                            hasIssues
                              ? issues.map((i) => i.message).join("\n")
                              : undefined
                          }
                        >
                          {value !== null && value !== undefined
                            ? String(value)
                            : ""}
                          {hasIssues && (
                            <span className="ml-1 text-xs">
                              {hasErrors ? "⚠️" : "⚠"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mappedData.length > 5 && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-right">
              Showing 5 of {mappedData.length} rows
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MappingPreview;
