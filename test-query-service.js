// Test script to directly test SQL query validation

// Create a mock executeQuery function
const executeQuery = async (query) => {
  console.log(`Mock executing query: ${query}`);
  return [];
};

// Simplified QueryService class with just the validateQuery method
class QueryService {
  async validateQuery(sqlQuery, options = {}) {
    try {
      // Check if the query is a SELECT query
      const trimmedQuery = sqlQuery.trim().toUpperCase();
      console.log("Validating SQL query:", sqlQuery);
      console.log(
        "Trimmed uppercase query starts with:",
        trimmedQuery.substring(0, 10)
      );

      if (!trimmedQuery.startsWith("SELECT")) {
        console.log("Query validation failed: Not a SELECT query");
        return {
          isValid: false,
          error:
            "Only SELECT queries are allowed. Please rephrase your question to ask for information retrieval rather than data modification.",
          sqlQuery: sqlQuery, // This is the key change we made
        };
      }

      // Check for dangerous operations
      const dangerousOperations = [
        "DROP",
        "DELETE",
        "TRUNCATE",
        "UPDATE",
        "INSERT",
        "ALTER",
        "CREATE",
        "GRANT",
        "REVOKE",
      ];

      for (const operation of dangerousOperations) {
        if (sqlQuery.toUpperCase().includes(operation)) {
          return {
            isValid: false,
            error: `Query contains dangerous operation: ${operation}`,
            sqlQuery: sqlQuery,
          };
        }
      }

      // Return valid for SELECT queries in this test
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sqlQuery: sqlQuery,
      };
    }
  }
}

async function testValidation() {
  try {
    console.log("Testing non-SELECT query validation...");

    // Create a new QueryService instance
    const queryService = new QueryService();

    // Test a non-SELECT query
    const nonSelectQuery = "DELETE FROM users WHERE id = 1";
    console.log(`Testing query: ${nonSelectQuery}`);

    const validationResult = await queryService.validateQuery(nonSelectQuery);
    console.log(
      "Validation result:",
      JSON.stringify(validationResult, null, 2)
    );

    // Check if the SQL query is included in the response
    if (validationResult.sqlQuery) {
      console.log("SUCCESS: SQL query is included in the validation response!");
      console.log("SQL Query:", validationResult.sqlQuery);
    } else {
      console.log(
        "FAILURE: SQL query is not included in the validation response."
      );
    }

    console.log("Error message:", validationResult.error);

    // Test a SELECT query (should be valid)
    const selectQuery = "SELECT * FROM users";
    console.log(`\nTesting query: ${selectQuery}`);

    const validSelectResult = await queryService.validateQuery(selectQuery);
    console.log(
      "Validation result for SELECT query:",
      JSON.stringify(validSelectResult, null, 2)
    );
  } catch (error) {
    console.error("Error during test:", error);
  }
}

testValidation();
