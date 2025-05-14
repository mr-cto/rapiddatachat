import React, { useState, useEffect, useCallback } from "react";
import { GlobalSchema } from "../../lib/globalSchemaService";

interface SchemaRetrievalProps {
  schemaId?: string;
  projectId?: string;
  onSchemaLoaded?: (schema: GlobalSchema) => void;
  onSchemasLoaded?: (schemas: GlobalSchema[]) => void;
  bypassCache?: boolean;
  autoLoad?: boolean;
  showStats?: boolean;
}

/**
 * Component for retrieving schemas with caching
 */
const SchemaRetrieval: React.FC<SchemaRetrievalProps> = ({
  schemaId,
  projectId,
  onSchemaLoaded,
  onSchemasLoaded,
  bypassCache = false,
  autoLoad = true,
  showStats = false,
}) => {
  const [schema, setSchema] = useState<GlobalSchema | null>(null);
  const [schemas, setSchemas] = useState<GlobalSchema[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<{
    hits: number;
    misses: number;
    fromCache: boolean;
  }>({
    hits: 0,
    misses: 0,
    fromCache: false,
  });

  /**
   * Load a schema by ID
   */
  const loadSchema = useCallback(async () => {
    if (!schemaId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/schema-retrieval?id=${schemaId}&bypassCache=${bypassCache}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch schema");
      }

      const data = await response.json();
      setSchema(data.schema);
      setCacheStats((prev) => ({
        ...prev,
        fromCache: data.fromCache,
        hits: data.fromCache ? prev.hits + 1 : prev.hits,
        misses: !data.fromCache ? prev.misses + 1 : prev.misses,
      }));

      // Notify parent component
      if (onSchemaLoaded) {
        onSchemaLoaded(data.schema);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [schemaId, bypassCache, onSchemaLoaded]);

  /**
   * Load schemas by project ID
   */
  const loadSchemasByProject = useCallback(async () => {
    if (!projectId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/schema-retrieval?projectId=${projectId}&bypassCache=${bypassCache}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch schemas");
      }

      const data = await response.json();
      setSchemas(data.schemas);
      setCacheStats((prev) => ({
        ...prev,
        fromCache: data.fromCache,
        hits: data.fromCache ? prev.hits + 1 : prev.hits,
        misses: !data.fromCache ? prev.misses + 1 : prev.misses,
      }));

      // Notify parent component
      if (onSchemasLoaded) {
        onSchemasLoaded(data.schemas);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, bypassCache, onSchemasLoaded]);

  /**
   * Load all schemas for the user
   */
  const loadAllSchemas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/schema-retrieval?bypassCache=${bypassCache}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch schemas");
      }

      const data = await response.json();
      setSchemas(data.schemas);
      setCacheStats((prev) => ({
        ...prev,
        fromCache: data.fromCache,
        hits: data.fromCache ? prev.hits + 1 : prev.hits,
        misses: !data.fromCache ? prev.misses + 1 : prev.misses,
      }));

      // Notify parent component
      if (onSchemasLoaded) {
        onSchemasLoaded(data.schemas);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [bypassCache, onSchemasLoaded]);

  /**
   * Load multiple schemas by IDs
   */
  const loadMultipleSchemas = useCallback(
    async (ids: string[]) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/schema-retrieval", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ids,
            bypassCache,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch schemas");
        }

        const data = await response.json();
        setSchemas(data.schemas);
        setCacheStats((prev) => ({
          ...prev,
          fromCache: data.fromCache,
          hits: data.fromCache ? prev.hits + 1 : prev.hits,
          misses: !data.fromCache ? prev.misses + 1 : prev.misses,
        }));

        // Notify parent component
        if (onSchemasLoaded) {
          onSchemasLoaded(data.schemas);
        }

        return {
          schemas: data.schemas,
          missingIds: data.missingIds,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return {
          schemas: [],
          missingIds: ids,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [bypassCache, onSchemasLoaded]
  );

  /**
   * Clear cache for a schema
   */
  const clearCache = useCallback(async (id?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const url = id
        ? `/api/schema-retrieval?id=${id}`
        : "/api/schema-retrieval";

      const response = await fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear cache");
      }

      const data = await response.json();
      return data.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear all cache
   */
  const clearAllCache = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/schema-retrieval?all=true", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear cache");
      }

      const data = await response.json();
      return data.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load schema or schemas on mount if autoLoad is true
  useEffect(() => {
    if (!autoLoad) return;

    if (schemaId) {
      loadSchema();
    } else if (projectId) {
      loadSchemasByProject();
    } else {
      loadAllSchemas();
    }
  }, [
    autoLoad,
    schemaId,
    projectId,
    loadSchema,
    loadSchemasByProject,
    loadAllSchemas,
  ]);

  return (
    <div>
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 mb-4">
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center items-center h-12 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-primary"></div>
        </div>
      )}

      {/* Cache stats */}
      {showStats && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300 mb-4">
          <h3 className="font-semibold mb-2">Cache Stats</h3>
          <p>Hits: {cacheStats.hits}</p>
          <p>Misses: {cacheStats.misses}</p>
          <p>Last request from cache: {cacheStats.fromCache ? "Yes" : "No"}</p>
        </div>
      )}

      {/* Schema data */}
      {schema && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Schema</h3>
          <p>
            <span className="font-medium">ID:</span> {schema.id}
          </p>
          <p>
            <span className="font-medium">Name:</span> {schema.name}
          </p>
          <p>
            <span className="font-medium">Columns:</span>{" "}
            {schema.columns.length}
          </p>
        </div>
      )}

      {/* Schemas data */}
      {schemas.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Schemas ({schemas.length})</h3>
          <ul className="list-disc list-inside">
            {schemas.map((s) => (
              <li key={s.id}>
                {s.name} ({s.columns.length} columns)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {schemaId && (
          <button
            onClick={() => loadSchema()}
            disabled={isLoading}
            className="px-3 py-1 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover disabled:opacity-50"
          >
            Reload Schema
          </button>
        )}

        {projectId && (
          <button
            onClick={() => loadSchemasByProject()}
            disabled={isLoading}
            className="px-3 py-1 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover disabled:opacity-50"
          >
            Reload Project Schemas
          </button>
        )}

        {!schemaId && !projectId && (
          <button
            onClick={() => loadAllSchemas()}
            disabled={isLoading}
            className="px-3 py-1 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover disabled:opacity-50"
          >
            Reload All Schemas
          </button>
        )}

        {schemaId && (
          <button
            onClick={() => clearCache(schemaId)}
            disabled={isLoading}
            className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50"
          >
            Clear Schema Cache
          </button>
        )}

        <button
          onClick={() => clearAllCache()}
          disabled={isLoading}
          className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50"
        >
          Clear All Cache
        </button>
      </div>
    </div>
  );
};

export default SchemaRetrieval;
