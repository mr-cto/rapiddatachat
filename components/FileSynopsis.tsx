import React, { useState, useEffect } from "react";
import { FixedSizeList as List } from "react-window";
import { useSession } from "next-auth/react";

// Define the column type
interface Column {
  name: string;
  type: string;
}

// Define the synopsis data type
interface SynopsisData {
  fileId: string;
  filename: string;
  rows: number;
  columnCount: number;
  columns: Column[];
  format: string;
  uploadedAt: string;
  ingestedAt: string;
}

// Props for the FileSynopsis component
interface FileSynopsisProps {
  fileId: string;
}

const FileSynopsis: React.FC<FileSynopsisProps> = ({ fileId }) => {
  // State for the synopsis data
  const [synopsis, setSynopsis] = useState<SynopsisData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Get the session for authentication
  const { data: session } = useSession();

  // Fetch the synopsis data
  useEffect(() => {
    const fetchSynopsis = async () => {
      if (!fileId || !session) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/file-synopsis/${fileId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch file synopsis");
        }

        const data = await response.json();
        setSynopsis(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        console.error("Error fetching file synopsis:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSynopsis();
  }, [fileId, session]);

  // Truncate long column names
  const truncateColumnName = (name: string, maxLength: number = 40) => {
    if (name.length <= maxLength) return name;
    return `${name.substring(0, maxLength - 3)}...`;
  };

  // Render a column row for the virtualized list
  const ColumnRow = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    if (!synopsis) return null;

    const column = synopsis.columns[index];

    return (
      <div
        style={style}
        className={`flex justify-between px-4 py-2 ${
          index % 2 === 0
            ? "bg-ui-secondary dark:bg-ui-secondary"
            : "bg-ui-primary dark:bg-ui-primary"
        }`}
      >
        <div
          className="font-medium text-secondary dark:text-secondary"
          title={column.name}
        >
          {truncateColumnName(column.name)}
        </div>
        <div className="text-tertiary dark:text-tertiary">{column.type}</div>
      </div>
    );
  };

  // Show loading state
  if (loading) {
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
          Error loading file synopsis
        </div>
        <div className="text-secondary dark:text-secondary mt-1">{error}</div>
      </div>
    );
  }

  // Show empty state
  if (!synopsis) {
    return (
      <div className="p-4 bg-ui-primary dark:bg-ui-primary rounded-lg shadow">
        <div className="text-tertiary dark:text-tertiary">
          No synopsis data available
        </div>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  // Main component render
  return (
    <div className="bg-ui-primary dark:bg-ui-primary rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-black dark:text-black">
          {synopsis.filename}
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <span className="text-tertiary dark:text-tertiary text-sm">
              Format:
            </span>
            <span className="ml-2 text-secondary dark:text-secondary font-medium uppercase">
              {synopsis.format}
            </span>
          </div>
          <div>
            <span className="text-tertiary dark:text-tertiary text-sm">
              Rows:
            </span>
            <span className="ml-2 text-secondary dark:text-secondary font-medium">
              {synopsis.rows.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-tertiary dark:text-tertiary text-sm">
              Columns:
            </span>
            <span className="ml-2 text-secondary dark:text-secondary font-medium">
              {synopsis.columnCount}
            </span>
          </div>
          <div>
            <span className="text-tertiary dark:text-tertiary text-sm">
              Ingested:
            </span>
            <span className="ml-2 text-secondary dark:text-secondary text-sm">
              {formatDate(synopsis.ingestedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Column list header */}
      <div className="flex justify-between px-4 py-2 bg-ui-secondary dark:bg-ui-secondary border-b border-gray-200 dark:border-gray-700">
        <div className="font-semibold text-secondary dark:text-secondary">
          Column Name
        </div>
        <div className="font-semibold text-secondary dark:text-secondary">
          Data Type
        </div>
      </div>

      {/* Virtualized column list */}
      <div className="h-64">
        {synopsis.columns.length > 0 ? (
          <List
            height={256} // 64 * 4 = 256px
            itemCount={synopsis.columns.length}
            itemSize={36} // Height of each row
            width="100%"
          >
            {ColumnRow}
          </List>
        ) : (
          <div className="p-4 text-center text-tertiary dark:text-tertiary">
            No columns found
          </div>
        )}
      </div>
    </div>
  );
};

export default FileSynopsis;
