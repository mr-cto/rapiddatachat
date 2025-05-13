// Natural Language to SQL Query tests

describe("NL to SQL Query", () => {
  beforeEach(() => {
    // Login before each test
    cy.visit("/auth/signin");
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();

    // Upload and activate a test file if not already done
    cy.visit("/files");
    cy.get("body").then(($body) => {
      if (!$body.text().includes("sample.csv")) {
        cy.visit("/upload");
        cy.fixture("sample.csv", "base64").then((fileContent) => {
          cy.get('input[type="file"]').attachFile({
            fileContent,
            fileName: "sample.csv",
            mimeType: "text/csv",
          });
        });

        // Wait for upload to complete
        cy.contains("File uploaded successfully", { timeout: 10000 }).should(
          "be.visible"
        );

        // Navigate to files page
        cy.visit("/files");

        // Activate the file if not already active
        cy.contains("sample.csv")
          .parent()
          .then(($row) => {
            if ($row.text().includes("pending")) {
              cy.wrap($row).find('button[title="Activate File"]').click();
              cy.contains("sample.csv")
                .parent()
                .contains("active", { timeout: 30000 })
                .should("be.visible");
            }
          });
      }
    });

    // Navigate to query page
    cy.visit("/query");
  });

  it("should display the query interface", () => {
    // Check that the query page is displayed
    cy.contains("Natural Language Query").should("be.visible");
    cy.get("textarea").should("be.visible");
    cy.get("button").contains("Run Query").should("be.visible");
  });

  it("should show error for empty query", () => {
    // Submit empty query
    cy.get("button").contains("Run Query").click();

    // Check for error message
    cy.contains("Please enter a query").should("be.visible");
  });

  it("should execute a simple query", () => {
    // Enter a simple query
    cy.get("textarea").type("Show me all data");

    // Submit the query
    cy.get("button").contains("Run Query").click();

    // Check that results are displayed
    cy.get(".results-table").should("be.visible");
    cy.get(".results-table thead tr th").should("have.length.greaterThan", 0);
    cy.get(".results-table tbody tr").should("have.length.greaterThan", 0);
  });

  it("should execute a filtered query", () => {
    // Get the first column name from the schema
    cy.get(".schema-info").then(($schema) => {
      const columnName = $schema.find(".column-name").first().text();

      // Enter a query with a filter
      cy.get("textarea").type(`Show me rows where ${columnName} is not null`);

      // Submit the query
      cy.get("button").contains("Run Query").click();

      // Check that results are displayed
      cy.get(".results-table").should("be.visible");
      cy.get(".results-table tbody tr").should("have.length.greaterThan", 0);
    });
  });

  it("should show the generated SQL", () => {
    // Enter a query
    cy.get("textarea").type("Show me the top 5 rows");

    // Submit the query
    cy.get("button").contains("Run Query").click();

    // Check that SQL is displayed
    cy.contains("Generated SQL").should("be.visible");
    cy.get(".sql-code").should("contain", "SELECT");
    cy.get(".sql-code").should("contain", "LIMIT 5");
  });

  it("should handle query errors gracefully", () => {
    // Enter an invalid query
    cy.get("textarea").type("Show me data from nonexistent_table");

    // Submit the query
    cy.get("button").contains("Run Query").click();

    // Check for error message
    cy.contains("Error executing query").should("be.visible");
  });

  it("should apply filters from filter controls", () => {
    // Open filter controls
    cy.contains("Filters").click();

    // Select a file filter
    cy.get('select[name="fileFilter"]').select("sample.csv");

    // Enter a query
    cy.get("textarea").type("Show me all data");

    // Submit the query
    cy.get("button").contains("Run Query").click();

    // Check that results are displayed
    cy.get(".results-table").should("be.visible");
    cy.get(".results-table tbody tr").should("have.length.greaterThan", 0);
  });

  it("should share query results", () => {
    // Enter a query
    cy.get("textarea").type("Show me all data");

    // Submit the query
    cy.get("button").contains("Run Query").click();

    // Wait for results
    cy.get(".results-table").should("be.visible");

    // Click share button
    cy.contains("Share").click();

    // Check that share link is generated
    cy.get('input[type="text"]').should(
      "have.value",
      /^https:\/\/.*\/shared\/.*$/
    );

    // Copy the share link
    const shareLink = cy.get('input[type="text"]').invoke("val");

    // Visit the share link
    shareLink.then((link) => {
      cy.visit(link);

      // Check that shared results are displayed
      cy.get(".results-table").should("be.visible");
      cy.get(".results-table tbody tr").should("have.length.greaterThan", 0);
    });
  });

  it("should show query history", () => {
    // Execute a query
    cy.get("textarea").type("Show me all data");
    cy.get("button").contains("Run Query").click();

    // Wait for results
    cy.get(".results-table").should("be.visible");

    // Execute another query
    cy.get("textarea").clear().type("Show me the top 5 rows");
    cy.get("button").contains("Run Query").click();

    // Check query history
    cy.contains("History").click();

    // Verify both queries are in history
    cy.get(".query-history-item").should("have.length", 2);
    cy.get(".query-history-item")
      .first()
      .should("contain", "Show me the top 5 rows");
    cy.get(".query-history-item").last().should("contain", "Show me all data");

    // Click on a history item
    cy.get(".query-history-item").last().click();

    // Verify the query is loaded
    cy.get("textarea").should("have.value", "Show me all data");
  });
});
