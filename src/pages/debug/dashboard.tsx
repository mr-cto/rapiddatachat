import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";

interface DebugTool {
  name: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

const DebugDashboard: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch system info
  useEffect(() => {
    const fetchSystemInfo = async () => {
      if (status !== "authenticated") return;

      try {
        setLoading(true);

        // Get database stats
        const dbResponse = await fetch("/api/debug/check-files-db");
        const dbData = await dbResponse.json();

        // Get files without project
        const filesResponse = await fetch("/api/debug/files-without-project");
        const filesData = await filesResponse.json();

        // Get all projects
        const projectsResponse = await fetch("/api/projects");
        const projectsData = await projectsResponse.json();

        setSystemInfo({
          database: dbData,
          filesWithoutProject: filesData.filesWithoutProject || [],
          filesInJoinTable: filesData.filesInJoinTable || [],
          counts: filesData.counts || {
            filesWithoutProject: 0,
            filesInJoinTable: 0,
          },
          projects: projectsData.projects || [],
        });
      } catch (err) {
        console.error("Error fetching system info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemInfo();
  }, [status]);

  const debugTools: DebugTool[] = [
    {
      name: "Fix Project Files",
      description: "Associate orphaned files with projects",
      path: "/debug/fix-project-files",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 11l5-5m0 0l5 5m-5-5v12"
          />
        </svg>
      ),
    },
    {
      name: "FilesPane Debug",
      description: "Test file fetching APIs and view responses",
      path: "/debug/file-pane-debug",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      name: "Check Files DB",
      description: "Inspect file database records",
      path: "/debug/check-files",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      ),
    },
    {
      name: "404 Logs",
      description: "View 404 error logs",
      path: "/debug/404-logs",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    {
      name: "File Projects",
      description: "Manage file-project associations",
      path: "/debug/file-projects",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
      ),
    },
  ];

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Debug Dashboard</h1>

      {/* System Status */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-800 mb-2">Files</h3>
            {systemInfo ? (
              <div>
                <p className="text-sm">
                  Total Files:{" "}
                  {systemInfo.database?.checks?.allUserFiles?.count || 0}
                </p>
                <div className="mt-2 flex items-center">
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    {systemInfo.counts?.filesWithoutProject || 0} without
                    project
                  </span>
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {systemInfo.counts?.filesInJoinTable || 0} in join table
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading...</p>
            )}
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-800 mb-2">Projects</h3>
            {systemInfo ? (
              <div>
                <p className="text-sm">
                  Active Project:{" "}
                  {systemInfo.database?.checks?.project?.name || "None"}
                </p>
                <p className="text-sm">
                  Project Files:{" "}
                  {systemInfo.database?.checks?.filesWithProjectId?.count || 0}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading...</p>
            )}
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium text-purple-800 mb-2">User</h3>
            {session ? (
              <div>
                <p className="text-sm">{session.user?.email}</p>
                <p className="text-sm">
                  Session Active: {session ? "Yes" : "No"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not logged in</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {systemInfo && systemInfo.counts?.filesWithoutProject > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Found {systemInfo.counts.filesWithoutProject} files without
                project association.
                <Link
                  href="/debug/fix-project-files"
                  className="font-medium underline text-yellow-700 hover:text-yellow-600 ml-2"
                >
                  Fix now
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projects List */}
      {systemInfo && systemInfo.projects && systemInfo.projects.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Projects</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Project Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Project ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Created
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {systemInfo.projects.map((project: any) => (
                  <tr key={project.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                        {project.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(project.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Link
                        href={`/project/${project.id}`}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        View
                      </Link>
                      <Link
                        href={`/debug/fix-project-files?projectId=${project.id}`}
                        className="text-green-600 hover:text-green-900"
                      >
                        Fix Files
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Debug Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {debugTools.map((tool) => (
          <Link
            key={tool.path}
            href={tool.path}
            className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center mb-3">
              <div className="bg-indigo-100 p-2 rounded-md text-indigo-600 mr-3">
                {tool.icon}
              </div>
              <h3 className="text-lg font-medium">{tool.name}</h3>
            </div>
            <p className="text-gray-600">{tool.description}</p>
          </Link>
        ))}
      </div>

      {/* Recent Files Without Project */}
      {systemInfo &&
        systemInfo.filesWithoutProject &&
        systemInfo.filesWithoutProject.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">
              Recent Files Without Project
            </h2>
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Filename
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Size
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Uploaded
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {systemInfo.filesWithoutProject
                    .slice(0, 5)
                    .map((file: any) => (
                      <tr key={file.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {file.filename}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              file.status === "active"
                                ? "bg-green-100 text-green-800"
                                : file.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {file.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.round(file.sizeBytes / 1024)} KB
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(file.uploadedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {systemInfo.filesWithoutProject.length > 5 && (
                <div className="bg-gray-50 px-6 py-3">
                  <Link
                    href="/debug/fix-project-files"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    View all {systemInfo.filesWithoutProject.length} files
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
};

export default DebugDashboard;
