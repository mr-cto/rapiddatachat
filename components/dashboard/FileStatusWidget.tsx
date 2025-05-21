import React, { useState } from "react";
import { useFileEvents } from "../../lib/hooks/useFileEvents";
import { useFilesContext } from "../files/context/FilesContext";

/**
 * Component to display file processing status and recent events
 * Uses the FileEvents system to show real-time updates
 */
export const FileStatusWidget: React.FC = () => {
  const { processingFiles } = useFilesContext();
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  // Listen for all file events
  useFileEvents(
    "all",
    (event) => {
      setRecentEvents((prev) => [event, ...prev].slice(0, 5));
    },
    []
  );

  return (
    <div className="border border-ui-border rounded-lg p-4 bg-ui-secondary">
      <h3 className="text-lg font-medium mb-3">File Processing Status</h3>

      {Object.keys(processingFiles || {}).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(processingFiles || {}).map(
            ([fileId, { status, progress }]) => (
              <div
                key={fileId}
                className="border border-ui-border rounded p-3 bg-ui-primary"
              >
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{fileId}</span>
                  <span className="text-sm">
                    {status} ({Math.round(progress)}%)
                  </span>
                </div>
                <div className="w-full bg-ui-tertiary rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <p className="text-gray-400 text-sm">No files currently processing</p>
      )}

      <h4 className="text-md font-medium mt-4 mb-2">Recent Activity</h4>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {recentEvents.length > 0 ? (
          recentEvents.map((event, index) => (
            <div key={index} className="text-xs text-gray-400">
              <span className="text-gray-300">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              {" - "}
              <span className="text-accent-primary">{event.type}</span>
              {" - "}
              <span>{event.fileId || event.fileName || "Unknown file"}</span>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-xs">No recent file events</p>
        )}
      </div>
    </div>
  );
};

export default FileStatusWidget;
