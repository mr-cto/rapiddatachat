import { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import ErrorBoundary from "../../components/ErrorBoundary";
import "../app/globals.css";
import "../../styles/animations.css";

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <ErrorBoundary>
      <SessionProvider
        session={session}
        // Re-fetch session every 5 minutes
        refetchInterval={5 * 60}
        // Re-fetch session when window is focused
        refetchOnWindowFocus={true}
      >
        <Component {...pageProps} />
      </SessionProvider>
    </ErrorBoundary>
  );
}

export default MyApp;
