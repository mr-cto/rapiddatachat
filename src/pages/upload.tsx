import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

/**
 * This page has been deprecated in favor of the integrated upload functionality
 * in the project dashboard. It now redirects users to the appropriate location.
 */
const UploadRedirectPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { projectId } = router.query;

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    // If a projectId is provided, redirect to that project's dashboard
    if (projectId && typeof projectId === "string") {
      // Get all query parameters from the current URL
      const { projectId: _, ...restQuery } = router.query;

      router.push(`/project/${projectId}/dashboard`);
    } else {
      // Otherwise, redirect to the projects list
      router.push("/project");
    }
  }, [router, status, projectId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ui-secondary dark:bg-ui-primary">
      <div className="text-center p-6 bg-ui-primary dark:bg-ui-primary rounded-lg shadow-md">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto"></div>
        <h1 className="mt-4 text-xl font-bold text-black dark:text-black">
          Redirecting...
        </h1>
        <p className="mt-2 text-secondary dark:text-secondary">
          The upload page has been moved to the project dashboard.
        </p>
      </div>
    </div>
  );
};

export default UploadRedirectPage;
