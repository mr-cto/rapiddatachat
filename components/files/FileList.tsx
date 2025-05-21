import React from "react";
import { Card } from "../ui";
import { FaFile } from "react-icons/fa";
import { Button } from "../ui";
import FileItem from "./FileItem";
import { useFilesContext } from "./context/FilesContext";
import { formatFileSize, getStatusBadgeColor } from "./utils";

interface FileListProps {
  className?: string;
}

const FileList: React.FC<FileListProps> = ({ className }) => {
  const {
    files,
    loading,
    fetchFiles,
    handleDeleteFile,
    handleDeleteClick,
    cancelDelete,
    deleteConfirmation,
    retryingFiles,
    retryErrors,
    onViewFileDetails,
    viewSynopsis,
    retryFileIngestion,
  } = useFilesContext();

  // Render file list UI
  const renderFileList = () => {
    // Show loading state
    if (loading) {
      return (
        <Card variant="default" padding="none">
          <div className="p-4 grid grid-cols-1 gap-4 animate-pulse">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="border border-ui-border rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="h-6 bg-ui-tertiary rounded w-3/4"></div>
                  <div className="flex space-x-2">
                    <div className="h-5 w-5 bg-ui-tertiary rounded-full"></div>
                    <div className="h-5 w-5 bg-ui-tertiary rounded-full"></div>
                  </div>
                </div>
                <div className="h-4 bg-ui-tertiary rounded w-1/2 mb-2"></div>
                <div className="h-5 bg-ui-tertiary rounded w-1/4 mb-3"></div>
              </div>
            ))}
          </div>
        </Card>
      );
    }

    // Show file list
    return (
      <Card variant="default" padding="none" className="overflow-hidden">
        <div className="p-1 grid grid-cols-1 gap-2">
          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onSelectFile={viewSynopsis}
              viewSynopsis={viewSynopsis}
              handleDeleteClick={handleDeleteClick}
              deleteConfirmation={deleteConfirmation}
              handleDeleteFile={handleDeleteFile}
              cancelDelete={cancelDelete}
              formatFileSize={formatFileSize}
              getStatusBadgeColor={getStatusBadgeColor}
              retryFileIngestion={retryFileIngestion}
              retryingFiles={retryingFiles}
              retryErrors={retryErrors}
              onViewFileDetails={onViewFileDetails}
            />
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className={`overflow-y-auto flex-1 p-1 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h2 className="text-md font-semibold flex items-center text-gray-300">
            <FaFile className="mr-1" /> Files{" "}
            {files.length > 0 ? `(${files.length})` : ""}
          </h2>
          <Button
            onClick={() => fetchFiles()}
            variant="secondary"
            size="sm"
            className="ml-2 h-6 px-2 py-0"
            title="Force refresh files list"
            isLoading={loading}
          >
            {!loading && "refresh"}
          </Button>
        </div>
      </div>
      {renderFileList()}
    </div>
  );
};

export default FileList;
