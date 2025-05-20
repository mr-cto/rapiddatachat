import React, { useRef, useState, useEffect } from "react";
import { Button } from "./ui";
import Papa from "papaparse";
import { ImprovedSchemaColumnMapper } from "./ImprovedSchemaColumnMapper";

// Maximum file size: 500MB in bytes
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Chunk size: 5MB in bytes
const CHUNK_SIZE = 5 * 1024 * 1024;

interface EnhancedFileUploadProps {
  onFilesSelected: (
    files: File[],
    projectId?: string,
    options?: {
      hasNewColumns?: boolean;
      showPreview?: boolean;
      previewData?: Record<string, unknown>[];
      fileId?: string; // Added to pass file ID after column mapping
    }
  ) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  uploading?: boolean;
  progress?: number;
  projectId?: string;
  useChunkedUpload?: boolean;
  existingColumns?: string[]; // To check for new columns
}

interface FileError {
  name: string;
  error: string;
}

const EnhancedFileUpload: React.FC<EnhancedFileUploadProps> = ({
  onFilesSelected,
  accept = ".csv,.xlsx",
  multiple = false,
  maxSize = MAX_FILE_SIZE,
  uploading = false,
  progress = 0,
  projectId,
  useChunkedUpload = false,
  existingColumns = [],
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FileError[]>([]);
  const [processingFile, setProcessingFile] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [internalUploading, setInternalUploading] = useState(uploading);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [fileColumnsToMap, setFileColumnsToMap] = useState<string[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string>("");
  const [processedFileIds, setProcessedFileIds] = useState<Set<string>>(
    new Set()
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Update internal uploading state when prop changes
  useEffect(() => {
    setInternalUploading(uploading);
  }, [uploading]);

  // Handle upload completion when progress reaches 100%
  useEffect(() => {
    if (uploading && progress >= 100) {
      // Mark upload as complete
      setUploadComplete(true);

      // After a delay, reset the uploading state to allow new uploads
      const timer = setTimeout(() => {
        setUploadComplete(false);
        setInternalUploading(false);
      }, 2000); // 2 second delay

      return () => clearTimeout(timer);
    }
  }, [uploading, progress]);

  const validateFiles = (
    files: FileList
  ): { valid: File[]; errors: FileError[] } => {
    const validFiles: File[] = [];
    const fileErrors: FileError[] = [];

    Array.from(files).forEach((file) => {
      // Check file size if not using chunked upload
      if (!useChunkedUpload && file.size > maxSize) {
        fileErrors.push({
          name: file.name,
          error: `File size exceeds the limit of ${Math.round(
            maxSize / (1024 * 1024)
          )}MB`,
        });
        return;
      }

      // Check file type - handle XLSX files with potentially incorrect MIME types
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      const isAllowedType =
        ALLOWED_FILE_TYPES.includes(file.type) ||
        fileExtension === "csv" ||
        fileExtension === "xlsx" ||
        fileExtension === "xls";

      if (!isAllowedType) {
        fileErrors.push({
          name: file.name,
          error:
            "File type not supported. Please upload CSV or XLSX files only.",
        });
        return;
      }

      validFiles.push(file);
    });

    return { valid: validFiles, errors: fileErrors };
  };

  // Add file hash calculation to prevent duplicate uploads
  const calculateFileHash = async (file: File): Promise<string> => {
    // Use file name, size and last modified date as a simple hash
    // For a more robust solution, you could use a proper hashing algorithm
    return `${file.name}-${file.size}-${file.lastModified}`;
  };

  const handleFiles = async (files: FileList | null) => {
    if (files && files.length > 0) {
      const { valid, errors } = validateFiles(files);

      if (valid.length > 0) {
        setSelectedFiles(valid);
        setErrors(errors);

        // Immediately proceed with upload without showing preview
        setProcessingFile(true);

        try {
          // Calculate file hash to prevent duplicate uploads
          const fileHash = await calculateFileHash(valid[0]);
          console.log(`File hash: ${fileHash}`);

          // Check if we need to show column mapping flow
          const hasNewColumns = await checkForNewColumns(valid[0]);

          // Parse the first 5 records from the file for preview
          let previewData: Record<string, unknown>[] = [];

          try {
            if (
              valid[0].type === "text/csv" ||
              valid[0].name.endsWith(".csv")
            ) {
              previewData = await parseCSVPreview(valid[0], 5);
              console.log("CSV preview data:", previewData);
            } else if (
              valid[0].name.endsWith(".xlsx") ||
              valid[0].name.endsWith(".xls")
            ) {
              // Try to parse Excel files client-side for preview
              try {
                const { parseFileClient } = await import(
                  "../utils/clientParse"
                );
                previewData = await parseFileClient(valid[0], 5);
                console.log("Excel preview data:", previewData);
              } catch (err) {
                console.warn("Client-side Excel parsing failed:", err);
              }
            }
          } catch (err) {
            console.warn("Preview generation error:", err);
          }

          // Extract headers from the file if needed for column mapping
          let headers: string[] = [];
          if (hasNewColumns) {
            headers = await extractFileHeaders(valid[0]);
            setFileColumnsToMap(headers);
          }

          // UNIFIED UPLOAD FLOW - Only upload the file once
          setProcessingFile(true);
          try {
            // Create a FormData object to upload the file
            const formData = new FormData();
            formData.append("file", valid[0]);
            if (projectId) {
              formData.append("projectId", projectId);
            }

            // Add file hash to prevent duplicate processing
            formData.append("fileHash", fileHash);

            // Upload the file
            const response = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });

            if (response.ok) {
              const data = await response.json();

              // Handle the case where the file was already uploaded (duplicate)
              if (data.duplicate) {
                console.log(`File already exists with ID: ${data.fileId}`);
                const fileId = data.fileId;

                // If we have new columns, show the column mapper with the existing file ID
                if (hasNewColumns) {
                  setCurrentFileId(fileId);
                  setShowColumnMapper(true);
                  return;
                }

                // Instead of calling onFilesSelected (which would trigger another upload),
                // just notify the parent that the file is ready to be displayed
                // Create a custom event to notify that the file is ready
                const event = new CustomEvent("fileStatusUpdate", {
                  detail: {
                    fileId: fileId,
                    status: "active",
                    fileName: valid[0]?.name || "File",
                  },
                });
                window.dispatchEvent(event);

                console.log(
                  `Dispatched fileStatusUpdate event for file ${fileId}`
                );
                return;
              }

              // Normal flow for new files
              if (data.files && data.files.length > 0) {
                const fileId = data.files[0].id;
                console.log(`File uploaded successfully, ID: ${fileId}`);

                // If we have new columns and haven't processed this file yet, show the column mapper
                if (hasNewColumns && !processedFileIds.has(fileId)) {
                  setCurrentFileId(fileId);
                  setShowColumnMapper(true);
                  // Add this file to the processed set
                  setProcessedFileIds((prev) => new Set(prev).add(fileId));
                  return;
                }

                // Check if the file is already active by fetching its status
                try {
                  const fileStatusResponse = await fetch(
                    `/api/files/${fileId}`
                  );
                  if (fileStatusResponse.ok) {
                    const fileData = await fileStatusResponse.json();
                    const fileStatus = fileData.file?.status || "unknown";

                    console.log(`Current file status: ${fileStatus}`);

                    // The file is already being processed by the ingest-file API
                    // No need to manually activate it, as the ingest-file process will handle activation
                    console.log(
                      `File ${fileId} will be activated by the ingest-file process, skipping manual activation`
                    );

                    // Instead of trying to activate, just check the status periodically
                    // to inform the user when it's ready
                    const checkStatusInterval = setInterval(async () => {
                      try {
                        const statusResponse = await fetch(
                          `/api/files/${fileId}`
                        );
                        if (statusResponse.ok) {
                          const fileData = await statusResponse.json();
                          const currentStatus =
                            fileData.file?.status || "unknown";

                          console.log(`Current file status: ${currentStatus}`);

                          if (currentStatus === "active") {
                            console.log(`File ${fileId} is now active`);
                            clearInterval(checkStatusInterval);
                          }
                        }
                      } catch (err) {
                        console.warn(`Error checking file status: ${err}`);
                      }
                    }, 5000); // Check every 5 seconds

                    // Clear the interval after 2 minutes (24 checks) to avoid memory leaks
                    setTimeout(() => {
                      clearInterval(checkStatusInterval);
                    }, 120000);
                  } else {
                    console.warn(
                      `Could not check file status: ${fileStatusResponse.status}`
                    );
                  }
                } catch (statusErr) {
                  console.warn(
                    `Error checking file status: ${statusErr}. Continuing anyway.`
                  );
                }

                // Instead of calling onFilesSelected (which would trigger another upload),
                // just notify the parent that the file is ready to be displayed
                // Create a custom event to notify that the file is ready
                const event = new CustomEvent("fileStatusUpdate", {
                  detail: {
                    fileId: fileId,
                    status: "active",
                    fileName: valid[0]?.name || "File",
                  },
                });
                window.dispatchEvent(event);

                console.log(
                  `Dispatched fileStatusUpdate event for file ${fileId}`
                );
              } else {
                throw new Error("No file ID returned from upload");
              }
            } else {
              throw new Error("Failed to upload file");
            }
          } catch (err) {
            console.error("Error uploading file:", err);
            setErrors([
              ...errors,
              {
                name: valid[0].name,
                error: "Failed to upload and activate file",
              },
            ]);

            // Instead of calling onFilesSelected, dispatch an error event
            const event = new CustomEvent("fileUploadError", {
              detail: {
                fileName: valid[0]?.name || "File",
                error: "Failed to upload and activate file",
              },
            });
            window.dispatchEvent(event);

            console.log(
              `Dispatched fileUploadError event for file ${
                valid[0]?.name || "File"
              }`
            );
          } finally {
            setProcessingFile(false);
          }
        } finally {
          setProcessingFile(false);
        }
      } else {
        setErrors(errors);
      }
    }
  };

  // Function to parse CSV preview data
  const parseCSVPreview = async (
    file: File,
    numRows: number = 5
  ): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        preview: numRows,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && Array.isArray(results.data)) {
            resolve(results.data as Record<string, unknown>[]);
          } else {
            resolve([]);
          }
        },
        error: () => {
          resolve([]);
        },
      });
    });
  };

  // Function to check if the file has new columns compared to existing columns
  const checkForNewColumns = async (file: File): Promise<boolean> => {
    // If no existing columns are provided, we need to check if we should show the column mapper
    // Only show the column mapper if there are actually new columns to map
    if (!existingColumns || existingColumns.length === 0) {
      console.log(
        "No existing columns provided, checking if we need column mapping"
      );

      // Extract headers from the file to see if we need column mapping
      const headers = await extractFileHeaders(file);

      // If we couldn't extract headers or there are no headers, no need for column mapping
      if (!headers || headers.length === 0) {
        console.log("No headers found in file, skipping column mapping");
        return false;
      }

      // If we have headers but no existing columns, we should show the column mapper
      // only if we're in a project context (projectId is provided)
      if (projectId) {
        console.log(
          "Headers found and in project context, showing column mapper"
        );
        return true;
      } else {
        console.log(
          "Headers found but no project context, skipping column mapper"
        );
        return false;
      }
    }

    try {
      // Extract headers from the file
      const headers = await extractFileHeaders(file);

      if (!headers || headers.length === 0) {
        console.log("No headers found in file, skipping column mapping");
        return false;
      }

      // Check if there are any headers not in existingColumns
      const newColumns = headers.filter(
        (header) => !existingColumns.includes(header)
      );
      const hasNewColumns = newColumns.length > 0;

      console.log(`File has ${newColumns.length} new columns:`, newColumns);
      return hasNewColumns;
    } catch (error) {
      console.error("Error checking for new columns:", error);
      return false;
    }
  };

  // Function to extract headers from a file
  const extractFileHeaders = async (file: File): Promise<string[]> => {
    try {
      // For CSV files
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        return new Promise((resolve) => {
          Papa.parse(file, {
            header: true,
            preview: 1, // We only need the headers
            skipEmptyLines: true,
            complete: (results) => {
              if (results.meta && results.meta.fields) {
                resolve(results.meta.fields);
              } else {
                resolve([]);
              }
            },
            error: () => {
              resolve([]);
            },
          });
        });
      }
      // For Excel files
      else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        try {
          const { parseFileClient } = await import("../utils/clientParse");
          const previewData = await parseFileClient(file, 1);
          if (previewData && previewData.length > 0) {
            return Object.keys(previewData[0]);
          }
        } catch (err) {
          console.warn("Client-side Excel parsing failed:", err);
        }
      }

      // Fallback to reading the first line of the file
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (!content) {
            resolve([]);
            return;
          }

          // For CSV files, get the first line and parse headers
          const lines = content.split("\n");
          if (lines.length === 0) {
            resolve([]);
            return;
          }

          const headers = lines[0]
            .split(",")
            .map((h) => h.trim().replace(/"/g, ""));

          resolve(headers);
        };

        // Read as text - only read the beginning of the file
        const blob = file.slice(0, 5000); // Read first 5KB to get headers
        reader.readAsText(blob);
      });
    } catch (error) {
      console.error("Error extracting file headers:", error);
      return [];
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const clearFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFiles([]);
    setErrors([]);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // Handle the completion of column mapping
  const handleMappingComplete = async (mapping: any) => {
    console.log("Column mapping completed:", mapping);

    // Hide the column mapper
    setShowColumnMapper(false);

    // The file has already been uploaded, so we need to explicitly activate it
    if (selectedFiles.length > 0 && currentFileId) {
      console.log("Column mapping completed for file ID:", currentFileId);

      // Check if the file is already active by fetching its status
      try {
        const fileResponse = await fetch(`/api/files/${currentFileId}`);
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          const fileStatus = fileData.file?.status || "unknown";

          console.log(`Current file status: ${fileStatus}`);

          // The file is already being processed by the ingest-file API
          // No need to manually activate it, as the ingest-file process will handle activation
          console.log(
            `File ${currentFileId} will be activated by the ingest-file process, skipping manual activation`
          );

          // Instead of trying to activate, just check the status periodically
          // to inform the user when it's ready
          const checkStatusInterval = setInterval(async () => {
            try {
              const statusResponse = await fetch(`/api/files/${currentFileId}`);
              if (statusResponse.ok) {
                const fileData = await statusResponse.json();
                const currentStatus = fileData.file?.status || "unknown";

                console.log(`Current file status: ${currentStatus}`);

                if (currentStatus === "active") {
                  console.log(`File ${currentFileId} is now active`);
                  clearInterval(checkStatusInterval);
                }
              }
            } catch (err) {
              console.warn(`Error checking file status: ${err}`);
            }
          }, 5000); // Check every 5 seconds

          // Clear the interval after 2 minutes (24 checks) to avoid memory leaks
          setTimeout(() => {
            clearInterval(checkStatusInterval);
          }, 120000);
        } else {
          console.warn(`Could not check file status: ${fileResponse.status}`);
        }
      } catch (err) {
        console.warn(`Error checking file status: ${err}. Continuing anyway.`);
      }

      // Add this file to the processed set to prevent duplicate processing
      setProcessedFileIds((prev) => new Set(prev).add(currentFileId));

      // Instead of calling onFilesSelected again (which would trigger another upload),
      // just notify the parent that the file is ready to be displayed
      // Create a custom event to notify that the file is ready
      const event = new CustomEvent("fileStatusUpdate", {
        detail: {
          fileId: currentFileId,
          status: "active",
          fileName: selectedFiles[0]?.name || "File",
        },
      });
      window.dispatchEvent(event);

      console.log(
        `Dispatched fileStatusUpdate event for file ${currentFileId}`
      );
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors duration-200 ${
          dragActive
            ? "border-accent-primary bg-accent-primary/10 dark:bg-accent-primary/20"
            : "border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-primary"
        } ${
          internalUploading || processingFile
            ? "opacity-50 pointer-events-none"
            : ""
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() =>
          !internalUploading && !processingFile && inputRef.current?.click()
        }
        style={{
          cursor: internalUploading || processingFile ? "default" : "pointer",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
          disabled={internalUploading || processingFile}
        />

        {internalUploading ? (
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-accent-primary">
                {uploadComplete ? "Upload Complete!" : "Uploading..."}
              </span>
              <span className="text-sm font-medium text-accent-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  uploadComplete ? "bg-green-500" : "bg-accent-primary"
                }`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : processingFile ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary mx-auto"></div>
            <p className="mt-4 text-gray-300">Processing file...</p>
          </div>
        ) : (
          <>
            <svg
              className="w-12 h-12 text-accent-primary mb-2"
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
            <p className="text-secondary dark:text-secondary mb-2">
              Drag and drop CSV or XLSX files here, or{" "}
              <span className="text-accent-primary underline">browse</span>
            </p>
            <p className="text-xs text-tertiary dark:text-tertiary">
              {useChunkedUpload
                ? "Large files will be uploaded in chunks"
                : `Maximum file size: ${Math.round(maxSize / (1024 * 1024))}MB`}
            </p>
          </>
        )}
      </div>

      {/* Removed the "File uploaded successfully" section as it's redundant with the files list */}

      {errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">
            File Upload Errors:
          </h3>
          <ul className="list-disc pl-5 text-xs text-red-700 dark:text-red-300">
            {errors.map((error, index) => (
              <li key={index}>
                {error.name}: {error.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Column Mapper Modal */}
      <ImprovedSchemaColumnMapper
        isOpen={showColumnMapper}
        onClose={() => setShowColumnMapper(false)}
        fileId={currentFileId}
        fileColumns={fileColumnsToMap}
        userId={projectId || ""}
        projectId={projectId}
        onMappingComplete={handleMappingComplete}
      />
    </div>
  );
};

export default EnhancedFileUpload;
