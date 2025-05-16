import React, { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import Image from "next/image";
import { Button, Link, Card } from "../ui";
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
  schemaManagementPane?: React.ReactNode;
  queryResultsPane?: React.ReactNode;
  chatInputPane?: React.ReactNode;
  projectName?: string;
}

const ImprovedDashboardLayout: React.FC<ImprovedDashboardLayoutProps> = ({
  children,
  historyPane,
  filesPane,
  schemaManagementPane,
  queryResultsPane,
  chatInputPane,
  projectName,
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showSchemaManagement, setShowSchemaManagement] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Redirect to sign-in page if not authenticated
  React.useEffect(() => {
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
      <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left Sidebar - History and Tools */}
        <div className="w-64 bg-ui-primary border-r border-ui-border flex flex-col">
          {/* History Section with Toggle */}
          <div className="border-b border-ui-border">
            <div
              className="p-3 bg-ui-secondary flex justify-between items-center cursor-pointer"
              onClick={() => setShowHistory(!showHistory)}
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
            {showHistory && (
              <div className="max-h-[30vh] overflow-y-auto">{historyPane}</div>
            )}
          </div>

          {/* File Upload Section with Toggle */}
          <div className="border-b border-ui-border">
            <div
              className="p-3 bg-ui-secondary flex justify-between items-center cursor-pointer"
              onClick={() => setShowFileUpload(!showFileUpload)}
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
            {showFileUpload && <div className="p-3">{filesPane}</div>}
          </div>

          {/* Schema Management Section (Collapsed by Default) */}
          <div className="border-b border-ui-border">
            <div
              className="p-3 bg-ui-secondary flex justify-between items-center cursor-pointer"
              onClick={() => setShowSchemaManagement(!showSchemaManagement)}
            >
              <h2 className="text-sm font-semibold text-gray-300 flex items-center">
                <FaDatabase className="mr-2" /> Schema Management
              </h2>
              {showSchemaManagement ? (
                <FaChevronUp size={14} />
              ) : (
                <FaChevronDown size={14} />
              )}
            </div>
            {showSchemaManagement && (
              <div className="p-3">{schemaManagementPane}</div>
            )}
          </div>

          {/* Quick Upload Button - Always Visible */}
          <div className="p-4 mt-auto">
            <Button
              onClick={() => setShowFileUpload(true)}
              variant="primary"
              fullWidth
              className="flex items-center justify-center"
            >
              <FaUpload className="mr-2" /> Upload New Data
            </Button>
          </div>
        </div>

        {/* Main Panel - Chat Results + Chat Input */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {/* Query Results Section - Takes all available space with padding for chat input */}
          <div className="flex-1 overflow-y-auto p-4 pb-24">
            {queryResultsPane || children}
          </div>

          {/* Chat Input Section - Fixed at the bottom */}
          <div className="fixed bottom-0 left-64 right-0 bg-ui-primary border-t border-ui-border shadow-lg z-10 p-4">
            {chatInputPane}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprovedDashboardLayout;
