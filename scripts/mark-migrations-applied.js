#!/usr/bin/env node

/**
 * This script marks all migrations as applied in the database.
 * Use this when the schema is already in sync with the database
 * but the migration history is not up to date.
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

console.log(`${colors.cyan}=== Mark Migrations as Applied ===${colors.reset}`);
console.log(
  `${colors.yellow}This script will mark all migrations as applied in the database${colors.reset}`
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
    // Continue with other migrations even if one fails
    return null;
  }
}

// Get all migration directories
function getMigrationDirectories() {
  const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
  return fs.readdirSync(migrationsDir).filter((dir) => {
    // Filter out non-directories and the migration_lock.toml file
    const stats = fs.statSync(path.join(migrationsDir, dir));
    return stats.isDirectory() && !dir.endsWith(".bak");
  });
}

// Main process
async function markMigrationsAsApplied() {
  try {
    // Get all migration directories
    const migrations = getMigrationDirectories();
    console.log(
      `${colors.magenta}Found ${migrations.length} migrations${colors.reset}`
    );

    // Mark each migration as applied
    for (const migration of migrations) {
      runCommand(
        `npx prisma migrate resolve --applied ${migration}`,
        `Marking ${migration} as applied`
      );
    }

    // Generate Prisma client
    runCommand("npx prisma generate", "Generating Prisma client");

    console.log(
      `${colors.green}=== All migrations marked as applied ===${colors.reset}`
    );
    console.log(
      `${colors.cyan}You can now use your database normally.${colors.reset}`
    );
  } catch (error) {
    console.error(
      `${colors.red}Failed to mark migrations as applied: ${error.message}${colors.reset}`
    );
    process.exit(1);
  }
}

// Run the script
markMigrationsAsApplied().catch((error) => {
  console.error(
    `${colors.red}Unhandled error: ${error.message}${colors.reset}`
  );
  process.exit(1);
});
