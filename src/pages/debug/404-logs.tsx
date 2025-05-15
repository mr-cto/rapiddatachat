import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import logConfig from "../../../lib/logConfig";

/**
 * Debug page for 404 errors
 */
const Debug404Page: React.FC = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Enable debug mode
  useEffect(() => {
    if (status === "authenticated") {
      // Check if debug mode is enabled
      const isDebug = logConfig.isDebugMode();
      setDebugEnabled(isDebug);
    }
  }, [status]);

  // Handle enabling debug mode
  const handleEnableDebug = () => {
    logConfig.enableDebugMode();
    setDebugEnabled(true);
  };

  // Handle disabling debug mode
  const handleDisableDebug = () => {
    logConfig.disableDebugMode();
    setDebugEnabled(false);
  };

  // Handle testing the 404 error
  const handleTest404 = async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      // Make a request to the project page without the dashboard suffix
      const response = await fetch(
        `/api/debug/test-404?projectId=${projectId}`
      );
      const data = await response.json();

      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Error testing 404:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle direct navigation to the 404 page
  const handleNavigateTo404 = () => {
    if (!projectId) return;
    router.push(`/project/${projectId}`);
  };

  // Handle navigation to the dashboard page
  const handleNavigateToDashboard = () => {
    if (!projectId) return;
    router.push(`/project/${projectId}/dashboard`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-primary dark:text-primary">
        Debug 404 Errors
      </h1>

      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Debug Settings
        </h2>

        <div className="flex items-center mb-4">
          <span className="mr-4">Debug Mode:</span>
          <span
            className={`font-medium ${
              debugEnabled ? "text-green-600" : "text-red-600"
            }`}
          >
            {debugEnabled ? "Enabled" : "Disabled"}
          </span>
          <button
            onClick={debugEnabled ? handleDisableDebug : handleEnableDebug}
            className={`ml-4 px-4 py-2 rounded-md ${
              debugEnabled
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {debugEnabled ? "Disable Debug Mode" : "Enable Debug Mode"}
          </button>
        </div>
      </div>

      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Test 404 Error
        </h2>

        <div className="mb-4">
          <label htmlFor="projectId" className="block mb-2">
            Project ID:
          </label>
          <input
            type="text"
            id="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Enter project ID"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
          />
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleTest404}
            disabled={!projectId || isLoading}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md disabled:opacity-50"
          >
            {isLoading ? "Testing..." : "Test 404 Error"}
          </button>

          <button
            onClick={handleNavigateTo404}
            disabled={!projectId}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md disabled:opacity-50"
          >
            Navigate to 404 Page
          </button>

          <button
            onClick={handleNavigateToDashboard}
            disabled={!projectId}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
          >
            Navigate to Dashboard
          </button>
        </div>
      </div>

      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
          Logs
        </h2>

        {logs.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">
            No logs available. Enable debug mode and test the 404 error to see
            logs.
          </div>
        ) : (
          <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-auto max-h-96">
            <pre className="whitespace-pre-wrap">{logs.join("\n")}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Debug404Page;
