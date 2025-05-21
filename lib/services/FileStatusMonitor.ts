import { fileEventBus } from "../events/FileEventBus";

interface FileStatus {
  fileId: string;
  status: string;
  progress: number;
  lastUpdated: number;
}

/**
 * Service to monitor the status of files being processed
 * Polls the server for file status updates and publishes events when status changes
 */
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
