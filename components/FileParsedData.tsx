import React, { useState, useEffect } from "react";
import { ColumnInfo } from "../lib/fileParsingService";

interface FileParsedDataProps {
  fileId: string;
}

interface ParsedData {
  columns: ColumnInfo[];
  rowCount: number;
  sampleData: any[];
  fileType: string;
}

/**
 * Component to display parsed file information
 */
const FileParsedData: React.FC<FileParsedDataProps> = ({ fileId }) => {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"columns" | "sample">("columns");

  // Fetch parsed file data
  useEffect(() => {
    const fetchParsedData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/file-parsing/${fileId}`);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch parsed data: ${response.statusText}`
          );
        }

        const data = await response.json();
        setParsedData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchParsedData();
    }
  }, [fileId]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  // Render empty state
  if (!parsedData) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300">
        No parsed data available
      </div>
    );
  }

  // Render data type badge
  const renderDataTypeBadge = (dataType: string) => {
    const typeColors: Record<string, string> = {
      string:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      integer:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      float:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      date: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      boolean:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      null: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    };

    const colorClass =
      typeColors[dataType] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}
      >
        {dataType}
      </span>
    );
  };

  return (
    <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg shadow-sm">
      {/* File info header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-primary dark:text-primary">
              File Analysis
            </h2>
            <p className="text-sm text-tertiary dark:text-tertiary">
              {parsedData.rowCount.toLocaleString()} rows •{" "}
              {parsedData.columns.length} columns •{" "}
              {parsedData.fileType.toUpperCase()} file
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "columns"
                ? "border-b-2 border-accent-primary text-accent-primary"
                : "text-secondary dark:text-secondary hover:text-accent-primary dark:hover:text-accent-primary"
            }`}
            onClick={() => setActiveTab("columns")}
          >
            Columns
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "sample"
                ? "border-b-2 border-accent-primary text-accent-primary"
                : "text-secondary dark:text-secondary hover:text-accent-primary dark:hover:text-accent-primary"
            }`}
            onClick={() => setActiveTab("sample")}
          >
            Sample Data
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "columns" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-tertiary dark:text-tertiary uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-tertiary dark:text-tertiary uppercase tracking-wider">
                    Data Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-tertiary dark:text-tertiary uppercase tracking-wider">
                    Unique Values
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-tertiary dark:text-tertiary uppercase tracking-wider">
                    Null Count
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-tertiary dark:text-tertiary uppercase tracking-wider">
                    Sample Values
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {parsedData.columns.map((column) => (
                  <tr
                    key={column.index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary dark:text-primary">
                      {column.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary dark:text-secondary">
                      {renderDataTypeBadge(column.dataType)}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary dark:text-secondary">
                      {column.uniqueValues?.toLocaleString() || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary dark:text-secondary">
                      {column.nullCount?.toLocaleString() || "0"}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary dark:text-secondary">
                      <div className="max-w-xs truncate">
                        {column.sampleValues.slice(0, 3).map((value, i) => (
                          <span
                            key={i}
                            className="inline-block px-2 py-1 mr-1 mb-1 text-xs bg-gray-100 dark:bg-gray-800 rounded"
                          >
                            {value === null ||
                            value === undefined ||
                            value === ""
                              ? "null"
                              : String(value)}
                          </span>
                        ))}
                        {column.sampleValues.length > 3 && (
                          <span className="text-xs text-tertiary dark:text-tertiary">
                            +{column.sampleValues.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "sample" && (
          <div className="overflow-x-auto">
            {parsedData.sampleData.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    {parsedData.columns.map((column) => (
                      <th
                        key={column.index}
                        className="px-4 py-3 text-left text-xs font-medium text-tertiary dark:text-tertiary uppercase tracking-wider"
                      >
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {parsedData.sampleData.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      {parsedData.columns.map((column) => (
                        <td
                          key={`${rowIndex}-${column.index}`}
                          className="px-4 py-3 text-sm text-secondary dark:text-secondary"
                        >
                          {row[column.name] === null ||
                          row[column.name] === undefined ||
                          row[column.name] === "" ? (
                            <span className="text-tertiary dark:text-tertiary italic">
                              null
                            </span>
                          ) : (
                            String(row[column.name])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-tertiary dark:text-tertiary">
                No sample data available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileParsedData;
