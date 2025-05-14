import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ColumnMergeManager } from "./ColumnMergeManager";

interface FileRawDataProps {
  fileId: string;
}

interface PaginatedData {
  fileId: string;
  data: Record<string, unknown>[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  sortBy?: string;
  sortDirection?: string;
  filterColumn?: string;
  filterValue?: string;
  dbOperationsSkipped?: boolean;
  message?: string;
}

const FileRawData: React.FC<FileRawDataProps> = ({ fileId }) => {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterColumn, setFilterColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRows, setTotalRows] = useState<number>(0);

  // Get the session for authentication
  const { data: session } = useSession();

  // Fetch the file data
  useEffect(() => {
    const fetchData = async () => {
      if (!fileId || !session) return;

      setLoading(true);
      setError(null);

      try {
        // Build the query URL with all parameters
        let url = `/api/file-data/${fileId}?page=${page}&pageSize=${pageSize}`;

        if (sortBy) {
          url += `&sortBy=${encodeURIComponent(
            sortBy
          )}&sortDirection=${sortDirection}`;
        }

        if (filterColumn && filterValue) {
          url += `&filterColumn=${encodeURIComponent(
            filterColumn
          )}&filterValue=${encodeURIComponent(filterValue)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch file data");
        }

        const responseData = await response.json();
        setData(responseData.data || []);
        setTotalPages(responseData.totalPages || 1);
        setTotalRows(responseData.totalRows || 0);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        console.error("Error fetching file data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    fileId,
    session,
    page,
    pageSize,
    sortBy,
    sortDirection,
    filterColumn,
    filterValue,
  ]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Handle sort change
  const handleSortChange = (column: string, direction: "asc" | "desc") => {
    setSortBy(column);
    setSortDirection(direction);
    setPage(1); // Reset to first page when changing sort
  };

  // Initial loading state
  if (loading && data.length === 0) {
    return (
      <div className="p-4 bg-ui-primary dark:bg-ui-primary rounded-lg shadow">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-4 bg-ui-primary dark:bg-ui-primary rounded-lg shadow border border-red-200 dark:border-red-800">
        <div className="text-red-500 dark:text-red-400 font-medium">
          Error loading file data
        </div>
        <div className="text-secondary dark:text-secondary mt-1">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <ColumnMergeManager
        fileId={fileId}
        data={data}
        onSortChange={handleSortChange}
        initialSortColumn={sortBy}
        initialSortDirection={sortDirection}
        onPageChange={handlePageChange}
        currentPage={page}
        totalPages={totalPages}
        totalRows={totalRows}
        serverSideSort={true}
        className="w-full"
      />
    </div>
  );
};

export default FileRawData;
