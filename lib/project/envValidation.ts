/**
 * Environment variable validation for the simplified data upload flow
 */

/**
 * Validate environment variables for the simplified data upload flow
 * @returns Object with validation results
 */
export function validateProjectEnvVars(): {
  isValid: boolean;
  missingVars: string[];
  invalidVars: { name: string; reason: string }[];
} {
  const requiredVars = ["DATABASE_URL", "STORAGE_PROVIDER"];

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

  const missingVars: string[] = [];
  const invalidVars: { name: string; reason: string }[] = [];

  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // Validate project variables if they exist
  if (process.env.PROJECT_STORAGE_PATH) {
    // No validation needed, any string is valid
  }

  if (process.env.MAX_PROJECTS_PER_USER) {
    const maxProjects = parseInt(process.env.MAX_PROJECTS_PER_USER);
    if (isNaN(maxProjects) || maxProjects <= 0) {
      invalidVars.push({
        name: "MAX_PROJECTS_PER_USER",
        reason: "Must be a positive number",
      });
    }
  }

  if (process.env.SCHEMA_VALIDATION_LEVEL) {
    const validLevels = ["strict", "lenient"];
    if (!validLevels.includes(process.env.SCHEMA_VALIDATION_LEVEL)) {
      invalidVars.push({
        name: "SCHEMA_VALIDATION_LEVEL",
        reason: `Must be one of: ${validLevels.join(", ")}`,
      });
    }
  }

  if (process.env.MAX_SCHEMA_COLUMNS) {
    const maxColumns = parseInt(process.env.MAX_SCHEMA_COLUMNS);
    if (isNaN(maxColumns) || maxColumns <= 0) {
      invalidVars.push({
        name: "MAX_SCHEMA_COLUMNS",
        reason: "Must be a positive number",
      });
    }
  }

  if (process.env.COLUMN_MAPPING_STRATEGY) {
    const validStrategies = ["exact", "fuzzy", "none"];
    if (!validStrategies.includes(process.env.COLUMN_MAPPING_STRATEGY)) {
      invalidVars.push({
        name: "COLUMN_MAPPING_STRATEGY",
        reason: `Must be one of: ${validStrategies.join(", ")}`,
      });
    }
  }

  if (process.env.ENABLE_SCHEMA_EVOLUTION) {
    const validValues = ["true", "false"];
    if (!validValues.includes(process.env.ENABLE_SCHEMA_EVOLUTION)) {
      invalidVars.push({
        name: "ENABLE_SCHEMA_EVOLUTION",
        reason: "Must be 'true' or 'false'",
      });
    }
  }

  if (process.env.NORMALIZATION_BATCH_SIZE) {
    const batchSize = parseInt(process.env.NORMALIZATION_BATCH_SIZE);
    if (isNaN(batchSize) || batchSize <= 0) {
      invalidVars.push({
        name: "NORMALIZATION_BATCH_SIZE",
        reason: "Must be a positive number",
      });
    }
  }

  if (process.env.ENABLE_DATA_VALIDATION) {
    const validValues = ["true", "false"];
    if (!validValues.includes(process.env.ENABLE_DATA_VALIDATION)) {
      invalidVars.push({
        name: "ENABLE_DATA_VALIDATION",
        reason: "Must be 'true' or 'false'",
      });
    }
  }

  return {
    isValid: missingVars.length === 0 && invalidVars.length === 0,
    missingVars,
    invalidVars,
  };
}

/**
 * Get environment variables with default values
 * @returns Object with environment variables
 */
export function getProjectEnvVars() {
  return {
    projectStoragePath: process.env.PROJECT_STORAGE_PATH || "./projects",
    maxProjectsPerUser: parseInt(process.env.MAX_PROJECTS_PER_USER || "50"),
    schemaValidationLevel: process.env.SCHEMA_VALIDATION_LEVEL || "strict",
    maxSchemaColumns: parseInt(process.env.MAX_SCHEMA_COLUMNS || "100"),
    columnMappingStrategy: process.env.COLUMN_MAPPING_STRATEGY || "fuzzy",
    enableSchemaEvolution: process.env.ENABLE_SCHEMA_EVOLUTION !== "false",
    normalizationBatchSize: parseInt(
      process.env.NORMALIZATION_BATCH_SIZE || "1000"
    ),
    enableDataValidation: process.env.ENABLE_DATA_VALIDATION !== "false",
  };
}

/**
 * Log environment validation results
 * @param validationResults Validation results from validateProjectEnvVars
 */
export function logEnvValidationResults(validationResults: {
  isValid: boolean;
  missingVars: string[];
  invalidVars: { name: string; reason: string }[];
}) {
  if (validationResults.isValid) {
    console.log("Environment variables validation passed");
    return;
  }

  console.warn("Environment variables validation failed:");

  if (validationResults.missingVars.length > 0) {
    console.warn("Missing variables:");
    validationResults.missingVars.forEach((varName) => {
      console.warn(`- ${varName}`);
    });
  }

  if (validationResults.invalidVars.length > 0) {
    console.warn("Invalid variables:");
    validationResults.invalidVars.forEach((invalidVar) => {
      console.warn(`- ${invalidVar.name}: ${invalidVar.reason}`);
    });
  }

  console.warn(
    "Please check your .env file and update the variables accordingly."
  );
  console.warn("See docs/environment-variables.md for more information.");
}
