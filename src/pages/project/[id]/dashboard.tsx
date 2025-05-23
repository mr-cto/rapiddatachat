import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import ImprovedDashboardLayout from "../../../../components/layouts/ImprovedDashboardLayout";
import HistoryPane from "../../../../components/panels/HistoryPane";
import FilesPane from "../../../../components/panels/FilesPane";
import ColumnManagementPane from "../../../../components/panels/ColumnManagementPane";
import ImprovedQueryResultsPane from "../../../../components/panels/ImprovedQueryResultsPane";
import ImprovedChatInputPane from "../../../../components/panels/ImprovedChatInputPane";
import { Button } from "../../../../components/ui";
import ErrorBoundary from "../../../../components/ErrorBoundary";

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

// Use named function instead of arrow function for better HMR support
function ProjectDashboard(): React.ReactElement {
  console.log("Dashboard rendering started");

  const router = useRouter();
  console.log("Router state:", {
    isReady: router.isReady,
    pathname: router.pathname,
    query: router.query,
  });

  const { data: session, status } = useSession();
  console.log("Session state:", { status, userId: session?.user?.id });

  // Safely access router.query values with proper type handling
  // Only access router.query when router is ready to prevent HMR issues
  const projectId = router.isReady
    ? (router.query.id as string | undefined)
    : undefined;
  const columnCreated = router.isReady
    ? (router.query.columnCreated as string | undefined)
    : undefined;
  const fileMapped = router.isReady
    ? (router.query.fileMapped as string | undefined)
    : undefined;

  console.log("Extracted query params:", {
    projectId,
    columnCreated,
    fileMapped,
  });
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
    // Only run this effect when authentication status is determined
    if (status === "loading") return;

    // Check authentication status
    if (status === "unauthenticated") {
      router
        .push("/auth/signin")
        .catch((err) => console.error("Failed to redirect to signin:", err));
    } else if (status === "authenticated" && router.isReady && !projectId) {
      // If authenticated but no project ID, redirect to projects page
      router
        .push("/project")
        .catch((err) =>
          console.error("Failed to redirect to projects page:", err)
        );
    }
  }, [status, router, projectId, router.isReady]);

  // Handle success messages from URL parameters
  useEffect(() => {
    // Only run this effect when router is ready and query params are available
    if (!router.isReady) return;

    if (columnCreated === "true") {
      setSuccessMessage(
        "Column created successfully! Your file has been mapped to the column."
      );

      // Remove the query parameter to prevent showing the message on refresh
      try {
        const { pathname } = router;
        router
          .replace(pathname, undefined, { shallow: true })
          .catch((err) => console.error("Failed to update URL:", err));
      } catch (err) {
        console.error("Error updating URL:", err);
      }

      // Clear the message after a few seconds
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }

    if (fileMapped === "true") {
      setSuccessMessage("File successfully mapped to column!");

      // Remove the query parameter to prevent showing the message on refresh
      try {
        const { pathname } = router;
        router
          .replace(pathname, undefined, { shallow: true })
          .catch((err) => console.error("Failed to update URL:", err));
      } catch (err) {
        console.error("Error updating URL:", err);
      }

      // Clear the message after a few seconds
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [columnCreated, fileMapped, router, router.isReady]);

  // Fetch project data
  useEffect(() => {
    // Only run this effect when router is ready and we have a projectId
    if (!router.isReady || status !== "authenticated" || !projectId) return;

    const fetchProject = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/projects/${projectId}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to fetch project: ${response.status}`
          );
        }

        const data = await response.json();

        if (!data.project) {
          throw new Error("Project not found or invalid response format");
        }

        setProject(data.project);
      } catch (err) {
        console.error("Error fetching project:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId, status, router.isReady]);

  // Add error recovery mechanism for database connectivity issues
  useEffect(() => {
    // Only run this effect when there's an error and we have a projectId
    if (error && projectId && router.isReady) {
      console.log("Setting up error recovery for:", error);

      // Set up an auto-retry mechanism
      const timer = setTimeout(() => {
        console.log("Attempting to recover from error...");

        // Force a refresh of the data
        const fetchProject = async () => {
          try {
            setIsLoading(true);

            // First try to fetch the project data
            const response = await fetch(`/api/projects/${projectId}`);

            if (response.ok) {
              const data = await response.json();
              if (data.project) {
                setProject(data.project);
                setError(null); // Clear the error if successful
              }
            }
          } catch (err) {
            // Silent catch - we'll retry again
            console.log("Recovery attempt failed, will retry again");
          } finally {
            setIsLoading(false);
          }
        };

        fetchProject();
      }, 3000); // Retry every 3 seconds

      return () => clearTimeout(timer);
    }
  }, [error, projectId, router.isReady]);

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
    if (
      selectedQuery &&
      selectedQuery.text &&
      selectedQuery.text !== currentQuery
    ) {
      setCurrentQuery(selectedQuery.text);
      // Only submit if we have a valid query text
      if (selectedQuery.text.trim()) {
        handleSubmit(selectedQuery.text);
      }
    }
  }, [selectedQuery, currentQuery]);

  // Show loading state while checking authentication or loading project
  if (status === "loading" || (isLoading && !project)) {
    return (
      <div className="min-h-screen flex flex-col bg-ui-primary">
        <header className="flex justify-between items-center px-6 h-16 border-b border-ui-border bg-ui-primary shadow-md">
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-bold text-accent-primary hover:text-accent-primary-hover transition-colors">
              RapidDataChat
            </h1>
          </div>
        </header>
        <div className="flex-1 flex justify-center items-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto"></div>
            <p className="mt-4 text-gray-300 font-medium">
              Loading project dashboard...
            </p>
            {projectId && (
              <p className="mt-2 text-gray-400 text-sm">
                Project ID: {projectId}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if there was an error loading the project
  if (error && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-ui-primary">
        <header className="flex justify-between items-center px-6 h-16 border-b border-ui-border bg-ui-primary shadow-md">
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-bold text-accent-primary hover:text-accent-primary-hover transition-colors">
              RapidDataChat
            </h1>
            <Button
              onClick={() => router.push("/project")}
              variant="secondary"
              size="sm"
              className="flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Back to Projects
            </Button>
          </div>
        </header>
        <div className="flex-1 flex justify-center items-center">
          <div className="text-center max-w-md p-6 bg-ui-secondary border border-ui-border rounded-lg shadow-lg">
            <svg
              className="w-16 h-16 text-red-500 mx-auto mb-4"
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
            <h2 className="text-xl font-bold text-gray-300 mb-2">
              Error Loading Project
            </h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  router.reload();
                }}
                variant="primary"
              >
                Try Again
              </Button>
              <Button onClick={() => router.push("/project")} variant="outline">
                Go to Projects
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Add project name to the title in the header
  const headerTitle = project ? `${project.name} - Dashboard` : "Dashboard";

  // Wrap the entire render in a try/catch as an additional safety measure
  try {
    console.log("About to render dashboard component");

    // Add an additional check to ensure we don't render with incomplete data
    if (!router.isReady) {
      console.log("Router not ready yet, showing loading state");
      return (
        <div className="min-h-screen flex flex-col bg-ui-primary">
          <header className="flex justify-between items-center px-6 h-16 border-b border-ui-border bg-ui-primary shadow-md">
            <div className="flex items-center space-x-6">
              <h1 className="text-xl font-bold text-accent-primary hover:text-accent-primary-hover transition-colors">
                RapidDataChat
              </h1>
            </div>
          </header>
          <div className="flex-1 flex justify-center items-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto"></div>
              <p className="mt-4 text-gray-300 font-medium">
                Initializing dashboard...
              </p>
              <p className="mt-2 text-gray-400 text-sm">
                Please wait while we load your project data
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <ErrorBoundary>
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

        <ImprovedDashboardLayout
          projectName={project?.name}
          historyPane={
            projectId ? (
              <HistoryPane
                onSelect={handleQuerySelect}
                selectedQueryId={selectedQuery?.id}
                projectId={projectId}
              />
            ) : (
              <div className="p-4 text-gray-400">Loading history...</div>
            )
          }
          filesPane={
            projectId ? (
              <FilesPane
                onSelectFile={handleFileSelect}
                selectedFileId={selectedFileId}
                projectId={projectId}
              />
            ) : (
              <div className="p-4 text-gray-400">Loading files...</div>
            )
          }
          columnManagementPane={
            <ColumnManagementPane
              onColumnChange={(column) => {
                // If a column is selected, show a success message
                if (column) {
                  setSuccessMessage(`Column "${column.name}" is now active.`);

                  // Clear the message after a few seconds
                  setTimeout(() => {
                    setSuccessMessage(null);
                  }, 5000);
                }
              }}
            />
          }
          queryResultsPane={
            <ImprovedQueryResultsPane
              isLoading={isLoading}
              error={error}
              result={result}
              currentQuery={currentQuery}
              onPageChange={handlePageChange}
              onSortChange={handleSortChange}
              onApplyFilters={handleApplyFilters}
              onColumnMergesChange={handleColumnMergesChange}
              userId={session?.user?.id}
            />
          }
          chatInputPane={
            <ImprovedChatInputPane
              onSubmit={handleSubmit}
              isLoading={isLoading}
              selectedFileId={selectedFileId}
            />
          }
        />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error("Error rendering dashboard:", error);
    return (
      <div className="min-h-screen flex flex-col bg-ui-primary">
        <header className="flex justify-between items-center px-6 h-16 border-b border-ui-border bg-ui-primary shadow-md">
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-bold text-accent-primary hover:text-accent-primary-hover transition-colors">
              RapidDataChat
            </h1>
          </div>
        </header>
        <div className="flex-1 flex justify-center items-center">
          <div className="text-center max-w-md p-6 bg-ui-secondary border border-ui-border rounded-lg shadow-lg">
            <svg
              className="w-16 h-16 text-red-500 mx-auto mb-4"
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
            <h2 className="text-xl font-bold text-gray-300 mb-2">
              Dashboard Error
            </h2>
            <p className="text-gray-400 mb-4">
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred"}
            </p>
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Reload Page
              </Button>
              <Button onClick={() => router.push("/project")} variant="outline">
                Go to Projects
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

// Export the component directly with ErrorBoundary to simplify HMR
export default function DashboardWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <ProjectDashboard />
    </ErrorBoundary>
  );
}
