import React, { memo } from "react";
import { FaTrash, FaEye } from "react-icons/fa";
import { Button } from "../ui";
import { FileItemProps } from "./types";

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
  }: FileItemProps) => {
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

export default FileItem;
