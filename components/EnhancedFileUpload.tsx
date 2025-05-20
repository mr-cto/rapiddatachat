import React, { useRef, useState, useEffect } from "react";
import { Button } from "./ui";
import Papa from "papaparse";

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

  const handleFiles = async (files: FileList | null) => {
    if (files && files.length > 0) {
      const { valid, errors } = validateFiles(files);

      if (valid.length > 0) {
        setSelectedFiles(valid);
        setErrors(errors);

        // Immediately proceed with upload without showing preview
        setProcessingFile(true);

        try {
          // Check if we need to show column mapping flow
          // This would typically involve reading the file headers
          // and comparing with existing columns
          const hasNewColumns = await checkForNewColumns(valid[0]);

          // Parse the first 5 records from the file for preview
          let previewData: Record<string, unknown>[] = [];

          if (valid[0].type === "text/csv" || valid[0].name.endsWith(".csv")) {
            previewData = await parseCSVPreview(valid[0], 5);
          } else if (
            valid[0].name.endsWith(".xlsx") ||
            valid[0].name.endsWith(".xls")
          ) {
            // For Excel files, we'll rely on the backend processing
            // but we could add client-side Excel parsing in the future
          }

          // Use the onFilesSelected callback to pass the files to the parent component
          // with options for how to handle the file
          onFilesSelected(valid, projectId, {
            hasNewColumns,
            showPreview: valid.length > 0 && !hasNewColumns,
            previewData: previewData.length > 0 ? previewData : undefined,
          });
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
    // If no existing columns are provided, assume new columns
    if (!existingColumns || existingColumns.length === 0) {
      return true;
    }

    try {
      // Read the first few lines of the file to get headers
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (!content) {
            resolve(false);
            return;
          }

          // For CSV files, get the first line and parse headers
          const lines = content.split("\n");
          if (lines.length === 0) {
            resolve(false);
            return;
          }

          const headers = lines[0]
            .split(",")
            .map((h) => h.trim().replace(/"/g, ""));

          // Check if there are any headers not in existingColumns
          const hasNewColumns = headers.some(
            (header) => !existingColumns.includes(header)
          );

          resolve(hasNewColumns);
        };

        // Read as text - only read the beginning of the file
        const blob = file.slice(0, 5000); // Read first 5KB to get headers
        reader.readAsText(blob);
      });
    } catch (error) {
      console.error("Error checking for new columns:", error);
      return false;
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
    </div>
  );
};

export default EnhancedFileUpload;
