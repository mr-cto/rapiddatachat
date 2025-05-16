#!/usr/bin/env node

/**
 * This script cleans up backup migration directories
 * that are causing confusion in the migration status.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

console.log(`${colors.cyan}=== Migration Cleanup Script ===${colors.reset}`);
console.log(
  `${colors.yellow}This script will remove backup migration directories${colors.reset}`
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

// Function to recursively delete a directory
function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursive call
        deleteFolderRecursive(curPath);
      } else {
        // Delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

// Main process
async function cleanupMigrations() {
  try {
    const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
    const backupDirs = [
      path.join(migrationsDir, "20250513_add_batch_processing.bak"),
      path.join(migrationsDir, "20250513_add_error_handling.bak"),
    ];

    console.log(
      `${colors.magenta}Removing backup migration directories...${colors.reset}`
    );

    for (const dir of backupDirs) {
      if (fs.existsSync(dir)) {
        console.log(`${colors.blue}Removing ${dir}...${colors.reset}`);
        deleteFolderRecursive(dir);
        console.log(`${colors.green}✓ Removed ${dir}${colors.reset}`);
      } else {
        console.log(
          `${colors.yellow}Directory ${dir} does not exist, skipping${colors.reset}`
        );
      }
    }

    // Generate Prisma client
    runCommand("npx prisma generate", "Generating Prisma client");

    console.log(
      `${colors.green}=== Migration cleanup completed successfully ===${colors.reset}`
    );
    console.log(
      `${colors.cyan}You can now use your database normally.${colors.reset}`
    );
  } catch (error) {
    console.error(
      `${colors.red}Migration cleanup failed: ${error.message}${colors.reset}`
    );
    process.exit(1);
  }
}

// Run the script
cleanupMigrations().catch((error) => {
  console.error(
    `${colors.red}Unhandled error: ${error.message}${colors.reset}`
  );
  process.exit(1);
});
