const { SchemaTransactionService } = require("./lib/schemaTransactionService");
const { GlobalSchemaService } = require("./lib/globalSchemaService");

/**
 * Test script for the SchemaTransactionService
 */
async function testSchemaTransactionService() {
  try {
    console.log("Starting SchemaTransactionService test...");

    // Create instances of the services
    const schemaTransactionService = new SchemaTransactionService();
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
      "Schema for testing transactions",
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

    // Step 2: Begin a transaction
    console.log("\nStep 2: Beginning transaction...");
    const transaction = await schemaTransactionService.beginTransaction(
      schema.id,
      userId
    );

    console.log(`Transaction ID: ${transaction.id}`);
    console.log(`Transaction status: ${transaction.status}`);

    // Step 3: Add operations to the transaction
    console.log("\nStep 3: Adding operations to the transaction...");

    // Add a new column
    await schemaTransactionService.addOperation(transaction.id, {
      type: "add_column",
      target: "age",
      params: {
        name: "age",
        type: "integer",
        description: "Age",
      },
    });

    // Modify an existing column
    await schemaTransactionService.addOperation(transaction.id, {
      type: "modify_column",
      target: "email",
      params: {
        isRequired: false,
        description: "Email address (optional)",
      },
    });

    // Get the updated transaction
    const updatedTransaction = await schemaTransactionService.getTransaction(
      transaction.id
    );

    console.log(`Operations added: ${updatedTransaction.operations.length}`);
    updatedTransaction.operations.forEach((op, index) => {
      console.log(`Operation ${index + 1}:`);
      console.log(`  Type: ${op.type}`);
      console.log(`  Target: ${op.target}`);
      console.log(`  Status: ${op.status}`);
    });

    // Step 4: Commit the transaction
    console.log("\nStep 4: Committing transaction...");
    const commitResult = await schemaTransactionService.commitTransaction(
      transaction.id
    );

    console.log(`Commit success: ${commitResult.success}`);
    console.log(`Commit message: ${commitResult.message}`);

    if (commitResult.schema) {
      console.log(
        `Updated schema columns: ${commitResult.schema.columns.length}`
      );
      commitResult.schema.columns.forEach((col, index) => {
        console.log(`Column ${index + 1}: ${col.name} (${col.type})`);
      });
    }

    // Step 5: Get the updated schema
    console.log("\nStep 5: Getting updated schema...");
    const updatedSchema = await globalSchemaService.getGlobalSchemaById(
      schema.id
    );

    console.log(`Updated schema version: ${updatedSchema.version}`);
    console.log(`Updated schema columns: ${updatedSchema.columns.length}`);
    updatedSchema.columns.forEach((col, index) => {
      console.log(`Column ${index + 1}: ${col.name} (${col.type})`);
      console.log(`  Description: ${col.description}`);
      console.log(`  Required: ${col.isRequired}`);
    });

    // Step 6: Begin another transaction
    console.log("\nStep 6: Beginning another transaction...");
    const transaction2 = await schemaTransactionService.beginTransaction(
      schema.id,
      userId
    );

    console.log(`Transaction ID: ${transaction2.id}`);

    // Add an operation to remove a column
    await schemaTransactionService.addOperation(transaction2.id, {
      type: "remove_column",
      target: "email",
      params: {},
    });

    // Step 7: Rollback the transaction
    console.log("\nStep 7: Rolling back transaction...");
    const rollbackResult = await schemaTransactionService.rollbackTransaction(
      transaction2.id
    );

    console.log(`Rollback success: ${rollbackResult.success}`);
    console.log(`Rollback message: ${rollbackResult.message}`);

    // Step 8: Get transactions for the schema
    console.log("\nStep 8: Getting transactions for the schema...");
    const transactions =
      await schemaTransactionService.getTransactionsForSchema(schema.id);

    console.log(`Found ${transactions.length} transactions:`);
    transactions.forEach((tx, index) => {
      console.log(`Transaction ${index + 1}:`);
      console.log(`  ID: ${tx.id}`);
      console.log(`  Status: ${tx.status}`);
      console.log(`  Operations: ${tx.operations.length}`);
      console.log(`  Started At: ${tx.startedAt}`);
      console.log(`  Completed At: ${tx.completedAt || "N/A"}`);
    });

    console.log("\nSchemaTransactionService test completed successfully!");
  } catch (error) {
    console.error("Error in SchemaTransactionService test:", error);
  }
}

// Run the test
testSchemaTransactionService();
