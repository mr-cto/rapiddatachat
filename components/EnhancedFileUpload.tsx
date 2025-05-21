import React, { useRef } from "react";
import { ImprovedSchemaColumnMapper } from "./ImprovedSchemaColumnMapper";
import { useFilesContext } from "./files/context/FilesContext";

// Maximum file size: 500MB in bytes
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

interface EnhancedFileUploadProps {
  // Make onFilesSelected optional since we're using the context
  onFilesSelected?: (
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

const EnhancedFileUpload: React.FC<EnhancedFileUploadProps> = ({
  onFilesSelected,
  accept = ".csv,.xlsx",
  multiple = false,
  maxSize = MAX_FILE_SIZE,
  uploading: externalUploading = false,
  progress: externalProgress = 0,
  projectId,
  useChunkedUpload = false,
  existingColumns = [],
}) => {
  // Use the FilesContext and hooks
  const {
    uploading,
    uploadProgress,
    uploadStatus,
    showSchemaMapper,
    uploadedFileId,
    uploadedFileColumns,
    dragActive,
    uploadingFiles,
    inputRef,
    handleDrag,
    handleDrop,
    handleChange,
    handleFilesUpload: contextHandleFilesUpload,
    setShowSchemaMapper,
  } = useFilesContext();

  // Use the provided onFilesSelected if available, otherwise use the one from context
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files);

    if (onFilesSelected) {
      onFilesSelected(validFiles, projectId);
    } else {
      contextHandleFilesUpload(validFiles, projectId);
    }
  };

  // Determine which uploading and progress values to use
  // Prefer context values, fall back to props
  const isUploading = uploading || externalUploading;
  const currentProgress = uploadProgress || externalProgress;
  const uploadComplete = currentProgress >= 100;

  // Handle the completion of column mapping
  const handleMappingComplete = (mapping: any) => {
    setShowSchemaMapper(false);

    // Refresh the file list after mapping is complete
    // This is handled by the FilesContext
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors duration-200 ${
          dragActive
            ? "border-accent-primary bg-accent-primary/10 dark:bg-accent-primary/20"
            : "border-gray-300 dark:border-gray-700 bg-ui-primary dark:bg-ui-primary"
        } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        style={{
          cursor: isUploading ? "default" : "pointer",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-accent-primary">
                {uploadComplete
                  ? "Upload Complete!"
                  : uploadStatus || "Uploading..."}
              </span>
              <span className="text-sm font-medium text-accent-primary">
                {Math.round(currentProgress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  uploadComplete ? "bg-green-500" : "bg-accent-primary"
                }`}
                style={{ width: `${currentProgress}%` }}
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

      {/* Display uploading files with progress */}
      {Object.keys(uploadingFiles).length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
            Files Uploading
          </h4>
          {Object.entries(uploadingFiles).map(
            ([fileId, { fileName, progress }]) => (
              <div key={fileId} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-blue-700 dark:text-blue-300 truncate max-w-xs">
                    {fileName}
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
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

      {/* Column Mapper Modal */}
      {showSchemaMapper && uploadedFileId && (
        <ImprovedSchemaColumnMapper
          isOpen={showSchemaMapper}
          onClose={() => setShowSchemaMapper(false)}
          fileId={uploadedFileId}
          fileColumns={uploadedFileColumns}
          userId={projectId || ""}
          projectId={projectId}
          onMappingComplete={handleMappingComplete}
        />
      )}
    </div>
  );
};

export default EnhancedFileUpload;
