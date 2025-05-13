/**
 * This script tests the merged column functionality with the LLM.
 * It creates a merged column, then uses the NLToSQLService to translate a natural language query
 * that references the merged column.
 */

const { createMergedColumnView } = require("../lib/columnMergeService");
const { NLToSQLService } = require("../lib/nlToSql/nlToSqlService");
const { executeQuery } = require("../lib/database");

// Configuration
const userId = "test@example.com"; // Replace with a valid user ID
const fileId = ""; // Replace with a valid file ID
const apiKey = process.env.OPENAI_API_KEY || ""; // Replace with your API key

async function testMergedColumnWithLLM() {
  try {
    console.log("Testing merged column functionality with LLM...");

    // Check if we have a valid file ID
    if (!fileId) {
      console.log("Getting the first active file...");
      const activeFiles = await executeQuery(`
        SELECT id, filename FROM files
        WHERE user_id = '${userId}' AND status = 'active'
        LIMIT 1
      `);

      if (!activeFiles || activeFiles.length === 0) {
        console.error("No active files found for user:", userId);
        return;
      }

      fileId = activeFiles[0].id;
      console.log(`Using file: ${activeFiles[0].filename} (${fileId})`);
    }

    // Get the columns for the file
    console.log("Getting columns for the file...");
    const fileData = await executeQuery(`
      SELECT data FROM file_data
      WHERE file_id = '${fileId}'
      LIMIT 1
    `);

    if (!fileData || fileData.length === 0) {
      console.error("No data found for file:", fileId);
      return;
    }

    const data = fileData[0].data;
    const columns = Object.keys(data);
    console.log("Available columns:", columns);

    // Select two columns to merge
    if (columns.length < 2) {
      console.error("Need at least two columns to create a merged column");
      return;
    }

    const columnList = [columns[0], columns[1]];
    console.log(`Creating merged column from: ${columnList.join(", ")}`);

    // Create a merged column
    const mergeConfig = {
      id: `test-${Date.now()}`,
      userId,
      fileId,
      mergeName: "merged_test",
      columnList,
      delimiter: " ",
    };

    console.log("Creating merged column view...");
    const result = await createMergedColumnView(mergeConfig);
    console.log("Merged column view creation result:", result);

    if (!result.success) {
      console.error("Failed to create merged column view:", result.message);
      return;
    }

    // Initialize the NLToSQLService
    console.log("Initializing NLToSQLService...");
    const nlToSqlService = new NLToSQLService({
      apiKey,
      model: "gpt-4",
    });

    // Test queries that use the merged column
    const queries = [
      `Show me all records with merged_test containing "${columnList[0]}"`,
      `Count how many records have merged_test starting with "A"`,
      `What's the average length of merged_test?`,
    ];

    for (const query of queries) {
      console.log("\n-----------------------------------");
      console.log(`Testing query: "${query}"`);

      try {
        const result = await nlToSqlService.translateQuery(query, userId);
        console.log("Translation result:");
        console.log("SQL:", result.sql);
        console.log("Explanation:", result.explanation);

        // Execute the SQL query
        console.log("Executing SQL query...");
        const queryResult = await executeQuery(result.sql);
        console.log("Query result:", queryResult.slice(0, 5)); // Show only the first 5 results
      } catch (error) {
        console.error("Error translating or executing query:", error);
      }
    }

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error testing merged column with LLM:", error);
  }
}

// Run the test
testMergedColumnWithLLM().catch(console.error);
