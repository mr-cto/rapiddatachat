import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

const FilesPaneDebug: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (status !== "authenticated") return;

      try {
        const response = await fetch("/api/projects");
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (err) {
        console.error("Error fetching projects:", err);
      }
    };

    fetchProjects();
  }, [status]);

  // Handle fetch files
  const handleFetchFiles = async () => {
    if (!projectId) {
      setError("Please select a project");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Construct the query parameters
      const queryParams = new URLSearchParams({
        page: "1",
        pageSize: "10",
        sortBy: "uploadedAt",
        sortDirection: "desc",
      });

      // Fetch files for the project
      const endpoint = `/api/projects/${projectId}/files?${queryParams}`;
      console.log(`Fetching files from endpoint: ${endpoint}`);

      const response = await fetch(endpoint);
      console.log("Response status:", response.status);
      console.log("Response status text:", response.statusText);

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Files API response:", data);
      console.log("Files count:", data.files ? data.files.length : 0);
      console.log(
        "Full API response structure:",
        JSON.stringify(data, null, 2)
      );

      setApiResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching files:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle fetch files without project
  const handleFetchAllFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Construct the query parameters
      const queryParams = new URLSearchParams({
        page: "1",
        pageSize: "10",
        sortBy: "uploadedAt",
        sortDirection: "desc",
      });

      // Fetch all files
      const endpoint = `/api/files?${queryParams}`;
      console.log(`Fetching files from endpoint: ${endpoint}`);

      const response = await fetch(endpoint);
      console.log("Response status:", response.status);
      console.log("Response status text:", response.statusText);

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Files API response:", data);
      console.log("Files count:", data.files ? data.files.length : 0);
      console.log(
        "Full API response structure:",
        JSON.stringify(data, null, 2)
      );

      setApiResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching files:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle check files without project
  const handleCheckFilesWithoutProject = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/debug/files-without-project");
      console.log("Response status:", response.status);
      console.log("Response status text:", response.statusText);

      if (!response.ok) {
        throw new Error(`Failed to check files: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API response:", data);

      setApiResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error checking files:", err);
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
      <h1 className="text-2xl font-bold mb-4">FilesPane Debug Tool</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-4 mb-6">
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
            onClick={handleFetchFiles}
            disabled={!projectId || loading}
          >
            {loading ? "Fetching..." : "Fetch Project Files"}
          </button>
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            onClick={handleFetchAllFiles}
            disabled={loading}
          >
            {loading ? "Fetching..." : "Fetch All Files"}
          </button>
          <button
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            onClick={handleCheckFilesWithoutProject}
            disabled={loading}
          >
            {loading ? "Checking..." : "Check Files Without Project"}
          </button>
        </div>
      </div>

      {apiResponse && (
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">API Response</h2>
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Response Structure</h3>
            <div className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
            </div>
          </div>

          {apiResponse.files && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">
                Files ({apiResponse.files.length})
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
                        Project ID
                      </th>
                      <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiResponse.files.map((file: any) => (
                      <tr key={file.id}>
                        <td className="py-2 px-4 border-b border-gray-200">
                          {file.id.substring(0, 8)}...
                        </td>
                        <td className="py-2 px-4 border-b border-gray-200">
                          {file.filename}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-200">
                          {file.status}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-200">
                          {file.projectId
                            ? file.projectId.substring(0, 8) + "..."
                            : "null"}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-200">
                          {file.sizeBytes
                            ? Math.round(file.sizeBytes / 1024) + " KB"
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {apiResponse.pagination && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Pagination</h3>
              <div className="bg-gray-100 p-4 rounded">
                <p>
                  <strong>Page:</strong> {apiResponse.pagination.page}
                </p>
                <p>
                  <strong>Page Size:</strong> {apiResponse.pagination.pageSize}
                </p>
                <p>
                  <strong>Total Count:</strong>{" "}
                  {apiResponse.pagination.totalCount}
                </p>
                <p>
                  <strong>Total Pages:</strong>{" "}
                  {apiResponse.pagination.totalPages}
                </p>
              </div>
            </div>
          )}

          {apiResponse.checks && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Debug Checks</h3>
              <div className="bg-gray-100 p-4 rounded">
                {Object.entries(apiResponse.checks).map(
                  ([key, value]: [string, any]) => (
                    <div key={key} className="mb-4">
                      <h4 className="font-medium">{key}</h4>
                      {value.count !== undefined && (
                        <p>
                          <strong>Count:</strong> {value.count}
                        </p>
                      )}
                      {value.files && value.files.length > 0 && (
                        <div className="mt-2">
                          <h5 className="font-medium">Files:</h5>
                          <ul className="list-disc pl-5">
                            {value.files.map((file: any) => (
                              <li key={file.id}>
                                {file.filename} ({file.status})
                                {file.projectId && (
                                  <span>
                                    {" "}
                                    - Project: {file.projectId.substring(0, 8)}
                                    ...
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilesPaneDebug;
