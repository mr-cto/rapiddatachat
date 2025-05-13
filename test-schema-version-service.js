const { SchemaVersionService } = require("./lib/schemaVersionService");
const { GlobalSchemaService } = require("./lib/globalSchemaService");

/**
 * Test script for the SchemaVersionService
 */
async function testSchemaVersionService() {
  try {
    console.log("Starting SchemaVersionService test...");

    // Create instances of the services
    const schemaVersionService = new SchemaVersionService();
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
      "Schema for testing version history",
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
          name: "email",
          type: "text",
          description: "Email address",
          isRequired: true,
        },
      ]
    );

    console.log(`Created schema: ${schema.id}`);

    // Step 2: Create a schema version
    console.log("\nStep 2: Creating schema version...");
    const version1 = await schemaVersionService.createSchemaVersion(
      schema,
      userId,
      "Initial version"
    );

    console.log(`Created version: ${version1.version}`);
    console.log(`Version ID: ${version1.id}`);

    // Step 3: Modify the schema
    console.log("\nStep 3: Modifying schema...");
    schema.columns.push({
      name: "age",
      type: "integer",
      description: "Age",
    });

    schema.columns = schema.columns.map((col) => {
      if (col.name === "email") {
        return {
          ...col,
          isRequired: false,
        };
      }
      return col;
    });

    // Update the schema
    const updatedSchema = await globalSchemaService.updateGlobalSchema(schema);
    console.log(`Updated schema: ${updatedSchema.id}`);

    // Step 4: Create another schema version
    console.log("\nStep 4: Creating another schema version...");
    const version2 = await schemaVersionService.createSchemaVersion(
      updatedSchema,
      userId,
      "Added age field and made email optional"
    );

    console.log(`Created version: ${version2.version}`);
    console.log(`Version ID: ${version2.id}`);

    // Step 5: Get all versions
    console.log("\nStep 5: Getting all versions...");
    const versions = await schemaVersionService.getSchemaVersions(schema.id);

    console.log(`Found ${versions.length} versions:`);
    versions.forEach((version, index) => {
      console.log(`Version ${index + 1}:`);
      console.log(`  ID: ${version.id}`);
      console.log(`  Version: ${version.version}`);
      console.log(`  Created At: ${version.createdAt}`);
      console.log(`  Created By: ${version.createdBy}`);
      console.log(`  Comment: ${version.comment}`);
      console.log(`  Columns: ${version.columns.length}`);

      if (version.changeLog && version.changeLog.length > 0) {
        console.log(`  Change Log: ${version.changeLog.length} changes`);
        version.changeLog.forEach((change, changeIndex) => {
          console.log(`    Change ${changeIndex + 1}:`);
          console.log(`      Type: ${change.type}`);
          console.log(`      Column: ${change.columnName}`);
          if (change.before) {
            console.log(`      Before: ${JSON.stringify(change.before)}`);
          }
          if (change.after) {
            console.log(`      After: ${JSON.stringify(change.after)}`);
          }
        });
      }
    });

    // Step 6: Compare versions
    console.log("\nStep 6: Comparing versions...");
    const comparison = schemaVersionService.compareSchemas(
      version1.columns,
      version2.columns
    );

    console.log("Comparison results:");
    console.log(`  Added columns: ${comparison.added.length}`);
    comparison.added.forEach((col, index) => {
      console.log(`    ${index + 1}. ${col.name} (${col.type})`);
    });

    console.log(`  Removed columns: ${comparison.removed.length}`);
    comparison.removed.forEach((col, index) => {
      console.log(`    ${index + 1}. ${col.name} (${col.type})`);
    });

    console.log(`  Modified columns: ${comparison.modified.length}`);
    comparison.modified.forEach((mod, index) => {
      console.log(`    ${index + 1}. ${mod.columnName}`);
      console.log(`       Before: ${JSON.stringify(mod.before)}`);
      console.log(`       After: ${JSON.stringify(mod.after)}`);
    });

    console.log(`  Unchanged columns: ${comparison.unchanged.length}`);
    comparison.unchanged.forEach((col, index) => {
      console.log(`    ${index + 1}. ${col.name} (${col.type})`);
    });

    // Step 7: Generate change script
    console.log("\nStep 7: Generating change script...");
    const changeScript = schemaVersionService.generateChangeScript(comparison);

    console.log("Change script:");
    console.log(changeScript);

    // Step 8: Rollback to version 1
    console.log("\nStep 8: Rolling back to version 1...");
    const rollbackResult = await schemaVersionService.rollbackSchema(
      schema.id,
      1,
      userId
    );

    console.log(`Rollback success: ${rollbackResult.success}`);
    console.log(`Rollback message: ${rollbackResult.message}`);

    if (rollbackResult.schema) {
      console.log(
        `Rolled back schema columns: ${rollbackResult.schema.columns.length}`
      );
    }

    // Step 9: Get the latest version after rollback
    console.log("\nStep 9: Getting latest version after rollback...");
    const latestVersion = await schemaVersionService.getLatestSchemaVersion(
      schema.id
    );

    console.log(`Latest version: ${latestVersion.version}`);
    console.log(`Latest version comment: ${latestVersion.comment}`);
    console.log(`Latest version columns: ${latestVersion.columns.length}`);

    console.log("\nSchemaVersionService test completed successfully!");
  } catch (error) {
    console.error("Error in SchemaVersionService test:", error);
  }
}

// Run the test
testSchemaVersionService();
