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
            {file.filename} <br />
            <br />{" "}
            {file.uploadedAt && new Date(file.uploadedAt).toLocaleString()}
          </h3>
          <div className="flex space-x-2">
            {/* <Button
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
            </Button> */}
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
      </div>
    );
  }
);

FileItem.displayName = "FileItem";

export default FileItem;
