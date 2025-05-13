#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 *
 * This script validates the environment variables for RapidDataChat,
 * with a focus on those related to the simplified data upload flow.
 */

// Load environment variables from .env file
require("dotenv").config();

// Define required variables
const requiredVars = ["DATABASE_URL", "STORAGE_PROVIDER"];

// Define project-specific variables
const projectVars = [
  "PROJECT_STORAGE_PATH",
  "MAX_PROJECTS_PER_USER",
  "SCHEMA_VALIDATION_LEVEL",
  "MAX_SCHEMA_COLUMNS",
  "COLUMN_MAPPING_STRATEGY",
  "ENABLE_SCHEMA_EVOLUTION",
  "NORMALIZATION_BATCH_SIZE",
  "ENABLE_DATA_VALIDATION",
];

// Validation rules
const validationRules = {
  MAX_PROJECTS_PER_USER: {
    validate: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num > 0;
    },
    message: "Must be a positive number",
  },
  SCHEMA_VALIDATION_LEVEL: {
    validate: (value) => ["strict", "lenient"].includes(value),
    message: "Must be one of: strict, lenient",
  },
  MAX_SCHEMA_COLUMNS: {
    validate: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num > 0;
    },
    message: "Must be a positive number",
  },
  COLUMN_MAPPING_STRATEGY: {
    validate: (value) => ["exact", "fuzzy", "none"].includes(value),
    message: "Must be one of: exact, fuzzy, none",
  },
  ENABLE_SCHEMA_EVOLUTION: {
    validate: (value) => ["true", "false"].includes(value),
    message: "Must be 'true' or 'false'",
  },
  NORMALIZATION_BATCH_SIZE: {
    validate: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num > 0;
    },
    message: "Must be a positive number",
  },
  ENABLE_DATA_VALIDATION: {
    validate: (value) => ["true", "false"].includes(value),
    message: "Must be 'true' or 'false'",
  },
};

// Default values
const defaultValues = {
  PROJECT_STORAGE_PATH: "./projects",
  MAX_PROJECTS_PER_USER: "50",
  SCHEMA_VALIDATION_LEVEL: "strict",
  MAX_SCHEMA_COLUMNS: "100",
  COLUMN_MAPPING_STRATEGY: "fuzzy",
  ENABLE_SCHEMA_EVOLUTION: "true",
  NORMALIZATION_BATCH_SIZE: "1000",
  ENABLE_DATA_VALIDATION: "true",
};

// Validate environment variables
function validateEnv() {
  const missingVars = [];
  const invalidVars = [];
  const warnings = [];

  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // Check project variables
  for (const varName of projectVars) {
    const value = process.env[varName];

    // If the variable is not set, add a warning
    if (!value) {
      warnings.push(
        `${varName} is not set, using default: ${defaultValues[varName]}`
      );
      continue;
    }

    // If the variable has a validation rule, validate it
    if (validationRules[varName]) {
      const { validate, message } = validationRules[varName];
      if (!validate(value)) {
        invalidVars.push({ name: varName, reason: message });
      }
    }
  }

  return { missingVars, invalidVars, warnings };
}

// Main function
function main() {
  console.log("=== RapidDataChat Environment Variables Validation ===\n");

  const { missingVars, invalidVars, warnings } = validateEnv();

  // Print warnings
  if (warnings.length > 0) {
    console.log("Warnings:");
    warnings.forEach((warning) => {
      console.log(`- ${warning}`);
    });
    console.log("");
  }

  // Print missing variables
  if (missingVars.length > 0) {
    console.error("Missing required variables:");
    missingVars.forEach((varName) => {
      console.error(`- ${varName}`);
    });
    console.log("");
  }

  // Print invalid variables
  if (invalidVars.length > 0) {
    console.error("Invalid variables:");
    invalidVars.forEach(({ name, reason }) => {
      console.error(`- ${name}: ${reason}`);
    });
    console.log("");
  }

  // Print result
  if (missingVars.length === 0 && invalidVars.length === 0) {
    console.log("✅ All required environment variables are valid.");

    if (warnings.length > 0) {
      console.log("⚠️  Some variables are using default values.");
      console.log("   See docs/environment-variables.md for more information.");
    }

    process.exit(0);
  } else {
    console.error("❌ Environment variables validation failed.");
    console.error(
      "   Please check your .env file and update the variables accordingly."
    );
    console.error("   See docs/environment-variables.md for more information.");
    process.exit(1);
  }
}

// Run the main function
main();
