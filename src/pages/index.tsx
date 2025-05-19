import React, { useEffect } from "react";
import { useRouter } from "next/router";

interface Query {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
}

const IndexPage: React.FC = () => {
  const router = useRouter();

  // Redirect all users to project page
  useEffect(() => {
    router.replace("/project");
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 border-r-2 border-r-indigo-300 mx-auto"></div>
        <p className="mt-4 text-slate-600 font-medium">
          Redirecting to projects...
        </p>
      </div>
    </div>
  );
};

export default IndexPage;
