import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FaFile } from "react-icons/fa";
import FileList from "../FileList";
import FileUpload from "../FileUpload";
import SchemaColumnMapper from "../SchemaColumnMapper";

interface FileData {
  id: string;
  filename: string;
  uploadedAt: string;
  ingestedAt: string | null;
  sizeBytes: number;
  format: string | null;
  status: string;
  metadata: Record<string, unknown>;
  _count: {
    fileErrors: number;
  };
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface Sorting {
  column: string;
  direction: "asc" | "desc";
}

interface FilesPaneProps {
  onSelectFile: (fileId: string) => void;
  selectedFileId?: string;
}

const FilesPane: React.FC<FilesPaneProps> = ({
  onSelectFile,
  selectedFileId,
}) => {
  const { data: session } = useSession();
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showSchemaMapper, setShowSchemaMapper] = useState<boolean>(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileColumns, setUploadedFileColumns] = useState<string[]>([]);

  // Pagination and sorting state
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 0,
  });

  const [sorting, setSorting] = useState<Sorting>({
    column: "uploadedAt",
    direction: "desc",
  });

  // Fetch files
  const fetchFiles = async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        sortBy: sorting.column,
        sortDirection: sorting.direction,
      });

      const response = await fetch(`/api/files?${queryParams}`);

      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const data = await response.json();
      setFiles(data.files || []);
      setPagination({
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalCount: data.pagination.totalCount,
        totalPages: data.pagination.totalPages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching files:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch files on component mount and when pagination/sorting changes
  useEffect(() => {
    fetchFiles();
  }, [session, pagination.page, pagination.pageSize, sorting]);

  // Handle file upload
  const handleFilesSelected = async (uploadedFiles: File[]) => {
    if (uploadedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Create FormData object
      const formData = new FormData();
      uploadedFiles.forEach((file) => {
        formData.append("file", file);
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          // Increase progress by random amount between 5-15%
          const increment = Math.random() * 10 + 5;
          return Math.min(prev + increment, 95);
        });
      }, 500);

      // Send the files to the API
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      setUploadProgress(100);

      // Get the response data
      const responseData = await response.json();

      // Get the first uploaded file ID
      if (responseData.files && responseData.files.length > 0) {
        const fileId = responseData.files[0].id;
        setUploadedFileId(fileId);

        // Fetch file columns for schema mapping
        try {
          const fileDataResponse = await fetch(`/api/file-data/${fileId}`);
          if (fileDataResponse.ok) {
            const fileData = await fileDataResponse.json();
            if (fileData.columns && fileData.columns.length > 0) {
              setUploadedFileColumns(fileData.columns);

              // Show schema mapping modal
              setTimeout(() => {
                setShowSchemaMapper(true);
              }, 1000);
            }
          }
        } catch (columnErr) {
          console.error("Error fetching file columns:", columnErr);
        }
      }

      // Refresh the file list
      fetchFiles();

      // Reset the upload form after successful upload
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle sort change
  const handleSort = (column: string) => {
    setSorting((prev) => ({
      column,
      direction:
        prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({
      ...prev,
      page,
    }));
  };

  // Handle page size change
  const handlePageSizeChange = (pageSize: number) => {
    setPagination((prev) => ({
      ...prev,
      page: 1, // Reset to first page when changing page size
      pageSize,
    }));
  };

  // Handle file deletion
  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      // Refresh the file list
      fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="h-[50vh] flex flex-col">
      <div className="p-2 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-md font-semibold flex items-center text-black dark:text-black">
            <FaFile className="mr-1" /> Files
          </h2>
        </div>

        <div className="mt-2 mb-2 p-2 border rounded-md bg-gray-50">
          <FileUpload
            onFilesSelected={handleFilesSelected}
            multiple
            uploading={uploading}
            progress={uploadProgress}
          />
        </div>

        {error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-xs">{error}</p>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-1">
        <FileList
          files={files}
          onDelete={handleDeleteFile}
          onRefresh={fetchFiles}
          loading={loading}
        />
      </div>

      {/* Schema Column Mapper Modal */}
      {showSchemaMapper && uploadedFileId && (
        <SchemaColumnMapper
          isOpen={showSchemaMapper}
          onClose={() => setShowSchemaMapper(false)}
          fileId={uploadedFileId}
          fileColumns={uploadedFileColumns}
          userId={session?.user?.email || session?.user?.id || ""}
          onMappingComplete={() => {
            setShowSchemaMapper(false);
            setUploadedFileId(null);
            setUploadedFileColumns([]);
          }}
        />
      )}
    </div>
  );
};

export default FilesPane;
