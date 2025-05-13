const fetch = require("node-fetch");

async function testSchemaManagement() {
  try {
    console.log("Testing schema management API...");

    const response = await fetch(
      "http://localhost:3000/api/schema-management",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_from_files",
          name: "Global Schema",
          description: "Automatically generated global schema",
        }),
      }
    );

    const data = await response.json();
    console.log("Response:", data);
  } catch (error) {
    console.error("Error testing schema management API:", error);
  }
}

testSchemaManagement();
