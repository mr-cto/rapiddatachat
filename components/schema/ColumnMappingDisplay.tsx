import React, { useState, useEffect } from "react";
import { Tooltip } from "react-tooltip";

/**
 * Interface for column metadata
 */
interface ColumnMetadata {
  name: string;
  type: string;
  description?: string;
  isRequired?: boolean;
  isPrimaryKey?: boolean;
  sampleValues?: string[];
}

/**
 * Interface for file column metadata
 */
interface FileColumnMetadata extends ColumnMetadata {
  index: number;
  originalName: string;
}

/**
 * Interface for schema column metadata
 */
interface SchemaColumnMetadata extends ColumnMetadata {
  id: string;
  isNewColumn?: boolean;
}

/**
 * Props for ColumnMappingDisplay component
 */
interface ColumnMappingDisplayProps {
  fileColumns: FileColumnMetadata[];
  schemaColumns: SchemaColumnMetadata[];
  isLoading?: boolean;
  onSelectFileColumn?: (column: FileColumnMetadata) => void;
  onSelectSchemaColumn?: (column: SchemaColumnMetadata) => void;
  selectedFileColumn?: FileColumnMetadata | null;
  selectedSchemaColumn?: SchemaColumnMetadata | null;
  suggestedMappings?: Record<string, string>; // fileColumnName -> schemaColumnId
}

/**
 * Component for displaying file and schema columns side by side
 */
const ColumnMappingDisplay: React.FC<ColumnMappingDisplayProps> = ({
  fileColumns,
  schemaColumns,
  isLoading = false,
  onSelectFileColumn,
  onSelectSchemaColumn,
  selectedFileColumn,
  selectedSchemaColumn,
  suggestedMappings = {},
}) => {
  const [searchFileColumns, setSearchFileColumns] = useState("");
  const [searchSchemaColumns, setSearchSchemaColumns] = useState("");
  const [filteredFileColumns, setFilteredFileColumns] = useState<
    FileColumnMetadata[]
  >([]);
  const [filteredSchemaColumns, setFilteredSchemaColumns] = useState<
    SchemaColumnMetadata[]
  >([]);

  // Filter columns based on search
  useEffect(() => {
    if (fileColumns) {
      setFilteredFileColumns(
        fileColumns.filter((column) =>
          column.name.toLowerCase().includes(searchFileColumns.toLowerCase())
        )
      );
    }

    if (schemaColumns) {
      setFilteredSchemaColumns(
        schemaColumns.filter((column) =>
          column.name.toLowerCase().includes(searchSchemaColumns.toLowerCase())
        )
      );
    }
  }, [fileColumns, schemaColumns, searchFileColumns, searchSchemaColumns]);

  /**
   * Get CSS class for file column
   */
  const getFileColumnClass = (column: FileColumnMetadata) => {
    let classes = "p-3 border rounded-md mb-2 cursor-pointer transition-colors";

    // Check if column is selected
    if (selectedFileColumn && selectedFileColumn.name === column.name) {
      classes += " bg-blue-100 dark:bg-blue-900 border-blue-500";
    } else {
      classes += " hover:bg-gray-50 dark:hover:bg-gray-800";
    }

    // Check if column has a suggested mapping
    if (suggestedMappings && suggestedMappings[column.name]) {
      classes += " border-l-4 border-l-green-500";
    }

    return classes;
  };

  /**
   * Get CSS class for schema column
   */
  const getSchemaColumnClass = (column: SchemaColumnMetadata) => {
    let classes = "p-3 border rounded-md mb-2 cursor-pointer transition-colors";

    // Check if column is selected
    if (selectedSchemaColumn && selectedSchemaColumn.id === column.id) {
      classes += " bg-blue-100 dark:bg-blue-900 border-blue-500";
    } else {
      classes += " hover:bg-gray-50 dark:hover:bg-gray-800";
    }

    // Check if column is required
    if (column.isRequired) {
      classes += " border-l-4 border-l-red-500";
    }

    // Check if column is a primary key
    if (column.isPrimaryKey) {
      classes += " border-l-4 border-l-purple-500";
    }

    // Check if column is a new column
    if (column.isNewColumn) {
      classes += " border-l-4 border-l-yellow-500";
    }

    return classes;
  };

  /**
   * Handle file column click
   */
  const handleFileColumnClick = (column: FileColumnMetadata) => {
    if (onSelectFileColumn) {
      onSelectFileColumn(column);
    }
  };

  /**
   * Handle schema column click
   */
  const handleSchemaColumnClick = (column: SchemaColumnMetadata) => {
    if (onSelectSchemaColumn) {
      onSelectSchemaColumn(column);
    }
  };

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* File Columns */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">File Columns</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Search file columns..."
              className="w-full p-2 border rounded-md pl-10"
              value={searchFileColumns}
              onChange={(e) => setSearchFileColumns(e.target.value)}
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto pr-2">
          {filteredFileColumns.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No file columns found
            </div>
          ) : (
            filteredFileColumns.map((column) => (
              <div
                key={column.name}
                className={getFileColumnClass(column)}
                onClick={() => handleFileColumnClick(column)}
                data-tooltip-id={`file-column-${column.name}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{column.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Type: {column.type}
                    </div>
                    {column.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {column.description}
                      </div>
                    )}
                  </div>
                  <div className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    Col {column.index + 1}
                  </div>
                </div>

                {column.sampleValues && column.sampleValues.length > 0 && (
                  <div className="mt-2 text-sm">
                    <div className="text-gray-500 dark:text-gray-400">
                      Sample values:
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {column.sampleValues.map((value, index) => (
                        <span
                          key={index}
                          className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {suggestedMappings && suggestedMappings[column.name] && (
                  <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                    Suggested mapping:{" "}
                    {
                      schemaColumns.find(
                        (sc) => sc.id === suggestedMappings[column.name]
                      )?.name
                    }
                  </div>
                )}

                <Tooltip
                  id={`file-column-${column.name}`}
                  place="left"
                  content={`Original name: ${column.originalName}`}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Schema Columns */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Schema Columns</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Search schema columns..."
              className="w-full p-2 border rounded-md pl-10"
              value={searchSchemaColumns}
              onChange={(e) => setSearchSchemaColumns(e.target.value)}
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto pr-2">
          {filteredSchemaColumns.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No schema columns found
            </div>
          ) : (
            filteredSchemaColumns.map((column) => (
              <div
                key={column.id}
                className={getSchemaColumnClass(column)}
                onClick={() => handleSchemaColumnClick(column)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium flex items-center">
                      {column.name}
                      {column.isRequired && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                      {column.isPrimaryKey && (
                        <span className="ml-1 text-purple-500">🔑</span>
                      )}
                      {column.isNewColumn && (
                        <span className="ml-1 text-yellow-500">New</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Type: {column.type}
                    </div>
                    {column.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {column.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingDisplay;
