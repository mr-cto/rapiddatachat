import React, { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import FileSynopsis from "../../../components/FileSynopsis";
import FileRawData from "../../../components/FileRawData";
import FileActivationButton from "../../../components/FileActivationButton";
import { FaArrowLeft, FaTrash } from "react-icons/fa";

interface FileData {
  id: string;
  filename: string;
  uploadedAt: string;
  ingestedAt: string | null;
  sizeBytes: number;
  format: string | null;
  status: string;
  metadata: Record<string, unknown>;
  _count: {
    fileErrors: number;
  };
}

interface FilePageProps {
  user: {
    email: string;
    name?: string;
  };
  fileId: string;
}

const FilePage: React.FC<FilePageProps> = ({ user, fileId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<FileData | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<boolean>(false);

  // Fetch file data
  useEffect(() => {
    const fetchFile = async () => {
      if (!fileId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/files/${fileId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch file");
        }

        const data = await response.json();
        setFile(data.file);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        console.error("Error fetching file:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [fileId]);

  // Handle file delete
  const handleDelete = async () => {
    if (!fileId) return;

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete file");
      }

      // Redirect to files page
      router.push("/files");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      console.error("Error deleting file:", err);
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <>
      <Head>
        <title>
          {file ? `${file.filename} | RapidDataChat` : "File | RapidDataChat"}
        </title>
        <meta name="description" content="File details" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div className="flex items-center">
              <button
                onClick={() => router.push("/files")}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <FaArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-3xl font-bold text-black dark:text-black">
                File Details
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {user?.name && (
                <span className="text-gray-700">Welcome, {user.name}</span>
              )}
              <Link
                href="/project"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Projects
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-32 bg-gray-200 rounded mt-4"></div>
              </div>
            </div>
          )}

          {/* File details */}
          {!loading && file && (
            <div className="space-y-6">
              {/* File header */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-black dark:text-black">
                      {file.filename}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Uploaded on {formatDate(file.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex space-x-4">
                    <FileActivationButton
                      fileId={file.id}
                      initialStatus={file.status}
                    />
                    {deleteConfirmation ? (
                      <div className="flex items-center space-x-2 bg-red-50 p-2 rounded">
                        <span className="text-sm text-red-700">
                          Are you sure?
                        </span>
                        <button
                          onClick={handleDelete}
                          className="text-red-600 hover:text-red-900 font-medium"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmation(false)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmation(true)}
                        className="text-red-600 hover:text-red-900 flex items-center"
                      >
                        <FaTrash className="mr-1" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="text-xs text-gray-500 block">Format</span>
                    <span className="font-medium">
                      {file.format?.toUpperCase() || "Unknown"}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="text-xs text-gray-500 block">Size</span>
                    <span className="font-medium">
                      {formatFileSize(file.sizeBytes)}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="text-xs text-gray-500 block">Status</span>
                    <span
                      className={`font-medium ${
                        file.status === "active"
                          ? "text-green-600"
                          : file.status === "error"
                          ? "text-red-600"
                          : file.status === "processing"
                          ? "text-blue-600"
                          : "text-yellow-600"
                      }`}
                    >
                      {file.status.charAt(0).toUpperCase() +
                        file.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* File synopsis */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-black dark:text-black mb-4">
                  File Synopsis
                </h3>
                <FileSynopsis fileId={file.id} />
              </div>

              {/* File raw data */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-black dark:text-black mb-4">
                  File Data
                </h3>
                {file.status === "active" ? (
                  <FileRawData fileId={file.id} />
                ) : (
                  <div className="p-4 bg-yellow-50 text-yellow-700 rounded-md">
                    File must be activated to view and manage data. Use the
                    "Activate" button above.
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Redirect to login if not authenticated
  if (!session || !session.user) {
    return {
      redirect: {
        destination: "/auth/signin",
        permanent: false,
      },
    };
  }

  // Get file ID from URL
  const { id } = context.params || {};

  if (!id || typeof id !== "string") {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      user: {
        email: session.user.email || "",
        name: session.user.name || "",
      },
      fileId: id,
    },
  };
};

export default FilePage;
