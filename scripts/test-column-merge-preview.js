/**
 * This script tests the column merge preview functionality.
 * It creates a test file, then uses the API to generate a preview of merged columns.
 */

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

// Configuration
const API_URL = "http://localhost:3000/api";
const TEST_FILE_PATH = path.join(__dirname, "../test_data.csv");
const TEST_USER_ID = "test@example.com";

// Main function
async function testColumnMergePreview() {
  try {
    console.log("Testing column merge preview functionality...");

    // Step 1: Upload a test file if it doesn't exist
    const fileId = await ensureTestFile();
    if (!fileId) {
      console.error("Failed to ensure test file exists");
      return;
    }

    console.log(`Using file ID: ${fileId}`);

    // Step 2: Get the columns from the file
    const columns = await getFileColumns(fileId);
    if (!columns || columns.length < 2) {
      console.error("File does not have enough columns for testing");
      return;
    }

    console.log(`Available columns: ${columns.join(", ")}`);

    // Step 3: Select two columns to merge
    const selectedColumns = columns.slice(0, 2);
    console.log(`Selected columns for merge: ${selectedColumns.join(", ")}`);

    // Step 4: Test preview with different delimiters
    const delimiters = ["", " ", ",", "-", "_", "."];

    for (const delimiter of delimiters) {
      console.log(`\nTesting preview with delimiter: "${delimiter}"`);

      // Generate preview
      const previewData = await generatePreview(
        fileId,
        selectedColumns,
        delimiter
      );

      if (!previewData) {
        console.error(
          `Failed to generate preview with delimiter: "${delimiter}"`
        );
        continue;
      }

      // Display preview results
      console.log(`Preview generated with ${previewData.length} rows`);

      if (previewData.length > 0) {
        const firstRow = previewData[0];
        console.log("First row preview:");

        // Show original column values
        selectedColumns.forEach((column) => {
          console.log(`  ${column}: ${firstRow[column]}`);
        });

        // Show merged column value
        console.log(`  Merged: ${firstRow.mergedColumn}`);

        // Verify the merged value
        const expectedMergedValue = selectedColumns
          .map((col) => (firstRow[col] ? String(firstRow[col]).trim() : ""))
          .filter((val) => val !== "")
          .join(delimiter);

        if (firstRow.mergedColumn === expectedMergedValue) {
          console.log("  ✅ Merged value is correct");
        } else {
          console.log(`  ❌ Merged value is incorrect`);
          console.log(`  Expected: "${expectedMergedValue}"`);
          console.log(`  Actual: "${firstRow.mergedColumn}"`);
        }
      }
    }

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error testing column merge preview:", error);
  }
}

// Helper function to ensure a test file exists
async function ensureTestFile() {
  try {
    // Check if the test file exists
    if (!fs.existsSync(TEST_FILE_PATH)) {
      console.error(`Test file not found: ${TEST_FILE_PATH}`);
      return null;
    }

    // Check if the file is already uploaded
    const filesResponse = await fetch(`${API_URL}/files`);
    const filesData = await filesResponse.json();

    const existingFile = filesData.files.find(
      (file) =>
        file.filename === path.basename(TEST_FILE_PATH) &&
        file.status === "active"
    );

    if (existingFile) {
      console.log("Using existing test file");
      return existingFile.id;
    }

    // Upload the file
    console.log("Uploading test file...");

    const formData = new FormData();
    formData.append("file", fs.createReadStream(TEST_FILE_PATH));

    const uploadResponse = await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.error("Failed to upload file:", await uploadResponse.text());
      return null;
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.fileId;

    // Activate the file
    console.log("Activating file...");
    const activateResponse = await fetch(`${API_URL}/activate-file/${fileId}`, {
      method: "POST",
    });

    if (!activateResponse.ok) {
      console.error("Failed to activate file:", await activateResponse.text());
      return null;
    }

    console.log("File uploaded and activated successfully");
    return fileId;
  } catch (error) {
    console.error("Error ensuring test file:", error);
    return null;
  }
}

// Helper function to get columns from a file
async function getFileColumns(fileId) {
  try {
    const response = await fetch(
      `${API_URL}/file-data/${fileId}?page=1&pageSize=1`
    );

    if (!response.ok) {
      console.error("Failed to get file data:", await response.text());
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.error("No data found in file");
      return null;
    }

    // Extract columns from the first row
    const firstRow = data.data[0];
    const dataObj =
      firstRow.data &&
      typeof firstRow.data === "object" &&
      !Array.isArray(firstRow.data)
        ? firstRow.data
        : firstRow;

    return Object.keys(dataObj);
  } catch (error) {
    console.error("Error getting file columns:", error);
    return null;
  }
}

// Helper function to generate a preview of merged columns
async function generatePreview(fileId, columnList, delimiter, limit = 5) {
  try {
    const response = await fetch(`${API_URL}/column-merges/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId,
        columnList,
        delimiter,
        limit,
      }),
    });

    if (!response.ok) {
      console.error("Failed to generate preview:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.previewData;
  } catch (error) {
    console.error("Error generating preview:", error);
    return null;
  }
}

// Run the test
testColumnMergePreview().catch(console.error);
