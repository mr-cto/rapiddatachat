import React, { useRef, useState, useEffect } from "react";
import { parseFileClient } from "../utils/clientParse";
import Papa from "papaparse";
import Modal from "./Modal";
import { Button } from "./ui";
import ColumnFilterModal from "./ColumnFilterModal";
// Removed ColumnMergeManager import as we're using a simplified version

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
  onFilesSelected: (files: File[], projectId?: string) => void;
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

interface ColumnMerge {
  id: string;
  mergeName: string;
  columnList: string[];
  delimiter: string;
}

// Interface for the form state of creating a column merge
interface MergeFormState {
  mergeName: string;
  selectedColumns: string[];
  delimiter: string;
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
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FileError[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [showColumnMerge, setShowColumnMerge] = useState(false);
  const [columnMerges, setColumnMerges] = useState<ColumnMerge[]>([]);
  const [mergeForm, setMergeForm] = useState<MergeFormState>({
    mergeName: "",
    selectedColumns: [],
    delimiter: " ",
  });
  const [processingPreview, setProcessingPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when files are deselected
  useEffect(() => {
    if (selectedFiles.length === 0) {
      setPreviewData([]);
      setColumns([]);
      setVisibleColumns([]);
      setShowPreview(false);
      setColumnMerges([]);
    }
  }, [selectedFiles]);

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
        setErrors(errors);

        // Parse the file for preview
        await generatePreview(valid[0]);
      } else {
        setErrors(errors);
      }
    }
  };

  const generatePreview = async (file: File) => {
    try {
      setProcessingPreview(true);

      // Use Papa.parse directly for more control
      Papa.parse(file, {
        header: true,
        preview: 5, // Only parse 5 rows for the preview
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            // Extract column names
            const headers =
              results.meta.fields ||
              (results.data[0]
                ? Object.keys(results.data[0] as Record<string, unknown>)
                : []);

            setPreviewData(results.data as Record<string, unknown>[]);
            setColumns(headers);
            setVisibleColumns(headers);
            setShowPreview(true);
          } else {
            setErrors([
              ...errors,
              { name: file.name, error: "No data found in the file" },
            ]);
          }
          setProcessingPreview(false);
        },
        error: (err) => {
          setErrors([...errors, { name: file.name, error: err.message }]);
          setProcessingPreview(false);
        },
      });
    } catch (err) {
      console.error("Error generating preview:", err);
      setErrors([
        ...errors,
        {
          name: file.name,
          error:
            err instanceof Error
              ? err.message
              : "Unknown error generating preview",
        },
      ]);
      setProcessingPreview(false);
    }
  };

  const handleChunkedUpload = async (file: File) => {
    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;

    console.log(
      `Starting chunked upload for ${file.name} (${file.size} bytes)`
    );
    console.log(
      `File will be split into ${totalChunks} chunks of ${CHUNK_SIZE} bytes each`
    );

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

      // Add column merges information if available
      if (columnMerges.length > 0) {
        formData.append("columnMerges", JSON.stringify(columnMerges));
      }

      // Add visible columns information if filtered
      if (visibleColumns.length < columns.length) {
        formData.append("visibleColumns", JSON.stringify(visibleColumns));
      }

      if (projectId) {
        formData.append("projectId", projectId);
      }
      // Append the chunk as a file with a filename
      formData.append("chunk", chunk, `${file.name}.part${chunkIndex}`);

      try {
        console.log(
          `Uploading chunk ${chunkIndex + 1}/${totalChunks} for file ${
            file.name
          }`
        );

        const response = await fetch("/api/upload-chunk", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Server response (${response.status}): ${errorText}`);
          throw new Error(
            `Failed to upload chunk: ${response.status} ${response.statusText}`
          );
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
        console.error("Chunk details:", {
          fileId,
          fileName: file.name,
          chunkIndex,
          chunkSize: chunk.size,
          totalChunks,
        });

        // Dispatch error event
        const errorEvent = new CustomEvent("fileUploadError", {
          detail: {
            fileId,
            fileName: file.name,
            error: error instanceof Error ? error.message : "Unknown error",
            chunkIndex,
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

    // Return a promise that resolves when the upload is complete or rejects on error
    return uploadChunksWithConcurrency().catch((error) => {
      console.error("Error in chunked upload:", error);
      throw error; // Re-throw to trigger the fallback
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
    setPreviewData([]);
    setColumns([]);
    setVisibleColumns([]);
    setShowPreview(false);
    setColumnMerges([]);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleColumnMergesChange = (merges: ColumnMerge[]) => {
    setColumnMerges(merges);

    // When using the simplified UI, we would call the list endpoint instead of index
    // Example:
    // fetch('/api/column-merges/list?fileId=preview')
    //   .then(response => response.json())
    //   .then(data => {
    //     // Process data
    //   })
    //   .catch(error => console.error('Error fetching column merges:', error));
  };

  const handleVisibleColumnsChange = (columns: string[]) => {
    setVisibleColumns(columns);
    setShowColumnFilter(false);
  };

  const handleProceedWithUpload = () => {
    if (selectedFiles.length === 0) return;

    // Close preview
    setShowPreview(false);

    // Always use regular upload for now since chunked upload is having issues
    console.log("Using regular upload method");

    // Pass column configuration with the files
    const fileConfig = {
      files: selectedFiles,
      columnMerges,
      visibleColumns:
        visibleColumns.length < columns.length ? visibleColumns : undefined,
    };

    // Use the onFilesSelected callback to pass the files to the parent component
    onFilesSelected(selectedFiles, projectId);
  };

  return (
    <div className="w-full">
      {!showPreview ? (
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
          ) : processingPreview ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary mx-auto"></div>
              <p className="mt-4 text-gray-300">Generating preview...</p>
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
                  : `Maximum file size: ${Math.round(
                      maxSize / (1024 * 1024)
                    )}MB`}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-ui-primary">
          <div className="p-4 border-b border-ui-border flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-gray-200">
                Preview: {selectedFiles[0]?.name}
              </h3>
              <p className="text-sm text-gray-400">
                Showing first 5 rows. Customize columns before uploading.
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowColumnFilter(true)}
              >
                Filter Columns
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowColumnMerge(true)}
              >
                Merge Columns
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px]">
            <table className="min-w-full divide-y divide-ui-border">
              <thead className="bg-ui-secondary">
                <tr>
                  {visibleColumns.map((column) => (
                    <th
                      key={column}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider sticky top-0 bg-ui-secondary"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-ui-primary divide-y divide-ui-border">
                {previewData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {visibleColumns.map((column) => (
                      <td
                        key={`${rowIndex}-${column}`}
                        className="px-3 py-2 text-sm text-gray-300"
                      >
                        {row[column] !== undefined && row[column] !== null
                          ? String(row[column])
                          : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-ui-border flex justify-between items-center">
            <Button variant="secondary" onClick={clearFiles}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleProceedWithUpload}>
              Proceed with Upload
            </Button>
          </div>
        </div>
      )}

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

      {/* Column Filter Modal */}
      <ColumnFilterModal
        isOpen={showColumnFilter}
        onClose={() => setShowColumnFilter(false)}
        columns={columns}
        initialVisibleColumns={visibleColumns}
        onApplyFilters={handleVisibleColumnsChange}
      />

      {/* Column Merge Modal */}
      {showColumnMerge && (
        <Modal
          isOpen={showColumnMerge}
          onClose={() => setShowColumnMerge(false)}
          title="Merge Columns"
          maxWidth="max-w-4xl"
        >
          <div className="p-4">
            {/* Create a simplified column merge UI for preview */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Available Columns
              </h3>
              <div className="flex flex-wrap gap-2 p-2 border border-ui-border rounded-md bg-ui-secondary">
                {visibleColumns.map((column) => (
                  <div
                    key={column}
                    className="px-2 py-1 bg-ui-primary text-gray-300 text-sm rounded border border-ui-border"
                  >
                    {column}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Create Column Merge
              </h3>
              <div className="p-3 border border-ui-border rounded-md bg-ui-secondary">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Merged Column Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-ui-primary border border-ui-border rounded-md text-gray-300"
                      placeholder="Enter name for merged column"
                      value={mergeForm.mergeName}
                      onChange={(e) =>
                        setMergeForm({
                          ...mergeForm,
                          mergeName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Select Columns to Merge
                    </label>
                    <div className="flex flex-wrap gap-2 p-2 border border-ui-border rounded-md bg-ui-primary">
                      {visibleColumns.map((column) => (
                        <label
                          key={column}
                          className="flex items-center space-x-2 px-2 py-1 bg-ui-secondary text-gray-300 text-sm rounded border border-ui-border"
                        >
                          <input
                            type="checkbox"
                            className="rounded text-accent-primary"
                            checked={mergeForm.selectedColumns.includes(column)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMergeForm({
                                  ...mergeForm,
                                  selectedColumns: [
                                    ...mergeForm.selectedColumns,
                                    column,
                                  ],
                                });
                              } else {
                                setMergeForm({
                                  ...mergeForm,
                                  selectedColumns:
                                    mergeForm.selectedColumns.filter(
                                      (col) => col !== column
                                    ),
                                });
                              }
                            }}
                          />
                          <span>{column}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Delimiter
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-ui-primary border border-ui-border rounded-md text-gray-300"
                      value={mergeForm.delimiter}
                      onChange={(e) =>
                        setMergeForm({
                          ...mergeForm,
                          delimiter: e.target.value,
                        })
                      }
                    >
                      <option value=" ">Space ( )</option>
                      <option value=", ">Comma (,)</option>
                      <option value=" - ">Dash (-)</option>
                      <option value=".">Period (.)</option>
                      <option value="">None</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="primary"
                    onClick={() => {
                      // Validate form
                      if (!mergeForm.mergeName) {
                        alert("Please enter a name for the merged column");
                        return;
                      }
                      if (mergeForm.selectedColumns.length < 2) {
                        alert("Please select at least 2 columns to merge");
                        return;
                      }

                      // Create new merge
                      const newMerge: ColumnMerge = {
                        id: `preview-${crypto.randomUUID()}`,
                        mergeName: mergeForm.mergeName,
                        columnList: mergeForm.selectedColumns,
                        delimiter: mergeForm.delimiter,
                      };

                      // Add to column merges
                      setColumnMerges([...columnMerges, newMerge]);

                      // Reset form
                      setMergeForm({
                        mergeName: "",
                        selectedColumns: [],
                        delimiter: " ",
                      });

                      // Show confirmation
                      alert(
                        `Column merge "${newMerge.mergeName}" created successfully!`
                      );
                    }}
                  >
                    Create Merge
                  </Button>
                </div>
              </div>
            </div>

            {/* Display existing merges */}
            {columnMerges.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  Existing Column Merges
                </h3>
                <div className="border border-ui-border rounded-md bg-ui-secondary">
                  <ul className="divide-y divide-ui-border">
                    {columnMerges.map((merge) => (
                      <li key={merge.id} className="p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-gray-300">
                              {merge.mergeName}
                            </p>
                            <p className="text-xs text-gray-400">
                              {merge.columnList.join(` ${merge.delimiter} `)}
                            </p>
                          </div>
                          <button
                            className="text-red-500 hover:text-red-400"
                            onClick={() => {
                              setColumnMerges(
                                columnMerges.filter((m) => m.id !== merge.id)
                              );
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button
                variant="primary"
                onClick={() => setShowColumnMerge(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EnhancedFileUpload;
