import React, { useState } from "react";
import { useRouter } from "next/router";

interface ProjectCreationProps {
  userId: string;
  onProjectCreated?: (projectId: string) => void;
}

/**
 * ProjectCreation component for creating new projects
 */
const ProjectCreation: React.FC<ProjectCreationProps> = ({
  userId,
  onProjectCreated,
}) => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Call the API to create a new project
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create project");
      }

      const data = await response.json();

      // Call the onProjectCreated callback if provided
      if (onProjectCreated) {
        onProjectCreated(data.project.id);
      }

      // Redirect to the project dashboard
      router.push(`/project/${data.project.id}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-ui-secondary dark:bg-ui-secondary rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-primary dark:text-primary">
        Create New Project
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-secondary dark:text-secondary mb-1"
          >
            Project Name *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
            placeholder="Enter project name"
            required
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-secondary dark:text-secondary mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
            placeholder="Enter project description (optional)"
            rows={4}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 bg-accent-primary text-white rounded-md ${
              isSubmitting
                ? "opacity-70 cursor-not-allowed"
                : "hover:bg-accent-primary-hover"
            }`}
          >
            {isSubmitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectCreation;
