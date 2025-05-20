import React, { useMemo } from "react";
import { FaFile } from "react-icons/fa";
import { ImprovedSchemaColumnMapper } from "../ImprovedSchemaColumnMapper";
import { Button, Card } from "../ui";
import EnhancedFileUpload from "../EnhancedFileUpload";

// Import our extracted components and hooks
import FileItem from "../files/FileItem";
import FileDetailsModal from "../files/FileDetailsModal";
import { formatFileSize, getStatusBadgeColor } from "../files/utils";
import { FilesPaneProps } from "../files/types";
import { FilesProvider, useFilesContext } from "../files/context/FilesContext";

// Inner component that uses the context
const FilesPaneContent: React.FC = () => {
  const {
    files,
    loading,
    error,
    successMessage,
    uploadingFiles,
    fileDetailsModalOpen,
    selectedFileDetails,
    deleteConfirmation,
    retryingFiles,
    retryErrors,
    showSchemaMapper,
    uploadedFileId,
    uploadedFileColumns,
    fetchFiles,
    handleDeleteFile,
    handleDeleteClick,
    cancelDelete,
    onViewFileDetails,
    closeFileDetailsModal,
    retryFileIngestion,
    viewSynopsis,
    setShowSchemaMapper,
  } = useFilesContext();

  // Get context
  const filesContext = useFilesContext();

  // Create a memoized enhanced file upload component
  const fileUploadElement = useMemo(() => {
    return (
      <EnhancedFileUpload
        onFilesSelected={filesContext.handleFilesUpload}
        uploading={filesContext.uploading}
        progress={filesContext.uploadProgress}
        projectId={filesContext.projectId}
        useChunkedUpload={true}
        existingColumns={[]}
      />
    );
  }, [filesContext]);

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
              onSelectFile={filesContext.viewSynopsis}
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
    <div className="h-[50vh] flex flex-col">
      <div className="p-2 border-b border-ui-border">
        {successMessage && (
          <div className="mt-2 p-3 bg-green-900/30 border border-green-800 rounded-md">
            <p className="text-green-400 text-sm flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              {successMessage}
            </p>
          </div>
        )}

        {/* Display uploading files with progress */}
        {Object.keys(uploadingFiles).length > 0 && (
          <div className="mt-2 p-3 bg-blue-900/30 border border-blue-800 rounded-md">
            <h4 className="text-blue-400 text-sm font-medium mb-2">
              Files Uploading
            </h4>
            {Object.entries(uploadingFiles).map(
              ([fileId, { fileName, progress }]) => (
                <div key={fileId} className="mb-2 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-300 truncate max-w-xs">
                      {fileName}
                    </span>
                    <span className="text-xs text-blue-300">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-ui-tertiary rounded-full h-1.5">
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

        <div className="mt-2 mb-2 p-3 border border-ui-border rounded-md bg-ui-secondary">
          {fileUploadElement}
        </div>

        {error && (
          <div className="mt-2 p-3 bg-red-900/30 border border-red-800 rounded-md">
            <p className="text-red-400 text-sm flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {error}
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="overflow-y-auto flex-1 p-1 mt-4">
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
      )}

      {/* Schema Column Mapper Modal */}
      {showSchemaMapper && uploadedFileId && (
        <ImprovedSchemaColumnMapper
          isOpen={showSchemaMapper}
          onClose={() => {
            setShowSchemaMapper(false);
          }}
          fileId={uploadedFileId}
          fileColumns={uploadedFileColumns}
          userId={filesContext.userId || ""}
          projectId={filesContext.projectId}
          onMappingComplete={(mapping: {
            fileId: string;
            schemaId: string;
            mappings: Record<string, string>;
            newColumnsAdded?: number;
          }) => {
            setShowSchemaMapper(false);

            // Show success message with info about new columns
            const message =
              mapping.newColumnsAdded && mapping.newColumnsAdded > 0
                ? `File successfully uploaded and mapped to schema! ${mapping.newColumnsAdded} new column(s) added to schema.`
                : "File successfully uploaded and mapped to schema!";

            useFilesContext().setSuccessMessage(message);

            // Refresh the file list after mapping is complete
            fetchFiles();
          }}
        />
      )}

      {/* File Details Modal */}
      <FileDetailsModal
        isOpen={fileDetailsModalOpen}
        onClose={closeFileDetailsModal}
        fileId={selectedFileDetails}
        formatFileSize={formatFileSize}
        getStatusBadgeColor={getStatusBadgeColor}
        retryFileIngestion={retryFileIngestion}
        retryingFiles={retryingFiles}
      />
    </div>
  );
};

// Wrapper component that provides the context
const FilesPane: React.FC<FilesPaneProps> = ({
  onSelectFile,
  selectedFileId,
  projectId,
  onPreviewParsed,
  onFileCountChange,
}) => {
  return (
    <FilesProvider
      onSelectFile={onSelectFile}
      selectedFileId={selectedFileId}
      projectId={projectId}
      onPreviewParsed={onPreviewParsed}
      onFileCountChange={onFileCountChange}
    >
      <FilesPaneContent />
    </FilesProvider>
  );
};

export default FilesPane;
