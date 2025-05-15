import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

interface File {
  id: string;
  filename: string;
  status: string;
  projectId: string | null;
  _count?: {
    fileErrors: number;
  };
  source?: string;
}

interface Project {
  id: string;
  name: string;
}

const FileProjectDebugPage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [filesWithoutProject, setFilesWithoutProject] = useState<File[]>([]);
  const [filesInJoinTable, setFilesInJoinTable] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [updateAllFiles, setUpdateAllFiles] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (status !== "authenticated") return;

      try {
        setLoading(true);
        setError(null);

        // Fetch files without project
        const filesResponse = await fetch("/api/debug/files-without-project");
        if (!filesResponse.ok) {
          throw new Error("Failed to fetch files without project");
        }
        const filesData = await filesResponse.json();
        setFilesWithoutProject(filesData.filesWithoutProject || []);
        setFilesInJoinTable(filesData.filesInJoinTable || []);

        // Fetch projects
        const projectsResponse = await fetch("/api/projects");
        if (!projectsResponse.ok) {
          throw new Error("Failed to fetch projects");
        }
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.projects || []);

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setLoading(false);
      }
    };

    fetchData();
  }, [status]);

  // Handle fix files
  const handleFixFiles = async () => {
    if (!selectedProjectId) {
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
          projectId: selectedProjectId,
          updateAllFiles: updateAllFiles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fix files");
      }

      const data = await response.json();
      setSuccess(`Successfully updated ${data.filesUpdated} files`);

      // Refresh the data
      const filesResponse = await fetch("/api/debug/files-without-project");
      if (!filesResponse.ok) {
        throw new Error("Failed to fetch files without project");
      }
      const filesData = await filesResponse.json();
      setFilesWithoutProject(filesData.filesWithoutProject || []);
      setFilesInJoinTable(filesData.filesInJoinTable || []);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
      <h1 className="text-2xl font-bold mb-4">File-Project Debug</h1>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Files Without Project</h2>
          <div className="bg-white shadow rounded-lg p-4">
            <p className="mb-2">Total: {filesWithoutProject.length}</p>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Filename</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filesWithoutProject.map((file) => (
                    <tr key={file.id}>
                      <td className="px-4 py-2 text-sm">{file.id}</td>
                      <td className="px-4 py-2">{file.filename}</td>
                      <td className="px-4 py-2">{file.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Files In Join Table</h2>
          <div className="bg-white shadow rounded-lg p-4">
            <p className="mb-2">Total: {filesInJoinTable.length}</p>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Filename</th>
                    <th className="px-4 py-2 text-left">Project ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filesInJoinTable.map((file) => (
                    <tr key={file.id}>
                      <td className="px-4 py-2 text-sm">{file.id}</td>
                      <td className="px-4 py-2">{file.filename}</td>
                      <td className="px-4 py-2 text-sm">{file.project_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Fix Files</h2>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Select Project</label>
            <select
              className="w-full p-2 border rounded"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="mr-2"
                checked={updateAllFiles}
                onChange={(e) => setUpdateAllFiles(e.target.checked)}
              />
              <span className="text-gray-700">
                Update all files with no project (found{" "}
                {filesWithoutProject.length})
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              This will associate all files that have no project with the
              selected project
            </p>
          </div>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={handleFixFiles}
            disabled={!selectedProjectId || loading}
          >
            {loading ? "Processing..." : "Fix Files"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileProjectDebugPage;
