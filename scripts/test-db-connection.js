#!/usr/bin/env node

/**
 * This script tests the database connection and displays basic information
 * about the database schema.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

async function testConnection() {
  console.log(`${colors.cyan}=== Database Connection Test ===${colors.reset}`);

  try {
    // Test connection by querying for a single user
    console.log(`${colors.blue}Testing database connection...${colors.reset}`);
    await prisma.$connect();
    console.log(
      `${colors.green}✓ Successfully connected to the database${colors.reset}`
    );

    // Get table counts
    console.log(`\n${colors.cyan}=== Database Table Counts ===${colors.reset}`);

    const tables = [
      { name: "Users", query: prisma.user.count() },
      { name: "Projects", query: prisma.project.count() },
      { name: "Files", query: prisma.file.count() },
      { name: "GlobalSchemas", query: prisma.globalSchema.count() },
      { name: "SchemaColumns", query: prisma.schemaColumn.count() },
      { name: "ColumnMappings", query: prisma.columnMapping.count() },
      { name: "ColumnMerges", query: prisma.columnMerge.count() },
      { name: "Queries", query: prisma.query.count() },
      { name: "Results", query: prisma.result.count() },
      { name: "FileErrors", query: prisma.fileError.count() },
      {
        name: "DeadLetterQueueItems",
        query: prisma.deadLetterQueueItem.count(),
      },
      { name: "FileData", query: prisma.fileData.count() },
    ];

    for (const table of tables) {
      try {
        const count = await table.query;
        console.log(
          `${colors.blue}${table.name}:${colors.reset} ${count} records`
        );
      } catch (error) {
        console.log(
          `${colors.red}${table.name}:${colors.reset} Error - ${error.message}`
        );
      }
    }

    // Check for specific tables that might be causing issues
    console.log(
      `\n${colors.cyan}=== Checking Problematic Tables ===${colors.reset}`
    );

    // Execute raw query to check if dead_letter_queue exists
    const deadLetterQueueCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'dead_letter_queue'
      );
    `;
    console.log(
      `${colors.blue}dead_letter_queue table exists:${colors.reset} ${deadLetterQueueCheck[0].exists}`
    );

    // Execute raw query to check if projects exists
    const projectsCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'projects'
      );
    `;
    console.log(
      `${colors.blue}projects table exists:${colors.reset} ${projectsCheck[0].exists}`
    );

    console.log(
      `\n${colors.green}✓ Database connection test completed successfully${colors.reset}`
    );
  } catch (error) {
    console.error(
      `${colors.red}Error connecting to the database: ${error.message}${colors.reset}`
    );
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection().catch((error) => {
  console.error(
    `${colors.red}Unhandled error: ${error.message}${colors.reset}`
  );
  process.exit(1);
});
