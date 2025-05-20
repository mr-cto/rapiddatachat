import { useState, useCallback, useRef, useEffect } from "react";
import { FileData, Pagination, Sorting } from "../types";

interface UseFileListProps {
  projectId?: string;
  isAuthenticated: boolean;
  onFileCountChange?: (count: number) => void;
}

export const useFileList = ({
  projectId,
  isAuthenticated,
  onFileCountChange,
}: UseFileListProps) => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFirstUpload, setIsFirstUpload] = useState<boolean>(false);
  const [hasActiveSchema, setHasActiveSchema] = useState<boolean>(false);

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

  // Track last fetch time to prevent too frequent fetches
  const lastFetchTimeRef = useRef<number>(0);
  const fetchInProgressRef = useRef<boolean>(false);
  const fetchQueuedRef = useRef<boolean>(false);

  // Track if this is the initial mount
  const initialMountRef = useRef(true);

  // Fetch files - memoized with useCallback to prevent unnecessary re-renders
  const fetchFiles = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) return;

    // Prevent fetching too frequently (minimum 2000ms between fetches)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;

    if (timeSinceLastFetch < 2000) {
      // If a fetch is already in progress, queue another one
      if (fetchInProgressRef.current && !fetchQueuedRef.current) {
        fetchQueuedRef.current = true;
        setTimeout(() => {
          fetchQueuedRef.current = false;
          fetchFiles();
        }, 2000 - timeSinceLastFetch);
      }
      return;
    }

    // Set fetch in progress
    fetchInProgressRef.current = true;
    lastFetchTimeRef.current = now;
    console.log("Fetching files...");

    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        sortBy: sorting.column,
        sortDirection: sorting.direction,
      });

      // Always use project-specific endpoint if projectId is provided
      // Otherwise use the general files endpoint
      const endpoint = projectId
        ? `/api/projects/${projectId}/files?${queryParams}`
        : `/api/files?${queryParams}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();

      // Ensure we have a valid files array
      if (data.files && Array.isArray(data.files)) {
        setFiles(data.files);

        // Check if this is the first upload for the project
        const filesEmpty = data.files.length === 0;
        setIsFirstUpload(filesEmpty);

        // If there are files, assume there's a schema
        setHasActiveSchema(!filesEmpty);

        // Notify parent about file count change
        if (onFileCountChange) {
          onFileCountChange(data.files.length);
        }
      } else {
        setFiles([]);
        setIsFirstUpload(true);
        setHasActiveSchema(false);
      }

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
      fetchInProgressRef.current = false;

      // If another fetch was queued while this one was in progress, execute it now
      if (fetchQueuedRef.current) {
        fetchQueuedRef.current = false;
        setTimeout(fetchFiles, 100);
      }
    }
  }, [
    isAuthenticated,
    pagination.page,
    pagination.pageSize,
    sorting,
    projectId,
    onFileCountChange,
  ]);

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

  // Initial fetch on mount only
  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch when pagination or sorting changes, but not on window focus events
  useEffect(() => {
    // Skip the first render since we already fetched in the mount effect
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }

    if (isAuthenticated) {
      fetchFiles();
    }
  }, [
    pagination.page,
    pagination.pageSize,
    sorting,
    fetchFiles,
    isAuthenticated,
  ]);

  return {
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
  };
};
