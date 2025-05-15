import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

interface File {
  id: string;
  filename: string;
  status: string;
  projectId: string | null;
}

interface Project {
  id: string;
  name: string;
  userId: string;
}

interface CheckResult {
  projectId: string;
  userEmail: string;
  checks: {
    allUserFiles: {
      count: number;
      files: File[];
    };
    filesWithProjectId?: {
      count: number;
      files: File[];
    };
    filesInJoinTable?: {
      count: number;
      files: any[];
    };
    project?: Project;
  };
}

const CheckFilesPage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

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

  // Handle check files
  const handleCheckFiles = async () => {
    if (!projectId) {
      setError("Please select a project");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/debug/check-files-db?projectId=${projectId}`
      );
      if (!response.ok) {
        throw new Error("Failed to check files");
      }

      const data = await response.json();
      setCheckResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
      <h1 className="text-2xl font-bold mb-4">Check Files Database</h1>

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
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={handleCheckFiles}
          disabled={!projectId || loading}
        >
          {loading ? "Checking..." : "Check Files"}
        </button>
      </div>

      {checkResult && (
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Check Results</h2>

          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Project Info</h3>
            {checkResult.checks.project ? (
              <div className="bg-gray-50 p-3 rounded">
                <p>
                  <strong>ID:</strong> {checkResult.checks.project.id}
                </p>
                <p>
                  <strong>Name:</strong> {checkResult.checks.project.name}
                </p>
                <p>
                  <strong>User ID:</strong> {checkResult.checks.project.userId}
                </p>
                <p>
                  <strong>Current User:</strong> {checkResult.userEmail}
                </p>
              </div>
            ) : (
              <p className="text-red-500">Project not found</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-lg font-medium mb-2">All User Files</h3>
              <p className="mb-2">
                Count: {checkResult.checks.allUserFiles.count}
              </p>
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left">Filename</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Project ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkResult.checks.allUserFiles.files.map((file) => (
                      <tr key={file.id}>
                        <td className="px-4 py-2">{file.filename}</td>
                        <td className="px-4 py-2">{file.status}</td>
                        <td className="px-4 py-2">
                          {file.projectId ? (
                            <span
                              className={
                                file.projectId === projectId
                                  ? "text-green-600"
                                  : ""
                              }
                            >
                              {file.projectId.substring(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-red-500">null</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {checkResult.checks.filesWithProjectId && (
              <div>
                <h3 className="text-lg font-medium mb-2">
                  Files With Project ID
                </h3>
                <p className="mb-2">
                  Count: {checkResult.checks.filesWithProjectId.count}
                </p>
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left">Filename</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkResult.checks.filesWithProjectId.files.map(
                        (file) => (
                          <tr key={file.id}>
                            <td className="px-4 py-2">{file.filename}</td>
                            <td className="px-4 py-2">{file.status}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {checkResult.checks.filesInJoinTable && (
              <div>
                <h3 className="text-lg font-medium mb-2">
                  Files In Join Table
                </h3>
                <p className="mb-2">
                  Count: {checkResult.checks.filesInJoinTable.count}
                </p>
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left">Filename</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Project ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkResult.checks.filesInJoinTable.files.map((file) => (
                        <tr key={file.id}>
                          <td className="px-4 py-2">{file.filename}</td>
                          <td className="px-4 py-2">{file.status}</td>
                          <td className="px-4 py-2">
                            {file.projectId ? (
                              <span
                                className={
                                  file.projectId === projectId
                                    ? "text-green-600"
                                    : ""
                                }
                              >
                                {file.projectId.substring(0, 8)}...
                              </span>
                            ) : (
                              <span className="text-red-500">null</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckFilesPage;
