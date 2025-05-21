import { useEffect } from "react";
import { fileEventBus, FileEventType, FileEvent } from "../events/FileEventBus";

/**
 * React hook for subscribing to file events
 *
 * @param eventTypes - Single event type or array of event types to subscribe to
 * @param callback - Function to call when an event is received
 * @param deps - Dependencies array for the useEffect hook
 */
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

    // Return cleanup function that unsubscribes from all events
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, deps);
}
