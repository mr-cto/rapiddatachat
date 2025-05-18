import React from "react";
import { NextPage } from "next";
import { Button } from "../../components/ui";

interface ErrorProps {
  statusCode?: number;
  message?: string;
}

const ErrorPage: NextPage<ErrorProps> = ({ statusCode, message }) => {
  return (
    <div className="min-h-screen flex flex-col bg-ui-primary">
      <header className="flex justify-between items-center px-6 h-16 border-b border-ui-border bg-ui-primary shadow-md">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold text-accent-primary hover:text-accent-primary-hover transition-colors">
            RapidDataChat
          </h1>
          <Button
            onClick={() => (window.location.href = "/project")}
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
          <svg
            className="w-16 h-16 text-red-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl font-bold text-gray-300 mb-2">
            {statusCode ? `Error ${statusCode}` : "An error occurred"}
          </h2>
          <p className="text-gray-400 mb-4">
            {message || "Something went wrong. Please try again later."}
          </p>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => window.location.reload()} variant="primary">
              Reload Page
            </Button>
            <Button
              onClick={() => (window.location.href = "/project")}
              variant="outline"
            >
              Go to Projects
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  const message = err?.message || "An unexpected error occurred";

  return { statusCode, message };
};

export default ErrorPage;
