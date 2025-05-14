/**
 * Test script for column merge API functionality
 *
 * This script tests the column merge API endpoints by:
 * 1. Creating a column merge
 * 2. Fetching the column merge
 * 3. Deleting the column merge
 * 4. Verifying the column merge was deleted
 */

const fetch = require("node-fetch");

// Test configuration
const testConfig = {
  fileId: "test-file-id",
  mergeName: "full_name",
  columnList: ["first_name", "last_name"],
  delimiter: " ",
};

// API base URL
const API_BASE_URL = "http://localhost:3000/api";

// Run the test
async function runTest() {
  console.log("Starting column merge API test...");
  console.log("Test configuration:", testConfig);

  let createdMergeId = null;

  try {
    // Step 1: Create a column merge
    console.log("\n1. Creating column merge...");
    const createResponse = await fetch(`${API_BASE_URL}/column-merges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId: testConfig.fileId,
        mergeName: testConfig.mergeName,
        columnList: testConfig.columnList,
        delimiter: testConfig.delimiter,
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(
        `Failed to create column merge: ${
          errorData.error || createResponse.statusText
        }`
      );
    }

    const createData = await createResponse.json();
    createdMergeId = createData.columnMerge.id;

    console.log("Column merge created successfully with ID:", createdMergeId);

    // Step 2: Fetch the column merge
    console.log("\n2. Fetching column merge...");
    const getResponse = await fetch(
      `${API_BASE_URL}/column-merges?fileId=${testConfig.fileId}`
    );

    if (!getResponse.ok) {
      const errorData = await getResponse.json();
      throw new Error(
        `Failed to fetch column merges: ${
          errorData.error || getResponse.statusText
        }`
      );
    }

    const getData = await getResponse.json();
    console.log("Fetched column merges:", getData);

    const createdMerge = getData.columnMerges.find(
      (merge) => merge.id === createdMergeId
    );
    if (!createdMerge) {
      throw new Error("Created column merge not found in the list");
    }

    console.log("Column merge found:", createdMerge);

    // Step 3: Delete the column merge
    console.log("\n3. Deleting column merge...");
    const deleteResponse = await fetch(
      `${API_BASE_URL}/column-merges/${createdMergeId}`,
      {
        method: "DELETE",
      }
    );

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      throw new Error(
        `Failed to delete column merge: ${
          errorData.error || deleteResponse.statusText
        }`
      );
    }

    console.log("Column merge deleted successfully");

    // Step 4: Verify the column merge was deleted
    console.log("\n4. Verifying column merge was deleted...");
    const verifyResponse = await fetch(
      `${API_BASE_URL}/column-merges?fileId=${testConfig.fileId}`
    );

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      throw new Error(
        `Failed to fetch column merges: ${
          errorData.error || verifyResponse.statusText
        }`
      );
    }

    const verifyData = await verifyResponse.json();
    const deletedMerge = verifyData.columnMerges.find(
      (merge) => merge.id === createdMergeId
    );

    if (deletedMerge) {
      throw new Error("Column merge was not properly deleted");
    }

    console.log("Column merge deletion verified successfully");

    // Test successful
    console.log("\n✅ Column merge API test completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);

    // Clean up if needed
    if (createdMergeId) {
      try {
        console.log("\nAttempting to clean up created column merge...");
        await fetch(`${API_BASE_URL}/column-merges/${createdMergeId}`, {
          method: "DELETE",
        });
        console.log("Cleanup successful");
      } catch (cleanupError) {
        console.error("Cleanup failed:", cleanupError);
      }
    }

    process.exit(1);
  }
}

// Run the test
runTest();
