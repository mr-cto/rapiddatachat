import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import FileUpload from "../FileUpload";
import FileList from "../FileList";

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectDashboardProps {
  projectId: string;
}

/**
 * ProjectDashboard component for displaying project information and files
 */
const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ projectId }) => {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [useChunkedUpload, setUseChunkedUpload] = useState(false);

  // Fetch project data
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch project details
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        if (!projectResponse.ok) {
          throw new Error("Failed to fetch project details");
        }
        const projectData = await projectResponse.json();
        setProject(projectData.project);

        // Fetch project files
        const filesResponse = await fetch(`/api/projects/${projectId}/files`);
        if (!filesResponse.ok) {
          throw new Error("Failed to fetch project files");
        }
        const filesData = await filesResponse.json();
        setFiles(filesData.files);

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  /**
   * Handle file selection for upload
   */
  const handleFilesSelected = async (
    selectedFiles: File[],
    projectId?: string
  ) => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // If using chunked upload, the FileUpload component will handle it
      if (useChunkedUpload) {
        // The progress will be updated by the FileUpload component
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append("projectId", projectId || "");
      formData.append("file", selectedFiles[0]);

      // Upload the file with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);

          // Check if this is the first file upload for the project
          if (files.length === 0) {
            // Redirect to schema creation page
            router.push({
              pathname: "/project/[id]/schema/create",
              query: { id: projectId, fileId: response.files[0].id },
            });
          } else {
            // Redirect to schema mapping page
            router.push({
              pathname: "/project/[id]/schema/map",
              query: { id: projectId, fileId: response.files[0].id },
            });
          }
        } else {
          setError("Failed to upload file");
          setIsUploading(false);
        }
      });

      xhr.addEventListener("error", () => {
        setError("An error occurred during upload");
        setIsUploading(false);
      });

      xhr.open("POST", "/api/upload", true);
      xhr.send(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsUploading(false);
    }
  };

  // Handle file deletion
  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      // Remove the file from the state
      setFiles(files.filter((file) => file.id !== fileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  // Refresh file list
  const refreshFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}/files`);
      if (!response.ok) {
        throw new Error("Failed to fetch project files");
      }
      const data = await response.json();
      setFiles(data.files);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  // Toggle chunked upload
  const toggleChunkedUpload = () => {
    setUseChunkedUpload(!useChunkedUpload);
  };

  if (isLoading) {
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

  if (!project) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300">
        Project not found
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Project Header */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-primary dark:text-primary mb-2">
          {project.name}
        </h1>
        {project.description && (
          <p className="text-secondary dark:text-secondary mb-4">
            {project.description}
          </p>
        )}
        <div className="flex space-x-4 text-sm text-tertiary dark:text-tertiary">
          <span>
            Created: {new Date(project.createdAt).toLocaleDateString()}
          </span>
          <span>
            Updated: {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-primary dark:text-primary">
            Upload Data
          </h2>
          <div className="flex items-center">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useChunkedUpload}
                onChange={toggleChunkedUpload}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-primary/20 dark:peer-focus:ring-accent-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-accent-primary"></div>
              <span className="ms-3 text-sm font-medium text-secondary dark:text-secondary">
                Large file upload
              </span>
            </label>
          </div>
        </div>
        <FileUpload
          onFilesSelected={handleFilesSelected}
          uploading={isUploading}
          progress={uploadProgress}
          projectId={projectId}
          useChunkedUpload={useChunkedUpload}
        />
      </div>

      {/* Files Section */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-primary dark:text-primary mb-4">
          Project Files
        </h2>
        {files.length === 0 ? (
          <div className="text-center py-8 text-tertiary dark:text-tertiary">
            <p>No files uploaded yet</p>
            <p className="text-sm mt-2">
              Upload a file to get started with your project
            </p>
          </div>
        ) : (
          <FileList
            files={files}
            onDelete={handleDeleteFile}
            onRefresh={refreshFiles}
            loading={false}
          />
        )}
      </div>

      {/* Schema Management Section */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-primary dark:text-primary mb-4">
          Global Schema
        </h2>
        <div className="flex justify-between items-center">
          <p className="text-secondary dark:text-secondary">
            Manage your project&apos;s global schema
          </p>
          <button
            onClick={() =>
              router.push({
                pathname: "/project/[id]/schema",
                query: { id: projectId },
              })
            }
            className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover"
          >
            Manage Schema
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;
