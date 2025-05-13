/**
 * Test script for the GlobalSchemaService
 *
 * To run this test:
 * 1. First compile the TypeScript files: npx tsc
 * 2. Then run: node --experimental-specifier-resolution=node test-global-schema-service.js
 */

// Import the GlobalSchemaService
import { GlobalSchemaService } from "./lib/globalSchemaService.js";

// Create a new instance of the GlobalSchemaService
const schemaService = new GlobalSchemaService();

// Test user ID
const userId = "test-user@example.com";
const projectId = "test-project-123";

/**
 * Test getting schema templates
 */
async function testGetSchemaTemplates() {
  console.log("\n=== Testing getSchemaTemplates ===");
  try {
    const templates = schemaService.getSchemaTemplates();
    console.log(`Found ${templates.length} templates:`);
    templates.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name}: ${template.description}`);
      console.log(`   Columns: ${template.columns.length}`);
    });
  } catch (error) {
    console.error("Error getting schema templates:", error);
  }
}

/**
 * Test creating a schema from a template
 */
async function testCreateSchemaFromTemplate() {
  console.log("\n=== Testing createSchemaFromTemplate ===");
  try {
    const schema = await schemaService.createSchemaFromTemplate(
      userId,
      projectId,
      "User Data",
      "Test User Schema",
      "A test schema for user data"
    );
    console.log("Created schema from template:");
    console.log(`ID: ${schema.id}`);
    console.log(`Name: ${schema.name}`);
    console.log(`Description: ${schema.description}`);
    console.log(`Columns: ${schema.columns.length}`);
    console.log(`Version: ${schema.version}`);
    return schema;
  } catch (error) {
    console.error("Error creating schema from template:", error);
  }
}

/**
 * Test creating a schema with custom columns
 */
async function testCreateGlobalSchema() {
  console.log("\n=== Testing createGlobalSchema ===");
  try {
    const schema = await schemaService.createGlobalSchema(
      userId,
      projectId,
      "Test Custom Schema",
      "A test schema with custom columns",
      [
        {
          name: "id",
          type: "text",
          description: "Unique identifier",
          isRequired: true,
          isPrimaryKey: true,
        },
        {
          name: "name",
          type: "text",
          description: "Name",
          isRequired: true,
        },
        {
          name: "age",
          type: "integer",
          description: "Age",
          validationRules: [
            {
              type: "min",
              value: 0,
              errorMessage: "Age must be greater than or equal to 0",
            },
          ],
        },
      ]
    );
    console.log("Created custom schema:");
    console.log(`ID: ${schema.id}`);
    console.log(`Name: ${schema.name}`);
    console.log(`Description: ${schema.description}`);
    console.log(`Columns: ${schema.columns.length}`);
    console.log(`Version: ${schema.version}`);
    return schema;
  } catch (error) {
    console.error("Error creating custom schema:", error);
  }
}

/**
 * Test getting schemas for a user
 */
async function testGetGlobalSchemas() {
  console.log("\n=== Testing getGlobalSchemas ===");
  try {
    const schemas = await schemaService.getGlobalSchemas(userId);
    console.log(`Found ${schemas.length} schemas for user ${userId}:`);
    schemas.forEach((schema, index) => {
      console.log(`${index + 1}. ${schema.name}: ${schema.description}`);
      console.log(`   ID: ${schema.id}`);
      console.log(`   Columns: ${schema.columns.length}`);
      console.log(`   Version: ${schema.version}`);
      console.log(`   Active: ${schema.isActive}`);
    });
  } catch (error) {
    console.error("Error getting schemas:", error);
  }
}

/**
 * Test getting schemas for a project
 */
async function testGetGlobalSchemasByProject() {
  console.log("\n=== Testing getGlobalSchemas by project ===");
  try {
    const schemas = await schemaService.getGlobalSchemas(userId, projectId);
    console.log(`Found ${schemas.length} schemas for project ${projectId}:`);
    schemas.forEach((schema, index) => {
      console.log(`${index + 1}. ${schema.name}: ${schema.description}`);
      console.log(`   ID: ${schema.id}`);
      console.log(`   Columns: ${schema.columns.length}`);
      console.log(`   Version: ${schema.version}`);
      console.log(`   Active: ${schema.isActive}`);
    });
  } catch (error) {
    console.error("Error getting schemas by project:", error);
  }
}

/**
 * Test getting a schema by ID
 */
async function testGetGlobalSchemaById(schemaId) {
  console.log("\n=== Testing getGlobalSchemaById ===");
  try {
    const schema = await schemaService.getGlobalSchemaById(schemaId);
    if (schema) {
      console.log("Found schema:");
      console.log(`ID: ${schema.id}`);
      console.log(`Name: ${schema.name}`);
      console.log(`Description: ${schema.description}`);
      console.log(`Columns: ${schema.columns.length}`);
      console.log(`Version: ${schema.version}`);
      console.log(`Previous Version ID: ${schema.previousVersionId || "None"}`);
    } else {
      console.log(`Schema with ID ${schemaId} not found`);
    }
    return schema;
  } catch (error) {
    console.error("Error getting schema by ID:", error);
  }
}

/**
 * Test updating a schema
 */
async function testUpdateGlobalSchema(schema) {
  console.log("\n=== Testing updateGlobalSchema ===");
  try {
    // Add a new column to the schema
    const updatedSchema = {
      ...schema,
      columns: [
        ...schema.columns,
        {
          name: "email",
          type: "text",
          description: "Email address",
          isRequired: true,
          validationRules: [
            {
              type: "pattern",
              value: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
              errorMessage: "Invalid email format",
            },
          ],
        },
      ],
    };

    const result = await schemaService.updateGlobalSchema(updatedSchema);
    if (result) {
      console.log("Updated schema:");
      console.log(`ID: ${result.id}`);
      console.log(`Name: ${result.name}`);
      console.log(`Description: ${result.description}`);
      console.log(`Columns: ${result.columns.length}`);
      console.log(`Version: ${result.version}`);
    } else {
      console.log("Failed to update schema");
    }
    return result;
  } catch (error) {
    console.error("Error updating schema:", error);
  }
}

/**
 * Test creating a new version of a schema
 */
async function testCreateNewSchemaVersion(schema) {
  console.log("\n=== Testing updateGlobalSchema with createNewVersion ===");
  try {
    // Add a new column to the schema
    const updatedSchema = {
      ...schema,
      columns: [
        ...schema.columns,
        {
          name: "address",
          type: "text",
          description: "Physical address",
        },
      ],
    };

    const result = await schemaService.updateGlobalSchema(updatedSchema, true);
    if (result) {
      console.log("Created new schema version:");
      console.log(`ID: ${result.id}`);
      console.log(`Name: ${result.name}`);
      console.log(`Description: ${result.description}`);
      console.log(`Columns: ${result.columns.length}`);
      console.log(`Version: ${result.version}`);
      console.log(`Previous Version ID: ${result.previousVersionId}`);
    } else {
      console.log("Failed to create new schema version");
    }
    return result;
  } catch (error) {
    console.error("Error creating new schema version:", error);
  }
}

/**
 * Test validating a schema
 */
async function testValidateSchema() {
  console.log("\n=== Testing validateSchema ===");
  try {
    // Valid schema
    const validSchema = {
      id: "test-schema",
      userId: "test-user",
      name: "Test Schema",
      columns: [
        {
          name: "id",
          type: "text",
        },
        {
          name: "name",
          type: "text",
        },
      ],
    };

    const validResult = schemaService.validateSchema(validSchema);
    console.log("Valid schema validation result:");
    console.log(`Is valid: ${validResult.isValid}`);
    console.log(`Errors: ${validResult.errors.length}`);
    console.log(`Warnings: ${validResult.warnings.length}`);

    // Invalid schema
    const invalidSchema = {
      id: "test-schema",
      userId: "test-user",
      name: "Test Schema",
      columns: [
        {
          name: "id",
          type: "text",
        },
        {
          name: "id", // Duplicate column name
          type: "text",
        },
        {
          name: "age",
          type: "invalid-type", // Invalid type
        },
      ],
    };

    const invalidResult = schemaService.validateSchema(invalidSchema);
    console.log("\nInvalid schema validation result:");
    console.log(`Is valid: ${invalidResult.isValid}`);
    console.log(`Errors: ${invalidResult.errors.length}`);
    if (invalidResult.errors.length > 0) {
      console.log("Error messages:");
      invalidResult.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    console.log(`Warnings: ${invalidResult.warnings.length}`);
    if (invalidResult.warnings.length > 0) {
      console.log("Warning messages:");
      invalidResult.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
    }
  } catch (error) {
    console.error("Error validating schema:", error);
  }
}

/**
 * Test deleting a schema
 */
async function testDeleteGlobalSchema(schemaId) {
  console.log("\n=== Testing deleteGlobalSchema ===");
  try {
    const result = await schemaService.deleteGlobalSchema(schemaId);
    console.log(`Delete result: ${result}`);
    return result;
  } catch (error) {
    console.error("Error deleting schema:", error);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    // Test getting schema templates
    await testGetSchemaTemplates();

    // Test creating a schema from a template
    const templateSchema = await testCreateSchemaFromTemplate();

    // Test creating a schema with custom columns
    const customSchema = await testCreateGlobalSchema();

    // Test getting schemas for a user
    await testGetGlobalSchemas();

    // Test getting schemas for a project
    await testGetGlobalSchemasByProject();

    // Test getting a schema by ID
    const retrievedSchema = await testGetGlobalSchemaById(customSchema.id);

    // Test updating a schema
    const updatedSchema = await testUpdateGlobalSchema(retrievedSchema);

    // Test creating a new version of a schema
    const newVersionSchema = await testCreateNewSchemaVersion(updatedSchema);

    // Test validating a schema
    await testValidateSchema();

    // Test getting schema versions
    if (newVersionSchema) {
      console.log("\n=== Testing schema versions ===");
      console.log(`New version schema ID: ${newVersionSchema.id}`);
      console.log(`Previous version ID: ${newVersionSchema.previousVersionId}`);

      // Get the previous version
      const previousVersion = await testGetGlobalSchemaById(
        newVersionSchema.previousVersionId
      );
      console.log(`Previous version schema ID: ${previousVersion.id}`);
      console.log(
        `Previous version schema version: ${previousVersion.version}`
      );
    }

    // Test deleting a schema
    if (templateSchema) {
      await testDeleteGlobalSchema(templateSchema.id);
    }
  } catch (error) {
    console.error("Error running tests:", error);
  }
}

// Run the tests
runTests();
