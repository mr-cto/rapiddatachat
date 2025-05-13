import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  FaSpinner,
  FaExclamationTriangle,
  FaCheckCircle,
} from "react-icons/fa";

interface FileActivationButtonProps {
  fileId: string;
  initialStatus: string;
  onActivated?: () => void;
}

interface ActivationProgress {
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  isComplete: boolean;
}

const FileActivationButton: React.FC<FileActivationButtonProps> = ({
  fileId,
  initialStatus,
  onActivated,
}) => {
  const { data: session } = useSession();
  const [status, setStatus] = useState<string>(initialStatus);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if the button should be enabled
  const isActive = status === "active";
  const isProcessing = status === "processing";
  const isError = status === "error";

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Start polling for progress updates
  const startPolling = () => {
    if (isPolling) return;

    setIsPolling(true);

    // Poll every 1 second
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/file-activation-progress/${fileId}`);

        if (!response.ok) {
          // If we get a 404, the file might not exist anymore
          if (response.status === 404) {
            stopPolling();
            return;
          }

          const errorData = await response.json();
          console.error("Error polling activation progress:", errorData);
          return;
        }

        const data = (await response.json()) as ActivationProgress;

        // Update progress
        setProgress(data.progress);

        // If activation is complete, stop polling and update status
        if (data.isComplete) {
          stopPolling();

          if (data.error) {
            setError(data.error);
            setStatus("error");
          } else {
            setStatus("active");
            // Call the onActivated callback if provided
            if (onActivated) {
              onActivated();
            }
          }
        }
      } catch (err) {
        console.error("Error polling activation progress:", err);
      }
    }, 1000);
  };

  // Stop polling for progress updates
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  // Handle activation
  const handleActivate = async () => {
    if (!session || isActivating || isActive) return;

    setIsActivating(true);
    setError(null);
    setProgress(0);

    try {
      // Optimistic UI update
      setStatus("processing");

      // Call the API to activate the file
      const response = await fetch(`/api/activate-file/${fileId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to activate file");
      }

      const data = await response.json();

      // Set initial progress from response
      if (data.progress) {
        setProgress(data.progress);
      }

      // Start polling for progress updates
      startPolling();

      // If the file is already active, update status and call onActivated
      if (data.status === "active") {
        setStatus(data.status);
        setProgress(100);

        // Call the onActivated callback if provided
        if (onActivated) {
          onActivated();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
      stopPolling();
    } finally {
      setIsActivating(false);
    }
  };

  // Render progress bar
  const renderProgressBar = () => {
    if (!isProcessing && !isActivating) return null;

    return (
      <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div
          className="bg-accent-primary h-2.5 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        ></div>
        <div className="text-xs text-gray-500 mt-1 text-right">{progress}%</div>
      </div>
    );
  };

  // Render different button states
  const renderButton = () => {
    if (isActive) {
      return (
        <button
          className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-md cursor-default flex items-center"
          disabled
        >
          <FaCheckCircle className="mr-2" />
          <span>Active</span>
        </button>
      );
    }

    if (isActivating || isProcessing) {
      return (
        <button
          className="px-4 py-2 bg-accent-primary/70 dark:bg-accent-primary/70 text-white rounded-md flex items-center space-x-2"
          disabled
        >
          <FaSpinner className="animate-spin mr-2" />
          <span>Activating...</span>
        </button>
      );
    }

    if (isError) {
      return (
        <button
          className="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-md hover:bg-red-600 dark:hover:bg-red-700 transition-colors flex items-center space-x-2"
          onClick={handleActivate}
        >
          <FaExclamationTriangle className="mr-2" />
          <span>Retry Activation</span>
        </button>
      );
    }

    return (
      <button
        className="px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary-hover transition-colors"
        onClick={handleActivate}
      >
        Activate File
      </button>
    );
  };

  return (
    <div>
      {renderButton()}
      {renderProgressBar()}
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default FileActivationButton;
