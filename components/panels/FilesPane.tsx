import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import { useRouter } from "next/router";
import { useStableSession } from "../../lib/hooks/useStableSession";
import { FaFile, FaTrash, FaEye, FaUpload } from "react-icons/fa";
import SchemaColumnMapper from "../SchemaColumnMapper";
import { Button, Card } from "../ui";
import { v4 as uuidv4 } from "uuid";

interface FileData {
  id: string;
  filename: string;
  uploadedAt: string;
  ingestedAt: string | null;
  sizeBytes: number;
  format: string | null;
  status: string;
  metadata: {
    ingestion_progress?:
      | string
      | {
          processed: number;
          total: number | null;
          percentage: number | null;
          rowsPerSecond: number;
          elapsedSeconds: number;
          eta: number | null;
          lastUpdated: string;
        };
    columns?: string[];
    [key: string]: unknown;
  } | null;
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
    retryFileIngestion,
    retryingFiles,
    retryErrors,
    onViewFileDetails,
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
    retryFileIngestion: (fileId: string) => void;
    retryingFiles: Record<string, boolean>;
    retryErrors: Record<string, string>;
    onViewFileDetails: (fileId: string) => void;
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

        {/* Display status badge with ingestion progress */}
        <div className="mb-1">
          <span
            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
              file.status
            )} cursor-pointer hover:opacity-80`}
            onClick={(e) => {
              e.stopPropagation();
              onViewFileDetails(file.id);
            }}
            title="Click for details"
          >
            {file.status === "processing" ? (
              <span className="flex items-center">
                {file.status}
                <span className="ml-1 inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
              </span>
            ) : (
              file.status
            )}
          </span>

          {/* Show ingestion progress if available */}
          {file.status === "processing" &&
            file.metadata?.ingestion_progress && (
              <div className="mt-1 text-xs text-gray-400">
                {(() => {
                  try {
                    // Parse the progress data
                    const progress =
                      typeof file.metadata.ingestion_progress === "string"
                        ? JSON.parse(file.metadata.ingestion_progress)
                        : file.metadata.ingestion_progress;

                    if (progress.processed) {
                      return (
                        <div>
                          <div className="flex justify-between mb-1">
                            <span>
                              Processing: {progress.processed.toLocaleString()}{" "}
                              rows
                            </span>
                            {progress.percentage && (
                              <span>{progress.percentage}%</span>
                            )}
                          </div>
                          <div className="w-full bg-ui-tertiary rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress.percentage || 50}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>{progress.rowsPerSecond} rows/sec</span>
                            {progress.eta && (
                              <span>
                                ETA:{" "}
                                {progress.eta > 60
                                  ? `${Math.floor(progress.eta / 60)}m ${
                                      progress.eta % 60
                                    }s`
                                  : `${progress.eta}s`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  } catch (e) {
                    return null;
                  }
                })()}
              </div>
            )}
          {file._count.fileErrors > 0 && (
            <span
              className="text-xs text-red-500 ml-2 cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onViewFileDetails(file.id);
              }}
            >
              {file._count.fileErrors} error(s)
            </span>
          )}

          {/* Add retry button for files in error state */}
          {file.status === "error" && (
            <div className="mt-1">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  retryFileIngestion(file.id);
                }}
                variant="primary"
                size="sm"
                className="text-xs"
                isLoading={retryingFiles[file.id]}
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
  const { data: session, userId, isAuthenticated } = useStableSession();
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
  const [retryingFiles, setRetryingFiles] = useState<Record<string, boolean>>(
    {}
  );
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  const [fileDetailsModalOpen, setFileDetailsModalOpen] =
    useState<boolean>(false);
  const [selectedFileDetails, setSelectedFileDetails] = useState<string | null>(
    null
  );
  const [fileDetailsData, setFileDetailsData] = useState<any>(null);
  const [loadingFileDetails, setLoadingFileDetails] = useState<boolean>(false);
  const [updatingLargeFiles, setUpdatingLargeFiles] = useState<boolean>(false);
  const [uploadingFiles, setUploadingFiles] = useState<
    Record<string, { progress: number; fileName: string }>
  >({});
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
    if (!isAuthenticated) return false;

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
  }, [isAuthenticated, projectId]);

  // Track last fetch time to prevent too frequent fetches
  const lastFetchTimeRef = useRef<number>(0);
  const fetchInProgressRef = useRef<boolean>(false);
  const fetchQueuedRef = useRef<boolean>(false);

  // Fetch files - memoized with useCallback to prevent unnecessary re-renders
  const fetchFiles = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) return;

    // Prevent fetching too frequently (minimum 500ms between fetches)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;

    if (timeSinceLastFetch < 500) {
      // If a fetch is already in progress, queue another one
      if (fetchInProgressRef.current && !fetchQueuedRef.current) {
        fetchQueuedRef.current = true;
        setTimeout(() => {
          fetchQueuedRef.current = false;
          fetchFiles();
        }, 500 - timeSinceLastFetch);
      }
      return;
    }

    // Set fetch in progress
    fetchInProgressRef.current = true;
    lastFetchTimeRef.current = now;

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
      fetchInProgressRef.current = false;

      // If another fetch was queued while this one was in progress, execute it now
      if (fetchQueuedRef.current) {
        fetchQueuedRef.current = false;
        setTimeout(fetchFiles, 100);
      }
    }
  }, [
    isAuthenticated,
    pagination.page,
    pagination.pageSize,
    sorting,
    projectId,
  ]);

  // Track if this is the initial mount
  const initialMountRef = useRef(true);

  // Initial fetch on mount only and set up event listeners for file upload progress
  useEffect(() => {
    fetchFiles();

    // Add event listeners for file upload progress
    const handleFileUploadProgress = (event: CustomEvent) => {
      const { fileId, progress, fileName, completed } = event.detail;

      setUploadingFiles((prev) => ({
        ...prev,
        [fileId]: { progress, fileName },
      }));

      // If the upload is complete, update the progress indicator
      if (completed) {
        setUploadProgress(100);
        setUploadStatus("Processing file...");
      }
    };

    const handleFileUploadComplete = (event: CustomEvent) => {
      const { fileId, file } = event.detail;

      // Don't remove from uploading files yet - we'll keep showing progress
      // until processing is complete

      // Update the uploading files state to show processing status
      setUploadingFiles((prev) => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          progress: 100,
          status: "processing",
        },
      }));

      // Reset upload state
      setUploading(false);
      setUploadProgress(0);

      // Update status to show processing
      setUploadStatus(`File "${file.name}" uploaded, now processing...`);

      // Refresh the file list
      fetchFiles();
    };

    const handleFileUploadError = (event: CustomEvent) => {
      const { fileId, fileName, error } = event.detail;

      // Remove from uploading files
      setUploadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[fileId];
        return newState;
      });

      // Reset upload state
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus("");

      // Show error message
      setError(`Error uploading "${fileName}": ${error}`);
    };

    // Handle file status updates during processing
    const handleFileStatusUpdate = (event: CustomEvent) => {
      const { fileId, fileName, status, error } = event.detail;

      // Update the uploading files state to show processing status
      if (status) {
        setUploadingFiles((prev) => {
          // Only update if the file is still in our tracking state
          if (prev[fileId]) {
            return {
              ...prev,
              [fileId]: {
                ...prev[fileId],
                progress: status === "active" ? 100 : prev[fileId].progress,
                status: status,
              },
            };
          }
          return prev;
        });

        // If file is now active, show success message and remove from uploading files
        if (status === "active") {
          setSuccessMessage(`File "${fileName}" processed successfully!`);

          // Remove from uploading files
          setUploadingFiles((prev) => {
            const newState = { ...prev };
            delete newState[fileId];
            return newState;
          });

          // File is now active, refresh the file list
          fetchFiles();
        }
      }
    };

    // Handle file processing errors
    const handleFileProcessingError = (event: CustomEvent) => {
      const { fileId, fileName, error } = event.detail;

      // Remove from uploading files
      setUploadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[fileId];
        return newState;
      });

      // Show error message
      setError(`Error processing "${fileName}": ${error}`);

      // Refresh the file list to show the error status
      // This is important to show the updated error state
      fetchFiles();
    };

    // Handle file processing timeout
    const handleFileProcessingTimeout = (event: CustomEvent) => {
      const { fileId, fileName, message } = event.detail;

      // Update the uploading files state to show timeout
      setUploadingFiles((prev) => {
        if (prev[fileId]) {
          return {
            ...prev,
            [fileId]: {
              ...prev[fileId],
              status: "timeout",
            },
          };
        }
        return prev;
      });

      // Show warning message
      setSuccessMessage(
        `${message} for "${fileName}". The file may still be processing in the background.`
      );
    };

    // Add event listeners
    window.addEventListener(
      "fileUploadProgress",
      handleFileUploadProgress as EventListener
    );
    window.addEventListener(
      "fileUploadComplete",
      handleFileUploadComplete as EventListener
    );
    window.addEventListener(
      "fileUploadError",
      handleFileUploadError as EventListener
    );
    window.addEventListener(
      "fileStatusUpdate",
      handleFileStatusUpdate as EventListener
    );
    window.addEventListener(
      "fileProcessingError",
      handleFileProcessingError as EventListener
    );
    window.addEventListener(
      "fileProcessingTimeout",
      handleFileProcessingTimeout as EventListener
    );

    // Add visibility change listener to prevent unnecessary fetches on window focus
    const handleVisibilityChange = () => {
      // Do nothing - we'll handle fetches manually
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener(
        "fileUploadProgress",
        handleFileUploadProgress as EventListener
      );
      window.removeEventListener(
        "fileUploadComplete",
        handleFileUploadComplete as EventListener
      );
      window.removeEventListener(
        "fileUploadError",
        handleFileUploadError as EventListener
      );
      window.removeEventListener(
        "fileStatusUpdate",
        handleFileStatusUpdate as EventListener
      );
      window.removeEventListener(
        "fileProcessingError",
        handleFileProcessingError as EventListener
      );
      window.removeEventListener(
        "fileProcessingTimeout",
        handleFileProcessingTimeout as EventListener
      );
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

    if (isAuthenticated) {
      fetchFiles();
    }
  }, [
    pagination.page,
    pagination.pageSize,
    sorting,
    fetchFiles,
    isAuthenticated,
  ]);

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

            while (
              fileStatus !== "active" &&
              fileStatus !== "headers_extracted" &&
              retries < maxRetries
            ) {
              await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

              const fileStatusResponse = await fetch(`/api/files/${fileId}`);
              if (fileStatusResponse.ok) {
                const fileData = await fileStatusResponse.json();
                fileStatus = fileData.status || "working";
                setUploadStatus(`File processing: ${fileStatus}...`);

                // If we have headers_extracted status, we can proceed with column mapping
                if (fileStatus === "headers_extracted") {
                  console.log(
                    "Headers extracted, proceeding with column mapping"
                  );
                  break;
                }
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

              // Also fetch the file metadata directly to check for columns
              const fileResponse = await fetch(`/api/files/${fileId}`);
              if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                console.log("File metadata:", fileData);
                console.log(
                  "File metadata columns:",
                  fileData.metadata?.columns
                );

                // If we have columns in the metadata, use those directly
                if (
                  fileData.metadata?.columns &&
                  Array.isArray(fileData.metadata.columns)
                ) {
                  console.log(
                    "Using columns from file metadata:",
                    fileData.metadata.columns
                  );
                  let extractedColumns: string[] = fileData.metadata.columns;
                  setUploadedFileColumns(extractedColumns);
                  // Skip the rest of the column extraction logic by returning early
                  return;
                }
              }

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

            // New simplified flow: automatically use all columns
            setUploadStatus("Automatically including all columns...");

            // Create a mapping that includes all columns
            const columnsToInclude =
              uploadedFileColumns.length > 0
                ? uploadedFileColumns
                : Array.from({ length: 10 }, (_, i) => `Column ${i + 1}`);

            // Automatically create schema or add columns to existing schema
            try {
              // For first upload, create schema with all columns
              if (!hasSchema) {
                setUploadStatus("Creating schema with all columns...");

                // Create schema with all columns
                const createSchemaResponse = await fetch(
                  "/api/schema-management",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      action: "create_with_columns",
                      name: "Auto-generated Schema",
                      description: "Automatically created from file upload",
                      columns: columnsToInclude.map((col) => ({
                        id: uuidv4(),
                        name: col,
                        type: "text",
                        description: `Auto-generated from column: ${col}`,
                        isRequired: false,
                      })),
                      userId: session?.user?.email || session?.user?.id || "",
                      projectId: projectId,
                    }),
                  }
                );

                if (!createSchemaResponse.ok) {
                  throw new Error("Failed to create schema automatically");
                }

                const schemaData = await createSchemaResponse.json();
                console.log("Auto-created schema:", schemaData);

                // Activate the file
                const activateResponse = await fetch(
                  `/api/activate-file/${fileId}`,
                  {
                    method: "POST",
                  }
                );

                if (!activateResponse.ok) {
                  console.warn("Failed to activate file, but continuing");
                }

                setSuccessMessage(
                  "File uploaded and schema created automatically with all columns!"
                );
                // We need to fetch files here to ensure proper state before column mapping
                fetchFiles();
              } else {
                // For subsequent uploads, check if there are new columns that don't match existing ones
                setUploadStatus("Checking for new columns...");

                // Get current schema
                const schemaResponse = await fetch(
                  `/api/schema-management?projectId=${projectId}`
                );
                if (!schemaResponse.ok) {
                  throw new Error("Failed to fetch current schema");
                }

                const schemaData = await schemaResponse.json();
                const currentSchema =
                  schemaData.schemas.find((s: any) => s.isActive) ||
                  schemaData.schemas[0];

                if (!currentSchema) {
                  throw new Error("No schema found for project");
                }

                // Find new columns that don't exist in the current schema
                const existingColumnNames = currentSchema.columns.map(
                  (c: any) => c.name
                );
                const newColumns = columnsToInclude.filter(
                  (col) => !existingColumnNames.includes(col)
                );

                if (newColumns.length > 0) {
                  console.log(
                    `Found ${newColumns.length} new columns that don't match existing schema:`,
                    newColumns
                  );

                  // Show the column mapper for manual mapping when new columns are found
                  setUploadStatus(
                    "New columns found. Opening column mapper..."
                  );
                  setUploadedFileColumns(columnsToInclude);

                  // Show the schema mapper modal
                  setTimeout(() => {
                    setShowSchemaMapper(true);
                  }, 1000);

                  return;
                } else {
                  // If no new columns, proceed with automatic mapping
                  console.log(
                    "No new columns found. Proceeding with automatic mapping."
                  );

                  // Create automatic mapping for all columns
                  const mappingRecord: Record<string, string> = {};
                  columnsToInclude.forEach((col) => {
                    // Map each column to itself since they all exist in the schema
                    mappingRecord[col] = col;
                  });

                  // Save the mapping with better error handling
                  try {
                    console.log(
                      "Attempting to save column mapping with data:",
                      {
                        fileId,
                        schemaId: currentSchema.id,
                        mappingsCount: Object.keys(mappingRecord).length,
                      }
                    );

                    const mappingResponse = await fetch(
                      "/api/column-mappings",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          fileId,
                          schemaId: currentSchema.id,
                          mappings: mappingRecord,
                          newColumnsAdded: 0,
                        }),
                      }
                    );

                    if (!mappingResponse.ok) {
                      const errorData = await mappingResponse
                        .json()
                        .catch(() => ({}));
                      console.error("Column mapping save failed:", errorData);
                      throw new Error(
                        `Failed to save column mapping: ${
                          errorData.error || mappingResponse.statusText
                        }`
                      );
                    }

                    console.log("Column mapping saved successfully");
                  } catch (mappingError) {
                    console.error("Error saving column mapping:", mappingError);
                    // Continue with file activation even if mapping fails
                    console.warn(
                      "Continuing with file activation despite mapping error"
                    );
                  }

                  // Activate the file
                  const activateResponse = await fetch(
                    `/api/activate-file/${fileId}`,
                    {
                      method: "POST",
                    }
                  );

                  if (!activateResponse.ok) {
                    console.warn("Failed to activate file, but continuing");
                  }

                  setSuccessMessage(
                    "File uploaded and automatically mapped to existing schema!"
                  );
                  // We need to fetch files here to ensure proper state before column mapping
                  fetchFiles();
                }
              }

              setUploading(false);
              setUploadProgress(0);
              setUploadStatus("");
            } catch (err) {
              console.error("Error in automatic schema management:", err);
              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to process file automatically"
              );
              setUploading(false);
              setUploadProgress(0);
              setUploadStatus("");
            }
          } catch (err) {
            console.error("Error during column extraction:", err);

            // Even if column extraction fails, we can still proceed with the upload
            // Use default columns and continue with automatic schema management
            setUploadStatus("Using default columns due to extraction error...");

            // Create default columns
            const defaultColumns = Array.from(
              { length: 10 },
              (_, i) => `Column ${i + 1}`
            );

            setUploadedFileColumns(defaultColumns);

            // Continue with automatic schema management using default columns
            try {
              // For first upload, create schema with default columns
              if (!hasSchema) {
                setUploadStatus("Creating schema with default columns...");

                // Create schema with default columns
                const createSchemaResponse = await fetch(
                  "/api/schema-management",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      action: "create_with_columns",
                      name: "Auto-generated Schema",
                      description:
                        "Automatically created from file upload with default columns",
                      columns: defaultColumns.map((col) => ({
                        id: uuidv4(),
                        name: col,
                        type: "text",
                        description: `Auto-generated default column: ${col}`,
                        isRequired: false,
                      })),
                      userId: userId || "",
                      projectId: projectId,
                    }),
                  }
                );

                if (!createSchemaResponse.ok) {
                  throw new Error("Failed to create schema automatically");
                }

                const schemaData = await createSchemaResponse.json();
                console.log(
                  "Auto-created schema with default columns:",
                  schemaData
                );

                // Activate the file
                const activateResponse = await fetch(
                  `/api/activate-file/${fileId}`,
                  {
                    method: "POST",
                  }
                );

                if (!activateResponse.ok) {
                  console.warn("Failed to activate file, but continuing");
                }

                setSuccessMessage(
                  "File uploaded and schema created automatically with default columns!"
                );
                // We need to fetch files here to ensure proper state before column mapping
                fetchFiles();
              } else {
                // For subsequent uploads, use default columns
                setUploadStatus("Using default columns for mapping...");

                // Get current schema
                const schemaResponse = await fetch(
                  `/api/schema-management?projectId=${projectId}`
                );
                if (!schemaResponse.ok) {
                  throw new Error("Failed to fetch current schema");
                }

                const schemaData = await schemaResponse.json();
                const currentSchema =
                  schemaData.schemas.find((s: any) => s.isActive) ||
                  schemaData.schemas[0];

                if (!currentSchema) {
                  throw new Error("No schema found for project");
                }

                // Create automatic mapping for default columns
                const mappingRecord: Record<string, string> = {};
                defaultColumns.forEach((col) => {
                  mappingRecord[col] = col;
                });

                // Save the mapping
                const mappingResponse = await fetch("/api/column-mappings", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    fileId,
                    schemaId: currentSchema.id,
                    mappings: mappingRecord,
                    newColumnsAdded: 0,
                  }),
                });

                if (!mappingResponse.ok) {
                  throw new Error("Failed to save column mapping");
                }

                // Activate the file
                const activateResponse = await fetch(
                  `/api/activate-file/${fileId}`,
                  {
                    method: "POST",
                  }
                );

                if (!activateResponse.ok) {
                  console.warn("Failed to activate file, but continuing");
                }

                setSuccessMessage(
                  "File uploaded and automatically mapped with default columns!"
                );
                // We need to fetch files here to ensure proper state before column mapping
                fetchFiles();
              }

              setUploading(false);
              setUploadProgress(0);
              setUploadStatus("");
            } catch (innerErr) {
              console.error(
                "Error in automatic schema management with default columns:",
                innerErr
              );
              setError(
                innerErr instanceof Error
                  ? innerErr.message
                  : "Failed to process file automatically"
              );
              setUploading(false);
              setUploadProgress(0);
              setUploadStatus("");
            }
          }
        } catch (columnErr) {
          console.error("Error in outer column extraction block:", columnErr);
          setUploadStatus("Error extracting columns, using defaults");

          // Use default columns and continue with automatic schema management
          const defaultColumns = Array.from(
            { length: 10 },
            (_, i) => `Column ${i + 1}`
          );
          setUploadedFileColumns(defaultColumns);

          // Continue with automatic schema management using default columns
          try {
            // For first upload, create schema with default columns
            if (!hasSchema) {
              setUploadStatus("Creating schema with default columns...");

              // Create schema with default columns
              const createSchemaResponse = await fetch(
                "/api/schema-management",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    action: "create_with_columns",
                    name: "Auto-generated Schema",
                    description:
                      "Automatically created from file upload with default columns",
                    columns: defaultColumns.map((col) => ({
                      id: uuidv4(),
                      name: col,
                      type: "text",
                      description: `Auto-generated default column: ${col}`,
                      isRequired: false,
                    })),
                    userId: userId || "",
                    projectId: projectId,
                  }),
                }
              );

              if (!createSchemaResponse.ok) {
                throw new Error("Failed to create schema automatically");
              }

              const schemaData = await createSchemaResponse.json();
              console.log(
                "Auto-created schema with default columns:",
                schemaData
              );

              // Activate the file
              const activateResponse = await fetch(
                `/api/activate-file/${fileId}`,
                {
                  method: "POST",
                }
              );

              if (!activateResponse.ok) {
                console.warn("Failed to activate file, but continuing");
              }

              setSuccessMessage(
                "File uploaded and schema created automatically with default columns!"
              );
              // We need to fetch files here to ensure proper state before column mapping
              fetchFiles();
            } else {
              // For subsequent uploads, check if there are new columns that don't match existing ones
              setUploadStatus("Checking for new columns...");

              // Get current schema
              const schemaResponse = await fetch(
                `/api/schema-management?projectId=${projectId}`
              );
              if (!schemaResponse.ok) {
                throw new Error("Failed to fetch current schema");
              }

              const schemaData = await schemaResponse.json();
              const currentSchema =
                schemaData.schemas.find((s: any) => s.isActive) ||
                schemaData.schemas[0];

              if (!currentSchema) {
                throw new Error("No schema found for project");
              }

              // Find new columns that don't exist in the current schema
              const existingColumnNames = currentSchema.columns.map(
                (c: any) => c.name
              );
              const newColumns = defaultColumns.filter(
                (col) => !existingColumnNames.includes(col)
              );

              if (newColumns.length > 0) {
                console.log(
                  `Found ${newColumns.length} new default columns that don't match existing schema:`,
                  newColumns
                );

                // Show the column mapper for manual mapping when new columns are found
                setUploadStatus("New columns found. Opening column mapper...");
                setUploadedFileColumns(defaultColumns);

                // Show the schema mapper modal
                setTimeout(() => {
                  setShowSchemaMapper(true);
                }, 1000);

                return;
              } else {
                // If no new columns, proceed with automatic mapping
                console.log(
                  "No new columns found. Proceeding with automatic mapping."
                );

                // Create automatic mapping for default columns
                const mappingRecord: Record<string, string> = {};
                defaultColumns.forEach((col) => {
                  // Map each column to itself since they all exist in the schema
                  mappingRecord[col] = col;
                });

                // Save the mapping with better error handling
                try {
                  console.log("Attempting to save column mapping with data:", {
                    fileId,
                    schemaId: currentSchema.id,
                    mappingsCount: Object.keys(mappingRecord).length,
                  });

                  const mappingResponse = await fetch("/api/column-mappings", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      fileId,
                      schemaId: currentSchema.id,
                      mappings: mappingRecord,
                      newColumnsAdded: 0,
                    }),
                  });

                  if (!mappingResponse.ok) {
                    const errorData = await mappingResponse
                      .json()
                      .catch(() => ({}));
                    console.error("Column mapping save failed:", errorData);
                    throw new Error(
                      `Failed to save column mapping: ${
                        errorData.error || mappingResponse.statusText
                      }`
                    );
                  }

                  console.log("Column mapping saved successfully");
                } catch (mappingError) {
                  console.error("Error saving column mapping:", mappingError);
                  // Continue with file activation even if mapping fails
                  console.warn(
                    "Continuing with file activation despite mapping error"
                  );
                }

                // Activate the file
                const activateResponse = await fetch(
                  `/api/activate-file/${fileId}`,
                  {
                    method: "POST",
                  }
                );

                if (!activateResponse.ok) {
                  console.warn("Failed to activate file, but continuing");
                }

                setSuccessMessage(
                  "File uploaded and automatically mapped with default columns!"
                );
                // We need to fetch files here to ensure proper state before column mapping
                fetchFiles();
              }
            }

            setUploading(false);
            setUploadProgress(0);
            setUploadStatus("");
          } catch (innerErr) {
            console.error(
              "Error in automatic schema management with default columns:",
              innerErr
            );
            setError(
              innerErr instanceof Error
                ? innerErr.message
                : "Failed to process file automatically"
            );
            setUploading(false);
            setUploadProgress(0);
            setUploadStatus("");
          }
        }
      } else {
        throw new Error("No files were uploaded successfully");
      }

      // Refresh the file list to ensure proper state
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

      // If the deleted file is the currently selected file, reset the selection
      if (selectedFileId === fileId) {
        // Call onSelectFile with null or empty string to reset the datatable
        onSelectFile("");
      }

      // Refresh the file list after deletion
      // This is necessary to update the UI after a file is deleted
      fetchFiles();
      setDeleteConfirmation(null);

      // Show success message
      setSuccessMessage("File successfully deleted");
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

  // View file details
  const onViewFileDetails = async (fileId: string) => {
    try {
      setSelectedFileDetails(fileId);
      setLoadingFileDetails(true);
      setFileDetailsModalOpen(true);

      // Fetch file details including errors
      const response = await fetch(`/api/files/${fileId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch file details: ${response.statusText}`);
      }

      const data = await response.json();
      // Extract the file data from the response (it's nested under 'file')
      const fileData = data.file;

      if (!fileData) {
        throw new Error("File data not found in response");
      }

      console.log("File data:", fileData);

      // Fetch file errors if any
      const errorsResponse = await fetch(`/api/files/${fileId}/errors`);
      let errorsData = [];

      if (errorsResponse.ok) {
        const errorsResult = await errorsResponse.json();
        errorsData = errorsResult.errors || [];
      }

      setFileDetailsData({
        ...fileData,
        errors: errorsData,
      });
    } catch (error) {
      console.error("Error fetching file details:", error);
      setFileDetailsData({
        error:
          error instanceof Error
            ? error.message
            : "Failed to load file details",
      });
    } finally {
      setLoadingFileDetails(false);
    }
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
      setSuccessMessage(null);

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

      const data = await response.json();
      setSuccessMessage(data.message || "File ingestion retried successfully!");

      // Refresh the file list after successful retry
      // This is necessary to show the updated file status
      fetchFiles();
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

  // Update large files status
  const updateLargeFilesStatus = async () => {
    try {
      setUpdatingLargeFiles(true);
      setSuccessMessage(null);
      setError(null);

      const response = await fetch("/api/update-large-files-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            errorData.details ||
            "Failed to update large files status"
        );
      }

      const data = await response.json();
      setSuccessMessage(
        data.message || "Large files status updated successfully!"
      );

      // Refresh the file list after successful update
      // This is necessary to show the updated file statuses
      fetchFiles();
    } catch (error) {
      console.error("Error updating large files status:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setUpdatingLargeFiles(false);
    }
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
      case "headers_extracted":
        return "bg-purple-100 text-purple-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "timeout":
        return "bg-orange-100 text-orange-800";
      case "too_large":
        return "bg-orange-100 text-orange-800";
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
              retryFileIngestion={retryFileIngestion}
              retryingFiles={retryingFiles}
              retryErrors={retryErrors}
              onViewFileDetails={onViewFileDetails}
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

            {/* Add button to update large files status */}
            {files.some(
              (file) =>
                file.status === "error" && file.sizeBytes > 100 * 1024 * 1024
            ) && (
              <Button
                onClick={updateLargeFilesStatus}
                variant="secondary"
                size="sm"
                className="ml-2 text-xs"
                title="Update large files status"
                isLoading={updatingLargeFiles}
              >
                Fix Large Files
              </Button>
            )}
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

        {/* Display uploading files with progress */}
        {Object.keys(uploadingFiles).length > 0 && (
          <div className="mt-2 p-3 bg-blue-900/30 border border-blue-800 rounded-md">
            <h4 className="text-blue-400 text-sm font-medium mb-2">
              Files Uploading
            </h4>
            {Object.entries(uploadingFiles).map(
              ([fileId, { fileName, progress }]) => (
                <div key={fileId} className="mb-2 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-300 truncate max-w-xs">
                      {fileName}
                    </span>
                    <span className="text-xs text-blue-300">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-ui-tertiary rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {!successMessage && files.length > 0 && (
          <div className="mt-2 mb-2 p-3 border border-ui-border rounded-md bg-ui-secondary">
            {fileUploadElement}
          </div>
        )}

        {error && (
          <div className="mt-2 p-3 bg-red-900/30 border border-red-800 rounded-md">
            <p className="text-red-400 text-sm flex items-center">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {error}
            </p>
          </div>
        )}
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
          userId={userId || ""}
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
            // This is necessary to show the updated file with mapping
            fetchFiles();
          }}
        />
      )}

      {/* File Details Modal */}
      {fileDetailsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-ui-primary border border-ui-border rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-300">
                File Details
              </h3>
              <Button
                onClick={() => setFileDetailsModalOpen(false)}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-300"
              >
                ✕
              </Button>
            </div>

            {loadingFileDetails ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
              </div>
            ) : fileDetailsData?.error ? (
              <div className="p-4 bg-red-900/30 border border-red-800 rounded-md">
                <p className="text-red-400">{fileDetailsData.error}</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Filename</p>
                    <p className="text-sm text-gray-300">
                      {fileDetailsData?.filename || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Status</p>
                    <p className="text-sm text-gray-300">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                          fileDetailsData?.status || "unknown"
                        )}`}
                      >
                        {fileDetailsData?.status || "Unknown"}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Size</p>
                    <p className="text-sm text-gray-300">
                      {fileDetailsData?.sizeBytes
                        ? formatFileSize(fileDetailsData.sizeBytes)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Format</p>
                    <p className="text-sm text-gray-300">
                      {fileDetailsData?.format?.toUpperCase() || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Uploaded At</p>
                    <p className="text-sm text-gray-300">
                      {fileDetailsData?.uploadedAt
                        ? new Date(fileDetailsData.uploadedAt).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Ingested At</p>
                    <p className="text-sm text-gray-300">
                      {fileDetailsData?.ingestedAt
                        ? new Date(fileDetailsData.ingestedAt).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Display errors if any */}
                {fileDetailsData?.status === "error" && (
                  <div className="mt-4">
                    <h4 className="text-md font-medium text-gray-300 mb-2">
                      Error Details
                    </h4>
                    {fileDetailsData.activationError && (
                      <div className="p-3 bg-red-900/30 border border-red-800 rounded-md mb-3">
                        <p className="text-sm text-red-400">
                          {fileDetailsData.activationError}
                        </p>
                      </div>
                    )}

                    {fileDetailsData.errors &&
                    fileDetailsData.errors.length > 0 ? (
                      <div className="border border-ui-border rounded-md overflow-hidden">
                        <table className="min-w-full divide-y divide-ui-border">
                          <thead className="bg-ui-secondary">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                                Type
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                                Severity
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                                Message
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                                Timestamp
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ui-border">
                            {fileDetailsData.errors.map(
                              (error: any, index: number) => (
                                <tr
                                  key={index}
                                  className={
                                    index % 2 === 0
                                      ? "bg-ui-primary"
                                      : "bg-ui-secondary"
                                  }
                                >
                                  <td className="px-3 py-2 text-xs text-gray-300">
                                    {error.errorType || error.type}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-300">
                                    {error.severity}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-300">
                                    {error.message}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-300">
                                    {error.timestamp
                                      ? new Date(
                                          error.timestamp
                                        ).toLocaleString()
                                      : "N/A"}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-400 mb-3">
                          No detailed error records found.
                        </p>

                        {/* Display message for large files */}
                        {fileDetailsData.status === "too_large" ? (
                          <div className="p-3 bg-orange-900/30 border border-orange-800 rounded-md">
                            <p className="text-sm text-orange-400 font-medium mb-1">
                              Large File Detected
                            </p>
                            <p className="text-sm text-orange-400">
                              This file is{" "}
                              {formatFileSize(fileDetailsData.sizeBytes)} which
                              is too large for the default batch size. Click the
                              "Retry Ingestion" button below to process it with
                              optimized settings for large files.
                            </p>
                          </div>
                        ) : (
                          fileDetailsData.sizeBytes &&
                          fileDetailsData.sizeBytes > 50 * 1024 * 1024 && (
                            <div className="p-3 bg-yellow-900/30 border border-yellow-800 rounded-md">
                              <p className="text-sm text-yellow-400 font-medium mb-1">
                                Large File Detected
                              </p>
                              <p className="text-sm text-yellow-400">
                                This file is{" "}
                                {formatFileSize(fileDetailsData.sizeBytes)}{" "}
                                which may be too large for the default batch
                                size. Click the "Retry Ingestion" button below
                                to process it with optimized settings for large
                                files.
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Display retry button for error or too_large files */}
                {(fileDetailsData?.status === "error" ||
                  fileDetailsData?.status === "too_large") && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => {
                        setFileDetailsModalOpen(false);
                        retryFileIngestion(selectedFileDetails!);
                      }}
                      variant="primary"
                      size="sm"
                      isLoading={retryingFiles[selectedFileDetails!]}
                    >
                      Retry Ingestion
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilesPane;
