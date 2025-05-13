#!/usr/bin/env node

/**
 * Environment Variables Setup Script
 *
 * This script helps set up environment variables for RapidDataChat.
 * It creates a .env file based on .env.example and prompts for values.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Path to .env.example and .env files
const exampleEnvPath = path.join(__dirname, "..", ".env.example");
const envPath = path.join(__dirname, "..", ".env");

// Check if .env.example exists
if (!fs.existsSync(exampleEnvPath)) {
  console.error("Error: .env.example file not found.");
  process.exit(1);
}

// Check if .env already exists
if (fs.existsSync(envPath)) {
  rl.question("A .env file already exists. Overwrite? (y/N): ", (answer) => {
    if (answer.toLowerCase() !== "y") {
      console.log("Setup cancelled.");
      rl.close();
      process.exit(0);
    } else {
      setupEnv();
    }
  });
} else {
  setupEnv();
}

/**
 * Main function to set up environment variables
 */
function setupEnv() {
  // Read .env.example file
  const exampleEnv = fs.readFileSync(exampleEnvPath, "utf8");

  // Parse example environment variables
  const envVars = parseEnvFile(exampleEnv);

  // Start prompting for values
  console.log("\n=== RapidDataChat Environment Setup ===\n");
  console.log("Press Enter to use default values (shown in parentheses).");
  console.log(
    'For sensitive values, type "generate" to create a random value.\n'
  );

  promptForNextVar(envVars, 0, {});
}

/**
 * Parse environment variables from file content
 * @param {string} content - File content
 * @returns {Array} Array of environment variable objects
 */
function parseEnvFile(content) {
  const lines = content.split("\n");
  const envVars = [];

  let currentComment = "";

  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === "") {
      continue;
    }

    // Collect comments
    if (line.startsWith("#")) {
      currentComment += line.substring(1).trim() + " ";
      continue;
    }

    // Parse variable
    const match = line.match(/^([A-Za-z0-9_]+)=["']?([^"']*)["']?$/);
    if (match) {
      const [, name, defaultValue] = match;
      envVars.push({
        name,
        defaultValue,
        description: currentComment.trim(),
      });
      currentComment = "";
    }
  }

  return envVars;
}

/**
 * Prompt for the next environment variable
 * @param {Array} envVars - Array of environment variables
 * @param {number} index - Current index
 * @param {Object} values - Collected values
 */
function promptForNextVar(envVars, index, values) {
  if (index >= envVars.length) {
    // All variables processed, write to .env file
    writeEnvFile(values);
    return;
  }

  const variable = envVars[index];
  const prompt = `${variable.name}${
    variable.description ? ` (${variable.description})` : ""
  }${variable.defaultValue ? ` (${variable.defaultValue})` : ""}: `;

  rl.question(prompt, (answer) => {
    let value = answer.trim();

    // Use default value if empty
    if (value === "" && variable.defaultValue) {
      value = variable.defaultValue;
    }

    // Generate random value if requested
    if (value === "generate") {
      if (variable.name === "NEXTAUTH_SECRET") {
        value = crypto.randomBytes(32).toString("base64");
      } else {
        value = crypto.randomBytes(16).toString("hex");
      }
      console.log(`Generated: ${value}`);
    }

    // Store the value
    values[variable.name] = value;

    // Move to the next variable
    promptForNextVar(envVars, index + 1, values);
  });
}

/**
 * Write environment variables to .env file
 * @param {Object} values - Collected values
 */
function writeEnvFile(values) {
  let content = "# RapidDataChat Environment Variables\n";
  content += "# Generated on " + new Date().toISOString() + "\n\n";

  for (const [name, value] of Object.entries(values)) {
    content += `${name}=${value}\n`;
  }

  fs.writeFileSync(envPath, content);

  console.log(`\n.env file created successfully at ${envPath}`);
  console.log(
    "You can now use these environment variables for local development."
  );
  console.log(
    "For Vercel deployment, add these variables in the Vercel dashboard."
  );

  rl.close();
}
