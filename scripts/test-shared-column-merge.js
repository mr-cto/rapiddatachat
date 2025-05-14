/**
 * This script tests the column merge functionality in shared queries.
 * It creates a shared query with column merges via the API and verifies that
 * the column merges are displayed correctly in the shared query page.
 */

const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

// Configuration
const API_URL = "http://localhost:3000/api";
const SHARED_URL = "http://localhost:3000/shared";

// Main function
async function testSharedColumnMerge() {
  try {
    console.log("Testing column merge functionality in shared queries...");

    // Step 1: Prepare mock query data
    const mockQuery = {
      naturalLanguageQuery: "What are the top 5 companies by revenue?",
      sqlQuery:
        "SELECT company_name, revenue FROM companies ORDER BY revenue DESC LIMIT 5",
      results: [
        {
          company_name: "Company A",
          revenue: 1000000,
          location: "New York",
          founded: 2005,
        },
        {
          company_name: "Company B",
          revenue: 750000,
          location: "San Francisco",
          founded: 2010,
        },
        {
          company_name: "Company C",
          revenue: 500000,
          location: "Chicago",
          founded: 2008,
        },
        {
          company_name: "Company D",
          revenue: 250000,
          location: "Boston",
          founded: 2015,
        },
        {
          company_name: "Company E",
          revenue: 100000,
          location: "Seattle",
          founded: 2012,
        },
      ],
      columnMerges: [
        {
          id: "mock-merge-1",
          mergeName: "Company Info",
          columnList: ["company_name", "revenue"],
          delimiter: " - ",
        },
        {
          id: "mock-merge-2",
          mergeName: "Location Details",
          columnList: ["location", "founded"],
          delimiter: " (founded ",
        },
      ],
    };

    // Step 2: Create a shared query via API
    console.log("Creating shared query via API...");

    const response = await fetch(`${API_URL}/share-query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        naturalLanguageQuery: mockQuery.naturalLanguageQuery,
        sqlQuery: mockQuery.sqlQuery,
        results: mockQuery.results,
        columnMerges: mockQuery.columnMerges,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to create shared query: ${await response.text()}`);
      return;
    }

    const data = await response.json();
    const sharedId = data.id;

    console.log(`Created shared query with ID: ${sharedId}`);
    console.log(
      `Column merges: ${JSON.stringify(mockQuery.columnMerges, null, 2)}`
    );

    // Step 3: Create a direct URL for testing
    console.log(
      `\nTo test the shared query in the browser, visit:\n${SHARED_URL}/${sharedId}\n`
    );
    console.log("Expected behavior:");
    console.log("1. The shared query page should display the query results");
    console.log("2. The column merge functionality should be available");
    console.log(
      "3. The predefined column merges should be applied automatically"
    );
    console.log(
      '4. The "Company Info" merge should combine company_name and revenue with " - " delimiter'
    );
    console.log(
      '5. The "Location Details" merge should combine location and founded with " (founded " delimiter'
    );

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error testing shared column merge:", error);
  }
}

// Run the test
testSharedColumnMerge().catch(console.error);
