import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { FaDatabase, FaSync } from "react-icons/fa";
import { ColumnManager } from "../ColumnManager";
import { GlobalSchema } from "../../lib/schemaManagement";

interface ColumnManagementPaneProps {
  onColumnChange?: (column: GlobalSchema | null) => void;
  refreshTrigger?: number; // A value that changes when refresh is needed
}

const ColumnManagementPane: React.FC<ColumnManagementPaneProps> = ({
  onColumnChange,
  refreshTrigger,
}) => {
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Key to force re-render
  const router = useRouter();
  const { id: projectId } = router.query;

  // Listen for file upload completion events
  useEffect(() => {
    const handleFileUploadComplete = (event: CustomEvent) => {
      console.log(
        "File upload complete event received in SchemaManagementPane"
      );
      refreshSchema();
    };

    // Add event listener
    window.addEventListener(
      "fileUploadComplete",
      handleFileUploadComplete as EventListener
    );

    // Cleanup
    return () => {
      window.removeEventListener(
        "fileUploadComplete",
        handleFileUploadComplete as EventListener
      );
    };
  }, []);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      refreshSchema();
    }
  }, [refreshTrigger]);

  // Function to refresh the schema
  const refreshSchema = () => {
    setIsRefreshing(true);

    // Force re-render of ColumnManager by changing the key
    setRefreshKey((prevKey) => prevKey + 1);

    // Set a timeout to simulate the refresh process
    setTimeout(() => {
      setLastRefreshTime(new Date());
      setIsRefreshing(false);
    }, 500);
  };

  if (!session?.user) {
    return (
      <div className="p-4 text-center text-gray-500">
        Please sign in to manage columns.
      </div>
    );
  }

  if (!projectId || typeof projectId !== "string") {
    return (
      <div className="p-4 text-center text-gray-500">
        Project ID is required to manage columns.
      </div>
    );
  }

  return (
    <div className="h-[50vh] flex flex-col">
      <div className="p-2 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-md font-semibold flex items-center text-gray-300">
            <FaDatabase className="mr-1" /> Column Management
          </h2>
          <button
            onClick={refreshSchema}
            disabled={isRefreshing}
            className={`p-1 rounded-md ${
              isRefreshing
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-700"
            }`}
            title="Refresh schema"
          >
            <FaSync
              className={`text-gray-300 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {lastRefreshTime && (
          <div className="text-xs text-gray-400 mt-1">
            Last refreshed: {lastRefreshTime.toLocaleTimeString()}
          </div>
        )}

        {error && (
          <div className="mb-2 p-2 bg-red-900/30 border border-red-800 rounded-md mt-2">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-3">
        <ColumnManager
          key={refreshKey}
          userId={session.user.email || session.user.id || ""}
          projectId={projectId}
          onColumnChange={onColumnChange}
        />
      </div>
    </div>
  );
};

export default ColumnManagementPane;
