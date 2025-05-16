import React from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import Image from "next/image";
import { Button, Link } from "../ui";

interface DashboardLayoutProps {
  children?: React.ReactNode;
  historyPane?: React.ReactNode;
  chatPane?: React.ReactNode;
  filesPane?: React.ReactNode;
  schemaManagementPane?: React.ReactNode;
  queryResultsPane?: React.ReactNode;
  chatInputPane?: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  historyPane,
  chatPane,
  filesPane,
  schemaManagementPane,
  queryResultsPane,
  chatInputPane,
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();

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

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-[280px_1fr] h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left Panel - Files and Schema Management */}
        <div className="bg-ui-primary border-r border-ui-border flex flex-col">
          {/* Files Section - Takes half height */}
          <div className="h-1/2 overflow-y-auto border-b border-ui-border">
            <div className="p-3 bg-ui-secondary border-b border-ui-border">
              <h2 className="text-sm font-semibold text-gray-300">Files</h2>
            </div>
            <div className="p-1">{filesPane}</div>
          </div>

          {/* Schema Management Section - Takes half height */}
          <div className="h-1/2 overflow-y-auto">
            <div className="p-3 bg-ui-secondary border-b border-ui-border">
              <h2 className="text-sm font-semibold text-gray-300">
                Schema Management
              </h2>
            </div>
            <div className="p-1">{schemaManagementPane}</div>
          </div>
        </div>

        {/* Main Panel - Chat or Query Results + Chat Input */}
        <div className="bg-background flex flex-col overflow-hidden p-4">
          {/* If chatPane is provided, use it (for backward compatibility) */}
          {chatPane ? (
            <div className="flex-1 overflow-y-auto">{chatPane}</div>
          ) : (
            <>
              {/* Main content container taking full height */}
              <div className="h-full relative">
                {/* Query Results Section - Takes all available space with padding for chat input */}
                <div className="h-[calc(100vh-10vh)] overflow-x-auto overflow-y-auto w-full max-w-full">
                  {queryResultsPane || children}
                </div>

                {/* Chat Input Section - Fixed at the bottom with improved styling */}
                <div className="fixed bottom-0 left-[280px] right-0 h-[70px] w-[calc(100vw-280px)] bg-ui-primary border-t border-ui-border shadow-lg z-10 px-4">
                  {chatInputPane}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
