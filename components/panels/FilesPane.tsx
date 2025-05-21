import React, { useMemo } from "react";
import { ImprovedSchemaColumnMapper } from "../ImprovedSchemaColumnMapper";
import EnhancedFileUpload from "../EnhancedFileUpload";
import { FileStatusWidget } from "../dashboard/FileStatusWidget";

// Import our extracted components and hooks
import FileList from "../files/FileList";
import FileDetailsModal from "../files/FileDetailsModal";
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
  // No need to pass props since EnhancedFileUpload now uses the context directly
  const fileUploadElement = useMemo(() => {
    return <EnhancedFileUpload />;
  }, []);

  // No need for renderFileList as we're using the FileList component

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

        {/* Add FileStatusWidget to show processing files */}
        {/* <div className="mt-2 mb-2">
          <FileStatusWidget />
        </div> */}

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

      {files.length > 0 && <FileList className="mt-4" />}

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

            // Use the filesContext variable instead of calling useFilesContext() inside a render function
            filesContext.setSuccessMessage(message);

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
