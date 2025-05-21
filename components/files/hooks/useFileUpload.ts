import { useState, useRef, useCallback, useEffect } from "react";
import { fileEventBus } from "../../../lib/events/FileEventBus";
import { parseFileClient } from "../../../utils/clientParse";
import { validateFiles, MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "../utils";

interface UseFileUploadProps {
  projectId?: string;
  isAuthenticated: boolean;
  userId?: string | undefined;
  fetchFiles: () => Promise<void>;
  onPreviewParsed?: (preview: Record<string, unknown>[]) => void;
  hasActiveSchema: boolean;
  isFirstUpload: boolean;
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;
}

export const useFileUpload = ({
  projectId,
  isAuthenticated,
  userId,
  fetchFiles,
  onPreviewParsed,
  hasActiveSchema,
  isFirstUpload,
  setError,
  setSuccessMessage,
}: UseFileUploadProps) => {
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [showSchemaMapper, setShowSchemaMapper] = useState<boolean>(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileColumns, setUploadedFileColumns] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<
    Record<string, { progress: number; fileName: string }>
  >({});
  const [fileColumns, setFileColumns] = useState<Record<string, string[]>>({});
  const [schemaCreated, setSchemaCreated] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

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

  // Handle file selection
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const { valid, errors } = validateFiles(
      files,
      MAX_FILE_SIZE,
      ALLOWED_FILE_TYPES
    );

    if (errors.length > 0) {
      setError(errors.join(". "));
      return;
    }

    if (valid.length > 0) {
      try {
        // Parse the file to get preview data
        const preview = await parseFileClient(valid[0]);

        // Pass preview data to parent component if callback exists
        if (onPreviewParsed) {
          onPreviewParsed(preview);
        }

        // Pass the preview data to handleFilesUpload
        handleFilesUpload(valid, undefined, {
          previewData: preview,
          showPreview: true,
        });
      } catch (err) {
        console.warn("Preview parsing failed", err);
        // Continue with upload even if preview fails
        handleFilesUpload(valid);
      }
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
  const handleFilesUpload = async (
    uploadedFiles: File[],
    projectIdParam?: string,
    options?: {
      hasNewColumns?: boolean;
      showPreview?: boolean;
      previewData?: Record<string, unknown>[];
    }
  ) => {
    if (uploadedFiles.length === 0) return;

    // Generate a client-side ID for tracking before server response
    const clientFileId = crypto.randomUUID();

    // Publish upload started event
    fileEventBus.publish({
      type: "file:upload:started",
      fileName: uploadedFiles[0].name,
      projectId,
      data: {
        clientFileId,
        size: uploadedFiles[0].size,
        type: uploadedFiles[0].type,
      },
    });

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadStatus("Uploading file...");
    setSuccessMessage(null);

    // Use the options to determine the flow
    const hasNewColumns = options?.hasNewColumns || false;
    const showPreview = options?.showPreview || false;

    // If we have preview data from papaparse, pass it to the parent component
    if (options?.previewData && onPreviewParsed) {
      onPreviewParsed(options.previewData);
    }

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
          const newProgress = Math.min(prev + increment, 95);

          // Publish progress event
          fileEventBus.publish({
            type: "file:upload:progress",
            fileName: uploadedFiles[0].name,
            projectId,
            data: {
              clientFileId,
              progress: newProgress,
            },
          });

          return newProgress;
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
                // The file data is nested in a 'file' property
                fileStatus = fileData.file?.status || "working";
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

                  // Process the file with the extracted columns
                  await processFileWithColumns(
                    fileId,
                    extractedColumns,
                    hasSchema,
                    hasNewColumns
                  );
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

              // Generate a client-side ID for tracking
              const clientFileId = crypto.randomUUID();

              // Publish upload completed event
              fileEventBus.publish({
                type: "file:upload:completed",
                fileId,
                fileName: uploadedFiles[0].name,
                projectId,
                data: {
                  clientFileId,
                  columns: extractedColumns,
                },
              });

              // Force schema check again to be sure
              const schemaExists = await checkActiveSchema();
              console.log(`Before processing: Schema exists: ${schemaExists}`);

              // Process the file with the extracted columns
              await processFileWithColumns(
                fileId,
                extractedColumns,
                schemaExists,
                hasNewColumns
              );
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

                // Process the file with empty columns
                // Force schema check again to be sure
                const schemaExists = await checkActiveSchema();
                console.log(
                  `Before processing empty columns: Schema exists: ${schemaExists}`
                );

                await processFileWithColumns(
                  fileId,
                  [],
                  schemaExists,
                  hasNewColumns
                );
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

                // Process the file with the extracted columns
                await processFileWithColumns(
                  fileId,
                  extractedColumns,
                  hasSchema,
                  hasNewColumns
                );
              }
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

            // Process the file with default columns
            await processFileWithColumns(
              fileId,
              defaultColumns,
              hasSchema,
              hasNewColumns
            );
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

          // Process the file with default columns
          // Force schema check again to be sure
          const schemaExists = await checkActiveSchema();
          console.log(
            `Before processing default columns: Schema exists: ${schemaExists}`
          );

          await processFileWithColumns(
            fileId,
            defaultColumns,
            schemaExists,
            hasNewColumns
          );
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

  // Helper function to process file with columns
  const processFileWithColumns = async (
    fileId: string,
    columns: string[],
    hasSchema: boolean,
    hasNewColumns: boolean
  ) => {
    try {
      // New simplified flow: automatically use all columns
      setUploadStatus("Automatically including all columns...");

      // Create a mapping that includes all columns
      const columnsToInclude =
        columns.length > 0
          ? columns
          : Array.from({ length: 10 }, (_, i) => `Column ${i + 1}`);

      // Automatically create schema or add columns to existing schema
      try {
        // For first upload, create schema with all columns
        if (!hasSchema) {
          console.log(
            "processFileWithColumns: No schema exists, creating new schema"
          );
          setUploadStatus("Creating schema with all columns...");

          // Get the actual column names from the file metadata
          let actualColumns = columnsToInclude;

          try {
            // Try to get the actual column names from the file metadata
            const fileResponse = await fetch(`/api/files/${fileId}`);
            if (fileResponse.ok) {
              const fileData = await fileResponse.json();
              console.log("File metadata for schema creation:", fileData);

              // Check if we have columns in the metadata
              if (
                fileData.file?.metadata?.columns &&
                Array.isArray(fileData.file.metadata.columns) &&
                fileData.file.metadata.columns.length > 0
              ) {
                actualColumns = fileData.file.metadata.columns;
                console.log(
                  "Using actual columns from file metadata:",
                  actualColumns
                );
              }
            }
          } catch (err) {
            console.warn(
              "Error fetching file metadata for schema creation:",
              err
            );
            // Continue with columnsToInclude if we can't get the actual columns
          }

          // Create schema with actual columns from file metadata
          console.log(
            "processFileWithColumns: Creating schema with columns:",
            actualColumns
          );
          console.log("processFileWithColumns: userId:", userId);
          console.log("processFileWithColumns: projectId:", projectId);

          const schemaPayload = {
            action: "create_with_columns",
            name: "Auto-generated Schema",
            description: "Automatically created from file upload",
            columns: actualColumns.map((col) => ({
              id: crypto.randomUUID(),
              name: col,
              type: "text",
              description: `Auto-generated from column: ${col}`,
              isRequired: false,
            })),
            userId: userId || "",
            projectId: projectId,
          };

          console.log("processFileWithColumns: Schema payload:", schemaPayload);

          const createSchemaResponse = await fetch("/api/schema-management", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(schemaPayload),
          });

          console.log(
            `processFileWithColumns: Schema creation response status: ${createSchemaResponse.status}`
          );

          if (!createSchemaResponse.ok) {
            const errorText = await createSchemaResponse
              .text()
              .catch(() => "Could not read error response");
            console.error(
              "processFileWithColumns: Schema creation failed:",
              errorText
            );
            throw new Error(
              `Failed to create schema automatically: ${errorText}`
            );
          }

          const schemaData = await createSchemaResponse.json();
          console.log("Auto-created schema:", schemaData);
          setSchemaCreated(true);

          // Publish schema created event
          fileEventBus.publish({
            type: "file:schema:created",
            fileId,
            projectId,
            data: {
              schemaId: schemaData.schema?.id,
              columns: actualColumns,
            },
          });

          // Activate the file after creating the schema
          try {
            // Get the schema ID from the response
            const schemaId = schemaData.schema?.id;

            if (schemaId) {
              // Create automatic mapping for all columns
              const mappingRecord: Record<string, string> = {};
              actualColumns.forEach((col) => {
                // Map each column to itself
                mappingRecord[col] = col;
              });

              // Save the column mapping
              const mappingResponse = await fetch("/api/column-mappings", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  fileId,
                  schemaId: schemaId,
                  mappings: mappingRecord,
                  newColumnsAdded: 0,
                }),
              });

              if (!mappingResponse.ok) {
                console.warn(
                  "Failed to save column mapping for first upload, but continuing"
                );
              } else {
                console.log(
                  "Column mapping saved successfully for first upload"
                );
              }

              // Publish activation started event
              fileEventBus.publish({
                type: "file:activation:started",
                fileId,
                projectId,
              });

              // Activate the file
              const activateResponse = await fetch(
                `/api/activate-file/${fileId}`,
                {
                  method: "POST",
                }
              );

              if (!activateResponse.ok) {
                console.warn(
                  "Failed to activate file after schema creation, but continuing"
                );

                // Publish error event
                fileEventBus.publish({
                  type: "file:error",
                  fileId,
                  projectId,
                  error: new Error(
                    "Failed to activate file after schema creation"
                  ),
                  data: { stage: "activation" },
                });
              } else {
                console.log(
                  "File activated successfully after schema creation"
                );

                // Publish activation completed event
                fileEventBus.publish({
                  type: "file:activation:completed",
                  fileId,
                  projectId,
                  data: { status: "active" },
                });
              }
            }
          } catch (activationError) {
            console.warn(
              "Error during file activation after schema creation:",
              activationError
            );

            // Publish error event
            fileEventBus.publish({
              type: "file:error",
              fileId,
              projectId,
              error:
                activationError instanceof Error
                  ? activationError
                  : new Error("Error during file activation"),
              data: { stage: "activation" },
            });

            // Continue even if activation fails
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
            const error = new Error("Failed to fetch current schema");

            // Publish error event
            fileEventBus.publish({
              type: "file:error",
              fileId,
              projectId,
              error,
              data: { stage: "schema-fetch" },
            });

            throw error;
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

          if (newColumns.length > 0 || hasNewColumns) {
            console.log(
              `Found ${newColumns.length} new columns that don't match existing schema:`,
              newColumns
            );

            // Show the column mapper for manual mapping when new columns are found
            setUploadStatus("New columns found. Opening column mapper...");
            setUploadedFileColumns(columnsToInclude);

            // Show the schema mapper modal
            setTimeout(() => {
              setShowSchemaMapper(true);
            }, 100);

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

        // Publish error event
        fileEventBus.publish({
          type: "file:error",
          fileId,
          projectId,
          error:
            err instanceof Error
              ? err
              : new Error("Failed to process file automatically"),
          data: { stage: "schema-management" },
        });

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
      console.error("Error processing file with columns:", err);

      // Publish error event
      fileEventBus.publish({
        type: "file:error",
        fileId,
        projectId,
        error:
          err instanceof Error
            ? err
            : new Error("Failed to process file with columns"),
        data: { stage: "processing" },
      });

      setError(
        err instanceof Error
          ? err.message
          : "Failed to process file with columns"
      );
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
    }
  };

  return {
    uploading,
    uploadProgress,
    uploadStatus,
    showSchemaMapper,
    uploadedFileId,
    uploadedFileColumns,
    dragActive,
    uploadingFiles,
    fileColumns,
    schemaCreated,
    inputRef,
    handleDrag,
    handleDrop,
    handleChange,
    handleFilesUpload,
    setShowSchemaMapper,
    setUploadedFileId,
    setUploadedFileColumns,
    setUploadingFiles,
    setFileColumns,
    setSchemaCreated,
    MAX_FILE_SIZE,
  };
};
