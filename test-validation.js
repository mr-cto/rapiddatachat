// Test script to verify that non-SELECT queries return the SQL query in the response
const fetch = require("node-fetch");

async function testNonSelectQuery() {
  try {
    console.log("Testing non-SELECT query validation...");

    // This is a non-SELECT query that should be caught by validation
    const response = await fetch("http://localhost:3000/api/nl-to-sql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "Delete all records",
        userId: "dev@example.com",
      }),
    });

    const result = await response.json();
    console.log("Response status:", response.status);
    console.log("Response body:", JSON.stringify(result, null, 2));

    // Check if the SQL query is included in the response
    if (result.sqlQuery) {
      console.log("SUCCESS: SQL query is included in the response!");
      console.log("SQL Query:", result.sqlQuery);
    } else {
      console.log("FAILURE: SQL query is not included in the response.");
    }

    console.log("Error message:", result.error);
  } catch (error) {
    console.error("Error during test:", error);
  }
}

testNonSelectQuery();
