import { useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

const Dashboard = () => {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    // Wait until authentication check is complete
    if (status !== "loading") {
      // Redirect to the new dashboard layout
      router.replace("/");
    }
  }, [router, status]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to new dashboard...</p>
      </div>
    </div>
  );
};

export default Dashboard;
