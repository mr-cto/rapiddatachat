import NextAuth from "next-auth";
import { authOptions } from "../../../../lib/authOptions";

// Add debug logging
console.log("NextAuth API handler initialized");
console.log("Environment variables check:");

// Check NEXTAUTH_URL
const nextAuthUrl = process.env.NEXTAUTH_URL;
console.log("- NEXTAUTH_URL:", nextAuthUrl || "Not set");
if (!nextAuthUrl) {
  console.error(
    "WARNING: NEXTAUTH_URL is not set. This will cause authentication issues in production!"
  );
} else if (!nextAuthUrl.startsWith("http")) {
  console.error(
    `WARNING: NEXTAUTH_URL (${nextAuthUrl}) does not start with http:// or https://`
  );
}

// Check NEXTAUTH_SECRET
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
console.log("- NEXTAUTH_SECRET:", nextAuthSecret ? "Set" : "Not set");
if (!nextAuthSecret) {
  console.error(
    "WARNING: NEXTAUTH_SECRET is not set. This will cause authentication issues!"
  );
}

// Check other environment variables
console.log(
  "- GOOGLE_CLIENT_ID:",
  process.env.GOOGLE_CLIENT_ID ? "Set" : "Not set"
);
console.log(
  "- GOOGLE_CLIENT_SECRET:",
  process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Not set"
);
console.log("- NODE_ENV:", process.env.NODE_ENV);

// Create handler with error logging
const authHandler = NextAuth(authOptions);

// Export the handler with additional error handling
export default async function handler(req: any, res: any) {
  // Log detailed request information
  console.log(`NextAuth request: ${req.method} ${req.url}`);
  console.log("Request headers:", {
    host: req.headers.host,
    origin: req.headers.origin,
    referer: req.headers.referer,
    "user-agent": req.headers["user-agent"],
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "x-forwarded-host": req.headers["x-forwarded-host"],
    "x-forwarded-proto": req.headers["x-forwarded-proto"],
  });

  // Log cookies (without sensitive values)
  if (req.cookies) {
    console.log("Request cookies present:", Object.keys(req.cookies));
  } else {
    console.log("No cookies in request");
  }

  try {
    // Log the start time to measure performance
    const startTime = Date.now();
    const result = await authHandler(req, res);
    const duration = Date.now() - startTime;

    // Log response information
    console.log(
      `NextAuth response completed in ${duration}ms with status: ${res.statusCode}`
    );
    return result;
  } catch (error) {
    console.error("NextAuth error:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);

      // Log specific error types
      if (error.message.includes("CSRF")) {
        console.error(
          "CSRF token validation failed. This could be due to cookie issues or cross-domain problems."
        );
      } else if (error.message.includes("database")) {
        console.error(
          "Database connection error. Check DATABASE_URL environment variable."
        );
      } else if (error.message.includes("OAuth")) {
        console.error("OAuth provider error. Check provider configuration.");
      }
    }
    throw error;
  }
}
