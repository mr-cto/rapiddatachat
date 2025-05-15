import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
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

        const response = await fetch("/api/projects");
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }

        const data = await response.json();
        setProjects(data.projects);
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
    router.push("/project/create");
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-secondary dark:text-secondary">
          My Projects
        </h1>
        <button
          onClick={handleCreateProject}
          className="px-4 py-2 bg-white text-dark rounded-md hover:bg-black hover:text-white hover:border-white border border-dark hover:cursor-pointer"
        >
          Create New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold text-primary dark:text-primary mb-4">
            No Projects Yet
          </h2>
          <p className="text-secondary dark:text-secondary mb-6">
            Create your first project to get started with data management.
          </p>
          <button
            onClick={handleCreateProject}
            className="px-6 py-3 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}/dashboard`}
              className="block"
            >
              <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow h-full">
                <h2 className="text-xl font-semibold text-secondary dark:text-secondary mb-2 truncate">
                  {project.name}
                </h2>
                {project.description && (
                  <p className="text-secondary dark:text-secondary mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="mt-auto pt-4 text-sm text-tertiary dark:text-tertiary">
                  <p>
                    Created: {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                  <p>
                    Updated: {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
