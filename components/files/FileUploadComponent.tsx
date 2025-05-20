import React, { memo } from "react";
import { FaUpload } from "react-icons/fa";
import { FileUploadComponentProps } from "./types";

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
  }: FileUploadComponentProps) => {
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

export default FileUploadComponent;
