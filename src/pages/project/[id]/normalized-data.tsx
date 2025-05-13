import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { NormalizedData } from "../../../../lib/dataNormalization/dataNormalizationService";
import { GlobalSchema } from "../../../../lib/globalSchemaService";
import DataNormalizationPanel from "../../../../components/dataNormalization/DataNormalizationPanel";

/**
 * Page for displaying normalized data for a project
 */
const NormalizedDataPage: React.FC = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { id: projectId } = router.query;

  const [normalizedData, setNormalizedData] = useState<NormalizedData[]>([]);
  const [schemas, setSchemas] = useState<GlobalSchema[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch schemas for the project
  useEffect(() => {
    const fetchSchemas = async () => {
      if (status !== "authenticated" || !projectId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/schema-retrieval?projectId=${projectId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch schemas");
        }

        const data = await response.json();
        setSchemas(data.schemas || []);

        // Select the first schema by default
        if (data.schemas && data.schemas.length > 0) {
          setSelectedSchemaId(data.schemas[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchemas();
  }, [projectId, status]);

  // Fetch normalized data when schema is selected
  useEffect(() => {
    const fetchNormalizedData = async () => {
      if (!projectId || !selectedSchemaId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/data-normalization?projectId=${projectId}&schemaId=${selectedSchemaId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch normalized data");
        }

        const data = await response.json();
        setNormalizedData(data.normalizedData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNormalizedData();
  }, [projectId, selectedSchemaId]);

  // Handle schema selection
  const handleSchemaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchemaId(e.target.value);
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-primary dark:text-primary">
        Normalized Data
      </h1>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
      )}

      {/* Schema selector */}
      <div className="mb-6">
        <label
          htmlFor="schema-select"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Select Schema
        </label>
        <select
          id="schema-select"
          value={selectedSchemaId}
          onChange={handleSchemaChange}
          className="block w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-accent-primary focus:border-accent-primary dark:bg-gray-800 dark:text-white"
        >
          <option value="">Select a schema</option>
          {schemas.map((schema) => (
            <option key={schema.id} value={schema.id}>
              {schema.name} (v{schema.version})
            </option>
          ))}
        </select>
      </div>

      {/* Normalized data */}
      {selectedSchemaId && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
            Normalized Data ({normalizedData.length} records)
          </h2>

          {normalizedData.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      {Object.keys(normalizedData[0].data).map((column) => (
                        <th
                          key={column}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {normalizedData.map((item, index) => (
                      <tr key={item.id || index}>
                        {Object.keys(item.data).map((column) => (
                          <td
                            key={`${item.id}-${column}`}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                          >
                            {item.data[column] !== null &&
                            item.data[column] !== undefined
                              ? String(item.data[column])
                              : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No normalized data found for this schema.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Data normalization panel */}
      {projectId && selectedSchemaId && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-primary dark:text-primary">
            Normalize New Data
          </h2>
          <DataNormalizationPanel
            fileId=""
            projectId={projectId as string}
            schemaId={selectedSchemaId}
            onNormalizationComplete={(result) => {
              // Refresh normalized data after successful normalization
              if (result.success) {
                const fetchNormalizedData = async () => {
                  try {
                    setIsLoading(true);
                    const response = await fetch(
                      `/api/data-normalization?projectId=${projectId}&schemaId=${selectedSchemaId}`
                    );
                    if (response.ok) {
                      const data = await response.json();
                      setNormalizedData(data.normalizedData || []);
                    }
                  } catch (err) {
                    console.error("Error refreshing normalized data:", err);
                  } finally {
                    setIsLoading(false);
                  }
                };
                fetchNormalizedData();
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default NormalizedDataPage;
