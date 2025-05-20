import React, { useState, useCallback, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { useStableSession } from "../../lib/hooks/useStableSession";
import { useRouter } from "next/router";
import Image from "next/image";
import { Button, Link, Card, ResizablePanel, ResizablePanelGroup } from "../ui";
import { FaUpload, FaDatabase } from "react-icons/fa";
import ColumnManagementPane from "../panels/ColumnManagementPane";

interface ImprovedDashboardLayoutProps {
  children?: React.ReactNode;
  filesPane?: React.ReactNode;
  queryResultsPane?: React.ReactNode;
  chatInputPane?: React.ReactNode;
  projectName?: string;
}

const ImprovedDashboardLayout: React.FC<ImprovedDashboardLayoutProps> = ({
  children,
  filesPane,
  queryResultsPane,
  chatInputPane,
  projectName,
}) => {
  const { data: session, status, isAuthenticated } = useStableSession();
  const router = useRouter();
  // UI state
  const [sidebarWidth, setSidebarWidth] = useState(400); // Default width (match minWidth)
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [filePreviewData, setFilePreviewData] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [fileCount, setFileCount] = useState<number>(0);

  // Reference to track initial mount
  const initialMountRef = useRef(true);

  // Store sidebar width in localStorage to persist between sessions
  useEffect(() => {
    // Try to get saved width from localStorage
    const savedWidth = localStorage.getItem("sidebarWidth");
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth, 10));
    }

    // Mark that initial render is complete
    setIsInitialRender(false);

    // Add event listener to prevent unnecessary re-renders on window focus
    const handleVisibilityChange = () => {
      // Do nothing - we'll handle updates manually
    };

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Update localStorage when width changes
  const handleSidebarResize = useCallback((width: number) => {
    setSidebarWidth(width);
    localStorage.setItem("sidebarWidth", width.toString());

    // Force update chat input position
    const chatInput = document.querySelector(".chat-input-container");
    if (chatInput) {
      (chatInput as HTMLElement).style.left = `${width}px`;
    }
  }, []);

  // Redirect to sign-in page if not authenticated
  React.useEffect(() => {
    // Always check authentication on initial mount
    if (initialMountRef.current) {
      initialMountRef.current = false;

      // If not authenticated and status is resolved, redirect
      if (!isAuthenticated && status === "unauthenticated") {
        router.push("/auth/signin");
      }
    } else if (document.visibilityState === "visible") {
      // On tab focus, only check if status is explicitly unauthenticated
      if (status === "unauthenticated") {
        router.push("/auth/signin");
      }
    }
  }, [isAuthenticated, status, router]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ui-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary border-r-2 border-r-indigo-300 mx-auto"></div>
          <p className="mt-4 text-gray-300 font-medium">
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Handle sign out
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/auth/signin" });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
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
          {projectName && (
            <div className="text-gray-300 font-medium px-3 py-1 bg-ui-secondary rounded-md">
              {projectName}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {session?.user && (
            <>
              <div className="flex items-center">
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    width={36}
                    height={36}
                    className="rounded-full border-2 border-indigo-100"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-accent-primary flex items-center justify-center text-white shadow-sm">
                    {session.user.name?.charAt(0) ||
                      session.user.email?.charAt(0) ||
                      "U"}
                  </div>
                )}
                <span className="ml-2 text-sm font-medium text-gray-300">
                  {session.user.name || session.user.email}
                </span>
              </div>
              <Button onClick={handleSignOut} variant="outline" size="sm">
                Sign Out
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content with Improved Layout */}
      <div className="flex-1 h-[calc(100vh-4rem)] overflow-hidden">
        <ResizablePanelGroup
          defaultLeftWidth={sidebarWidth}
          minLeftWidth={400}
          maxLeftWidth={1200}
          onResize={handleSidebarResize}
          className="h-full"
        >
          {/* Left Sidebar - History and Tools */}
          <ResizablePanel
            type="left"
            className="bg-ui-primary border-r border-ui-border flex flex-col"
            scrollable={true}
          >
            {/* File Upload and Schema Management Section */}
            <div className="flex flex-col h-full">
              {/* Files Section */}
              <div className="flex flex-col h-1/2">
                <div className="p-3 bg-ui-secondary flex justify-between items-center border-b border-ui-border">
                  <h2 className="text-sm font-semibold text-gray-300 flex items-center">
                    <FaUpload className="mr-2" /> Files
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {React.isValidElement(filesPane)
                    ? React.cloneElement(filesPane as React.ReactElement<any>, {
                        onPreviewParsed: (
                          preview: Record<string, unknown>[]
                        ) => {
                          setFilePreviewData(preview);
                        },
                        onFileCountChange: (count: number) => {
                          setFileCount(count);
                          // Reset file preview data when all files are deleted
                          if (count === 0) {
                            setFilePreviewData(null);
                          }
                        },
                      })
                    : filesPane}
                </div>
              </div>

              {/* Schema Management Section */}
              <div className="flex flex-col h-1/2 border-t border-ui-border">
                <div className="p-3 bg-ui-secondary flex justify-between items-center border-b border-ui-border">
                  <h2 className="text-sm font-semibold text-gray-300 flex items-center">
                    <FaDatabase className="mr-2" /> Schema Management
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <ColumnManagementPane
                    projectId={router.query.id as string}
                    onColumnChange={(schema) => {
                      console.log("Schema selected:", schema?.name);
                    }}
                    refreshTrigger={filePreviewData ? 1 : 0}
                  />
                </div>
              </div>
            </div>
          </ResizablePanel>

          {/* Main Panel - Chat Results + Chat Input */}
          <ResizablePanel
            type="right"
            className="flex flex-col bg-background overflow-hidden"
          >
            {/* Query Results Section - Takes all available space with padding for chat input */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24">
              <div className="max-w-full break-words">
                {/* Pass file preview data to query results pane if available */}
                {React.isValidElement(queryResultsPane) && filePreviewData
                  ? React.cloneElement(
                      queryResultsPane as React.ReactElement<any>,
                      {
                        result:
                          filePreviewData.length > 0
                            ? {
                                sqlQuery: "-- Preview of uploaded file",
                                explanation:
                                  "Showing the first 10 records from the uploaded file.",
                                results: filePreviewData.slice(0, 10), // Ensure we only show 10 records
                                executionTime: 0,
                                totalRows: filePreviewData.length,
                              }
                            : null,
                        isLoading: false,
                        error: null,
                        previewData: filePreviewData,
                        isPreview: true,
                      }
                    )
                  : queryResultsPane || children}
              </div>
            </div>

            {/* Chat Input Section - Fixed at the bottom with dynamic left offset */}
            <div
              className="fixed bottom-0 right-0 bg-ui-primary border-t border-ui-border shadow-lg z-10 p-4 chat-input-container"
              style={{
                left: `${sidebarWidth}px`,
                transition: isInitialRender ? "none" : "all 0s linear",
                width: `calc(100% - ${sidebarWidth}px)`,
              }}
            >
              <div className="w-full overflow-hidden">{chatInputPane}</div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default ImprovedDashboardLayout;
