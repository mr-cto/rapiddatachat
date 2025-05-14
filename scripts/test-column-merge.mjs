/**
 * Test script for column merge functionality
 *
 * This script tests the column merge service by:
 * 1. Creating a column merge
 * 2. Verifying the PostgreSQL view was created
 * 3. Deleting the column merge
 * 4. Verifying the PostgreSQL view was dropped
 */

import {
  createMergedColumnView,
  dropMergedColumnView,
  getMergedColumnViews,
} from "../lib/columnMergeService.js";

// Test configuration
const testConfig = {
  userId: "test-user",
  fileId: "test-file-id",
  mergeName: "full_name",
  columnList: ["first_name", "last_name"],
  delimiter: " ",
};

// Run the test
async function runTest() {
  console.log("Starting column merge test...");
  console.log("Test configuration:", testConfig);

  try {
    // Step 1: Create a column merge
    console.log("\n1. Creating column merge...");
    const createResult = await createMergedColumnView({
      id: "test-merge-id",
      userId: testConfig.userId,
      fileId: testConfig.fileId,
      mergeName: testConfig.mergeName,
      columnList: testConfig.columnList,
      delimiter: testConfig.delimiter,
    });

    console.log("Create result:", createResult);

    if (!createResult.success) {
      throw new Error(`Failed to create column merge: ${createResult.message}`);
    }

    // Step 2: Verify the view was created
    console.log("\n2. Verifying column merge view...");
    const views = await getMergedColumnViews(
      testConfig.userId,
      testConfig.fileId
    );
    console.log("Found views:", views);

    const createdView = views.find(
      (view) => view.mergeName === testConfig.mergeName
    );
    if (!createdView) {
      throw new Error("Created view not found in the list of views");
    }

    console.log("View verification successful!");

    // Step 3: Delete the column merge
    console.log("\n3. Deleting column merge...");
    const deleteResult = await dropMergedColumnView({
      id: "test-merge-id",
      userId: testConfig.userId,
      fileId: testConfig.fileId,
      mergeName: testConfig.mergeName,
      columnList: testConfig.columnList,
      delimiter: testConfig.delimiter,
    });

    console.log("Delete result:", deleteResult);

    if (!deleteResult.success) {
      throw new Error(`Failed to delete column merge: ${deleteResult.message}`);
    }

    // Step 4: Verify the view was dropped
    console.log("\n4. Verifying view was dropped...");
    const viewsAfterDelete = await getMergedColumnViews(
      testConfig.userId,
      testConfig.fileId
    );
    console.log("Views after delete:", viewsAfterDelete);

    const deletedView = viewsAfterDelete.find(
      (view) => view.mergeName === testConfig.mergeName
    );
    if (deletedView) {
      throw new Error("View was not properly deleted");
    }

    console.log("View deletion verification successful!");

    // Test successful
    console.log("\n✅ Column merge test completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
runTest();
