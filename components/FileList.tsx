import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { FaTrash, FaEye } from "react-icons/fa";
import { Badge, Button, Link } from "./ui";

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
  activationError?: string | null;
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
  onRefresh,
  loading,
}) => {
  const router = useRouter();
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null
  );
  const [retryingFiles, setRetryingFiles] = useState<Record<string, boolean>>(
    {}
  );
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});

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

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "processing":
        return "primary";
      case "error":
        return "danger";
      default:
        return "secondary";
    }
  };

  // Handle delete click
  const handleDeleteClick = (fileId: string) => {
    setDeleteConfirmation(fileId);
  };

  // Confirm delete
  const confirmDelete = (fileId: string) => {
    // Clear any cached columns for this file before deletion
    setFileColumns((prev) => {
      const newColumns = { ...prev };
      delete newColumns[fileId];
      return newColumns;
    });

    setFetchAttempted((prev) => {
      const newAttempted = { ...prev };
      delete newAttempted[fileId];
      return newAttempted;
    });

    setLoadingColumns((prev) => {
      const newLoading = { ...prev };
      delete newLoading[fileId];
      return newLoading;
    });

    // Call the parent's onDelete handler
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

  // Retry file ingestion
  const retryFileIngestion = async (fileId: string) => {
    try {
      setRetryingFiles((prev) => ({ ...prev, [fileId]: true }));
      setRetryErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fileId];
        return newErrors;
      });

      const response = await fetch("/api/retry-file-ingestion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            errorData.details ||
            "Failed to retry file ingestion"
        );
      }

      // Refresh the file list after successful retry
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error(`Error retrying file ingestion for ${fileId}:`, error);
      setRetryErrors((prev) => ({
        ...prev,
        [fileId]: error instanceof Error ? error.message : "Unknown error",
      }));
    } finally {
      setRetryingFiles((prev) => ({ ...prev, [fileId]: false }));
    }
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
      <div className="bg-ui-primary shadow rounded-lg overflow-hidden">
        <div className="p-4 grid grid-cols-1 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="h-6 bg-ui-tertiary rounded w-3/4"></div>
                <div className="flex space-x-2">
                  <div className="h-5 w-5 bg-ui-tertiary rounded-full"></div>
                  <div className="h-5 w-5 bg-ui-tertiary rounded-full"></div>
                </div>
              </div>
              <div className="h-4 bg-ui-tertiary rounded w-1/2 mb-2"></div>
              <div className="h-5 bg-ui-tertiary rounded w-1/4 mb-3"></div>
              <div className="mt-3">
                <div className="h-4 bg-ui-tertiary rounded w-1/3 mb-2"></div>
                <div className="flex flex-wrap gap-1">
                  <div className="h-6 bg-ui-tertiary rounded w-16"></div>
                  <div className="h-6 bg-ui-tertiary rounded w-20"></div>
                  <div className="h-6 bg-ui-tertiary rounded w-14"></div>
                  <div className="h-6 bg-ui-tertiary rounded w-24"></div>
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
      <div className="bg-ui-primary shadow rounded-lg overflow-hidden">
        <div className="p-8 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-500"
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
          <h3 className="mt-4 text-lg font-medium text-gray-300">
            No files available
          </h3>
          <p className="mt-2 text-base text-gray-400 max-w-md mx-auto">
            Upload a file to see its columns and data structure.
          </p>
          <div className="mt-6">
            <Link href="/upload" variant="button" size="lg">
              Upload File
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="bg-ui-primary overflow-hidden">
      {/* Single Column File List */}
      <div className="p-1 grid grid-cols-1 gap-2">
        {files.map((file) => {
          // Get columns for this file (either from state or extracted from metadata)
          const columns = fileColumns[file.id] || [];

          return (
            <div
              key={file.id}
              className="border border-ui-border rounded-lg p-2 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-sm font-medium text-gray-300 break-words pr-2">
                  {file.filename}
                </h3>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => viewSynopsis(file.id)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-1 text-accent-primary"
                    title="View Synopsis"
                  >
                    <FaEye />
                  </Button>
                  {deleteConfirmation === file.id ? (
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => confirmDelete(file.id)}
                        variant="danger"
                        size="sm"
                        title="Confirm Delete"
                      >
                        Yes
                      </Button>
                      <Button
                        onClick={cancelDelete}
                        variant="secondary"
                        size="sm"
                        title="Cancel Delete"
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleDeleteClick(file.id)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 p-1 text-red-400"
                      title="Delete File"
                    >
                      <FaTrash />
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-400 mb-1">
                {file.format?.toUpperCase() || "Unknown format"} •{" "}
                {formatFileSize(file.sizeBytes)}
              </div>

              {/* Display status badge */}
              <div className="mb-1">
                <Badge
                  variant={getStatusBadgeVariant(file.status) as any}
                  size="sm"
                >
                  {file.status}
                </Badge>
                {file._count.fileErrors > 0 && (
                  <Badge variant="danger" size="sm" className="ml-2">
                    {file._count.fileErrors} error(s)
                  </Badge>
                )}

                {/* Add retry button for files in error state */}
                {file.status === "error" && (
                  <div className="mt-1">
                    {retryingFiles[file.id] ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-primary mr-1"></div>
                        <span className="text-xs text-gray-400">
                          Retrying...
                        </span>
                      </div>
                    ) : (
                      <div>
                        <Button
                          onClick={() => retryFileIngestion(file.id)}
                          variant="primary"
                          size="sm"
                          className="text-xs"
                        >
                          Retry Ingestion
                        </Button>
                        {retryErrors[file.id] && (
                          <div className="text-xs text-red-400 mt-1">
                            {retryErrors[file.id]}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Display columns */}
              <div className="mt-1">
                <h4 className="text-xs font-medium text-gray-400 mb-1">
                  Columns:
                </h4>
                <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto">
                  {columns.length > 0 ? (
                    columns.slice(0, 10).map((column, index) => (
                      <span
                        key={index}
                        className="bg-ui-tertiary text-gray-300 text-xs px-1 py-0.5 rounded"
                      >
                        {column}
                      </span>
                    ))
                  ) : (
                    <div>
                      {loadingColumns[file.id] ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-primary mr-1"></div>
                          <span className="text-xs text-gray-400">
                            Loading...
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <span className="text-xs text-gray-400">
                            No columns
                          </span>
                          <Button
                            className="ml-1 text-xs"
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchColumnsForFile(file.id)}
                          >
                            Retry
                          </Button>
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
