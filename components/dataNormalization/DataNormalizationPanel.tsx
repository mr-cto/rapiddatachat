import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  NormalizationResult,
  NormalizationError,
  NormalizationWarning,
} from "../../lib/dataNormalization/dataNormalizationService";

interface DataNormalizationPanelProps {
  fileId: string;
  projectId: string;
  schemaId: string;
  rawData?: any[];
  onNormalizationComplete?: (result: NormalizationResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Component for normalizing data according to a schema
 */
const DataNormalizationPanel: React.FC<DataNormalizationPanelProps> = ({
  fileId,
  projectId,
  schemaId,
  rawData,
  onNormalizationComplete,
  onError,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<NormalizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState({
    skipInvalidRows: false,
    validateTypes: true,
    validateRequired: true,
    validateConstraints: true,
  });

  /**
   * Normalize data
   */
  const normalizeData = async (data?: any[]) => {
    try {
      setIsLoading(true);
      setError(null);

      const dataToNormalize = data || rawData;

      if (!dataToNormalize) {
        throw new Error("No data to normalize");
      }

      const response = await fetch("/api/data-normalization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          projectId,
          schemaId,
          rawData: dataToNormalize,
          options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to normalize data");
      }

      const normalizationResult = await response.json();
      setResult(normalizationResult);

      // Notify parent component
      if (onNormalizationComplete) {
        onNormalizationComplete(normalizationResult);
      }

      return normalizationResult;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);

      // Notify parent component
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get normalized data for a file
   */
  const getNormalizedData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/data-normalization?fileId=${fileId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get normalized data");
      }

      const data = await response.json();
      return data.normalizedData;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);

      // Notify parent component
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }

      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle option change
   */
  const handleOptionChange = (option: string, value: boolean) => {
    setOptions((prevOptions) => ({
      ...prevOptions,
      [option]: value,
    }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
        Data Normalization
      </h2>

      {/* Options */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
          Validation Options
        </h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="skipInvalidRows"
              checked={options.skipInvalidRows}
              onChange={(e) =>
                handleOptionChange("skipInvalidRows", e.target.checked)
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="skipInvalidRows"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Skip invalid rows
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="validateTypes"
              checked={options.validateTypes}
              onChange={(e) =>
                handleOptionChange("validateTypes", e.target.checked)
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="validateTypes"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Validate data types
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="validateRequired"
              checked={options.validateRequired}
              onChange={(e) =>
                handleOptionChange("validateRequired", e.target.checked)
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="validateRequired"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Validate required fields
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="validateConstraints"
              checked={options.validateConstraints}
              onChange={(e) =>
                handleOptionChange("validateConstraints", e.target.checked)
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="validateConstraints"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Validate constraints
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => normalizeData()}
          disabled={isLoading || !rawData}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Normalizing..." : "Normalize Data"}
        </button>
        <button
          onClick={() => getNormalizedData()}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "View Normalized Data"}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 mb-4">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
            Normalization Results
          </h3>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
            <div className="flex items-center mb-2">
              <div
                className={`h-3 w-3 rounded-full mr-2 ${
                  result.success ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span className="font-medium">
                {result.success ? "Success" : "Completed with errors"}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Normalized {result.normalizedCount} records with{" "}
              {result.errorCount} errors
            </p>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-md font-medium mb-2 text-red-600 dark:text-red-400">
                Errors ({result.errors.length})
              </h4>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Row
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Column
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {result.errors.map((error, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {error.rowIndex >= 0 ? error.rowIndex + 1 : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {error.column || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {error.value !== null && error.value !== undefined
                            ? String(error.value)
                            : "null"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                          {error.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="mt-4">
              <h4 className="text-md font-medium mb-2 text-yellow-600 dark:text-yellow-400">
                Warnings ({result.warnings.length})
              </h4>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Row
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Column
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Warning
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {result.warnings.map((warning, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {warning.rowIndex >= 0 ? warning.rowIndex + 1 : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {warning.column || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {warning.value !== null && warning.value !== undefined
                            ? String(warning.value)
                            : "null"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 dark:text-yellow-400">
                          {warning.warning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataNormalizationPanel;
