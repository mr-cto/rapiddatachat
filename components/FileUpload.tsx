import React, { useRef, useState } from "react";
import { parseFileClient } from "../utils/clientParse";

// Maximum file size: 500MB in bytes
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Chunk size: 5MB in bytes
const CHUNK_SIZE = 5 * 1024 * 1024;

interface FileUploadProps {
  onFilesSelected: (files: File[], projectId?: string) => void;
  onPreviewParsed?: (preview: Record<string, unknown>[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  uploading?: boolean;
  progress?: number;
  projectId?: string;
  useChunkedUpload?: boolean;
}

interface FileError {
  name: string;
  error: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  onPreviewParsed,
  accept = ".csv,.xlsx",
  multiple = false,
  maxSize = MAX_FILE_SIZE,
  uploading = false,
  progress = 0,
  projectId,
  useChunkedUpload = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FileError[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

      // Check file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
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

  const handleFiles = async (files: FileList | null) => {
    if (files && files.length > 0) {
      const { valid, errors } = validateFiles(files);

      if (valid.length > 0) {
        setSelectedFiles(valid);

        if (onPreviewParsed) {
          try {
            const preview = await parseFileClient(valid[0]);
            onPreviewParsed(preview);
          } catch (err) {
            console.warn("Preview parsing failed", err);
          }
        }

        if (useChunkedUpload) {
          handleChunkedUpload(valid[0]);
        } else {
          onFilesSelected(valid, projectId);
        }
      }

      setErrors(errors);
    }
  };

  const handleChunkedUpload = async (file: File) => {
    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;

    // Set uploading state in parent component
    onFilesSelected([file], projectId);

    // Function to upload a single chunk
    const uploadChunk = async (
      chunk: Blob,
      chunkIndex: number
    ): Promise<boolean> => {
      const formData = new FormData();
      formData.append("fileId", fileId);
      formData.append("originalFilename", file.name);
      formData.append("totalChunks", totalChunks.toString());
      formData.append("currentChunk", chunkIndex.toString());
      formData.append("totalSize", file.size.toString());
      formData.append("mimeType", file.type);
      if (projectId) {
        formData.append("projectId", projectId);
      }
      formData.append("chunk", chunk);

      try {
        const response = await fetch("/api/upload-chunk", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload chunk");
        }

        const data = await response.json();
        uploadedChunks++;

        // Calculate and dispatch progress event
        const uploadProgress = Math.round((uploadedChunks / totalChunks) * 100);

        // Create and dispatch a custom event for progress updates
        const progressEvent = new CustomEvent("fileUploadProgress", {
          detail: {
            fileId,
            progress: uploadProgress,
            fileName: file.name,
            completed: uploadedChunks === totalChunks,
          },
        });
        window.dispatchEvent(progressEvent);

        // If all chunks are uploaded, handle the complete file
        if (data.file) {
          // File is complete, handle the response
          const fileObj = {
            id: data.file.id,
            name: data.file.name,
            size: data.file.size,
            status: data.file.status,
            format: data.file.format,
          };

          // Dispatch completion event
          const completionEvent = new CustomEvent("fileUploadComplete", {
            detail: {
              fileId: data.file.id,
              file: fileObj,
            },
          });
          window.dispatchEvent(completionEvent);

          // Start polling for file status to detect processing errors
          startFileStatusPolling(data.file.id, file.name);

          return true;
        }

        return false;
      } catch (error) {
        console.error("Error uploading chunk:", error);

        // Dispatch error event
        const errorEvent = new CustomEvent("fileUploadError", {
          detail: {
            fileId,
            fileName: file.name,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
        window.dispatchEvent(errorEvent);

        return false;
      }
    };

    // Function to poll for file status updates
    const startFileStatusPolling = (fileId: string, fileName: string) => {
      let pollCount = 0;
      const maxPolls = 60; // Poll for up to 5 minutes (5s * 60 = 300s = 5min)
      const pollInterval = 5000; // Poll every 5 seconds

      const pollFileStatus = async () => {
        try {
          const response = await fetch(`/api/files/${fileId}`);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch file status: ${response.statusText}`
            );
          }

          const data = await response.json();

          // Dispatch status update event
          const statusEvent = new CustomEvent("fileStatusUpdate", {
            detail: {
              fileId,
              fileName,
              status: data.status,
              error: data.activationError || null,
            },
          });
          window.dispatchEvent(statusEvent);

          // If file is in a terminal state (active or error), stop polling
          if (data.status === "active" || data.status === "error") {
            if (data.status === "error") {
              // Dispatch specific error event for processing errors
              const processingErrorEvent = new CustomEvent(
                "fileProcessingError",
                {
                  detail: {
                    fileId,
                    fileName,
                    error: data.activationError || "Error processing file",
                  },
                }
              );
              window.dispatchEvent(processingErrorEvent);
            }
            return;
          }

          // Continue polling if we haven't reached the maximum number of polls
          pollCount++;
          if (pollCount < maxPolls) {
            setTimeout(pollFileStatus, pollInterval);
          } else {
            // If we've reached the maximum number of polls, assume something went wrong
            const timeoutEvent = new CustomEvent("fileProcessingTimeout", {
              detail: {
                fileId,
                fileName,
                message: "File processing is taking longer than expected",
              },
            });
            window.dispatchEvent(timeoutEvent);
          }
        } catch (error) {
          console.error("Error polling file status:", error);
          // Continue polling despite errors
          pollCount++;
          if (pollCount < maxPolls) {
            setTimeout(pollFileStatus, pollInterval);
          }
        }
      };

      // Start polling after a short delay to allow the server to begin processing
      setTimeout(pollFileStatus, 2000);
    };

    // Start uploading chunks in a non-blocking way
    // Use Promise.all with a limited concurrency to avoid overwhelming the server
    const uploadChunksWithConcurrency = async () => {
      const concurrencyLimit = 3; // Upload 3 chunks at a time
      let currentChunk = 0;

      const uploadNextBatch = async () => {
        const chunkPromises = [];

        // Create a batch of chunk upload promises
        for (
          let i = 0;
          i < concurrencyLimit && currentChunk < totalChunks;
          i++
        ) {
          const start = currentChunk * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          chunkPromises.push(uploadChunk(chunk, currentChunk));
          currentChunk++;
        }

        // Wait for the current batch to complete
        await Promise.all(chunkPromises);

        // If there are more chunks, upload the next batch
        if (currentChunk < totalChunks) {
          await uploadNextBatch();
        }
      };

      // Start the upload process
      await uploadNextBatch();
    };

    // Start the upload process without blocking the UI
    uploadChunksWithConcurrency().catch((error) => {
      console.error("Error in chunked upload:", error);
    });
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

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors duration-200 ${
          dragActive
            ? "border-accent-primary bg-accent-primary/10 dark:bg-accent-primary/20"
            : "border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-primary"
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
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />

        {uploading ? (
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-accent-primary">
                Uploading...
              </span>
              <span className="text-sm font-medium text-accent-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-accent-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
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

      {selectedFiles.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-secondary dark:text-secondary">
              Selected Files:
            </h3>
            {!uploading && (
              <button
                onClick={clearFiles}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                type="button"
              >
                Clear All
              </button>
            )}
          </div>
          <ul className="bg-ui-secondary dark:bg-ui-secondary rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {selectedFiles.map((file, index) => (
              <li
                key={index}
                className="px-3 py-2 text-sm text-secondary dark:text-secondary flex justify-between items-center"
              >
                <span className="truncate max-w-xs">{file.name}</span>
                <span className="text-xs text-tertiary dark:text-tertiary">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
