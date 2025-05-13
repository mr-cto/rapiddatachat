import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { SchemaVersion } from "../../../../../lib/schemaVersionService";
import SchemaVersionHistory from "../../../../../components/schema/SchemaVersionHistory";
import SchemaVersionComparison from "../../../../../components/schema/SchemaVersionComparison";

/**
 * Page for displaying schema version history and comparison
 */
const SchemaVersionsPage: React.FC = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { id: projectId } = router.query;
  const [schemaId, setSchemaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [compareFromVersion, setCompareFromVersion] = useState<number | null>(
    null
  );
  const [compareToVersion, setCompareToVersion] = useState<number | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch the active schema for the project
  useEffect(() => {
    const fetchActiveSchema = async () => {
      if (status !== "authenticated" || !projectId) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/schema-retrieval?projectId=${projectId}&active=true`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch active schema");
        }

        const data = await response.json();
        if (data.schemas && data.schemas.length > 0) {
          setSchemaId(data.schemas[0].id);
        } else {
          setError("No active schema found for this project");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveSchema();
  }, [projectId, status]);

  /**
   * Handle version comparison
   */
  const handleCompare = (fromVersion: number, toVersion: number) => {
    setCompareFromVersion(fromVersion);
    setCompareToVersion(toVersion);
    setShowComparison(true);
  };

  /**
   * Handle rollback
   */
  const handleRollback = async (version: number) => {
    if (!schemaId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/schema-versions/rollback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schemaId,
          version,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to rollback schema");
      }

      // Refresh the page to show the updated schema
      router.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary dark:text-primary">
          Schema Version History
        </h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Back
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 mb-6">
          {error}
        </div>
      )}

      {/* No schema message */}
      {!schemaId && !isLoading && !error && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-yellow-700 dark:text-yellow-300 mb-6">
          No active schema found for this project. Please create a schema first.
        </div>
      )}

      {/* Version comparison */}
      {showComparison &&
        schemaId &&
        compareFromVersion !== null &&
        compareToVersion !== null && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-primary dark:text-primary">
                Version Comparison
              </h2>
              <button
                onClick={() => setShowComparison(false)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close Comparison
              </button>
            </div>
            <SchemaVersionComparison
              schemaId={schemaId}
              fromVersion={compareFromVersion}
              toVersion={compareToVersion}
              onClose={() => setShowComparison(false)}
            />
          </div>
        )}

      {/* Version history */}
      {schemaId && (
        <SchemaVersionHistory
          schemaId={schemaId}
          onCompareSelect={handleCompare}
          onRollbackSelect={handleRollback}
        />
      )}
    </div>
  );
};

export default SchemaVersionsPage;
