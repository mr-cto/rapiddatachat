import React, { createContext, useContext, ReactNode } from "react";
import { useStableSession } from "../../../lib/hooks/useStableSession";
import { useFileList } from "../hooks/useFileList";
import { useFileOperations } from "../hooks/useFileOperations";
import { useFileUpload } from "../hooks/useFileUpload";
import { FileData, Pagination, Sorting } from "../types";

interface FilesContextType {
  // File list state
  files: FileData[];
  loading: boolean;
  error: string | null;
  isFirstUpload: boolean;
  hasActiveSchema: boolean;
  pagination: Pagination;
  sorting: Sorting;
  projectId?: string; // Add projectId to context
  userId?: string; // Add userId to context

  // File operations state
  deleteConfirmation: string | null;
  retryingFiles: Record<string, boolean>;
  retryErrors: Record<string, string>;
  successMessage: string | null;
  fileDetailsModalOpen: boolean;
  selectedFileDetails: string | null;

  // File upload state
  uploading: boolean;
  uploadProgress: number;
  uploadStatus: string;
  showSchemaMapper: boolean;
  uploadedFileId: string | null;
  uploadedFileColumns: string[];
  dragActive: boolean;
  uploadingFiles: Record<string, { progress: number; fileName: string }>;
  inputRef: React.RefObject<HTMLInputElement | null>;

  // File list operations
  fetchFiles: () => Promise<void>;
  handleSort: (column: string) => void;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (pageSize: number) => void;

  // File operations
  handleDeleteFile: (fileId: string) => Promise<void>;
  handleDeleteClick: (fileId: string) => void;
  cancelDelete: () => void;
  onViewFileDetails: (fileId: string) => void;
  closeFileDetailsModal: () => void;
  retryFileIngestion: (fileId: string) => Promise<void>;
  viewSynopsis: (fileId: string) => void;

  // File upload operations
  handleDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFilesUpload: (
    uploadedFiles: File[],
    projectIdParam?: string,
    options?: {
      hasNewColumns?: boolean;
      showPreview?: boolean;
      previewData?: Record<string, unknown>[];
    }
  ) => Promise<void>;

  // Utility functions
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;
  setShowSchemaMapper: (show: boolean) => void;
}

const FilesContext = createContext<FilesContextType | undefined>(undefined);

interface FilesProviderProps {
  children: ReactNode;
  projectId?: string;
  onSelectFile: (fileId: string) => void;
  selectedFileId?: string;
  onPreviewParsed?: (preview: Record<string, unknown>[]) => void;
  onFileCountChange?: (count: number) => void;
}

export const FilesProvider: React.FC<FilesProviderProps> = ({
  children,
  projectId,
  onSelectFile,
  selectedFileId,
  onPreviewParsed,
  onFileCountChange,
}) => {
  const { userId, isAuthenticated } = useStableSession();

  // Use our custom hooks
  const {
    files,
    loading,
    error,
    isFirstUpload,
    hasActiveSchema,
    pagination,
    sorting,
    fetchFiles,
    handleSort,
    handlePageChange,
    handlePageSizeChange,
    setError,
  } = useFileList({
    projectId,
    isAuthenticated,
    onFileCountChange,
  });

  const {
    deleteConfirmation,
    retryingFiles,
    retryErrors,
    successMessage,
    fileDetailsModalOpen,
    selectedFileDetails,
    handleDeleteFile,
    handleDeleteClick,
    cancelDelete,
    onViewFileDetails,
    closeFileDetailsModal,
    retryFileIngestion,
    viewSynopsis,
    setSuccessMessage,
  } = useFileOperations({
    fetchFiles,
    selectedFileId,
    onSelectFile,
    onFileCountChange,
  });

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
    handleFilesUpload,
    setShowSchemaMapper,
  } = useFileUpload({
    projectId,
    isAuthenticated,
    userId: userId || undefined,
    fetchFiles,
    onPreviewParsed,
    hasActiveSchema,
    isFirstUpload,
    setError,
    setSuccessMessage,
  });

  const value: FilesContextType = {
    // File list state
    files,
    loading,
    error,
    isFirstUpload,
    hasActiveSchema,
    pagination,
    sorting,
    projectId, // Expose projectId in context
    userId: userId || undefined, // Expose userId in context

    // File operations state
    deleteConfirmation,
    retryingFiles,
    retryErrors,
    successMessage,
    fileDetailsModalOpen,
    selectedFileDetails,

    // File upload state
    uploading,
    uploadProgress,
    uploadStatus,
    showSchemaMapper,
    uploadedFileId,
    uploadedFileColumns,
    dragActive,
    uploadingFiles,
    inputRef,

    // File list operations
    fetchFiles,
    handleSort,
    handlePageChange,
    handlePageSizeChange,

    // File operations
    handleDeleteFile,
    handleDeleteClick,
    cancelDelete,
    onViewFileDetails,
    closeFileDetailsModal,
    retryFileIngestion,
    viewSynopsis,

    // File upload operations
    handleDrag,
    handleDrop,
    handleChange,
    handleFilesUpload,

    // Utility functions
    setError,
    setSuccessMessage,
    setShowSchemaMapper,
  };

  return (
    <FilesContext.Provider value={value}>{children}</FilesContext.Provider>
  );
};

export const useFilesContext = (): FilesContextType => {
  const context = useContext(FilesContext);
  if (context === undefined) {
    throw new Error("useFilesContext must be used within a FilesProvider");
  }
  return context;
};
