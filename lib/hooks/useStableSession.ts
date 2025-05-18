import { useSession } from "next-auth/react";
import { useRef, useEffect, useMemo } from "react";

/**
 * A custom hook that provides a stable session reference to prevent unnecessary re-renders.
 * Only triggers re-renders when essential session data changes (authentication state, user ID).
 *
 * @returns A stable session object and status
 */
export function useStableSession() {
  // Get the original session from next-auth
  const { data: session, status } = useSession();

  // Create a ref to store the previous session state
  const prevSessionRef = useRef<{
    status: string;
    userId?: string;
    email?: string | null;
  }>({
    status: "loading",
    userId: undefined,
    email: undefined,
  });

  // Memoize the essential parts of the session that should trigger re-renders
  const sessionEssentials = useMemo(() => {
    return {
      status,
      userId: session?.user?.id,
      email: session?.user?.email,
    };
  }, [session?.user?.id, session?.user?.email, status]);

  // Check if essential session data has changed
  const hasSessionChanged =
    prevSessionRef.current.status !== sessionEssentials.status ||
    prevSessionRef.current.userId !== sessionEssentials.userId ||
    prevSessionRef.current.email !== sessionEssentials.email;

  // Update the ref if essential data has changed
  useEffect(() => {
    if (hasSessionChanged) {
      prevSessionRef.current = sessionEssentials;
    }
  }, [sessionEssentials, hasSessionChanged]);

  // Return a stable session object that only changes when essential data changes
  return useMemo(() => {
    // Always use the current session status to determine authentication
    const currentStatus = sessionEssentials.status;
    const isCurrentlyAuthenticated = currentStatus === "authenticated";

    return {
      data: session, // Always use the current session data
      status: currentStatus,
      isAuthenticated: isCurrentlyAuthenticated,
      userId: isCurrentlyAuthenticated
        ? sessionEssentials.userId || sessionEssentials.email
        : null,
    };
  }, [session, sessionEssentials]);
}
