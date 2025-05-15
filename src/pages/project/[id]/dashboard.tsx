import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import DashboardLayout from "../../../../components/layouts/DashboardLayout";
import HistoryPane from "../../../../components/panels/HistoryPane";
import FilesPane from "../../../../components/panels/FilesPane";
import SchemaManagementPane from "../../../../components/panels/SchemaManagementPane";
import QueryResultsPane from "../../../../components/panels/QueryResultsPane";
import ChatInputPane from "../../../../components/panels/ChatInputPane";

interface Query {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectDashboard: React.FC = () => {
  const router = useRouter();
  const { id: projectId, schemaCreated, fileMapped } = router.query;
  const { data: session, status } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<Query | undefined>(
    undefined
  );
  const [selectedFileId, setSelectedFileId] = useState<string | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Handle success messages from URL parameters
  useEffect(() => {
    if (schemaCreated === "true") {
      setSuccessMessage(
        "Schema created successfully! Your file has been mapped to the schema."
      );

      // Remove the query parameter to prevent showing the message on refresh
      const { pathname } = router;
      router.replace(pathname, undefined, { shallow: true });

      // Clear the message after a few seconds
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }

    if (fileMapped === "true") {
      setSuccessMessage("File successfully mapped to schema!");

      // Remove the query parameter to prevent showing the message on refresh
      const { pathname } = router;
      router.replace(pathname, undefined, { shallow: true });

      // Clear the message after a few seconds
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [schemaCreated, fileMapped, router]);

  // Fetch project data
  useEffect(() => {
    const fetchProject = async () => {
      if (status !== "authenticated" || !projectId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch project");
        }

        const data = await response.json();
        setProject(data.project);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId, status]);

  // Handle query selection
  const handleQuerySelect = (query: Query) => {
    setSelectedQuery(query);
  };

  // Handle file selection
  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId);
  };

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
        pageSize: options?.pageSize || 10,
        fileId: selectedFileId,
        projectId: projectId, // Include project ID in the query
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

    (async () => {
      try {
        const queryOptions = {
          page,
          pageSize: 10,
          fileId: selectedFileId,
          projectId: projectId, // Include project ID in the query
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

    (async () => {
      try {
        const queryOptions = {
          page: 1,
          pageSize: 10,
          sortColumn: column,
          sortDirection: direction,
          fileId: selectedFileId,
          projectId: projectId, // Include project ID in the query
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

    (async () => {
      try {
        const queryOptions = {
          page: 1,
          pageSize: 10,
          filters,
          fileId: selectedFileId,
          projectId: projectId, // Include project ID in the query
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

  if (status === "loading" || (isLoading && !project)) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  // Add project name to the title in the header
  const headerTitle = project ? `${project.name} - Dashboard` : "Dashboard";

  return (
    <>
      {/* Success message toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-md flex items-center">
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
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-4 text-green-700 hover:text-green-900"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      )}

      <DashboardLayout
        historyPane={
          <HistoryPane
            onSelect={handleQuerySelect}
            selectedQueryId={selectedQuery?.id}
            projectId={projectId as string}
          />
        }
        filesPane={
          <FilesPane
            onSelectFile={handleFileSelect}
            selectedFileId={selectedFileId}
            projectId={projectId as string}
          />
        }
        schemaManagementPane={
          <SchemaManagementPane
            onSchemaChange={(schema) => {
              // If a schema is selected, show a success message
              if (schema) {
                setSuccessMessage(`Schema "${schema.name}" is now active.`);

                // Clear the message after a few seconds
                setTimeout(() => {
                  setSuccessMessage(null);
                }, 5000);
              }
            }}
          />
        }
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
            // Note: We'll need to update QueryResultsPane component to include project context
          />
        }
        chatInputPane={
          <ChatInputPane
            onSubmit={handleSubmit}
            isLoading={isLoading}
            selectedFileId={selectedFileId}
            // Note: We'll need to update ChatInputPane component to include project context
          />
        }
      />
    </>
  );
};

export default ProjectDashboard;
