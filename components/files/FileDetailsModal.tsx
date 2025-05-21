import React, { useState, useEffect } from "react";
import { Button } from "../ui";
import { useFilesContext } from "./context/FilesContext";
import { formatFileSize, getStatusBadgeColor } from "./utils";

interface FileDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
}

const FileDetailsModal: React.FC<FileDetailsModalProps> = ({
  isOpen,
  onClose,
  fileId,
}) => {
  const { retryFileIngestion, retryingFiles } = useFilesContext();
  const [fileDetailsData, setFileDetailsData] = useState<any>(null);
  const [loadingFileDetails, setLoadingFileDetails] = useState<boolean>(false);

  useEffect(() => {
    const fetchFileDetails = async () => {
      if (!fileId || !isOpen) return;

      try {
        setLoadingFileDetails(true);

        // Fetch file details including errors
        const response = await fetch(`/api/files/${fileId}`);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch file details: ${response.statusText}`
          );
        }

        const data = await response.json();
        // Extract the file data from the response (it's nested under 'file')
        const fileData = data.file;

        if (!fileData) {
          throw new Error("File data not found in response");
        }

        // Fetch file errors if any
        const errorsResponse = await fetch(`/api/files/${fileId}/errors`);
        let errorsData = [];

        if (errorsResponse.ok) {
          const errorsResult = await errorsResponse.json();
          errorsData = errorsResult.errors || [];
        }

        setFileDetailsData({
          ...fileData,
          errors: errorsData,
        });
      } catch (error) {
        console.error("Error fetching file details:", error);
        setFileDetailsData({
          error:
            error instanceof Error
              ? error.message
              : "Failed to load file details",
        });
      } finally {
        setLoadingFileDetails(false);
      }
    };

    fetchFileDetails();
  }, [fileId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-ui-primary border border-ui-border rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-300">File Details</h3>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-300"
          >
            ✕
          </Button>
        </div>

        {loadingFileDetails ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : fileDetailsData?.error ? (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-md">
            <p className="text-red-400">{fileDetailsData.error}</p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-400">Filename</p>
                <p className="text-sm text-gray-300">
                  {fileDetailsData?.filename || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Status</p>
                <p className="text-sm text-gray-300">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                      fileDetailsData?.status || "unknown"
                    )}`}
                  >
                    {fileDetailsData?.status || "Unknown"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Size</p>
                <p className="text-sm text-gray-300">
                  {fileDetailsData?.sizeBytes
                    ? formatFileSize(fileDetailsData.sizeBytes)
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Format</p>
                <p className="text-sm text-gray-300">
                  {fileDetailsData?.format?.toUpperCase() || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Uploaded At</p>
                <p className="text-sm text-gray-300">
                  {fileDetailsData?.uploadedAt
                    ? new Date(fileDetailsData.uploadedAt).toLocaleString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Ingested At</p>
                <p className="text-sm text-gray-300">
                  {fileDetailsData?.ingestedAt
                    ? new Date(fileDetailsData.ingestedAt).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Display errors if any */}
            {fileDetailsData?.status === "error" && (
              <div className="mt-4">
                <h4 className="text-md font-medium text-gray-300 mb-2">
                  Error Details
                </h4>
                {fileDetailsData.activationError && (
                  <div className="p-3 bg-red-900/30 border border-red-800 rounded-md mb-3">
                    <p className="text-sm text-red-400">
                      {fileDetailsData.activationError}
                    </p>
                  </div>
                )}

                {fileDetailsData.errors && fileDetailsData.errors.length > 0 ? (
                  <div className="border border-ui-border rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-ui-border">
                      <thead className="bg-ui-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                            Type
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                            Severity
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                            Message
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">
                            Timestamp
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ui-border">
                        {fileDetailsData.errors.map(
                          (error: any, index: number) => (
                            <tr
                              key={index}
                              className={
                                index % 2 === 0
                                  ? "bg-ui-primary"
                                  : "bg-ui-secondary"
                              }
                            >
                              <td className="px-3 py-2 text-xs text-gray-300">
                                {error.errorType || error.type}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-300">
                                {error.severity}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-300">
                                {error.message}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-300">
                                {error.timestamp
                                  ? new Date(error.timestamp).toLocaleString()
                                  : "N/A"}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 mb-3">
                      No detailed error records found.
                    </p>

                    {/* Display message for large files */}
                    {fileDetailsData.status === "too_large" ? (
                      <div className="p-3 bg-orange-900/30 border border-orange-800 rounded-md">
                        <p className="text-sm text-orange-400 font-medium mb-1">
                          Large File Detected
                        </p>
                        <p className="text-sm text-orange-400">
                          This file is{" "}
                          {formatFileSize(fileDetailsData.sizeBytes)} which is
                          too large for the default batch size. Click the "Retry
                          Ingestion" button below to process it with optimized
                          settings for large files.
                        </p>
                      </div>
                    ) : (
                      fileDetailsData.sizeBytes &&
                      fileDetailsData.sizeBytes > 50 * 1024 * 1024 && (
                        <div className="p-3 bg-yellow-900/30 border border-yellow-800 rounded-md">
                          <p className="text-sm text-yellow-400 font-medium mb-1">
                            Large File Detected
                          </p>
                          <p className="text-sm text-yellow-400">
                            This file is{" "}
                            {formatFileSize(fileDetailsData.sizeBytes)} which
                            may be too large for the default batch size. Click
                            the "Retry Ingestion" button below to process it
                            with optimized settings for large files.
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Display retry button for error or too_large files */}
            {(fileDetailsData?.status === "error" ||
              fileDetailsData?.status === "too_large") &&
              fileId && (
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => {
                      onClose();
                      retryFileIngestion(fileId);
                    }}
                    variant="primary"
                    size="sm"
                    isLoading={retryingFiles[fileId]}
                  >
                    Retry Ingestion
                  </Button>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileDetailsModal;
