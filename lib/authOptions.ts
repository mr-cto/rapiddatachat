import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import { getPrismaClient } from "./prisma/replicaClient";

// Initialize Prisma client using the replica-aware client
const prisma = getPrismaClient();

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
        console.log(
          "Authorize function called with credentials:",
          credentials ? { email: credentials.email } : "no credentials"
        );

        if (!credentials?.email || !credentials?.password) {
          console.log("Missing email or password");
          return null;
        }

        try {
          console.log(
            `Looking up user with email: ${credentials.email.toLowerCase()}`
          );

          // Find user in the database (case insensitive)
          // Use the replica client directly to ensure we're using the correct database
          const user = await prisma.useReplica(async (replicaClient) => {
            return replicaClient.user.findUnique({
              where: { email: credentials.email.toLowerCase() },
            });
          });

          console.log(
            `User lookup result: ${user ? "User found" : "User not found"}`
          );

          // If user doesn't exist or password doesn't match
          if (!user || !user.password) {
            console.log(
              `Login attempt failed: User with email ${credentials.email} not found or has no password`
            );
            return null;
          }

          // Verify password
          console.log("Verifying password...");
          const isPasswordValid = await compare(
            credentials.password,
            user.password
          );
          console.log(
            `Password verification result: ${
              isPasswordValid ? "Valid" : "Invalid"
            }`
          );

          if (!isPasswordValid) {
            console.log(
              `Login attempt failed: Invalid password for user ${credentials.email}`
            );
            return null;
          }

          console.log(`Authentication successful for user: ${user.email}`);

          // Return user data (without password)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          if (error instanceof Error) {
            console.error("Error details:", error.message);
            console.error("Error stack:", error.stack);
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
      console.log("Session callback called with:", {
        sessionUser: session?.user ? { ...session.user, id: "REDACTED" } : null,
        tokenSub: token?.sub ? "EXISTS" : "MISSING",
      });

      // Add user ID to session
      if (session.user && token.sub) {
        session.user.id = token.sub;
        console.log("Added user ID to session");
      } else {
        console.log(
          "Could not add user ID to session - missing user or token.sub"
        );
      }

      return session;
    },
    async jwt({ token, user, account }) {
      console.log("JWT callback called with:", {
        tokenExists: !!token,
        userExists: !!user,
        accountExists: !!account,
        accountProvider: account?.provider,
      });

      // Add user ID to token
      if (user) {
        token.id = user.id;
        console.log("Added user ID to token");
      }

      // Add auth provider info to token
      if (account) {
        token.provider = account.provider;
        console.log(`Added provider (${account.provider}) to token`);
      }

      return token;
    },
    async redirect({ url, baseUrl }) {
      console.log("Redirect callback called with:", { url, baseUrl });

      try {
        // Validate baseUrl to ensure it's a valid URL
        if (!baseUrl || !baseUrl.startsWith("http")) {
          console.error(`Invalid baseUrl: "${baseUrl}". Using fallback URL.`);
          // Fallback to a hardcoded URL if baseUrl is invalid
          baseUrl = process.env.NEXTAUTH_URL || "https://datachat.mrcto.ai";
          console.log(`Using fallback baseUrl: ${baseUrl}`);
        }

        // Validate url to ensure it's a valid URL or path
        if (!url) {
          console.error(`Invalid url: "${url}". Using fallback path.`);
          url = "/project";
          console.log(`Using fallback url: ${url}`);
        }

        // Redirect to projects page after sign in
        if (url.startsWith(baseUrl)) {
          console.log(
            `URL starts with baseUrl, redirecting to ${baseUrl}/project`
          );
          return `${baseUrl}/project`;
        }
        // Redirect to projects page if trying to access home page after sign in
        else if (url === "/") {
          console.log(`URL is root, redirecting to ${baseUrl}/project`);
          return `${baseUrl}/project`;
        }

        // Check if URL is absolute or relative
        if (url.startsWith("http")) {
          // For absolute URLs, validate that they're properly formatted
          try {
            new URL(url);
            console.log(`Returning valid absolute URL: ${url}`);
            return url;
          } catch (error) {
            console.error(
              `Invalid absolute URL: "${url}". Redirecting to default.`
            );
            return `${baseUrl}/project`;
          }
        } else {
          // For relative URLs, just return them
          console.log(`Returning relative URL: ${url}`);
          return url;
        }
      } catch (error) {
        // Catch any unexpected errors in the redirect logic
        console.error("Error in redirect callback:", error);
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
