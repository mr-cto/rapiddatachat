import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { FaFile, FaTrash, FaEye, FaUpload } from "react-icons/fa";
import SchemaColumnMapper from "../SchemaColumnMapper";
import { Button, Card } from "../ui";

interface FileData {
  id: string;
  filename: string;
  uploadedAt: string;
  ingestedAt: string | null;
  sizeBytes: number;
  format: string | null;
  status: string;
  metadata: Record<string, unknown>;
  _count: {
    fileErrors: number;
  };
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface Sorting {
  column: string;
  direction: "asc" | "desc";
}

interface FilesPaneProps {
  onSelectFile: (fileId: string) => void;
  selectedFileId?: string;
  projectId?: string;
}

// Memoized file item component to prevent unnecessary re-renders
const FileItem = memo(
  ({
    file,
    onSelectFile,
    viewSynopsis,
    handleDeleteClick,
    deleteConfirmation,
    handleDeleteFile,
    cancelDelete,
    formatFileSize,
    getStatusBadgeColor,
  }: {
    file: FileData;
    onSelectFile: (fileId: string) => void;
    viewSynopsis: (fileId: string) => void;
    handleDeleteClick: (fileId: string) => void;
    deleteConfirmation: string | null;
    handleDeleteFile: (fileId: string) => void;
    cancelDelete: () => void;
    formatFileSize: (bytes: number) => string;
    getStatusBadgeColor: (status: string) => string;
  }) => {
    return (
      <div
        className="border border-ui-border rounded-lg p-2 hover:shadow-md transition-shadow"
        onClick={() => onSelectFile(file.id)}
      >
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-sm font-medium text-gray-300 break-words pr-2">
            {file.filename}
          </h3>
          <div className="flex space-x-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                viewSynopsis(file.id);
              }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                  variant="danger"
                  size="sm"
                  title="Confirm Delete"
                >
                  Yes
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelDelete();
                  }}
                  variant="secondary"
                  size="sm"
                  title="Cancel Delete"
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(file.id);
                }}
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
      </div>
    );
  }
);

FileItem.displayName = "FileItem";

const FilesPane: React.FC<FilesPaneProps> = ({
  onSelectFile,
  selectedFileId,
  projectId,
}) => {
  const { data: session } = useSession();
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showSchemaMapper, setShowSchemaMapper] = useState<boolean>(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileColumns, setUploadedFileColumns] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [isFirstUpload, setIsFirstUpload] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasActiveSchema, setHasActiveSchema] = useState<boolean>(false);
  const [schemaCreated, setSchemaCreated] = useState<boolean>(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null
  );
  const [fileColumns, setFileColumns] = useState<Record<string, string[]>>({});
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Maximum file size: 500MB in bytes
  const MAX_FILE_SIZE = 500 * 1024 * 1024;
  const ALLOWED_FILE_TYPES = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  // Pagination and sorting state
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 0,
  });

  const [sorting, setSorting] = useState<Sorting>({
    column: "uploadedAt",
    direction: "desc",
  });

  // Check if there's an active schema - only used during file upload, not in fetchFiles
  const checkActiveSchema = useCallback(async () => {
    if (!session?.user) return false;

    try {
      // Use project-specific endpoint if projectId is provided
      const endpoint = projectId
        ? `/api/schema-management?projectId=${projectId}`
        : `/api/schema-management`;

      try {
        const response = await fetch(endpoint);

        // If the endpoint returns a 404, it means there's no schema yet
        if (response.status === 404) {
          return false;
        }

        if (!response.ok) {
          // Don't throw an error, just assume no schema to allow the flow to continue
          return false;
        }

        const data = await response.json();

        // If we have any schemas at all, consider that we have an active schema
        const hasSchema = data.schemas && data.schemas.length > 0;
        return hasSchema;
      } catch (schemaErr) {
        // If schema check fails, fall back to checking if there are files
        return false;
      }
    } catch (err) {
      // Don't let schema check errors block the upload flow
      return false;
    }
  }, [session, projectId]);

  // Fetch files - memoized with useCallback to prevent unnecessary re-renders
  const fetchFiles = useCallback(async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        sortBy: sorting.column,
        sortDirection: sorting.direction,
      });

      // Always use project-specific endpoint if projectId is provided
      // Otherwise use the general files endpoint
      const endpoint = projectId
        ? `/api/projects/${projectId}/files?${queryParams}`
        : `/api/files?${queryParams}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();

      // Ensure we have a valid files array
      if (data.files && Array.isArray(data.files)) {
        setFiles(data.files);

        // Check if this is the first upload for the project
        const filesEmpty = data.files.length === 0;
        setIsFirstUpload(filesEmpty);

        // If there are files, assume there's a schema
        setHasActiveSchema(!filesEmpty);
      } else {
        setFiles([]);
        setIsFirstUpload(true);
        setHasActiveSchema(false);
      }

      // Don't check schema again here to avoid infinite loop
      // The initial hasActiveSchema value based on files is sufficient

      setPagination({
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalCount: data.pagination.totalCount,
        totalPages: data.pagination.totalPages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching files:", err);
    } finally {
      setLoading(false);
    }
  }, [session, pagination.page, pagination.pageSize, sorting, projectId]);

  // Track if this is the initial mount
  const initialMountRef = useRef(true);

  // Initial fetch on mount only
  useEffect(() => {
    fetchFiles();

    // Add event listener to prevent unnecessary fetches on window focus
    const handleVisibilityChange = () => {
      // Do nothing - we'll handle fetches manually
    };

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch when pagination or sorting changes, but not on window focus events
  useEffect(() => {
    // Skip the first render since we already fetched in the mount effect
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }

    if (session) {
      fetchFiles();
    }
  }, [pagination.page, pagination.pageSize, sorting, fetchFiles, session]);

  // Validate files
  const validateFiles = (
    files: FileList
  ): { valid: File[]; errors: string[] } => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(
          `${file.name}: File size exceeds the limit of ${Math.round(
            MAX_FILE_SIZE / (1024 * 1024)
          )}MB`
        );
        return;
      }

      // Check file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(
          `${file.name}: File type not supported. Please upload CSV or XLSX files only.`
        );
        return;
      }

      validFiles.push(file);
    });

    return { valid: validFiles, errors };
  };

  // Handle file selection
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const { valid, errors } = validateFiles(files);

    if (errors.length > 0) {
      setError(errors.join(". "));
      return;
    }

    if (valid.length > 0) {
      handleFilesUpload(valid);
    }
  };

  // Handle drag events
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop event
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  // Handle file input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  // Handle file upload
  const handleFilesUpload = async (uploadedFiles: File[]) => {
    if (uploadedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadStatus("Uploading file...");
    setSuccessMessage(null);

    try {
      // Check if there's an active schema
      let hasSchema = false;
      try {
        console.log("Checking for active schema before upload...");
        hasSchema = await checkActiveSchema();
        console.log("Active schema check result:", hasSchema);
      } catch (err) {
        console.warn(
          "Schema check failed during upload, proceeding with upload:",
          err
        );
        // Continue with upload even if schema check fails
      }

      // Create FormData object
      const formData = new FormData();
      uploadedFiles.forEach((file) => {
        formData.append("file", file);
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          // Increase progress by random amount between 5-15%
          const increment = Math.random() * 10 + 5;
          return Math.min(prev + increment, 95);
        });
      }, 500);

      // Send the files to the API
      // Always include projectId in the upload if available
      const uploadUrl = projectId
        ? `/api/upload?projectId=${projectId}`
        : "/api/upload";

      console.log(`Uploading to: ${uploadUrl}`);

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      setUploadProgress(100);
      setUploadStatus("Processing file...");

      // Get the response data
      const responseData = await response.json();

      // Get the first uploaded file ID
      if (responseData.files && responseData.files.length > 0) {
        const fileId = responseData.files[0].id;
        setUploadedFileId(fileId);

        // Fetch file columns for schema mapping
        try {
          setUploadStatus("Extracting columns...");

          try {
            // Wait for file to be processed (active status)
            let fileStatus = "pending";
            let retries = 0;
            const maxRetries = 10;

            while (fileStatus !== "active" && retries < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

              const fileStatusResponse = await fetch(`/api/files/${fileId}`);
              if (fileStatusResponse.ok) {
                const fileData = await fileStatusResponse.json();
                fileStatus = "working"; // fileData.status;
                setUploadStatus(`File processing: ${fileStatus}...`);
              }

              retries++;
            }

            // First try to get columns from file-parsed-data endpoint
            const parsedDataResponse = await fetch(
              `/api/file-parsed-data/${fileId}`
            );

            if (parsedDataResponse.ok) {
              const parsedData = await parsedDataResponse.json();
              console.log("Parsed data response:", parsedData);

              // Extract columns from the parsed data response
              let extractedColumns: string[] = [];

              // Try to get columns from the columns field first
              if (parsedData.columns) {
                if (Array.isArray(parsedData.columns)) {
                  extractedColumns = parsedData.columns;
                  console.log(
                    "Using columns from columns array:",
                    extractedColumns
                  );
                } else if (
                  typeof parsedData.columns === "object" &&
                  parsedData.columns !== null
                ) {
                  // If columns is an object, try to extract column names
                  extractedColumns = Object.keys(parsedData.columns);
                  console.log(
                    "Extracted column names from columns object:",
                    extractedColumns
                  );
                }
              }

              // If we still don't have columns, try to get them from the data
              if (
                extractedColumns.length === 0 &&
                parsedData.data &&
                Array.isArray(parsedData.data) &&
                parsedData.data.length > 0
              ) {
                // Get column names from the first row of data
                if (
                  typeof parsedData.data[0] === "object" &&
                  parsedData.data[0] !== null
                ) {
                  extractedColumns = Object.keys(parsedData.data[0]);
                  console.log("Extracted columns from data:", extractedColumns);
                }
              }

              // If we still don't have columns, use generic column names
              if (extractedColumns.length === 0) {
                console.log(
                  "No columns found in parsed-data response, falling back to file-data endpoint"
                );

                // Fall back to file-data endpoint
                const fileDataResponse = await fetch(
                  `/api/file-data/${fileId}`
                );

                if (fileDataResponse.ok) {
                  const fileData = await fileDataResponse.json();

                  // Extract columns from the file data response
                  if (
                    fileData.data &&
                    Array.isArray(fileData.data) &&
                    fileData.data.length > 0
                  ) {
                    // Try to extract columns from the first row of data
                    if (
                      typeof fileData.data[0] === "object" &&
                      fileData.data[0] !== null
                    ) {
                      extractedColumns = Object.keys(fileData.data[0]);
                      console.log(
                        "Extracted columns from file-data:",
                        extractedColumns
                      );
                    }
                  }
                } else {
                  console.warn(
                    `File data response not OK: ${fileDataResponse.status}`
                  );
                }
              }

              // If we still don't have columns, use generic column names
              if (extractedColumns.length === 0) {
                console.log(
                  "No columns found in any response, using generic column names"
                );
                extractedColumns = Array.from(
                  { length: 10 },
                  (_, i) => `Column ${i + 1}`
                );
              }

              setUploadedFileColumns(extractedColumns);
            } else {
              console.warn(
                `Parsed data response not OK: ${parsedDataResponse.status}`
              );

              // Fall back to file-data endpoint
              const fileDataResponse = await fetch(`/api/file-data/${fileId}`);

              if (!fileDataResponse.ok) {
                console.warn(
                  `File data response not OK: ${fileDataResponse.status}`
                );
                // Continue with empty columns rather than failing
                setUploadedFileColumns([]);
              } else {
                const fileData = await fileDataResponse.json();

                // Extract columns from the response
                let extractedColumns: string[] = [];

                if (
                  fileData.data &&
                  Array.isArray(fileData.data) &&
                  fileData.data.length > 0
                ) {
                  // Try to extract columns from the first row of data
                  if (
                    typeof fileData.data[0] === "object" &&
                    fileData.data[0] !== null
                  ) {
                    extractedColumns = Object.keys(fileData.data[0]);
                  }
                }

                // If we still don't have columns, use generic column names
                if (extractedColumns.length === 0) {
                  console.log(
                    "No columns found in file-data response, using generic column names"
                  );
                  extractedColumns = Array.from(
                    { length: 10 },
                    (_, i) => `Column ${i + 1}`
                  );
                }

                setUploadedFileColumns(extractedColumns);
              }
            }

            // For first upload or no active schema, redirect to schema creation page
            // Also check isFirstUpload as a fallback in case schema check failed
            // Decide whether to show schema mapper or create schema

            if (!hasSchema) {
              setUploadStatus("Redirecting to schema creation...");

              // Store columns in localStorage for the schema creation page
              const columnsToStore =
                uploadedFileColumns.length > 0
                  ? uploadedFileColumns
                  : Array.from({ length: 10 }, (_, i) => `Column ${i + 1}`);

              localStorage.setItem(
                "extractedColumns",
                JSON.stringify(columnsToStore)
              );
              localStorage.setItem("uploadedFileId", fileId);

              // Redirect to schema creation page
              router.push({
                pathname: "/project/[id]/schema/create",
                query: {
                  id: projectId,
                  firstUpload: "true",
                  fileId: fileId,
                  schemaCreated: "false",
                },
              });
            } else {
              // For subsequent uploads, show schema mapping modal
              setTimeout(() => {
                setUploadStatus("Mapping columns...");
                setShowSchemaMapper(true);
              }, 1000);
            }
          } catch (err) {
            console.error("Error during column extraction:", err);

            // Even if column extraction fails, we can still proceed with the upload
            // For first upload, redirect to schema creation with default columns
            if (!hasSchema || isFirstUpload) {
              setUploadStatus("Redirecting to schema creation...");

              // Store default columns in localStorage
              localStorage.setItem(
                "extractedColumns",
                JSON.stringify(
                  Array.from({ length: 10 }, (_, i) => `Column ${i + 1}`)
                )
              );
              localStorage.setItem("uploadedFileId", fileId);

              // Redirect to schema creation page
              router.push({
                pathname: "/project/[id]/schema/create",
                query: {
                  id: projectId,
                  firstUpload: "true",
                  fileId: fileId,
                  schemaCreated: "false",
                },
              });
            } else {
              // For subsequent uploads, show schema mapping modal with empty columns
              setTimeout(() => {
                setUploadStatus("Mapping columns...");
                setShowSchemaMapper(true);
              }, 1000);
            }
          }
        } catch (columnErr) {
          console.error("Error in outer column extraction block:", columnErr);
          setUploadStatus("Error extracting columns, using defaults");

          // Use default columns and continue with the flow
          const defaultColumns = Array.from(
            { length: 10 },
            (_, i) => `Column ${i + 1}`
          );
          setUploadedFileColumns(defaultColumns);

          // For first upload, redirect to schema creation with default columns
          if (!hasSchema || isFirstUpload) {
            setUploadStatus("Redirecting to schema creation...");

            // Store default columns in localStorage
            localStorage.setItem(
              "extractedColumns",
              JSON.stringify(defaultColumns)
            );
            localStorage.setItem("uploadedFileId", fileId);

            // Redirect to schema creation page
            router.push({
              pathname: "/project/[id]/schema/create",
              query: {
                id: projectId,
                firstUpload: "true",
                fileId: fileId,
                schemaCreated: "false",
              },
            });
          } else {
            // For subsequent uploads, show schema mapping modal with default columns
            setTimeout(() => {
              setUploadStatus("Mapping columns...");
              setShowSchemaMapper(true);
            }, 1000);
          }
        }
      } else {
        throw new Error("No files were uploaded successfully");
      }

      // Refresh the file list
      fetchFiles();

      // Reset the upload form after successful upload if we're not redirecting
      if (hasSchema || !isFirstUpload) {
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          setUploadStatus("");
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
    }
  };

  // Handle sort change
  const handleSort = (column: string) => {
    setSorting((prev) => ({
      column,
      direction:
        prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({
      ...prev,
      page,
    }));
  };

  // Handle page size change
  const handlePageSizeChange = (pageSize: number) => {
    setPagination((prev) => ({
      ...prev,
      page: 1, // Reset to first page when changing page size
      pageSize,
    }));
  };

  // Handle file deletion
  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      // Refresh the file list
      fetchFiles();
      setDeleteConfirmation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Handle delete click
  const handleDeleteClick = (fileId: string) => {
    setDeleteConfirmation(fileId);
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  // View file synopsis
  const viewSynopsis = (fileId: string) => {
    router.push({
      pathname: "/file/[id]",
      query: { id: fileId },
    });
  };

  // Format file size for display - memoized to prevent recreation on each render
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }, []);

  // Get status badge color - memoized to prevent recreation on each render
  const getStatusBadgeColor = useCallback((status: string) => {
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
  }, []);

  // Memoized file upload component
  const FileUploadComponent = memo(
    ({
      dragActive,
      uploading,
      uploadStatus,
      uploadProgress,
      isFirstUpload,
      hasActiveSchema,
      MAX_FILE_SIZE,
      handleDrag,
      handleDrop,
      inputRef,
      handleChange,
    }: {
      dragActive: boolean;
      uploading: boolean;
      uploadStatus: string;
      uploadProgress: number;
      isFirstUpload: boolean;
      hasActiveSchema: boolean;
      MAX_FILE_SIZE: number;
      handleDrag: (e: React.DragEvent<HTMLDivElement>) => void;
      handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
      inputRef: React.RefObject<HTMLInputElement | null>;
      handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    }) => {
      return (
        <div className="w-full">
          <div
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors duration-200 ${
              dragActive
                ? "border-accent-primary bg-ui-tertiary"
                : "border-gray-600 bg-ui-primary"
            } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            style={{ cursor: uploading ? "default" : "pointer" }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              multiple={!isFirstUpload && hasActiveSchema}
              className="hidden"
              onChange={handleChange}
              disabled={uploading}
            />

            {uploading ? (
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-accent-primary">
                    {uploadStatus || "Uploading..."}
                  </span>
                  <span className="text-sm font-medium text-accent-primary">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
                <div className="w-full bg-ui-tertiary rounded-full h-2.5">
                  <div
                    className="bg-accent-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <>
                <FaUpload className="w-12 h-12 text-accent-primary mb-2" />
                <p className="text-gray-300 mb-2">
                  Drag and drop CSV or XLSX files here, or{" "}
                  <span className="text-accent-primary underline">browse</span>
                </p>
                <p className="text-xs text-gray-400">
                  {isFirstUpload || !hasActiveSchema
                    ? "Upload your first CSV or XLSX file to create a schema for your project."
                    : "Upload CSV or XLSX files to add data to your project. Files will be automatically processed and mapped to your schema."}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Maximum file size: {Math.round(MAX_FILE_SIZE / (1024 * 1024))}
                  MB
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
  );

  FileUploadComponent.displayName = "FileUploadComponent";

  // Create a memoized file upload component
  const fileUploadElement = useMemo(
    () => (
      <FileUploadComponent
        dragActive={dragActive}
        uploading={uploading}
        uploadStatus={uploadStatus}
        uploadProgress={uploadProgress}
        isFirstUpload={isFirstUpload}
        hasActiveSchema={hasActiveSchema}
        MAX_FILE_SIZE={MAX_FILE_SIZE}
        handleDrag={handleDrag}
        handleDrop={handleDrop}
        inputRef={inputRef}
        handleChange={handleChange}
      />
    ),
    [
      dragActive,
      uploading,
      uploadStatus,
      uploadProgress,
      isFirstUpload,
      hasActiveSchema,
      MAX_FILE_SIZE,
      handleDrag,
      handleDrop,
      handleChange,
    ]
  );

  // Render file list UI
  const renderFileList = () => {
    // Show loading state
    if (loading) {
      return (
        <Card variant="default" padding="none">
          <div className="p-4 grid grid-cols-1 gap-4 animate-pulse">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="border border-ui-border rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="h-6 bg-ui-tertiary rounded w-3/4"></div>
                  <div className="flex space-x-2">
                    <div className="h-5 w-5 bg-ui-tertiary rounded-full"></div>
                    <div className="h-5 w-5 bg-ui-tertiary rounded-full"></div>
                  </div>
                </div>
                <div className="h-4 bg-ui-tertiary rounded w-1/2 mb-2"></div>
                <div className="h-5 bg-ui-tertiary rounded w-1/4 mb-3"></div>
              </div>
            ))}
          </div>
        </Card>
      );
    }

    // Show empty state with integrated upload
    if (files.length === 0) {
      return (
        <Card variant="default" padding="none">
          <div className="p-8 text-center">
            <FaFile className="mx-auto h-16 w-16 text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-300">
              No files available
            </h3>
            <p className="mt-2 text-sm text-gray-400 max-w-md mx-auto">
              Upload a file to see its columns and data structure.
            </p>
            <div className="mt-6 max-w-md mx-auto">{fileUploadElement}</div>
          </div>
        </Card>
      );
    }

    // Show file list
    return (
      <Card variant="default" padding="none" className="overflow-hidden">
        <div className="p-1 grid grid-cols-1 gap-2">
          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onSelectFile={onSelectFile}
              viewSynopsis={viewSynopsis}
              handleDeleteClick={handleDeleteClick}
              deleteConfirmation={deleteConfirmation}
              handleDeleteFile={handleDeleteFile}
              cancelDelete={cancelDelete}
              formatFileSize={formatFileSize}
              getStatusBadgeColor={getStatusBadgeColor}
            />
          ))}
        </div>
      </Card>
    );
  };

  // Remove debug console.log to improve performance

  return (
    <div className="h-[50vh] flex flex-col">
      <div className="p-2 border-b border-ui-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-md font-semibold flex items-center text-gray-300">
              <FaFile className="mr-1" /> Files{" "}
              {files.length > 0 ? `(${files.length})` : ""}
            </h2>
            <Button
              onClick={() => fetchFiles()}
              variant="secondary"
              size="sm"
              className="ml-2 h-6 px-2 py-0"
              title="Force refresh files list"
              isLoading={loading}
            >
              {!loading && "↻"}
            </Button>
          </div>
          <div className="flex items-center">
            {projectId && (
              <span className="text-xs text-gray-400 mr-2">
                Project ID: {projectId.substring(0, 8)}...
              </span>
            )}
            {files.length > 0 && (
              <Button
                onClick={() => setSuccessMessage(null)}
                variant="primary"
                size="sm"
              >
                Upload New File
              </Button>
            )}
          </div>
        </div>

        {successMessage && (
          <div className="mt-2 p-3 bg-green-900/30 border border-green-800 rounded-md">
            <p className="text-green-400 text-sm flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              {successMessage}
            </p>
          </div>
        )}

        {!successMessage && files.length > 0 && (
          <div className="mt-2 mb-2 p-3 border border-ui-border rounded-md bg-ui-secondary">
            {fileUploadElement}
          </div>
        )}

        {/* {error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-xs">{error}</p>
          </div>
        )} */}
      </div>

      <div className="overflow-y-auto flex-1 p-1">{renderFileList()}</div>

      {/* Schema Column Mapper Modal */}
      {showSchemaMapper && uploadedFileId && (
        <SchemaColumnMapper
          isOpen={showSchemaMapper}
          onClose={() => {
            setShowSchemaMapper(false);
            setUploadStatus("");
          }}
          fileId={uploadedFileId}
          fileColumns={uploadedFileColumns}
          userId={session?.user?.email || session?.user?.id || ""}
          projectId={projectId}
          onMappingComplete={(mapping) => {
            setShowSchemaMapper(false);
            setUploadedFileId(null);
            setUploadedFileColumns([]);

            // Show success message with info about new columns
            const message =
              mapping.newColumnsAdded && mapping.newColumnsAdded > 0
                ? `File successfully uploaded and mapped to schema! ${mapping.newColumnsAdded} new column(s) added to schema.`
                : "File successfully uploaded and mapped to schema!";

            setSuccessMessage(message);

            // Refresh the file list after mapping is complete
            fetchFiles();
          }}
        />
      )}
    </div>
  );
};

export default FilesPane;
