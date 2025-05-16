#!/usr/bin/env node

/**
 * This script specifically fixes the failed migration issue by:
 * 1. Marking the failed migration as resolved
 * 2. Applying the fixed migrations
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

console.log(`${colors.cyan}=== Failed Migration Fix Script ===${colors.reset}`);
console.log(
  `${colors.yellow}This script will fix the failed migration issue${colors.reset}`
);

// Function to run a command and handle errors
function runCommand(command, description) {
  console.log(`${colors.blue}${description}...${colors.reset}`);
  try {
    const output = execSync(command, { stdio: "inherit" });
    console.log(`${colors.green}✓ Success${colors.reset}`);
    return output;
  } catch (error) {
    console.error(`${colors.red}✗ Failed: ${error.message}${colors.reset}`);
    throw error;
  }
}

// Main process
async function fixFailedMigration() {
  try {
    // Step 1: Mark the failed migration as resolved
    console.log(
      `${colors.magenta}Resolving failed migration...${colors.reset}`
    );
    runCommand(
      "npx prisma migrate resolve --rolled-back 20250513_add_batch_processing",
      "Marking failed migration as rolled back"
    );

    // Step 2: Restore the original migration file temporarily
    console.log(
      `${colors.blue}Restoring original migration file temporarily...${colors.reset}`
    );
    const bakPath = path.join(
      __dirname,
      "..",
      "prisma",
      "migrations",
      "20250513_add_batch_processing.bak"
    );
    const origPath = path.join(
      __dirname,
      "..",
      "prisma",
      "migrations",
      "20250513_add_batch_processing"
    );

    if (!fs.existsSync(origPath)) {
      fs.mkdirSync(origPath, { recursive: true });
    }

    fs.copyFileSync(
      path.join(bakPath, "migration.sql"),
      path.join(origPath, "migration.sql")
    );
    console.log(
      `${colors.green}✓ Original migration file restored${colors.reset}`
    );

    // Step 3: Apply the fixed migrations
    console.log(`${colors.magenta}Applying fixed migrations...${colors.reset}`);

    // Apply the project models migration first if not already applied
    try {
      runCommand(
        "npx prisma migrate deploy --skip-generate",
        "Deploying migrations"
      );
    } catch (error) {
      console.error(
        `${colors.red}Migration deployment failed: ${error.message}${colors.reset}`
      );
      console.log(
        `${colors.yellow}Trying alternative approach...${colors.reset}`
      );

      // If the above fails, try a more targeted approach
      runCommand(
        "npx prisma db push --skip-generate --accept-data-loss",
        "Pushing schema changes directly"
      );
    }

    // Step 4: Generate Prisma client
    runCommand("npx prisma generate", "Generating Prisma client");

    console.log(
      `${colors.green}=== Migration fix completed successfully ===${colors.reset}`
    );
    console.log(
      `${colors.cyan}You can now use your database normally.${colors.reset}`
    );
  } catch (error) {
    console.error(
      `${colors.red}Migration fix failed: ${error.message}${colors.reset}`
    );
    process.exit(1);
  }
}

// Run the migration fix
fixFailedMigration().catch((error) => {
  console.error(
    `${colors.red}Unhandled error: ${error.message}${colors.reset}`
  );
  process.exit(1);
});
