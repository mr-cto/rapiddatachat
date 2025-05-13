import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import DashboardLayout from "../../../components/layouts/DashboardLayout";
import FileRawData from "../../../components/FileRawData";
import FileSynopsis from "../../../components/FileSynopsis";
import FileParsedData from "../../../components/FileParsedData";
import FileActivationButton from "../../../components/FileActivationButton";

interface FileDetailProps {
  id: string;
}

/**
 * File detail page
 */
const FileDetail: React.FC<FileDetailProps> = ({ id }) => {
  const router = useRouter();
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"parsed" | "raw" | "synopsis">(
    "parsed"
  );

  // Fetch file data
  useEffect(() => {
    const fetchFileData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/files/${id}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const data = await response.json();
        setFile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchFileData();
    }
  }, [id]);

  // Handle file activation
  const handleActivated = () => {
    // Refresh file data
    router.reload();
  };

  // Render loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Render error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
          {error}
        </div>
      </DashboardLayout>
    );
  }

  // Render empty state
  if (!file) {
    return (
      <DashboardLayout>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300">
          File not found
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* File header */}
      <div className="bg-ui-secondary dark:bg-ui-secondary rounded-lg p-6 shadow-sm mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-primary dark:text-primary mb-2">
              {file.filename}
            </h1>
            <div className="flex space-x-4 text-sm text-tertiary dark:text-tertiary">
              <span>
                Uploaded: {new Date(file.uploaded_at).toLocaleDateString()}
              </span>
              <span>
                Size: {(file.size_bytes / (1024 * 1024)).toFixed(2)} MB
              </span>
              <span>Format: {file.format.toUpperCase()}</span>
              <span>
                Status:{" "}
                <span
                  className={`font-medium ${
                    file.status === "active"
                      ? "text-green-600 dark:text-green-400"
                      : file.status === "pending"
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {file.status}
                </span>
              </span>
            </div>
          </div>

          {file.status !== "active" && (
            <FileActivationButton
              fileId={id}
              initialStatus={file.status}
              onActivated={handleActivated}
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "parsed"
                ? "border-b-2 border-accent-primary text-accent-primary"
                : "text-secondary dark:text-secondary hover:text-accent-primary dark:hover:text-accent-primary"
            }`}
            onClick={() => setActiveTab("parsed")}
          >
            Parsed Data
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "raw"
                ? "border-b-2 border-accent-primary text-accent-primary"
                : "text-secondary dark:text-secondary hover:text-accent-primary dark:hover:text-accent-primary"
            }`}
            onClick={() => setActiveTab("raw")}
          >
            Raw Data
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "synopsis"
                ? "border-b-2 border-accent-primary text-accent-primary"
                : "text-secondary dark:text-secondary hover:text-accent-primary dark:hover:text-accent-primary"
            }`}
            onClick={() => setActiveTab("synopsis")}
          >
            Synopsis
          </button>
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === "parsed" && <FileParsedData fileId={id} />}
        {activeTab === "raw" && <FileRawData fileId={id} />}
        {activeTab === "synopsis" && <FileSynopsis fileId={id} />}
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  // Check authentication
  if (!session) {
    return {
      redirect: {
        destination: "/auth/signin",
        permanent: false,
      },
    };
  }

  // Get file ID from the URL
  const { id } = context.params as { id: string };

  return {
    props: {
      id,
    },
  };
};

export default FileDetail;
