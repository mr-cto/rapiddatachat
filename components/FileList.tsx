import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FaTrash, FaEye } from "react-icons/fa";

// Define the file type
interface File {
  id: string;
  filename: string;
  uploadedAt: string;
  ingestedAt: string | null;
  sizeBytes: number;
  format: string | null;
  status: string;
  metadata: unknown; // Using any for flexibility in handling different metadata structures
  _count: {
    fileErrors: number;
  };
}

// Props for the FileList component
interface FileListProps {
  files: File[];
  onDelete: (fileId: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

const FileList: React.FC<FileListProps> = ({
  files,
  onDelete,
  // onRefresh,
  loading,
}) => {
  const router = useRouter();
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null
  );

  // State to store columns for each file
  const [fileColumns, setFileColumns] = useState<Record<string, string[]>>({});
  const [loadingColumns, setLoadingColumns] = useState<Record<string, boolean>>(
    {}
  );
  const [fetchAttempted, setFetchAttempted] = useState<Record<string, boolean>>(
    {}
  );

  // // Format date for display
  // const formatDate = (dateString: string | null) => {
  //   if (!dateString) return "N/A";
  //   return new Date(dateString).toLocaleString();
  // };

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Handle delete click
  const handleDeleteClick = (fileId: string) => {
    setDeleteConfirmation(fileId);
  };

  // Confirm delete
  const confirmDelete = (fileId: string) => {
    onDelete(fileId);
    setDeleteConfirmation(null);
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  // View file synopsis
  const viewSynopsis = (fileId: string) => {
    router.push(`/file/${fileId}`);
  };

  // Helper function to safely convert any value to a string
  const safeToString = (value: any): string => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value === "object") {
      try {
        // Try to get a name property if it exists
        if (value.name && typeof value.name === "string") {
          return value.name;
        }
        // Otherwise stringify the object
        return JSON.stringify(value);
      } catch (e) {
        return "[Complex Object]";
      }
    }
    return String(value);
  };

  // Function to fetch columns for a specific file
  const fetchColumnsForFile = async (fileId: string) => {
    if (loadingColumns[fileId]) return;

    setLoadingColumns((prev) => ({ ...prev, [fileId]: true }));
    try {
      // Make an API call to get file details including columns
      const response = await fetch(`/api/file-synopsis/${fileId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch columns: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Fetched file data for ${fileId}:`, data);

      // Extract columns from the response
      let extractedColumns: string[] = [];

      if (data.columns) {
        extractedColumns = Array.isArray(data.columns)
          ? data.columns.map(safeToString)
          : typeof data.columns === "object" && data.columns !== null
          ? Object.keys(data.columns)
          : [];
      } else if (data.metadata?.columns) {
        extractedColumns = Array.isArray(data.metadata.columns)
          ? data.metadata.columns.map(safeToString)
          : typeof data.metadata.columns === "object" &&
            data.metadata.columns !== null
          ? Object.keys(data.metadata.columns)
          : [];
      } else if (data.schema?.fields) {
        extractedColumns = Array.isArray(data.schema.fields)
          ? data.schema.fields.map((f: any) => safeToString(f.name || f))
          : [];
      } else if (data.headers) {
        extractedColumns = Array.isArray(data.headers)
          ? data.headers.map(safeToString)
          : [];
      } else if (
        data.data &&
        Array.isArray(data.data) &&
        data.data.length > 0
      ) {
        // If we have data rows, try to extract column names from the first row
        if (typeof data.data[0] === "object" && data.data[0] !== null) {
          extractedColumns = Object.keys(data.data[0]);
        }
      }

      // If we still don't have columns, try to find any array in the response
      if (extractedColumns.length === 0) {
        // Look for any array in the response that might contain column info
        Object.entries(data).forEach(([key, value]) => {
          if (
            Array.isArray(value) &&
            value.length > 0 &&
            (key.includes("column") ||
              key.includes("field") ||
              key.includes("header"))
          ) {
            extractedColumns = value.map(safeToString);
          }
        });
      }

      console.log(`Extracted columns for ${fileId}:`, extractedColumns);
      setFileColumns((prev) => ({ ...prev, [fileId]: extractedColumns }));
    } catch (error) {
      console.error(`Error fetching columns for file ${fileId}:`, error);
    } finally {
      setLoadingColumns((prev) => ({ ...prev, [fileId]: false }));
      setFetchAttempted((prev) => ({ ...prev, [fileId]: true }));
    }
  };

  // Effect to fetch columns for files when component mounts or files change
  useEffect(() => {
    // Only fetch for files that don't already have columns and haven't been attempted
    files.forEach((file) => {
      // Check if we need to extract columns from metadata
      let columnsFromMetadata: string[] = [];

      try {
        if (file.metadata && typeof file.metadata === "object") {
          const metadata = file.metadata as Record<string, any>;
          if (Array.isArray(metadata.columns)) {
            columnsFromMetadata = metadata.columns.map(safeToString);
          } else if (
            typeof metadata.columns === "object" &&
            metadata.columns !== null
          ) {
            columnsFromMetadata = Object.keys(metadata.columns);
          } else if (
            metadata.schema?.fields &&
            Array.isArray(metadata.schema.fields)
          ) {
            columnsFromMetadata = metadata.schema.fields.map((field: any) =>
              safeToString(field.name || field)
            );
          } else if (metadata.schema && typeof metadata.schema === "object") {
            columnsFromMetadata = Object.keys(metadata.schema);
          } else if (metadata.fields && Array.isArray(metadata.fields)) {
            columnsFromMetadata = metadata.fields.map((field: any) =>
              safeToString(field.name || field)
            );
          } else if (Array.isArray(metadata.headers)) {
            columnsFromMetadata = metadata.headers.map(safeToString);
          } else if (
            metadata.columnNames &&
            Array.isArray(metadata.columnNames)
          ) {
            columnsFromMetadata = metadata.columnNames.map(safeToString);
          } else if (metadata.header && Array.isArray(metadata.header)) {
            columnsFromMetadata = metadata.header.map(safeToString);
          }
        }
      } catch (error) {
        console.error("Error extracting columns from metadata:", error);
      }

      // If we found columns in metadata, use those
      if (columnsFromMetadata.length > 0) {
        setFileColumns((prev) => ({ ...prev, [file.id]: columnsFromMetadata }));
        setFetchAttempted((prev) => ({ ...prev, [file.id]: true }));
      }
      // Otherwise fetch from API if we haven't already tried
      else if (
        !fileColumns[file.id] &&
        !fetchAttempted[file.id] &&
        !loadingColumns[file.id]
      ) {
        fetchColumnsForFile(file.id);
      }
    });
  }, [files, fileColumns, fetchAttempted, loadingColumns]);

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 grid grid-cols-1 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="flex space-x-2">
                  <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                  <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                </div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-5 bg-gray-200 rounded w-1/4 mb-3"></div>
              <div className="mt-3">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="flex flex-wrap gap-1">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                  <div className="h-6 bg-gray-200 rounded w-14"></div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show empty state
  if (files.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-8 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-black dark:text-black">
            No files available
          </h3>
          <p className="mt-2 text-base text-gray-500 max-w-md mx-auto">
            Upload a file to see its columns and data structure.
          </p>
          <div className="mt-6">
            <Link
              href="/upload"
              className="inline-flex items-center px-5 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Upload File
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="bg-white overflow-hidden">
      {/* Single Column File List */}
      <div className="p-1 grid grid-cols-1 gap-2">
        {files.map((file) => {
          // Get columns for this file (either from state or extracted from metadata)
          const columns = fileColumns[file.id] || [];

          return (
            <div
              key={file.id}
              className="border rounded-lg p-2 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-sm font-medium text-black dark:text-black break-words pr-2">
                  {file.filename}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => viewSynopsis(file.id)}
                    className="text-blue-600 hover:text-blue-900"
                    title="View Synopsis"
                  >
                    <FaEye />
                  </button>
                  {deleteConfirmation === file.id ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => confirmDelete(file.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Confirm Delete"
                      >
                        Yes
                      </button>
                      <button
                        onClick={cancelDelete}
                        className="text-gray-600 hover:text-gray-900"
                        title="Cancel Delete"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDeleteClick(file.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete File"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-1">
                {file.format?.toUpperCase() || "Unknown format"} •{" "}
                {formatFileSize(file.sizeBytes)}
              </div>

              {/* Display status badge */}
              <div className="mb-1">
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                    file.status
                  )}`}
                >
                  {file.status}
                </span>
                {file._count.fileErrors > 0 && (
                  <span className="text-xs text-red-500 ml-2">
                    {file._count.fileErrors} error(s)
                  </span>
                )}
              </div>

              {/* Display columns */}
              <div className="mt-1">
                <h4 className="text-xs font-medium text-gray-700 mb-1">
                  Columns:
                </h4>
                <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto">
                  {columns.length > 0 ? (
                    columns.slice(0, 10).map((column, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-800 text-xs px-1 py-0.5 rounded"
                      >
                        {column}
                      </span>
                    ))
                  ) : (
                    <div>
                      {loadingColumns[file.id] ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-1"></div>
                          <span className="text-xs text-gray-500">
                            Loading...
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500">
                            No columns
                          </span>
                          <button
                            className="ml-1 text-xs text-blue-600 hover:text-blue-800"
                            onClick={() => fetchColumnsForFile(file.id)}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileList;
