import React from "react";
import { Button } from "../../components/ui";
import { useRouter } from "next/router";

const NotFoundPage: React.FC = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-ui-primary">
      <header className="flex justify-between items-center px-6 h-16 border-b border-ui-border bg-ui-primary shadow-md">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold text-accent-primary hover:text-accent-primary-hover transition-colors">
            RapidDataChat
          </h1>
          <Button
            onClick={() => router.push("/project")}
            variant="secondary"
            size="sm"
            className="flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
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
          </Button>
        </div>
      </header>
      <div className="flex-1 flex justify-center items-center">
        <div className="text-center max-w-md p-6 bg-ui-secondary border border-ui-border rounded-lg shadow-lg">
          <div className="text-6xl font-bold text-accent-primary mb-4">404</div>
          <h2 className="text-xl font-bold text-gray-300 mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-400 mb-6">
            {router.asPath.includes("/project/")
              ? "The project you're looking for doesn't exist or you don't have access to it."
              : "The page you're looking for doesn't exist or has been moved."}
          </p>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => router.push("/project")} variant="primary">
              Go to Projects
            </Button>
            <Button onClick={() => router.push("/")} variant="outline">
              Go to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
