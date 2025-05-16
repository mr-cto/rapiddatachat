import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import Image from "next/image";
import { Button, Link, Card, ResizablePanel, ResizablePanelGroup } from "../ui";
import {
  FaDatabase,
  FaHistory,
  FaUpload,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

interface ImprovedDashboardLayoutProps {
  children?: React.ReactNode;
  historyPane?: React.ReactNode;
  filesPane?: React.ReactNode;
  columnManagementPane?: React.ReactNode;
  queryResultsPane?: React.ReactNode;
  chatInputPane?: React.ReactNode;
  projectName?: string;
}

const ImprovedDashboardLayout: React.FC<ImprovedDashboardLayoutProps> = ({
  children,
  historyPane,
  filesPane,
  columnManagementPane,
  queryResultsPane,
  chatInputPane,
  projectName,
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  // UI state
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showColumnManagement, setShowColumnManagement] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(400); // Default width (match minWidth)
  const [isInitialRender, setIsInitialRender] = useState(true);

  // Reference to track initial mount
  const initialMountRef = useRef(true);

  // Memoize child components to prevent re-renders when toggling sections
  const memoizedHistoryPane = useMemo(() => historyPane, [historyPane]);
  const memoizedFilesPane = useMemo(() => filesPane, [filesPane]);
  const memoizedColumnManagementPane = useMemo(
    () => columnManagementPane,
    [columnManagementPane]
  );

  // Store sidebar width and panel states in localStorage to persist between sessions
  useEffect(() => {
    // Try to get saved width from localStorage
    const savedWidth = localStorage.getItem("sidebarWidth");
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth, 10));
    }

    // Mark that initial render is complete
    setIsInitialRender(false);

    // Try to get saved panel states from localStorage
    const savedPanelStates = localStorage.getItem("panelStates");
    if (savedPanelStates) {
      try {
        const states = JSON.parse(savedPanelStates);
        if (states.showFileUpload !== undefined)
          setShowFileUpload(states.showFileUpload);
        if (states.showColumnManagement !== undefined)
          setShowColumnManagement(states.showColumnManagement);
        if (states.showHistory !== undefined)
          setShowHistory(states.showHistory);
      } catch (e) {
        // Ignore parsing errors
      }
    }

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

  // Toggle panel visibility and save state to localStorage
  const togglePanel = useCallback(
    (panel: "history" | "files" | "columns") => {
      let newState;
      switch (panel) {
        case "history":
          newState = !showHistory;
          setShowHistory(newState);
          break;
        case "files":
          newState = !showFileUpload;
          setShowFileUpload(newState);
          break;
        case "columns":
          newState = !showColumnManagement;
          setShowColumnManagement(newState);
          break;
      }

      // Save all panel states to localStorage
      const panelStates = {
        showHistory,
        showFileUpload,
        showColumnManagement,
        [panel === "history"
          ? "showHistory"
          : panel === "files"
          ? "showFileUpload"
          : "showColumnManagement"]: newState,
      };
      localStorage.setItem("panelStates", JSON.stringify(panelStates));
    },
    [showHistory, showFileUpload, showColumnManagement]
  );

  // Redirect to sign-in page if not authenticated
  React.useEffect(() => {
    // Skip on window focus events
    if (initialMountRef.current) {
      initialMountRef.current = false;
    } else if (document.visibilityState === "visible") {
      // Don't redirect on tab focus
      return;
    }

    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

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
          maxLeftWidth={800}
          onResize={(leftWidth) => {
            setSidebarWidth(leftWidth);
            localStorage.setItem("sidebarWidth", leftWidth.toString());

            // Force update chat input position
            const chatInput = document.querySelector(".chat-input-container");
            if (chatInput) {
              (chatInput as HTMLElement).style.left = `${leftWidth}px`;
            }
          }}
          className="h-full"
        >
          {/* Left Sidebar - History and Tools */}
          <ResizablePanel
            type="left"
            className="bg-ui-primary border-r border-ui-border flex flex-col"
            scrollable={true}
          >
            {/* History Section with Toggle */}
            <div className="border-b border-ui-border">
              <div
                className="p-3 bg-ui-secondary flex justify-between items-center cursor-pointer"
                onClick={() => togglePanel("history")}
              >
                <h2 className="text-sm font-semibold text-gray-300 flex items-center">
                  <FaHistory className="mr-2" /> Query History
                </h2>
                {showHistory ? (
                  <FaChevronUp size={14} />
                ) : (
                  <FaChevronDown size={14} />
                )}
              </div>
              <div
                className={`max-h-[30vh] overflow-y-auto transition-all duration-300 ${
                  showHistory
                    ? "opacity-100 max-h-[30vh]"
                    : "opacity-0 max-h-0 overflow-hidden"
                }`}
              >
                {historyPane}
              </div>
            </div>

            {/* File Upload Section with Toggle */}
            <div className="border-b border-ui-border">
              <div
                className="p-3 bg-ui-secondary flex justify-between items-center cursor-pointer"
                onClick={() => togglePanel("files")}
              >
                <h2 className="text-sm font-semibold text-gray-300 flex items-center">
                  <FaUpload className="mr-2" /> Upload Data
                </h2>
                {showFileUpload ? (
                  <FaChevronUp size={14} />
                ) : (
                  <FaChevronDown size={14} />
                )}
              </div>
              <div
                className={`p-3 transition-all duration-300 ${
                  showFileUpload
                    ? "opacity-100"
                    : "opacity-0 h-0 overflow-hidden p-0"
                }`}
              >
                {filesPane}
              </div>
            </div>

            {/* Column Management Section (Collapsed by Default) */}
            <div className="border-b border-ui-border">
              <div
                className="p-3 bg-ui-secondary flex justify-between items-center cursor-pointer"
                onClick={() => togglePanel("columns")}
              >
                <h2 className="text-sm font-semibold text-gray-300 flex items-center">
                  <FaDatabase className="mr-2" /> Column Management
                </h2>
                {showColumnManagement ? (
                  <FaChevronUp size={14} />
                ) : (
                  <FaChevronDown size={14} />
                )}
              </div>
              <div
                className={`p-3 transition-all duration-300 ${
                  showColumnManagement
                    ? "opacity-100"
                    : "opacity-0 h-0 overflow-hidden p-0"
                }`}
              >
                {columnManagementPane}
              </div>
            </div>

            {/* Quick Upload Button - Always Visible */}
            <div className="p-4 mt-auto">
              <Button
                onClick={() => {
                  setShowFileUpload(true);
                  // Save panel state to localStorage
                  const panelStates = {
                    showHistory,
                    showFileUpload: true,
                    showColumnManagement,
                  };
                  localStorage.setItem(
                    "panelStates",
                    JSON.stringify(panelStates)
                  );
                }}
                variant="primary"
                fullWidth
                className="flex items-center justify-center"
              >
                <FaUpload className="mr-2" /> Upload New Data
              </Button>
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
                {queryResultsPane || children}
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
