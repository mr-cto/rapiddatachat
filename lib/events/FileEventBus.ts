export type FileEventType =
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
  | "file:delete:started"
  | "file:delete:completed"
  | "file:error"
  | "all"; // Special type for subscribing to all events

export interface FileEvent {
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
    const allCallbacks = this.listeners.get("all");
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
