import React, { useState } from "react";
import { useSession } from "next-auth/react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import HistoryPane from "../../components/panels/HistoryPane";
import ChatPane from "../../components/panels/ChatPane";
import FilesPane from "../../components/panels/FilesPane";
import SchemaManagementPane from "../../components/panels/SchemaManagementPane";
import QueryResultsPane from "../../components/panels/QueryResultsPane";
import ChatInputPane from "../../components/panels/ChatInputPane";

interface Query {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
}

const IndexPage: React.FC = () => {
  const { data: session } = useSession();
  const [selectedQuery, setSelectedQuery] = useState<Query | undefined>(
    undefined
  );
  const [selectedFileId, setSelectedFileId] = useState<string | undefined>(
    undefined
  );

  // Handle query selection
  const handleQuerySelect = (query: Query) => {
    setSelectedQuery(query);
  };

  // Handle file selection
  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  // We don't need a ChatPane reference anymore since we're handling state directly
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    sqlQuery: string;
    explanation: string;
    results: Record<string, unknown>[];
    executionTime?: number;
    totalRows?: number;
    totalPages?: number;
    currentPage?: number;
    columnMerges?: {
      id: string;
      mergeName: string;
      columnList: string[];
      delimiter: string;
    }[];
  } | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string>("");

  // Handle query submission
  const handleSubmit = async (
    query: string,
    options?: { pageSize?: number }
  ) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setCurrentQuery(query);

    try {
      const queryOptions = {
        page: 1,
        pageSize: options?.pageSize || 10, // Limit to 10 results per page
        fileId: selectedFileId,
      };

      const response = await fetch("/api/nl-to-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          ...queryOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process query");
      }

      if (data.error) {
        setError(data.error);
      } else {
        setResult({
          sqlQuery: data.sqlQuery,
          explanation: data.explanation,
          results: data.results,
          executionTime: data.executionTime,
          totalRows: data.totalRows,
          totalPages: data.totalPages,
          currentPage: data.currentPage,
          columnMerges: data.columnMerges || [],
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (!currentQuery) return;

    setIsLoading(true);

    // Remove timeout for quicker pagination
    (async () => {
      try {
        const queryOptions = {
          page,
          pageSize: 10, // Limit to 10 results per page
          fileId: selectedFileId,
        };

        const response = await fetch("/api/nl-to-sql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: currentQuery,
            ...queryOptions,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to process query");
        }

        if (data.error) {
          setError(data.error);
        } else {
          setResult({
            sqlQuery: data.sqlQuery,
            explanation: data.explanation,
            results: data.results,
            executionTime: data.executionTime,
            totalRows: data.totalRows,
            totalPages: data.totalPages,
            currentPage: data.currentPage,
            columnMerges: data.columnMerges || result?.columnMerges || [],
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    })();
  };

  // Handle sort change
  const handleSortChange = (column: string, direction: "asc" | "desc") => {
    if (!currentQuery) return;

    setIsLoading(true);

    // Remove timeout for quicker sorting
    (async () => {
      try {
        const queryOptions = {
          page: 1,
          pageSize: 10, // Limit to 10 results per page
          sortColumn: column,
          sortDirection: direction,
          fileId: selectedFileId,
        };

        const response = await fetch("/api/nl-to-sql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: currentQuery,
            ...queryOptions,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to process query");
        }

        if (data.error) {
          setError(data.error);
        } else {
          setResult({
            sqlQuery: data.sqlQuery,
            explanation: data.explanation,
            results: data.results,
            executionTime: data.executionTime,
            totalRows: data.totalRows,
            totalPages: data.totalPages,
            currentPage: data.currentPage || 1,
            columnMerges: data.columnMerges || result?.columnMerges || [],
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    })();
  };

  // Handle applying filters
  const handleApplyFilters = (filters: Record<string, unknown>) => {
    if (!currentQuery) return;

    setIsLoading(true);

    // Remove timeout for quicker filtering
    (async () => {
      try {
        const queryOptions = {
          page: 1,
          pageSize: 10, // Limit to 10 results per page
          filters,
          fileId: selectedFileId,
        };

        const response = await fetch("/api/nl-to-sql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: currentQuery,
            ...queryOptions,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to process query");
        }

        if (data.error) {
          setError(data.error);
        } else {
          setResult({
            sqlQuery: data.sqlQuery,
            explanation: data.explanation,
            results: data.results,
            executionTime: data.executionTime,
            totalRows: data.totalRows,
            totalPages: data.totalPages,
            currentPage: data.currentPage || 1,
            columnMerges: data.columnMerges || result?.columnMerges || [],
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    })();
  };

  // Handle column merges change
  const handleColumnMergesChange = (
    columnMerges: {
      id: string;
      mergeName: string;
      columnList: string[];
      delimiter: string;
    }[]
  ) => {
    if (result) {
      setResult({
        ...result,
        columnMerges,
      });
    }
  };

  // Use the selected query if provided
  React.useEffect(() => {
    if (selectedQuery && selectedQuery.text !== currentQuery) {
      setCurrentQuery(selectedQuery.text);
      handleSubmit(selectedQuery.text);
    }
  }, [selectedQuery]);

  return (
    <DashboardLayout
      historyPane={
        <HistoryPane
          onSelect={handleQuerySelect}
          selectedQueryId={selectedQuery?.id}
        />
      }
      filesPane={
        <FilesPane
          onSelectFile={handleFileSelect}
          selectedFileId={selectedFileId}
        />
      }
      schemaManagementPane={<SchemaManagementPane />}
      queryResultsPane={
        <QueryResultsPane
          isLoading={isLoading}
          error={error}
          result={result}
          currentQuery={currentQuery}
          onPageChange={handlePageChange}
          onSortChange={handleSortChange}
          onApplyFilters={handleApplyFilters}
          onColumnMergesChange={handleColumnMergesChange}
        />
      }
      chatInputPane={
        <ChatInputPane
          onSubmit={handleSubmit}
          isLoading={isLoading}
          selectedFileId={selectedFileId}
        />
      }
    />
  );
};

export default IndexPage;
