import React, { useRef, useState } from "react";

// Maximum file size: 50MB in bytes
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  uploading?: boolean;
  progress?: number;
}

interface FileError {
  name: string;
  error: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  accept = ".csv,.xlsx",
  multiple = false,
  maxSize = MAX_FILE_SIZE,
  uploading = false,
  progress = 0,
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
      // Check file size
      if (file.size > maxSize) {
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

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      const { valid, errors } = validateFiles(files);

      if (valid.length > 0) {
        setSelectedFiles(valid);
        onFilesSelected(valid);
      }

      setErrors(errors);
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
              Maximum file size: {Math.round(maxSize / (1024 * 1024))}MB
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
