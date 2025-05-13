const {
  DataNormalizationService,
} = require("./lib/dataNormalization/dataNormalizationService");
const { GlobalSchemaService } = require("./lib/globalSchemaService");

/**
 * Test script for the DataNormalizationService
 */
async function testDataNormalization() {
  try {
    console.log("Starting DataNormalizationService test...");

    // Create instances of the services
    const dataNormalizationService = new DataNormalizationService();
    const globalSchemaService = new GlobalSchemaService();

    // Test parameters
    const userId = "test-user@example.com";
    const projectId = "test-project-" + Date.now();
    const fileId = "test-file-" + Date.now();

    // Step 1: Create a test schema
    console.log("\nStep 1: Creating test schema...");
    const schema = await globalSchemaService.createGlobalSchema(
      userId,
      projectId,
      "Test Schema",
      "Schema for testing data normalization",
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
          validationRules: [
            {
              type: "pattern",
              value: "^[A-Za-z\\s]+$",
              errorMessage: "Name must contain only letters and spaces",
            },
          ],
        },
        {
          name: "age",
          type: "integer",
          description: "Age",
          validationRules: [
            {
              type: "min",
              value: 0,
              errorMessage: "Age must be a positive number",
            },
            {
              type: "max",
              value: 120,
              errorMessage: "Age must be less than 120",
            },
          ],
        },
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
        {
          name: "active",
          type: "boolean",
          description: "Whether the user is active",
        },
      ]
    );

    console.log(`Created schema: ${schema.id}`);

    // Step 2: Create a column mapping
    console.log("\nStep 2: Creating column mapping...");
    const columnMapping = {
      fileId,
      schemaId: schema.id,
      mappings: [
        {
          fileColumn: "user_id",
          schemaColumn: "id",
        },
        {
          fileColumn: "full_name",
          schemaColumn: "name",
        },
        {
          fileColumn: "user_age",
          schemaColumn: "age",
          transformationRule: "NUMBER",
        },
        {
          fileColumn: "user_email",
          schemaColumn: "email",
          transformationRule: "LOWER",
        },
        {
          fileColumn: "is_active",
          schemaColumn: "active",
          transformationRule: "BOOLEAN",
        },
      ],
    };

    const mappingSaved = await globalSchemaService.saveColumnMapping(
      columnMapping
    );
    console.log(`Column mapping saved: ${mappingSaved}`);

    // Step 3: Create test data
    console.log("\nStep 3: Creating test data...");
    const testData = [
      {
        user_id: "user1",
        full_name: "John Doe",
        user_age: "30",
        user_email: "JOHN.DOE@example.com",
        is_active: "true",
      },
      {
        user_id: "user2",
        full_name: "Jane Smith",
        user_age: "25",
        user_email: "jane.smith@example.com",
        is_active: "1",
      },
      {
        user_id: "user3",
        full_name: "Bob Johnson",
        user_age: "invalid",
        user_email: "bob.johnson@example.com",
        is_active: "false",
      },
      {
        user_id: "user4",
        full_name: "Alice Brown123",
        user_age: "40",
        user_email: "not-an-email",
        is_active: "0",
      },
      {
        user_id: "",
        full_name: "Missing ID",
        user_age: "35",
        user_email: "missing.id@example.com",
        is_active: "yes",
      },
    ];

    // Step 4: Normalize the data
    console.log("\nStep 4: Normalizing data...");
    const result = await dataNormalizationService.normalizeAndStoreData(
      fileId,
      projectId,
      testData,
      columnMapping,
      {
        skipInvalidRows: false,
        validateTypes: true,
        validateRequired: true,
        validateConstraints: true,
      }
    );

    console.log("\nNormalization result:");
    console.log(`Success: ${result.success}`);
    console.log(`Normalized count: ${result.normalizedCount}`);
    console.log(`Error count: ${result.errorCount}`);

    console.log("\nErrors:");
    result.errors.forEach((error, index) => {
      console.log(`Error ${index + 1}:`);
      console.log(`  Row: ${error.rowIndex}`);
      console.log(`  Column: ${error.column}`);
      console.log(`  Value: ${error.value}`);
      console.log(`  Error: ${error.error}`);
    });

    console.log("\nWarnings:");
    result.warnings.forEach((warning, index) => {
      console.log(`Warning ${index + 1}:`);
      console.log(`  Row: ${warning.rowIndex}`);
      console.log(`  Column: ${warning.column}`);
      console.log(`  Value: ${warning.value}`);
      console.log(`  Warning: ${warning.warning}`);
    });

    // Step 5: Retrieve normalized data
    console.log("\nStep 5: Retrieving normalized data for project...");
    const normalizedData = await dataNormalizationService.getNormalizedData(
      projectId
    );

    console.log(`Retrieved ${normalizedData.length} normalized records:`);
    normalizedData.forEach((record, index) => {
      console.log(`Record ${index + 1}:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Project ID: ${record.projectId}`);
      console.log(`  File ID: ${record.fileId}`);
      console.log(`  Schema ID: ${record.schemaId}`);
      console.log(`  Version: ${record.version}`);
      console.log(`  Created At: ${record.createdAt}`);
      console.log(`  Data: ${JSON.stringify(record.data, null, 2)}`);
    });

    // Step 6: Retrieve normalized data for file
    console.log("\nStep 6: Retrieving normalized data for file...");
    const fileNormalizedData =
      await dataNormalizationService.getNormalizedDataForFile(fileId);

    console.log(
      `Retrieved ${fileNormalizedData.length} normalized records for file:`
    );
    fileNormalizedData.forEach((record, index) => {
      console.log(`Record ${index + 1}:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Data: ${JSON.stringify(record.data, null, 2)}`);
    });

    console.log("\nDataNormalizationService test completed successfully!");
  } catch (error) {
    console.error("Error in DataNormalizationService test:", error);
  }
}

// Run the test
testDataNormalization();
