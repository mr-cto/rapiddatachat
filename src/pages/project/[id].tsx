import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import logger from "../../../lib/logger";

/**
 * Catch-all page for project routes without the dashboard suffix
 * This page will redirect to the dashboard page and log the redirect
 */
const ProjectRedirectPage: React.FC = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    // Generate a unique request ID for tracking
    const requestId = `client-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // Log the redirect
    console.log(
      `[Redirect] Redirecting from /project/${projectId} to /project/${projectId}/dashboard`
    );

    // Redirect to the dashboard page
    router.replace(`/project/${projectId}/dashboard`);
  }, [projectId, router, status]);

  // Show a loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold text-white">
          Redirecting to project dashboard...
        </h1>
      </div>
    </div>
  );
};

export default ProjectRedirectPage;
