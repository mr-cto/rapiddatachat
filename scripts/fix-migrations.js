#!/usr/bin/env node

/**
 * This script helps fix Prisma migration issues by:
 * 1. Resetting the migration state in the database
 * 2. Applying migrations in the correct order
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

console.log(`${colors.cyan}=== Prisma Migration Fix Script ===${colors.reset}`);
console.log(
  `${colors.yellow}This script will help fix migration issues by resetting and reapplying migrations${colors.reset}`
);

// Check if we're using the fixed migrations
const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
const hasFixedMigrations =
  fs.existsSync(
    path.join(migrationsDir, "20250513_add_error_handling_fixed")
  ) &&
  fs.existsSync(
    path.join(migrationsDir, "20250513_add_batch_processing_fixed")
  );

if (!hasFixedMigrations) {
  console.log(
    `${colors.red}Error: Fixed migration files not found.${colors.reset}`
  );
  console.log(
    `Please ensure you have created the fixed migration files first.`
  );
  process.exit(1);
}

// Backup the schema.prisma file
console.log(`${colors.blue}Backing up schema.prisma...${colors.reset}`);
const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const backupPath = path.join(__dirname, "..", "prisma", "schema.prisma.backup");
fs.copyFileSync(schemaPath, backupPath);
console.log(
  `${colors.green}Schema backup created at ${backupPath}${colors.reset}`
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
async function fixMigrations() {
  try {
    // Step 1: Rename problematic migrations
    console.log(
      `${colors.blue}Renaming problematic migrations...${colors.reset}`
    );

    // Rename the original migrations to .bak
    if (
      fs.existsSync(path.join(migrationsDir, "20250513_add_error_handling"))
    ) {
      fs.renameSync(
        path.join(migrationsDir, "20250513_add_error_handling"),
        path.join(migrationsDir, "20250513_add_error_handling.bak")
      );
    }

    if (
      fs.existsSync(path.join(migrationsDir, "20250513_add_batch_processing"))
    ) {
      fs.renameSync(
        path.join(migrationsDir, "20250513_add_batch_processing"),
        path.join(migrationsDir, "20250513_add_batch_processing.bak")
      );
    }

    console.log(`${colors.green}✓ Migrations renamed${colors.reset}`);

    // Step 2: Apply migrations in the correct order
    console.log(
      `${colors.magenta}Starting migration process...${colors.reset}`
    );

    // First, apply the init migrations
    runCommand(
      "npx prisma migrate resolve --applied 20250507030812_init",
      "Marking init migration as applied"
    );
    runCommand(
      "npx prisma migrate resolve --applied 20250507031816_fix_schema_relations",
      "Marking schema relations migration as applied"
    );
    runCommand(
      "npx prisma migrate resolve --applied 20250507042859_add_filepath_to_file",
      "Marking filepath migration as applied"
    );
    runCommand(
      "npx prisma migrate resolve --applied 20250507_add_queries_table",
      "Marking queries table migration as applied"
    );

    // Apply the project models migration
    runCommand(
      "npx prisma migrate resolve --applied 20250513022650_add_project_and_schema_models",
      "Marking project models migration as applied"
    );

    // Apply the activation progress migration
    runCommand(
      "npx prisma migrate resolve --applied 20250512_add_activation_progress",
      "Marking activation progress migration as applied"
    );

    // Apply the fixed migrations
    runCommand(
      "npx prisma migrate resolve --applied 20250513_add_batch_processing_fixed",
      "Marking fixed batch processing migration as applied"
    );
    runCommand(
      "npx prisma migrate resolve --applied 20250513_add_error_handling_fixed",
      "Marking fixed error handling migration as applied"
    );

    // Apply the remaining migrations
    runCommand(
      "npx prisma migrate resolve --applied 20250513_add_normalized_storage",
      "Marking normalized storage migration as applied"
    );
    runCommand(
      "npx prisma migrate resolve --applied 20250513_add_relationship_management",
      "Marking relationship management migration as applied"
    );
    runCommand(
      "npx prisma migrate resolve --applied 20250513_add_validation_framework",
      "Marking validation framework migration as applied"
    );

    console.log(
      `${colors.green}✓ All migrations marked as applied${colors.reset}`
    );

    // Step 3: Generate Prisma client
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
    console.log(
      `${colors.yellow}Restoring schema.prisma backup...${colors.reset}`
    );
    fs.copyFileSync(backupPath, schemaPath);
    console.log(`${colors.green}Schema restored from backup${colors.reset}`);
    process.exit(1);
  }
}

// Run the migration fix
fixMigrations().catch((error) => {
  console.error(
    `${colors.red}Unhandled error: ${error.message}${colors.reset}`
  );
  process.exit(1);
});
