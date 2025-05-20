# File Events System Implementation Plan

## Overview

This document outlines a comprehensive plan to enhance our file management system with an event-driven architecture. The goal is to improve the file upload process and ensure other parts of the dashboard are notified about file state changes and events in real-time.

## Background

Currently, our file upload process is handled primarily in the `FilesPane` component, which we've recently refactored to improve maintainability. However, other parts of the dashboard don't have a reliable way to know when files are uploaded, processed, or encounter errors. This implementation plan addresses that gap by creating a robust event system.

## 1. File Events System

### 1.1 FileEventBus

We'll create a central event bus to manage file-related events:

```typescript
// lib/events/FileEventBus.ts
type FileEventType =
  | "file:upload:started"
  | "file:upload:progress"
  | "file:upload:completed"
  | "file:processing:started"
  | "file:processing:progress"
  | "file:processing:completed"
  | "file:schema:created"
  | "file:schema:updated"
  | "file:mapping:completed"
  | "file:activation:started"
  | "file:activation:completed"
  | "file:error";

interface FileEvent {
  type: FileEventType;
  fileId?: string;
  fileName?: string;
  projectId?: string;
  data?: any;
  timestamp: number;
  error?: Error;
}

class FileEventBus {
  private listeners: Map<FileEventType, Set<(event: FileEvent) => void>> =
    new Map();

  public subscribe(
    eventType: FileEventType,
    callback: (event: FileEvent) => void
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  public publish(event: Omit<FileEvent, "timestamp">): void {
    const fullEvent = { ...event, timestamp: Date.now() };
    const callbacks = this.listeners.get(event.type);

    if (callbacks) {
      callbacks.forEach((callback) => callback(fullEvent));
    }

    // Also publish to 'all' listeners
    const allCallbacks = this.listeners.get("all" as FileEventType);
    if (allCallbacks) {
      allCallbacks.forEach((callback) => callback(fullEvent));
    }

    // Log events in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[FileEvent] ${event.type}`, event);
    }
  }
}

export const fileEventBus = new FileEventBus();
```

### 1.2 useFileEvents Hook

To make it easy for React components to subscribe to events:

```typescript
// lib/hooks/useFileEvents.ts
import { useEffect } from "react";
import { fileEventBus, FileEventType, FileEvent } from "../events/FileEventBus";

export function useFileEvents(
  eventTypes: FileEventType | FileEventType[],
  callback: (event: FileEvent) => void,
  deps: any[] = []
) {
  useEffect(() => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const unsubscribes = types.map((type) =>
      fileEventBus.subscribe(type, callback)
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, deps);
}
```

## 2. Enhanced File Upload Process

### 2.1 Update useFileUpload Hook

We'll enhance the `useFileUpload` hook to publish events at key points in the upload process:

```typescript
// components/files/hooks/useFileUpload.ts
// Add to existing imports
import { fileEventBus } from '../../../lib/events/FileEventBus';

// Inside handleFilesUpload function
const handleFilesUpload = async (uploadedFiles: File[], ...) => {
  if (uploadedFiles.length === 0) return;

  // Generate a client-side ID for tracking before server response
  const clientFileId = crypto.randomUUID();

  // Publish upload started event
  fileEventBus.publish({
    type: 'file:upload:started',
    fileName: uploadedFiles[0].name,
    projectId,
    data: {
      clientFileId,
      size: uploadedFiles[0].size,
      type: uploadedFiles[0].type
    }
  });

  // ... existing code ...

  // Add progress event publishing
  const progressInterval = setInterval(() => {
    setUploadProgress((prev) => {
      const increment = Math.random() * 10 + 5;
      const newProgress = Math.min(prev + increment, 95);

      // Publish progress event
      fileEventBus.publish({
        type: 'file:upload:progress',
        fileName: uploadedFiles[0].name,
        projectId,
        data: {
          clientFileId,
          progress: newProgress
        }
      });

      return newProgress;
    });
  }, 500);

  try {
    // ... existing code for upload ...

    // After successful upload
    fileEventBus.publish({
      type: 'file:upload:completed',
      fileId: responseData.files[0].id,
      fileName: uploadedFiles[0].name,
      projectId,
      data: {
        clientFileId,
        fileDetails: responseData.files[0]
      }
    });

    // ... continue with existing code ...

    // When schema is created
    fileEventBus.publish({
      type: 'file:schema:created',
      fileId,
      projectId,
      data: {
        schemaId: schemaData.schema?.id,
        columns: actualColumns
      }
    });

    // When file is activated
    fileEventBus.publish({
      type: 'file:activation:completed',
      fileId,
      projectId,
      data: {
        status: 'active'
      }
    });

  } catch (err) {
    // Publish error event
    fileEventBus.publish({
      type: 'file:error',
      fileName: uploadedFiles[0].name,
      projectId,
      error: err instanceof Error ? err : new Error('Unknown error'),
      data: { stage: 'upload' }
    });

    // ... existing error handling ...
  }
};
```

## 3. File Status Monitoring Service

### 3.1 FileStatusMonitor

To track the status of files being processed:

```typescript
// lib/services/FileStatusMonitor.ts
import { fileEventBus } from "../events/FileEventBus";

interface FileStatus {
  fileId: string;
  status: string;
  progress: number;
  lastUpdated: number;
}

class FileStatusMonitor {
  private fileStatuses: Map<string, FileStatus> = new Map();
  private pollingInterval: number | null = null;

  constructor(private pollingFrequency: number = 5000) {
    // Subscribe to file events
    fileEventBus.subscribe("file:upload:completed", this.handleFileUploaded);
    fileEventBus.subscribe(
      "file:activation:completed",
      this.handleFileActivated
    );
  }

  private handleFileUploaded = (event: any) => {
    if (event.fileId) {
      this.addFile(event.fileId);
    }
  };

  private handleFileActivated = (event: any) => {
    if (event.fileId) {
      this.updateFileStatus(event.fileId, "active", 100);
      this.removeFile(event.fileId);
    }
  };

  public addFile(fileId: string) {
    this.fileStatuses.set(fileId, {
      fileId,
      status: "processing",
      progress: 0,
      lastUpdated: Date.now(),
    });

    // Start polling if not already started
    this.startPolling();
  }

  public removeFile(fileId: string) {
    this.fileStatuses.delete(fileId);

    // Stop polling if no files to monitor
    if (this.fileStatuses.size === 0) {
      this.stopPolling();
    }
  }

  public updateFileStatus(fileId: string, status: string, progress: number) {
    const fileStatus = this.fileStatuses.get(fileId);
    if (fileStatus) {
      this.fileStatuses.set(fileId, {
        ...fileStatus,
        status,
        progress,
        lastUpdated: Date.now(),
      });

      // Publish status update event
      fileEventBus.publish({
        type: "file:processing:progress",
        fileId,
        data: {
          status,
          progress,
        },
      });
    }
  }

  private startPolling() {
    if (this.pollingInterval === null) {
      this.pollingInterval = window.setInterval(
        this.pollFileStatuses,
        this.pollingFrequency
      );
    }
  }

  private stopPolling() {
    if (this.pollingInterval !== null) {
      window.clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private pollFileStatuses = async () => {
    // Skip if no files to check
    if (this.fileStatuses.size === 0) return;

    // Get all file IDs to check
    const fileIds = Array.from(this.fileStatuses.keys());

    try {
      // Batch request for all files
      const response = await fetch(
        `/api/files/status?ids=${fileIds.join(",")}`
      );

      if (!response.ok) {
        console.error("Failed to poll file statuses:", response.statusText);
        return;
      }

      const data = await response.json();

      // Update each file status
      data.files.forEach((file: any) => {
        const currentStatus = this.fileStatuses.get(file.id);

        if (currentStatus) {
          // Calculate progress
          let progress = 0;
          if (file.status === "active") {
            progress = 100;
          } else if (file.metadata?.ingestion_progress) {
            const ingestionProgress =
              typeof file.metadata.ingestion_progress === "string"
                ? JSON.parse(file.metadata.ingestion_progress)
                : file.metadata.ingestion_progress;

            progress = ingestionProgress.percentage || 0;
          }

          // Update status if changed
          if (
            file.status !== currentStatus.status ||
            progress !== currentStatus.progress
          ) {
            this.updateFileStatus(file.id, file.status, progress);

            // If file is now active, publish completion event
            if (file.status === "active" && currentStatus.status !== "active") {
              fileEventBus.publish({
                type: "file:processing:completed",
                fileId: file.id,
                data: { status: "active" },
              });

              // Remove from monitoring
              this.removeFile(file.id);
            }
          }
        }
      });
    } catch (error) {
      console.error("Error polling file statuses:", error);
    }
  };
}

export const fileStatusMonitor = new FileStatusMonitor();
```

### 3.2 API Endpoint for Batch Status Checks

```typescript
// src/pages/api/files/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({ error: "File IDs are required" });
    }

    const fileIds = Array.isArray(ids) ? ids : ids.split(",");

    const files = await prisma.file.findMany({
      where: {
        id: { in: fileIds },
      },
      select: {
        id: true,
        status: true,
        metadata: true,
      },
    });

    return res.status(200).json({ files });
  } catch (error) {
    console.error("Error fetching file statuses:", error);
    return res.status(500).json({ error: "Failed to fetch file statuses" });
  }
}
```

## 4. FilesContext Integration

### 4.1 Enhanced FilesContext

Update the FilesContext to integrate with the event system:

```typescript
// components/files/context/FilesContext.tsx
// Add to imports
import { useFileEvents } from "../../../lib/hooks/useFileEvents";
import { fileStatusMonitor } from "../../../lib/services/FileStatusMonitor";

export const FilesProvider: React.FC<FilesProviderProps> = ({
  children,
  projectId,
  onSelectFile,
  selectedFileId,
  onPreviewParsed,
  onFileCountChange,
}) => {
  // ... existing code ...

  // Add state for file processing status
  const [processingFiles, setProcessingFiles] = useState<
    Record<
      string,
      {
        status: string;
        progress: number;
      }
    >
  >({});

  // Listen for file events
  useFileEvents(
    [
      "file:upload:completed",
      "file:processing:progress",
      "file:processing:completed",
    ],
    (event) => {
      if (event.fileId) {
        // Update processing files state
        if (event.type === "file:upload:completed") {
          setProcessingFiles((prev) => ({
            ...prev,
            [event.fileId!]: { status: "processing", progress: 0 },
          }));
        } else if (event.type === "file:processing:progress") {
          setProcessingFiles((prev) => ({
            ...prev,
            [event.fileId!]: {
              status: event.data.status,
              progress: event.data.progress,
            },
          }));
        } else if (event.type === "file:processing:completed") {
          setProcessingFiles((prev) => {
            const newState = { ...prev };
            delete newState[event.fileId!];
            return newState;
          });

          // Refresh file list when processing completes
          fetchFiles();
        }
      }
    },
    []
  );

  // Listen for error events
  useFileEvents(
    "file:error",
    (event) => {
      setError(event.error?.message || "An error occurred");
    },
    []
  );

  // Add processingFiles to context value
  const value: FilesContextType = {
    // ... existing properties ...
    processingFiles,

    // ... existing methods ...
  };

  return (
    <FilesContext.Provider value={value}>{children}</FilesContext.Provider>
  );
};
```

## 5. Dashboard Components

### 5.1 FileStatusWidget

Create a component to display file processing status:

```typescript
// components/dashboard/FileStatusWidget.tsx
import React, { useState } from "react";
import { useFileEvents } from "../../lib/hooks/useFileEvents";
import { useFilesContext } from "../files/context/FilesContext";

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

      {Object.keys(processingFiles).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(processingFiles).map(
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
        {recentEvents.map((event, index) => (
          <div key={index} className="text-xs text-gray-400">
            <span className="text-gray-300">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            {" - "}
            <span className="text-accent-primary">{event.type}</span>
            {" - "}
            <span>{event.fileId || event.fileName || "Unknown file"}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## 6. Implementation Timeline

### Phase 1: Core Event System (Week 1)

1. Implement FileEventBus
2. Create useFileEvents hook
3. Update useFileUpload to publish events
4. Basic integration with FilesContext

### Phase 2: Status Monitoring (Week 2)

1. Implement FileStatusMonitor service
2. Create API endpoint for batch status checks
3. Enhance FilesContext with processing state
4. Create FileStatusWidget component

### Phase 3: Dashboard Integration (Week 3)

1. Integrate FileStatusWidget into dashboard
2. Add event listeners to other dashboard components
3. Implement real-time updates for file status changes
4. Add notification system for important events

### Phase 4: Testing and Refinement (Week 4)

1. Comprehensive testing of event system
2. Performance optimization
3. Error handling improvements
4. Documentation

## 7. Benefits and Future Extensions

### Benefits

- **Real-time Updates**: Dashboard components can react to file state changes immediately
- **Decoupled Architecture**: Components can subscribe to events without tight coupling
- **Improved User Experience**: Users see file status updates without manual refreshing
- **Better Error Handling**: Centralized error reporting and recovery
- **Extensibility**: Easy to add new event types and subscribers

### Future Extensions

- **WebSocket Integration**: Replace polling with WebSocket for real-time updates
- **Event Persistence**: Store events in IndexedDB for offline support
- **Analytics**: Track file processing metrics and performance
- **Batch Operations**: Support for batch file operations with aggregated events
- **Undo/Redo**: Implement event-based undo/redo functionality

## 8. Conclusion

This implementation plan provides a comprehensive approach to improving the file upload process while ensuring other parts of the dashboard are notified about file state changes and events. By adopting an event-driven architecture, we can create a more responsive and maintainable system that provides a better user experience.
