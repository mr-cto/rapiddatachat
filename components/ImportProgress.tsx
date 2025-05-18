import React, { useEffect, useState } from "react";

interface ImportProgressProps {
  importJobId: string;
  onComplete?: (rowCount: number) => void;
  onError?: (error: string) => void;
}

interface ImportStatus {
  status: "queued" | "processing" | "ready" | "error";
  rowsProcessed: number;
  totalRows?: number;
  progress: number;
  error?: string;
}

/**
 * Component to display the progress of an import job
 */
export const ImportProgress: React.FC<ImportProgressProps> = ({
  importJobId,
  onComplete,
  onError,
}) => {
  const [status, setStatus] = useState<ImportStatus>({
    status: "queued",
    rowsProcessed: 0,
    progress: 0,
  });
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    // Function to fetch the current status
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/import/status?jobId=${importJobId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch status: ${response.statusText}`);
        }

        const data = await response.json();
        setStatus({
          status: data.status,
          rowsProcessed: data.rowsProcessed || 0,
          totalRows: data.totalRows,
          progress: data.progress || 0,
          error: data.error,
        });

        // If the job is complete, call the onComplete callback
        if (data.status === "ready" && onComplete) {
          onComplete(data.rowsProcessed);
        }

        // If the job has an error, call the onError callback
        if (data.status === "error" && onError) {
          onError(data.error || "Unknown error");
        }
      } catch (error) {
        console.error("Error fetching import status:", error);
      }
    };

    // Fetch the initial status
    fetchStatus();

    // Set up SSE for live updates if the job is not complete
    if (status.status !== "ready" && status.status !== "error") {
      try {
        // Close any existing event source
        if (eventSource) {
          eventSource.close();
        }

        // Create a new event source
        const sse = new EventSource(
          `/api/import/progress?jobId=${importJobId}`
        );

        // Handle progress updates
        sse.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.data);

            setStatus({
              status: data.status || status.status,
              rowsProcessed: data.processed || status.rowsProcessed,
              totalRows: data.total || status.totalRows,
              progress: data.progress || status.progress,
              error: data.error || status.error,
            });

            // If the job is complete, call the onComplete callback and close the connection
            if (data.status === "completed" && onComplete) {
              onComplete(
                data.rowCount || data.processed || status.rowsProcessed
              );
              sse.close();
            }

            // If the job has an error, call the onError callback and close the connection
            if (data.status === "error" && onError) {
              onError(data.error || "Unknown error");
              sse.close();
            }
          } catch (error) {
            console.error("Error parsing SSE message:", error);
          }
        });

        // Handle errors
        sse.addEventListener("error", () => {
          console.error("SSE connection error");
          sse.close();

          // Fall back to polling if SSE fails
          const interval = setInterval(() => {
            if (status.status !== "ready" && status.status !== "error") {
              fetchStatus();
            } else {
              clearInterval(interval);
            }
          }, 5000);

          // Clean up the interval on unmount
          return () => clearInterval(interval);
        });

        // Save the event source for cleanup
        setEventSource(sse);

        // Clean up the event source on unmount
        return () => {
          sse.close();
        };
      } catch (error) {
        console.error("Error setting up SSE:", error);

        // Fall back to polling if SSE fails
        const interval = setInterval(() => {
          if (status.status !== "ready" && status.status !== "error") {
            fetchStatus();
          } else {
            clearInterval(interval);
          }
        }, 5000);

        // Clean up the interval on unmount
        return () => clearInterval(interval);
      }
    }
  }, [importJobId, status.status]);

  // Render the progress bar
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {status.status === "queued" && "Queued for processing..."}
          {status.status === "processing" && "Processing..."}
          {status.status === "ready" && "Import complete!"}
          {status.status === "error" && "Import failed"}
        </span>
        <span className="text-sm font-medium">
          {status.status !== "error" && `${Math.round(status.progress)}%`}
        </span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${
            status.status === "error"
              ? "bg-red-500"
              : status.status === "ready"
              ? "bg-green-500"
              : "bg-blue-500"
          }`}
          style={{ width: `${status.progress}%` }}
        ></div>
      </div>

      {status.status === "processing" && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {status.rowsProcessed.toLocaleString()} rows processed
          {status.totalRows && ` of ${status.totalRows.toLocaleString()}`}
        </div>
      )}

      {status.status === "ready" && (
        <div className="mt-2 text-xs text-green-500 dark:text-green-400">
          Successfully imported {status.rowsProcessed.toLocaleString()} rows
        </div>
      )}

      {status.status === "error" && (
        <div className="mt-2 text-xs text-red-500 dark:text-red-400">
          {status.error || "An unknown error occurred"}
        </div>
      )}
    </div>
  );
};

export default ImportProgress;
