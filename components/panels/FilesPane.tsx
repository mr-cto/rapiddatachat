import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { FaFile, FaTrash, FaEye } from "react-icons/fa";
import SchemaColumnMapper from "../SchemaColumnMapper";

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

  // Maximum file size: 50MB in bytes
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
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

  // Check if there's an active schema
  const checkActiveSchema = async () => {
    if (!session?.user) return false;

    try {
      // First check if there are any files - if no files, then no schema
      if (files.length === 0) {
        setHasActiveSchema(false);
        return false;
      }

      // Use project-specific endpoint if projectId is provided
      const endpoint = projectId
        ? `/api/schema-management?projectId=${projectId}`
        : `/api/schema-management`;

      try {
        const response = await fetch(endpoint);

        // If the endpoint returns a 404, it means there's no schema yet
        if (response.status === 404) {
          setHasActiveSchema(false);
          return false;
        }

        if (!response.ok) {
          console.warn("Schema check returned non-OK status:", response.status);
          // Don't throw an error, just assume no schema to allow the flow to continue
          setHasActiveSchema(false);
          return false;
        }

        const data = await response.json();

        // If we have any schemas at all, consider that we have an active schema
        const hasSchema = data.schemas && data.schemas.length > 0;

        console.log("Schema check result:", {
          hasSchema,
          schemas: data.schemas,
        });

        setHasActiveSchema(hasSchema);
        return hasSchema;
      } catch (schemaErr) {
        console.warn(
          "Error fetching schema, falling back to file count check:",
          schemaErr
        );

        // If schema check fails, fall back to checking if there are files
        // If there are files, assume there's a schema (since files require schemas)
        const hasSchema = files.length > 0;
        setHasActiveSchema(hasSchema);
        return hasSchema;
      }
    } catch (err) {
      console.error("Error checking active schema:", err);
      // Don't let schema check errors block the upload flow
      setHasActiveSchema(false);
      return false;
    }
  };

  // Fetch files
  const fetchFiles = async () => {
    console.log("Fetching files", session?.user);
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

      console.log(`Fetching files from endpoint: ${endpoint}`);

      const response = await fetch(endpoint);
      console.log("Response status:", response.status);
      console.log("Response status text:", response.statusText);

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Files API response:", data);
      console.log("Files count:", data.files ? data.files.length : 0);
      console.log(
        "Full API response structure:",
        JSON.stringify(data, null, 2)
      );

      if (data.files && data.files.length > 0) {
        console.log("First file:", data.files[0]);
      } else {
        console.log("No files returned from API");
        // Check if there's any data in a different format
        if (data && typeof data === "object") {
          console.log("Available keys in response:", Object.keys(data));
        }
      }

      // Ensure we have a valid files array
      if (data.files && Array.isArray(data.files)) {
        setFiles(data.files);

        // Check if this is the first upload for the project
        const filesEmpty = data.files.length === 0;
        setIsFirstUpload(filesEmpty);

        // If there are files, assume there's a schema
        setHasActiveSchema(!filesEmpty);

        console.log(`Set ${data.files.length} files in state`);
      } else {
        console.warn("No valid files array in API response:", data);
        setFiles([]);
        setIsFirstUpload(true);
        setHasActiveSchema(false);
      }

      // Always check if there's an active schema, but don't await it
      // This prevents blocking the UI if the schema check fails
      checkActiveSchema().catch((err) => {
        console.warn(
          "Schema check failed, assuming schema based on file count:",
          err
        );
        // If schema check fails, fall back to file count
        setHasActiveSchema(files.length > 0);
      });

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
  };

  // Fetch files on component mount and when pagination/sorting changes
  useEffect(() => {
    fetchFiles();
  }, [session, pagination.page, pagination.pageSize, sorting, projectId]);

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
                fileStatus = fileData.status;
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
            console.log(
              "Deciding whether to show schema mapper or create schema:",
              {
                hasSchema,
                isFirstUpload,
                filesLength: files.length,
              }
            );

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

  // Render file upload UI
  const renderFileUpload = () => {
    return (
      <div className="w-full">
        <div
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors duration-200 ${
            dragActive
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-300 bg-white"
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
                <span className="text-sm font-medium text-indigo-600">
                  {uploadStatus || "Uploading..."}
                </span>
                <span className="text-sm font-medium text-indigo-600">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <>
              <svg
                className="w-12 h-12 text-indigo-500 mb-2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 16v-4a4 4 0 018 0v4m-4 4v-4m0 0V4m0 12a4 4 0 01-4-4V4a4 4 0 018 0v8a4 4 0 01-4 4z"
                />
              </svg>
              <p className="text-gray-700 mb-2">
                Drag and drop CSV or XLSX files here, or{" "}
                <span className="text-indigo-600 underline">browse</span>
              </p>
              <p className="text-xs text-gray-500">
                {isFirstUpload || !hasActiveSchema
                  ? "Upload your first CSV or XLSX file to create a schema for your project."
                  : "Upload CSV or XLSX files to add data to your project. Files will be automatically processed and mapped to your schema."}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Maximum file size: {Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB
              </p>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render file list UI
  const renderFileList = () => {
    // Show loading state
    if (loading) {
      return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-4 grid grid-cols-1 gap-4 animate-pulse">
            {[1, 2, 3].map((item) => (
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
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Show empty state with integrated upload
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
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No files available
            </h3>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Upload a file to see its columns and data structure.
            </p>
            <div className="mt-6 max-w-md mx-auto">{renderFileUpload()}</div>
          </div>
        </div>
      );
    }

    // Show file list
    return (
      <div className="bg-white overflow-hidden">
        <div className="p-1 grid grid-cols-1 gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="border rounded-lg p-2 hover:shadow-md transition-shadow"
              onClick={() => onSelectFile(file.id)}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-sm font-medium text-gray-900 break-words pr-2">
                  {file.filename}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      viewSynopsis(file.id);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                    title="View Synopsis"
                  >
                    <FaEye />
                  </button>
                  {deleteConfirmation === file.id ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        className="text-red-600 hover:text-red-900"
                        title="Confirm Delete"
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelDelete();
                        }}
                        className="text-gray-600 hover:text-gray-900"
                        title="Cancel Delete"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(file.id);
                      }}
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
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Debug information
  console.log("FilesPane render state:", {
    filesCount: files.length,
    loading,
    error,
    projectId,
    selectedFileId,
    hasActiveSchema,
  });

  return (
    <div className="h-[50vh] flex flex-col">
      <div className="p-2 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-md font-semibold flex items-center text-black dark:text-black">
              <FaFile className="mr-1" /> Files{" "}
              {files.length > 0 ? `(${files.length})` : ""}
            </h2>
            <button
              onClick={() => fetchFiles()}
              className="ml-2 text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              title="Force refresh files list"
            >
              ↻
            </button>
          </div>
          <div className="flex items-center">
            {projectId && (
              <span className="text-xs text-gray-500 mr-2">
                Project ID: {projectId.substring(0, 8)}...
              </span>
            )}
            {files.length > 0 && (
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Upload New File
              </button>
            )}
          </div>
        </div>

        {successMessage && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-700 text-sm flex items-center">
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
          <div className="mt-2 mb-2 p-3 border rounded-md bg-gray-50">
            {renderFileUpload()}
          </div>
        )}

        {error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-xs">{error}</p>
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
