import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import { getPrismaClient } from "./prisma/replicaClient";
import { cacheSession, getCachedSession } from "./authCache";
import logger from "./logging/logger";

// Initialize Prisma client using the replica-aware client
const prisma = getPrismaClient();

// Create a logger for auth operations
const log = logger.createLogger("Auth");

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", required: true },
        password: { label: "Password", type: "password", required: true },
      },
      async authorize(credentials) {
        log.debug(
          "Authorize function called with credentials",
          credentials ? { email: credentials.email } : "no credentials"
        );

        if (!credentials?.email || !credentials?.password) {
          log.warn("Missing email or password");
          return null;
        }

        try {
          log.debug(
            `Looking up user with email: ${credentials.email.toLowerCase()}`
          );

          // Find user in the database (case insensitive)
          // Use the replica client directly to ensure we're using the correct database
          const user = await prisma.useReplica(async (replicaClient) => {
            return replicaClient.user.findUnique({
              where: { email: credentials.email.toLowerCase() },
            });
          });

          log.debug(
            `User lookup result: ${user ? "User found" : "User not found"}`
          );

          // If user doesn't exist or password doesn't match
          if (!user || !user.password) {
            log.warn(
              `Login attempt failed: User with email ${credentials.email} not found or has no password`
            );
            return null;
          }

          // Verify password
          log.debug("Verifying password...");
          const isPasswordValid = await compare(
            credentials.password,
            user.password
          );
          log.debug(
            `Password verification result: ${
              isPasswordValid ? "Valid" : "Invalid"
            }`
          );

          if (!isPasswordValid) {
            log.warn(
              `Login attempt failed: Invalid password for user ${credentials.email}`
            );
            return null;
          }

          log.info(`Authentication successful for user: ${user.email}`);

          // Return user data (without password)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
          };
        } catch (error) {
          log.error("Authentication error", error);
          if (error instanceof Error) {
            log.error("Error details", {
              message: error.message,
              stack: error.stack,
            });
          }
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours - refresh the session every 24 hours
  },
  callbacks: {
    async session({ session, token }) {
      log.debug("Session callback called with", {
        sessionUser: session?.user ? { ...session.user, id: "REDACTED" } : null,
        tokenSub: token?.sub ? "EXISTS" : "MISSING",
      });

      // Add user ID to session
      if (session.user && token.sub) {
        session.user.id = token.sub;

        // Cache the session to reduce repeated auth checks
        cacheSession(token.sub, session.user);

        log.debug("Added user ID to session and cached session");
      } else {
        log.warn(
          "Could not add user ID to session - missing user or token.sub"
        );
      }

      return session;
    },
    async jwt({ token, user, account }) {
      log.debug("JWT callback called with", {
        tokenExists: !!token,
        userExists: !!user,
        accountExists: !!account,
        accountProvider: account?.provider,
      });

      // Add user ID to token
      if (user) {
        token.id = user.id;
        log.debug("Added user ID to token");
      }

      // Add auth provider info to token
      if (account) {
        token.provider = account.provider;
        log.debug(`Added provider (${account.provider}) to token`);
      }

      return token;
    },
    async redirect({ url, baseUrl }) {
      log.debug("Redirect callback called with", { url, baseUrl });

      try {
        // Validate baseUrl to ensure it's a valid URL
        if (!baseUrl || !baseUrl.startsWith("http")) {
          log.error(`Invalid baseUrl: "${baseUrl}". Using fallback URL.`);
          // Fallback to a hardcoded URL if baseUrl is invalid
          baseUrl = process.env.NEXTAUTH_URL || "https://datachat.mrcto.ai";
          log.info(`Using fallback baseUrl: ${baseUrl}`);
        }

        // Validate url to ensure it's a valid URL or path
        if (!url) {
          log.error(`Invalid url: "${url}". Using fallback path.`);
          url = "/project";
          log.info(`Using fallback url: ${url}`);
        }

        // Redirect to projects page after sign in
        if (url.startsWith(baseUrl)) {
          // log.info(
          //   `URL starts with baseUrl, redirecting to ${baseUrl}/project`
          // );
          return `${baseUrl}/project`;
        }
        // Redirect to projects page if trying to access home page after sign in
        else if (url === "/") {
          log.info(`URL is root, redirecting to ${baseUrl}/project`);
          return `${baseUrl}/project`;
        }

        // Check if URL is absolute or relative
        if (url.startsWith("http")) {
          // For absolute URLs, validate that they're properly formatted
          try {
            new URL(url);
            log.info(`Returning valid absolute URL: ${url}`);
            return url;
          } catch (error) {
            log.error(
              `Invalid absolute URL: "${url}". Redirecting to default.`
            );
            return `${baseUrl}/project`;
          }
        } else {
          // For relative URLs, just return them
          log.info(`Returning relative URL: ${url}`);
          return url;
        }
      } catch (error) {
        // Catch any unexpected errors in the redirect logic
        log.error("Error in redirect callback", error);
        // Return a safe default
        return "/project";
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
