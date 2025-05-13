// Test script for gender identification query generation
const { createNLToSQLService } = require("./lib/nlToSql/nlToSqlService");
const { createLLMService } = require("./lib/nlToSql/llmService");

// Mock schema service
const mockSchemaService = {
  getSchemaForActiveTables: async () => ({
    tables: [
      {
        name: "attorneys",
        columns: [
          { name: "First", type: "text" },
          { name: "Last", type: "text" },
          { name: "Title", type: "text" },
          { name: "Type", type: "text" },
          { name: "Email", type: "text" },
          { name: "Position", type: "text" },
        ],
        rowCount: 1000,
      },
    ],
  }),
  formatSchemaForPrompt: async () => `
    Table: attorneys
    Columns:
    - First (text)
    - Last (text)
    - Title (text)
    - Type (text)
    - Email (text)
    - Position (text)
  `,
  getSampleData: async () => `
    Sample data:
    {
      "First": "Jennifer",
      "Last": "Smith",
      "Title": "Ms.",
      "Type": "ATTORNEY",
      "Email": "jsmith@lawfirm.com",
      "Position": "Partner"
    }
  `,
};

// Mock query service
const mockQueryService = {
  validateQuery: async () => ({ isValid: true }),
  executeQuery: async () => ({
    rows: [],
    executionTime: 100,
    totalRows: 0,
    totalPages: 0,
    currentPage: 1,
  }),
};

// Create a test NLToSQLService with mocked dependencies
const createTestNLToSQLService = () => {
  const service = createNLToSQLService();
  service.schemaService = mockSchemaService;
  service.queryService = mockQueryService;
  return service;
};

// Test cases for gender identification queries
const testCases = [
  {
    name: "Simple female query",
    query: "show me all females",
    expectedPatterns: [/ILIKE.*'%Ms\.%'/i, /ILIKE.*'%Mrs\.%'/i, /ARRAY/i, /\(/],
  },
  {
    name: "Female attorneys query",
    query: "show me all female attorneys",
    expectedPatterns: [
      /ILIKE.*'%Ms\.%'/i,
      /ILIKE.*'%Mrs\.%'/i,
      /ARRAY/i,
      /Type.*ATTORNEY/i,
      /\(\(/,
    ],
  },
  {
    name: "Women lawyers query",
    query: "find women lawyers",
    expectedPatterns: [
      /ILIKE.*'%Ms\.%'/i,
      /ILIKE.*'%Mrs\.%'/i,
      /Type.*ATTORNEY/i,
      /\(/,
    ],
  },
];

// Run the tests
async function runTests() {
  console.log("Running gender identification query tests...\n");

  const nlToSQLService = createTestNLToSQLService();

  for (const test of testCases) {
    console.log(`Test: ${test.name}`);
    console.log(`Query: ${test.query}`);

    try {
      // Process the query
      const result = await nlToSQLService.processQuery(test.query, "test-user");

      console.log(`Generated SQL: ${result.sqlQuery}`);

      // Check if the SQL contains the expected patterns
      const passedPatterns = test.expectedPatterns.map((pattern) => {
        const matches = pattern.test(result.sqlQuery);
        return { pattern: pattern.toString(), passed: matches };
      });

      console.log("Pattern checks:");
      passedPatterns.forEach((p) => {
        console.log(`- ${p.pattern}: ${p.passed ? "PASSED" : "FAILED"}`);
      });

      const allPassed = passedPatterns.every((p) => p.passed);
      console.log(`Overall result: ${allPassed ? "PASSED" : "FAILED"}`);
    } catch (error) {
      console.error("Error processing query:", error);
      console.log("Test FAILED due to error");
    }

    console.log("-----------------------------------\n");
  }
}

// Execute the tests
console.log(
  "Note: This test requires mocking the LLM service to run properly."
);
console.log("In a real environment, you would need to provide valid API keys.");
console.log(
  "This test file is provided as a reference for how to test the gender query enhancements.\n"
);

// Uncomment to run the tests (requires proper mocking)
// runTests().catch(error => {
//   console.error('Error running tests:', error);
// });
