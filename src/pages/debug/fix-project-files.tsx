import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

const FixProjectFiles: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [filesWithoutProject, setFilesWithoutProject] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Check for projectId in query params
  useEffect(() => {
    if (router.query.projectId && typeof router.query.projectId === "string") {
      setProjectId(router.query.projectId);
    }
  }, [router.query]);

  // Fetch projects and files without project
  useEffect(() => {
    const fetchData = async () => {
      if (status !== "authenticated") return;

      try {
        // Fetch projects
        const projectsResponse = await fetch("/api/projects");
        if (!projectsResponse.ok) {
          throw new Error("Failed to fetch projects");
        }
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.projects || []);

        // Fetch files without project
        const filesResponse = await fetch("/api/debug/files-without-project");
        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          setFilesWithoutProject(filesData.filesWithoutProject || []);
          console.log("Files without project:", filesData.filesWithoutProject);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, [status]);

  // Refresh data
  const refreshData = async () => {
    if (status !== "authenticated") return;

    try {
      setLoading(true);
      setError(null);

      // Fetch files without project
      const filesResponse = await fetch("/api/debug/files-without-project");
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setFilesWithoutProject(filesData.filesWithoutProject || []);
        console.log("Files without project:", filesData.filesWithoutProject);
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle fix files
  const handleFixFiles = async (updateAllFiles: boolean) => {
    if (!projectId) {
      setError("Please select a project");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/debug/fix-file-projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          updateAllFiles,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fix files");
      }

      const data = await response.json();
      setApiResponse(data);
      setSuccess(`Successfully updated ${data.filesUpdated} files`);

      // Refresh the data after fixing files
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fixing files:", err);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Fix Project Files</h1>
        <button
          onClick={refreshData}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded flex items-center"
          disabled={loading}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Fix Files</h2>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Select Project</label>
            <select
              className="w-full p-2 border rounded"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex space-x-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => handleFixFiles(false)}
              disabled={!projectId || loading}
            >
              {loading ? "Fixing..." : "Fix Files in Join Table"}
            </button>
            <button
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => handleFixFiles(true)}
              disabled={!projectId || loading}
            >
              {loading ? "Fixing..." : "Fix All Files"}
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Files Without Project</h2>
          {filesWithoutProject.length === 0 ? (
            <p className="text-gray-500">No files without project found.</p>
          ) : (
            <div className="overflow-y-auto max-h-64">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">Filename</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {filesWithoutProject.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{file.filename}</td>
                      <td className="px-4 py-2">{file.status}</td>
                      <td className="px-4 py-2">
                        {Math.round(file.sizeBytes / 1024)} KB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filesWithoutProject.length > 0 && projectId && (
            <div className="mt-4">
              <button
                className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full"
                onClick={() => handleFixFiles(true)}
                disabled={!projectId || loading}
              >
                {loading
                  ? "Fixing..."
                  : `Assign All to "${
                      projects.find((p) => p.id === projectId)?.name
                    }"`}
              </button>
            </div>
          )}
        </div>
      </div>

      {apiResponse && (
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">API Response</h2>
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">
              Files Updated: {apiResponse.filesUpdated}
            </h3>
            <div className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
            </div>
          </div>

          {apiResponse.updateResults &&
            apiResponse.updateResults.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">
                  Update Results ({apiResponse.updateResults.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Filename
                        </th>
                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiResponse.updateResults.map(
                        (result: any, index: number) => (
                          <tr key={index}>
                            <td className="py-2 px-4 border-b border-gray-200">
                              {result.id.substring(0, 8)}...
                            </td>
                            <td className="py-2 px-4 border-b border-gray-200">
                              {result.filename}
                            </td>
                            <td className="py-2 px-4 border-b border-gray-200">
                              <span
                                className={
                                  result.status === "updated"
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {result.status}
                              </span>
                            </td>
                            <td className="py-2 px-4 border-b border-gray-200">
                              {result.source}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default FixProjectFiles;
