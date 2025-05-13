import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import FileUpload from "../../components/FileUpload";
import FileSynopsis from "../../components/FileSynopsis";
import FileActivationButton from "../../components/FileActivationButton";
import SchemaColumnMapper from "../../components/SchemaColumnMapper";
import SchemaManager from "../../components/SchemaManager";
import { GlobalSchema } from "../../lib/schemaManagement";

interface UploadStatus {
  uploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  files: UploadedFile[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: string;
  format: string;
  columns?: string[];
}

const UploadPage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    uploading: false,
    progress: 0,
    error: null,
    success: false,
    files: [],
  });
  const [showSchemaMapper, setShowSchemaMapper] = useState(false);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [activeSchema, setActiveSchema] = useState<GlobalSchema | null>(null);
  const [showSchemaManager, setShowSchemaManager] = useState(false);
  const [showDeleteSchemaConfirmation, setShowDeleteSchemaConfirmation] =
    useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Set isInitialLoad to false after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
      console.log("Initial load complete, now allowing modal management");
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch active schema when component mounts
  useEffect(() => {
    if (session?.user?.id) {
      fetchActiveSchema(session.user.id);
    }
  }, [session]);

  // Log when showSchemaManager changes
  useEffect(() => {
    console.log(`showSchemaManager changed to: ${showSchemaManager}`);
  }, [showSchemaManager]);

  // Log when showSchemaMapper changes
  useEffect(() => {
    console.log(`showSchemaMapper changed to: ${showSchemaMapper}`);
  }, [showSchemaMapper]);

  // Fetch the active schema for the user
  const fetchActiveSchema = async (userId: string) => {
    try {
      const response = await fetch("/api/schema-management");
      if (!response.ok) {
        throw new Error("Failed to fetch schemas");
      }

      const data = await response.json();
      const active = data.schemas.find(
        (schema: GlobalSchema) => schema.isActive
      );
      if (active) {
        setActiveSchema(active);
      }
    } catch (error) {
      console.error("Error fetching active schema:", error);
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    setUploadStatus({
      uploading: true,
      progress: 0,
      error: null,
      success: false,
      files: [],
    });

    try {
      // Create FormData object
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("file", file);
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadStatus((prev) => {
          // Increase progress by random amount between 5-15%
          const increment = Math.random() * 10 + 5;
          const newProgress = Math.min(prev.progress + increment, 95);
          return { ...prev, progress: newProgress };
        });
      }, 500);

      // Send the files to the API
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();

      // Extract columns from the first file for schema mapping
      if (data.files && data.files.length > 0) {
        const firstFile = data.files[0];
        await fetchFileColumns(firstFile.id);
        setCurrentFile(firstFile);
      }

      setUploadStatus({
        uploading: false,
        progress: 100,
        error: null,
        success: true,
        files: data.files,
      });

      // If there's an active schema, show the schema mapper (but only if schema manager is not open)
      if (
        activeSchema &&
        data.files &&
        data.files.length > 0 &&
        !showSchemaManager
      ) {
        console.log("Showing schema mapper after file upload");
        setShowSchemaMapper(true);
      } else if (showSchemaManager) {
        console.log("Schema manager is open, not showing schema mapper");
      }
      // If there's no active schema, create one from the file columns
      else if (
        !activeSchema &&
        data.files &&
        data.files.length > 0 &&
        fileColumns.length > 0
      ) {
        // Create a new schema from the file columns
        createSchemaFromFileColumns(data.files[0].id, fileColumns);
      }
    } catch (error) {
      setUploadStatus({
        uploading: false,
        progress: 0,
        error: error instanceof Error ? error.message : "Upload failed",
        success: false,
        files: [],
      });
    }
  };

  // Fetch columns for a file
  const fetchFileColumns = async (fileId: string) => {
    try {
      const response = await fetch(`/api/file-data/${fileId}?limit=1`);

      if (!response.ok) {
        throw new Error("Failed to fetch file data");
      }

      const data = await response.json();

      if (data && data.rows && data.rows.length > 0 && data.rows[0].data) {
        // Extract columns from the first row's data
        const columns = Object.keys(data.rows[0].data);
        setFileColumns(columns);
        return columns;
      }

      return [];
    } catch (error) {
      console.error("Error fetching file columns:", error);
      return [];
    }
  };

  // Handle schema mapping completion
  const handleMappingComplete = () => {
    setShowSchemaMapper(false);
  };

  // Create a schema from file columns
  const createSchemaFromFileColumns = async (
    fileId: string,
    columns: string[]
  ) => {
    try {
      // Create schema columns from file columns
      const schemaColumns = columns.map((column) => ({
        name: column,
        type: determineColumnType(column),
        sourceFile: fileId,
        sourceColumn: column,
        isRequired: false,
      }));

      // Create a new schema via API
      const response = await fetch("/api/schema-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_with_columns",
          name: `Auto-generated Schema (${new Date().toLocaleDateString()})`,
          description: `Schema automatically generated from uploaded file columns`,
          columns: schemaColumns,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create schema");
      }

      const data = await response.json();

      // Set the new schema as active
      setActiveSchema(data.schema);

      // Show the schema mapper (but only if schema manager is not open)
      if (currentFile && !showSchemaManager) {
        console.log(
          "Showing schema mapper after creating schema from file columns"
        );
        setShowSchemaMapper(true);
      } else if (showSchemaManager) {
        console.log(
          "Schema manager is open, not showing schema mapper after creating schema"
        );
      }
    } catch (error) {
      console.error("Error creating schema from file columns:", error);
    }
  };

  // Helper function to determine column type based on name
  const determineColumnType = (columnName: string): string => {
    const lowerName = columnName.toLowerCase();

    if (lowerName.includes("date") || lowerName.includes("time")) {
      return "timestamp";
    } else if (
      lowerName.includes("price") ||
      lowerName.includes("cost") ||
      lowerName.includes("amount")
    ) {
      return "numeric";
    } else if (
      lowerName.includes("count") ||
      lowerName.includes("number") ||
      lowerName.includes("qty") ||
      lowerName.includes("quantity")
    ) {
      return "integer";
    } else if (lowerName.includes("is_") || lowerName.includes("has_")) {
      return "boolean";
    } else {
      return "text";
    }
  };

  // Handle schema change
  const handleSchemaChange = (schema: GlobalSchema | null) => {
    console.log(
      "handleSchemaChange called with schema:",
      schema,
      "isInitialLoad:",
      isInitialLoad
    );

    // Update the active schema
    setActiveSchema(schema);

    // Skip modal management during initial load
    if (isInitialLoad) {
      console.log("Initial load - not closing modal or showing mapper");
      return;
    }

    // Only close the schema manager modal if a schema was selected (not deleted)
    if (schema !== null) {
      console.log("Schema selected, closing schema manager modal");
      setShowSchemaManager(false);

      // If we have a current file and a schema was selected, show the mapper
      if (currentFile) {
        console.log("Current file exists, showing schema mapper");
        setShowSchemaMapper(true);
      }
    } else {
      console.log(
        "Schema is null (likely deleted), keeping schema manager modal open"
      );
      // If schema is null (deleted or deselected), keep the modal open
      // Do not show the schema mapper
      setShowSchemaMapper(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ui-secondary dark:bg-ui-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto"></div>
          <p className="mt-4 text-secondary dark:text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ui-secondary dark:bg-ui-primary p-4">
      <div className="w-full max-w-2xl bg-ui-primary dark:bg-ui-primary rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-center text-black dark:text-black">
          Upload Your Data Files
        </h1>

        {/* Schema Management Section */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">
              Schema Management
            </h2>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Manage Schemas button clicked");
                setShowSchemaManager(true);
                setShowSchemaMapper(false); // Ensure schema mapper is closed
              }}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 text-sm"
            >
              Manage Schemas
            </button>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
            {activeSchema
              ? `Active Schema: ${activeSchema.name} (${activeSchema.columns.length} columns)`
              : "No active schema selected. Files will be uploaded without schema mapping."}
          </p>
          <div className="flex justify-between items-center mt-3">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Use the Schema Manager to create, edit, or delete schemas
            </p>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Delete Schemas button clicked");
                setShowSchemaManager(true);
              }}
              className="px-3 py-1 bg-red-500 text-white font-bold rounded-md hover:bg-red-600 text-xs"
            >
              Delete Schemas
            </button>
          </div>
        </div>

        <FileUpload
          onFilesSelected={handleFilesSelected}
          multiple
          uploading={uploadStatus.uploading}
          progress={uploadStatus.progress}
        />

        {uploadStatus.error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-700 dark:text-red-300">
              {uploadStatus.error}
            </p>
          </div>
        )}

        {uploadStatus.success && (
          <div className="mt-6">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md mb-6">
              <h3 className="text-green-800 dark:text-green-400 font-medium mb-2">
                Files uploaded successfully!
              </h3>
              <p className="text-green-700 dark:text-green-300 mb-4">
                Your files have been uploaded and are being processed. They will
                be available for querying soon.
              </p>
              {activeSchema && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    You have an active schema. Click the "Map Columns" button
                    below to map your file columns to the schema.
                  </p>
                </div>
              )}
            </div>

            {/* Display file synopsis for each uploaded file */}
            {uploadStatus.files.map((file) => (
              <div key={file.id} className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium text-black dark:text-black">
                    File Synopsis
                  </h3>
                  <div className="flex space-x-2">
                    {activeSchema && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("Map Columns button clicked");
                          setCurrentFile(file);
                          // Close schema manager if it's open
                          if (showSchemaManager) {
                            console.log(
                              "Closing schema manager before showing mapper"
                            );
                            setShowSchemaManager(false);
                          }
                          fetchFileColumns(file.id).then(() => {
                            console.log(
                              "Showing schema mapper after fetching columns"
                            );
                            setShowSchemaMapper(true);
                          });
                        }}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                      >
                        Map Columns
                      </button>
                    )}
                    <FileActivationButton
                      fileId={file.id}
                      initialStatus={file.status}
                    />
                  </div>
                </div>
                <FileSynopsis fileId={file.id} />
              </div>
            ))}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Schema Manager Modal */}
      {showSchemaManager && session?.user?.id && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto border-4 border-blue-400">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4 border-b-2 border-blue-300 pb-3">
                <div>
                  <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    Schema Manager
                  </h2>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    Create, edit, or delete your schemas here
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Close schema manager button clicked");
                    setShowSchemaManager(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="bg-red-50 p-3 mb-4 rounded-md border border-red-200">
                <h3 className="text-red-700 font-bold mb-1">Delete Schemas</h3>
                <p className="text-sm text-red-600">
                  To delete a schema, click the "Delete Schema" button next to
                  each schema below. You can also delete a schema while editing
                  it.
                </p>
              </div>

              <SchemaManager
                userId={session.user.id}
                onSchemaChange={handleSchemaChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* Schema Column Mapper Modal */}
      {showSchemaMapper && currentFile && session?.user?.id && (
        <SchemaColumnMapper
          isOpen={showSchemaMapper}
          onClose={() => setShowSchemaMapper(false)}
          fileId={currentFile.id}
          fileColumns={fileColumns}
          userId={session.user.id}
          onMappingComplete={handleMappingComplete}
        />
      )}
    </div>
  );
};

export default UploadPage;
