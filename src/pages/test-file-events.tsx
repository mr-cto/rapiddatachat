import React, { useState, useEffect } from "react";
import { useFileEvents } from "../../lib/hooks/useFileEvents";
import { fileEventBus } from "../../lib/events/FileEventBus";
import { fileStatusMonitor } from "../../lib/services/FileStatusMonitor";
import { Button, Card } from "../../components/ui";
import { FileStatusWidget } from "../../components/dashboard/FileStatusWidget";
import { FilesProvider } from "../../components/files/context/FilesContext";

/**
 * Test page for the file events system
 * This page demonstrates how the file events system works
 */
const TestFileEventsPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);

  // Listen for all file events
  useFileEvents(
    "all",
    (event) => {
      setEvents((prev) => [event, ...prev]);
    },
    []
  );

  // Function to simulate file upload
  const simulateFileUpload = () => {
    const fileId = `file-${Math.random().toString(36).substring(2, 9)}`;
    const fileName = `test-file-${Math.random()
      .toString(36)
      .substring(2, 9)}.csv`;

    // Publish upload started event
    fileEventBus.publish({
      type: "file:upload:started",
      fileId,
      fileName,
      data: {
        size: 1024 * 1024 * 2, // 2MB
        type: "text/csv",
      },
    });

    // Simulate upload progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;

      // Publish progress event
      fileEventBus.publish({
        type: "file:upload:progress",
        fileId,
        fileName,
        data: {
          progress,
        },
      });

      // When upload is complete
      if (progress >= 100) {
        clearInterval(progressInterval);

        // Publish upload completed event
        fileEventBus.publish({
          type: "file:upload:completed",
          fileId,
          fileName,
          data: {
            status: "processing",
          },
        });

        // Simulate file processing
        simulateFileProcessing(fileId, fileName);
      }
    }, 500);
  };

  // Function to simulate file processing
  const simulateFileProcessing = (fileId: string, fileName: string) => {
    // Add file to status monitor
    fileStatusMonitor.addFile(fileId);

    // Simulate processing progress
    let progress = 0;
    const processingInterval = setInterval(() => {
      progress += 5;

      // Update file status
      fileStatusMonitor.updateFileStatus(fileId, "processing", progress);

      // When processing is complete
      if (progress >= 100) {
        clearInterval(processingInterval);

        // Publish processing completed event
        fileEventBus.publish({
          type: "file:processing:completed",
          fileId,
          fileName,
          data: {
            status: "active",
          },
        });

        // Remove file from status monitor
        fileStatusMonitor.removeFile(fileId);
      }
    }, 1000);
  };

  // Function to simulate file error
  const simulateFileError = () => {
    const fileId = `file-${Math.random().toString(36).substring(2, 9)}`;
    const fileName = `error-file-${Math.random()
      .toString(36)
      .substring(2, 9)}.csv`;

    // Publish upload started event
    fileEventBus.publish({
      type: "file:upload:started",
      fileId,
      fileName,
      data: {
        size: 1024 * 1024 * 10, // 10MB
        type: "text/csv",
      },
    });

    // Simulate some progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 20;

      // Publish progress event
      fileEventBus.publish({
        type: "file:upload:progress",
        fileId,
        fileName,
        data: {
          progress,
        },
      });

      // Simulate error at 60%
      if (progress >= 60) {
        clearInterval(progressInterval);

        // Publish error event
        fileEventBus.publish({
          type: "file:error",
          fileId,
          fileName,
          error: new Error("Simulated file upload error"),
          data: {
            stage: "upload",
          },
        });
      }
    }, 500);
  };

  return (
    <FilesProvider onSelectFile={() => {}} projectId="test-project">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">File Events System Test</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Card className="mb-4">
              <h2 className="text-xl font-semibold mb-4">Actions</h2>
              <div className="flex flex-col space-y-2">
                <Button onClick={simulateFileUpload} variant="primary">
                  Simulate File Upload
                </Button>
                <Button onClick={simulateFileError} variant="danger">
                  Simulate File Error
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold mb-4">File Status</h2>
              <FileStatusWidget />
            </Card>
          </div>

          <Card>
            <h2 className="text-xl font-semibold mb-4">Event Log</h2>
            <div className="h-[500px] overflow-y-auto">
              {events.map((event, index) => (
                <div
                  key={index}
                  className="mb-2 p-2 border border-ui-border rounded"
                >
                  <div className="flex justify-between">
                    <span className="font-medium text-accent-primary">
                      {event.type}
                    </span>
                    <span className="text-sm text-gray-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    {event.fileId && <div>File ID: {event.fileId}</div>}
                    {event.fileName && <div>File Name: {event.fileName}</div>}
                    {event.error && (
                      <div className="text-red-400">
                        Error: {event.error.message}
                      </div>
                    )}
                    {event.data && (
                      <div className="mt-1">
                        <div className="font-medium">Data:</div>
                        <pre className="text-xs bg-ui-tertiary p-1 rounded">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="text-gray-400 text-center p-4">
                  No events yet. Try simulating a file upload.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </FilesProvider>
  );
};

export default TestFileEventsPage;
