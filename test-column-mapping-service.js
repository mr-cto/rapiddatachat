const { ColumnMappingService } = require("./lib/columnMappingService");
const { GlobalSchemaService } = require("./lib/globalSchemaService");

/**
 * Test script for the ColumnMappingService
 */
async function testColumnMappingService() {
  try {
    console.log("Starting ColumnMappingService test...");

    // Create instances of the services
    const columnMappingService = new ColumnMappingService();
    const globalSchemaService = new GlobalSchemaService();

    // Test parameters
    const userId = "test-user@example.com";
    const projectId = "test-project-" + Date.now();

    // Step 1: Create a test schema
    console.log("\nStep 1: Creating test schema...");
    const schema = await globalSchemaService.createGlobalSchema(
      userId,
      projectId,
      "Test Schema",
      "Schema for testing column mapping",
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
          description: "Full name",
          isRequired: true,
        },
        {
          name: "email",
          type: "text",
          description: "Email address",
          isRequired: true,
        },
        {
          name: "age",
          type: "integer",
          description: "Age in years",
        },
      ]
    );

    console.log(`Created schema: ${schema.id}`);

    // Step 2: Create a test file
    console.log("\nStep 2: Creating test file...");

    // We'll simulate a file since we don't have a real file upload in this test
    const fileId = `file_${Date.now()}`;
    const fileName = "test-data.csv";
    const filePath = `/uploads/${fileName}`;

    // Create column info for the file
    const columnInfo = [
      {
        name: "user_id",
        originalName: "user_id",
        type: "text",
        index: 0,
      },
      {
        name: "full_name",
        originalName: "full_name",
        type: "text",
        index: 1,
      },
      {
        name: "user_email",
        originalName: "user_email",
        type: "text",
        index: 2,
      },
      {
        name: "user_age",
        originalName: "user_age",
        type: "integer",
        index: 3,
      },
      {
        name: "address",
        originalName: "address",
        type: "text",
        index: 4,
      },
    ];

    // Create sample data for the file
    const sampleData = [
      {
        user_id: "1001",
        full_name: "John Doe",
        user_email: "john@example.com",
        user_age: "32",
        address: "123 Main St",
      },
      {
        user_id: "1002",
        full_name: "Jane Smith",
        user_email: "jane@example.com",
        user_age: "28",
        address: "456 Oak Ave",
      },
      {
        user_id: "1003",
        full_name: "Bob Johnson",
        user_email: "bob@example.com",
        user_age: "45",
        address: "789 Pine Rd",
      },
    ];

    // Insert the file into the database
    await executeQuery(`
      INSERT INTO files (
        id,
        name,
        file_path,
        user_id,
        project_id,
        column_info,
        created_at,
        updated_at
      )
      VALUES (
        '${fileId}',
        '${fileName}',
        '${filePath}',
        '${userId}',
        '${projectId}',
        '${JSON.stringify(columnInfo)}',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    // Insert the parsed data into the database
    await executeQuery(`
      INSERT INTO file_parsed_data (
        id,
        file_id,
        sample_data,
        full_data_path,
        created_at,
        updated_at
      )
      VALUES (
        'parsed_${fileId}',
        '${fileId}',
        '${JSON.stringify(sampleData)}',
        '${filePath}.parquet',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);

    console.log(`Created file: ${fileId}`);

    // Step 3: Get file columns
    console.log("\nStep 3: Getting file columns...");
    const fileColumns = await columnMappingService.getFileColumns(fileId);

    console.log(`Found ${fileColumns.length} file columns:`);
    fileColumns.forEach((column, index) => {
      console.log(`Column ${index + 1}:`);
      console.log(`  Name: ${column.name}`);
      console.log(`  Original Name: ${column.originalName}`);
      console.log(`  Type: ${column.type}`);
      console.log(`  Index: ${column.index}`);
      if (column.sampleValues && column.sampleValues.length > 0) {
        console.log(`  Sample Values: ${column.sampleValues.join(", ")}`);
      }
    });

    // Step 4: Get schema columns
    console.log("\nStep 4: Getting schema columns...");
    const schemaColumns = await columnMappingService.getSchemaColumns(
      schema.id
    );

    console.log(`Found ${schemaColumns.length} schema columns:`);
    schemaColumns.forEach((column, index) => {
      console.log(`Column ${index + 1}:`);
      console.log(`  ID: ${column.id}`);
      console.log(`  Name: ${column.name}`);
      console.log(`  Type: ${column.type}`);
      console.log(`  Description: ${column.description}`);
      console.log(`  Required: ${column.isRequired}`);
      console.log(`  Primary Key: ${column.isPrimaryKey}`);
    });

    // Step 5: Get mapping suggestions
    console.log("\nStep 5: Getting mapping suggestions...");
    const suggestions = await columnMappingService.suggestMappings(
      fileColumns,
      schemaColumns
    );

    console.log("Suggested mappings:");
    Object.entries(suggestions.suggestions).forEach(
      ([fileColumnName, schemaColumnId]) => {
        const schemaColumn = schemaColumns.find(
          (sc) => sc.id === schemaColumnId
        );
        console.log(
          `  ${fileColumnName} -> ${
            schemaColumn ? schemaColumn.name : "Unknown"
          }`
        );
        console.log(
          `    Confidence: ${suggestions.confidence[fileColumnName]}`
        );
        console.log(`    Reason: ${suggestions.reason[fileColumnName]}`);
      }
    );

    // Step 6: Create mappings
    console.log("\nStep 6: Creating mappings...");
    const mappings = [];

    // Add mappings based on suggestions
    Object.entries(suggestions.suggestions).forEach(
      ([fileColumnName, schemaColumnId]) => {
        mappings.push({
          fileColumnName,
          schemaColumnId,
        });
      }
    );

    // Add a manual mapping for address (which won't have a suggestion)
    // We'll map it to the name field just for testing purposes
    const nameColumn = schemaColumns.find((sc) => sc.name === "name");
    if (nameColumn) {
      mappings.push({
        fileColumnName: "address",
        schemaColumnId: nameColumn.id,
      });
    }

    console.log(`Created ${mappings.length} mappings:`);
    mappings.forEach((mapping, index) => {
      const schemaColumn = schemaColumns.find(
        (sc) => sc.id === mapping.schemaColumnId
      );
      console.log(`Mapping ${index + 1}:`);
      console.log(`  File Column: ${mapping.fileColumnName}`);
      console.log(
        `  Schema Column: ${schemaColumn ? schemaColumn.name : "Unknown"}`
      );
    });

    // Step 7: Save mappings
    console.log("\nStep 7: Saving mappings...");
    const saveResult = await columnMappingService.saveMappings(
      fileId,
      schema.id,
      mappings
    );

    console.log(`Mappings saved: ${saveResult}`);

    // Step 8: Get saved mappings
    console.log("\nStep 8: Getting saved mappings...");
    const savedMappings = await columnMappingService.getMappings(
      fileId,
      schema.id
    );

    console.log(`Found ${savedMappings.length} saved mappings:`);
    savedMappings.forEach((mapping, index) => {
      const schemaColumn = schemaColumns.find(
        (sc) => sc.id === mapping.schemaColumnId
      );
      console.log(`Mapping ${index + 1}:`);
      console.log(`  File Column: ${mapping.fileColumnName}`);
      console.log(
        `  Schema Column: ${schemaColumn ? schemaColumn.name : "Unknown"}`
      );
    });

    // Step 9: Apply mappings to data
    console.log("\nStep 9: Applying mappings to data...");
    const mappedData = await columnMappingService.applyMappings(
      sampleData,
      savedMappings,
      schemaColumns
    );

    console.log("Mapped data:");
    mappedData.forEach((row, index) => {
      console.log(`Row ${index + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    });

    console.log("\nColumnMappingService test completed successfully!");
  } catch (error) {
    console.error("Error in ColumnMappingService test:", error);
  }
}

/**
 * Helper function to execute a query
 */
async function executeQuery(query) {
  const { executeQuery: dbExecuteQuery } = require("./lib/database");
  return dbExecuteQuery(query);
}

// Run the test
testColumnMappingService();
