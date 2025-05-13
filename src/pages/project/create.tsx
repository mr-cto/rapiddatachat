import React from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import ProjectCreation from "../../components/project/ProjectCreation";

/**
 * CreateProject page for creating a new project
 */
const CreateProject: React.FC = () => {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Handle project creation completion
  const handleProjectCreated = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // Will redirect to login
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push("/project")}
          className="flex items-center text-accent-primary hover:text-accent-primary-hover"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Back to Projects
        </button>
      </div>

      <h1 className="text-3xl font-bold text-primary dark:text-primary mb-8">
        Create New Project
      </h1>

      <ProjectCreation
        userId={session?.user?.id as string}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
};

export default CreateProject;
