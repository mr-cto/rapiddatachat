import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FaArchive, FaEye, FaTrash } from "react-icons/fa";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import CardLoading from "../../../components/ui/CardLoading";
import CreateProjectModal from "../../../components/project/CreateProjectModal";
import Header from "../../../components/layouts/Header";

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  archived?: boolean; // This will be managed in the frontend
}

/**
 * ProjectList page for displaying all projects
 */
const ProjectList: React.FC = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loadingProjectIds, setLoadingProjectIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    projectId: string;
    action: "archive" | "unarchive";
    title: string;
    message: string;
  }>({
    isOpen: false,
    projectId: "",
    action: "archive",
    title: "",
    message: "",
  });

  // Initialize localStorage if needed
  useEffect(() => {
    // Check if localStorage is available (for SSR compatibility)
    if (typeof window !== "undefined") {
      // Initialize archivedProjects in localStorage if it doesn't exist
      if (!localStorage.getItem("archivedProjects")) {
        localStorage.setItem("archivedProjects", "{}");
      }
    }
  }, []);

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
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/projects", {
          credentials: "include", // Include cookies for authentication
        });
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }

        const data = await response.json();

        // Load archived status from localStorage
        const archivedProjects = JSON.parse(
          localStorage.getItem("archivedProjects") || "{}"
        );

        // Apply archived status to projects
        const projectsWithArchivedStatus = data.projects.map(
          (project: any) => ({
            ...project,
            archived: archivedProjects[project.id] === true,
          })
        );

        setProjects(projectsWithArchivedStatus);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [status]);

  // Handle create project button click
  const handleCreateProject = () => {
    setIsCreateModalOpen(true);
  };

  // Show archive confirmation dialog
  const showArchiveConfirmation = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setConfirmDialog({
      isOpen: true,
      projectId,
      action: "archive",
      title: "Archive Project",
      message:
        "Are you sure you want to archive this project? It will be moved to the archived projects list.",
    });
  };

  // Show unarchive confirmation dialog
  const showUnarchiveConfirmation = (
    projectId: string,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setConfirmDialog({
      isOpen: true,
      projectId,
      action: "unarchive",
      title: "Unarchive Project",
      message:
        "Are you sure you want to unarchive this project? It will be moved back to the active projects list.",
    });
  };

  // Handle dialog confirmation
  const handleConfirmAction = async () => {
    const { projectId, action } = confirmDialog;

    if (action === "archive") {
      await handleArchiveProject(projectId);
    } else {
      await handleUnarchiveProject(projectId);
    }
  };

  // Handle archive project
  const handleArchiveProject = async (projectId: string) => {
    try {
      // Add project to loading state
      setLoadingProjectIds((prev) => [...prev, projectId]);

      // Call API to archive project
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
        credentials: "include", // Include cookies for authentication
      });

      if (!response.ok) {
        throw new Error("Failed to archive project");
      }

      // Update local state - since we're managing archived status in the frontend
      setProjects(
        projects.map((project) =>
          project.id === projectId ? { ...project, archived: true } : project
        )
      );

      // Store archived status in localStorage for persistence
      const archivedProjects = JSON.parse(
        localStorage.getItem("archivedProjects") || "{}"
      );
      archivedProjects[projectId] = true;
      localStorage.setItem(
        "archivedProjects",
        JSON.stringify(archivedProjects)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to archive project"
      );
    } finally {
      // Remove project from loading state
      setLoadingProjectIds((prev) => prev.filter((id) => id !== projectId));
    }
  };

  // Handle unarchive project
  const handleUnarchiveProject = async (projectId: string) => {
    try {
      // Add project to loading state
      setLoadingProjectIds((prev) => [...prev, projectId]);

      // Call API to unarchive project
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: false }),
        credentials: "include", // Include cookies for authentication
      });

      if (!response.ok) {
        throw new Error("Failed to unarchive project");
      }

      // Update local state - since we're managing archived status in the frontend
      setProjects(
        projects.map((project) =>
          project.id === projectId ? { ...project, archived: false } : project
        )
      );

      // Remove archived status from localStorage
      const archivedProjects = JSON.parse(
        localStorage.getItem("archivedProjects") || "{}"
      );
      delete archivedProjects[projectId];
      localStorage.setItem(
        "archivedProjects",
        JSON.stringify(archivedProjects)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to unarchive project"
      );
    } finally {
      // Remove project from loading state
      setLoadingProjectIds((prev) => prev.filter((id) => id !== projectId));
    }
  };

  // Filter projects based on archived status
  const filteredProjects = projects.filter((project) =>
    showArchived ? project.archived : !project.archived
  );

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400 max-w-6xl mx-auto mt-8">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="RapidDataChat" />

      <div className="max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-gray-300 mr-4">
              My Projects
            </h1>
            <div className="flex items-center space-x-2">
              <button
                className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center ${
                  showArchived
                    ? "bg-accent-primary text-white"
                    : "bg-ui-tertiary text-gray-300 hover:bg-ui-tertiary/80"
                }`}
                onClick={() => setShowArchived(true)}
              >
                <FaArchive className="mr-2" /> Archived
              </button>
              <button
                className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center ${
                  !showArchived
                    ? "bg-accent-primary text-white"
                    : "bg-ui-tertiary text-gray-300 hover:bg-ui-tertiary/80"
                }`}
                onClick={() => setShowArchived(false)}
              >
                <FaEye className="mr-2" /> Active
              </button>
            </div>
          </div>
          <button
            onClick={handleCreateProject}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-md transition-all"
          >
            Create New Project
          </button>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="bg-ui-secondary rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-300 mb-4">
              {showArchived ? "No Archived Projects" : "No Projects Yet"}
            </h2>
            <p className="text-gray-400 mb-6">
              {showArchived
                ? "You don't have any archived projects."
                : "Create your first project to get started with data management."}
            </p>
            {!showArchived && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold rounded-lg transition"
              >
                Create Your First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <CardLoading
                key={project.id}
                isLoading={loadingProjectIds.includes(project.id)}
                className="bg-ui-secondary rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow h-full relative group"
              >
                <Link
                  href={`/project/${project.id}/dashboard`}
                  className="block h-full"
                >
                  <div className="flex justify-between items-start">
                    <h2 className="text-xl font-semibold text-gray-300 mb-2 truncate">
                      {project.name}
                    </h2>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {project.archived ? (
                        <button
                          className="h-8 w-8 p-1 text-green-400 hover:bg-ui-tertiary rounded-full"
                          title="Unarchive Project"
                          onClick={(e: React.MouseEvent) =>
                            showUnarchiveConfirmation(project.id, e)
                          }
                        >
                          <FaEye />
                        </button>
                      ) : (
                        <button
                          className="h-8 w-8 p-1 text-yellow-400 hover:bg-ui-tertiary rounded-full"
                          title="Archive Project"
                          onClick={(e: React.MouseEvent) =>
                            showArchiveConfirmation(project.id, e)
                          }
                        >
                          <FaArchive />
                        </button>
                      )}
                    </div>
                  </div>

                  {project.archived && (
                    <span className="inline-flex items-center rounded-full bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-400 mb-2">
                      Archived
                    </span>
                  )}

                  {project.description && (
                    <p className="text-gray-400 mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="mt-auto pt-4 text-sm text-gray-500">
                    <p>
                      Created:{" "}
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    <p>
                      Updated:{" "}
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              </CardLoading>
            ))}
          </div>
        )}
        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() =>
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
          }
          onConfirm={handleConfirmAction}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={
            confirmDialog.action === "archive" ? "Archive" : "Unarchive"
          }
          variant={confirmDialog.action === "archive" ? "warning" : "info"}
        />

        {/* Create Project Modal */}
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default ProjectList;
