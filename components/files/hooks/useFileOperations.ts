import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import { fileEventBus } from "../../../lib/events/FileEventBus";

interface UseFileOperationsProps {
  fetchFiles: () => Promise<void>;
  selectedFileId?: string;
  onSelectFile: (fileId: string) => void;
  onFileCountChange?: (count: number) => void;
}

export const useFileOperations = ({
  fetchFiles,
  selectedFileId,
  onSelectFile,
  onFileCountChange,
}: UseFileOperationsProps) => {
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null
  );
  const [retryingFiles, setRetryingFiles] = useState<Record<string, boolean>>(
    {}
  );
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fileDetailsModalOpen, setFileDetailsModalOpen] =
    useState<boolean>(false);
  const [selectedFileDetails, setSelectedFileDetails] = useState<string | null>(
    null
  );
  const [updatingLargeFiles, setUpdatingLargeFiles] = useState<boolean>(false);

  const router = useRouter();

  // Handle file deletion
  const handleDeleteFile = async (fileId: string) => {
    try {
      // Publish delete started event
      fileEventBus.publish({
        type: "file:delete:started",
        fileId,
      });

      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      // If the deleted file is the currently selected file, reset the selection
      if (selectedFileId === fileId) {
        // Call onSelectFile with empty string to reset the datatable
        onSelectFile("");
      }

      // Refresh the file list after deletion
      fetchFiles();
      setDeleteConfirmation(null);

      // Show success message
      setSuccessMessage("File successfully deleted");

      // Publish delete completed event
      fileEventBus.publish({
        type: "file:delete:completed",
        fileId,
      });

      // Check if this was the last file and notify parent
      if (onFileCountChange) {
        // We don't know the exact count here, but we'll let fetchFiles update it
        // This is just to trigger a UI update
        onFileCountChange(-1);
      }
    } catch (err) {
      console.error("Error deleting file:", err);
      setRetryErrors((prev) => ({
        ...prev,
        [fileId]: err instanceof Error ? err.message : "Delete failed",
      }));

      // Publish error event
      fileEventBus.publish({
        type: "file:error",
        fileId,
        error: err instanceof Error ? err : new Error("Delete failed"),
        data: { stage: "delete" },
      });
    }
  };

  // Handle delete click
  const handleDeleteClick = (fileId: string) => {
    setDeleteConfirmation(fileId);
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  // View file details
  const onViewFileDetails = (fileId: string) => {
    setSelectedFileDetails(fileId);
    setFileDetailsModalOpen(true);
  };

  // Close file details modal
  const closeFileDetailsModal = () => {
    setFileDetailsModalOpen(false);
    setSelectedFileDetails(null);
  };

  // Retry file ingestion
  const retryFileIngestion = async (fileId: string) => {
    try {
      setRetryingFiles((prev) => ({ ...prev, [fileId]: true }));
      setRetryErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fileId];
        return newErrors;
      });
      setSuccessMessage(null);

      const response = await fetch("/api/retry-file-ingestion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            errorData.details ||
            "Failed to retry file ingestion"
        );
      }

      const data = await response.json();
      setSuccessMessage(data.message || "File ingestion retried successfully!");

      // Refresh the file list after successful retry
      fetchFiles();
    } catch (error) {
      console.error(`Error retrying file ingestion for ${fileId}:`, error);
      setRetryErrors((prev) => ({
        ...prev,
        [fileId]: error instanceof Error ? error.message : "Unknown error",
      }));
    } finally {
      setRetryingFiles((prev) => ({ ...prev, [fileId]: false }));
    }
  };

  // Update large files status
  const updateLargeFilesStatus = async () => {
    try {
      setUpdatingLargeFiles(true);
      setSuccessMessage(null);

      const response = await fetch("/api/update-large-files-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            errorData.details ||
            "Failed to update large files status"
        );
      }

      const data = await response.json();
      setSuccessMessage(
        data.message || "Large files status updated successfully!"
      );

      // Refresh the file list after successful update
      fetchFiles();
    } catch (error) {
      console.error("Error updating large files status:", error);
      throw error;
    } finally {
      setUpdatingLargeFiles(false);
    }
  };

  // View file synopsis
  const viewSynopsis = useCallback(
    (fileId: string) => {
      router.push({
        pathname: "/file/[id]",
        query: { id: fileId },
      });
    },
    [router]
  );

  return {
    deleteConfirmation,
    retryingFiles,
    retryErrors,
    successMessage,
    fileDetailsModalOpen,
    selectedFileDetails,
    updatingLargeFiles,
    handleDeleteFile,
    handleDeleteClick,
    cancelDelete,
    onViewFileDetails,
    closeFileDetailsModal,
    retryFileIngestion,
    updateLargeFilesStatus,
    viewSynopsis,
    setSuccessMessage,
  };
};
