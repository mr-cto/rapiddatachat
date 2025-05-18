import type { NextApiRequest, NextApiResponse } from "next";
import { hash } from "bcryptjs";
import { getPrismaClient } from "../../../../lib/prisma/replicaClient";

// Initialize Prisma client
const prisma = getPrismaClient();

// Log database connection info
console.log("Database connection info:");
console.log(
  "- Connection string:",
  process.env.DATABASE_URL?.replace(/api_key=([^&]+)/, "api_key=****")
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Log database connection info (partial for security)
    const dbUrl = process.env.DATABASE_URL || "";
    const maskedDbUrl = dbUrl.includes("api_key=")
      ? dbUrl.replace(
          /api_key=([^&]+)/,
          "api_key=****" +
            dbUrl
              .split("api_key=")[1]
              .substring(dbUrl.split("api_key=")[1].length - 8)
        )
      : "DATABASE_URL not found or does not contain api_key";

    console.log("Database connection info:");
    console.log("- URL pattern:", maskedDbUrl);
    console.log(
      "- API key length:",
      dbUrl.includes("api_key=")
        ? dbUrl.split("api_key=")[1].split("&")[0].length
        : "N/A"
    );

    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Enhanced password validation
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    // Check password strength
    let strengthScore = 0;
    if (/[a-z]/.test(password)) strengthScore++; // Has lowercase
    if (/[A-Z]/.test(password)) strengthScore++; // Has uppercase
    if (/\d/.test(password)) strengthScore++; // Has number
    if (/[^A-Za-z0-9]/.test(password)) strengthScore++; // Has special char

    if (strengthScore < 3) {
      return res.status(400).json({
        message:
          "Password is too weak. Include uppercase, lowercase, numbers, and special characters.",
      });
    }

    console.log(`Signup attempt for email: ${email.toLowerCase().trim()}`);

    // Check if user already exists
    // Use the replica client directly to ensure we're using the correct database
    const existingUser = await prisma.useReplica(async (replicaClient) => {
      return replicaClient.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });
    });

    if (existingUser) {
      console.log(`Signup failed: Email ${email} already exists in database`);
      return res.status(409).json({
        message:
          "Email already in use. Please use a different email or sign in.",
      });
    }

    console.log("Hashing password...");
    // Hash the password
    const hashedPassword = await hash(password, 12);
    console.log("Password hashed successfully");

    console.log("Creating user in database...");
    // Create user in the database
    // Use the replica client directly to ensure we're using the correct database
    const user = await prisma.useReplica(async (replicaClient) => {
      return replicaClient.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
        },
      });
    });

    console.log(`User created successfully with ID: ${user.id}`);

    // Log all users in the database for debugging
    const allUsers = await prisma.useReplica(async (replicaClient) => {
      return replicaClient.user.findMany({
        select: { id: true, email: true, name: true },
      });
    });
    console.log("All users in database:", JSON.stringify(allUsers, null, 2));

    // Return success (without password)
    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error("Signup error:", error);

    // Handle known errors
    if (error.message === "User with this email already exists") {
      return res.status(409).json({
        message:
          "Email already in use. Please use a different email or sign in.",
      });
    }

    // Handle database connection errors
    if (
      error.code === "P1001" ||
      error.message?.includes("database connection")
    ) {
      console.error("Database connection error:", error);
      return res.status(503).json({
        message: "Service temporarily unavailable. Please try again later.",
      });
    }

    // Handle validation errors from database
    if (error.code === "P2002") {
      return res.status(409).json({
        message:
          "Email already in use. Please use a different email or sign in.",
      });
    }

    // Handle other Prisma errors
    if (error.code?.startsWith("P")) {
      console.error("Prisma error:", error);
      return res
        .status(500)
        .json({ message: "Database error. Please try again later." });
    }

    // Log the full error for debugging
    console.error("Unhandled signup error:", error);

    // Handle unknown errors
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again later." });
  }
}
