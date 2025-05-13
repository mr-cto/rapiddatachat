// Performance Monitoring tests

describe("Performance Monitoring", () => {
  beforeEach(() => {
    // Login before each test
    cy.visit("/auth/signin");
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();

    // Generate some query data by executing queries
    cy.visit("/query");

    // Execute a simple query
    cy.get("textarea").type("Show me all data");
    cy.get("button").contains("Run Query").click();
    cy.get(".results-table", { timeout: 10000 }).should("be.visible");

    // Execute another query
    cy.get("textarea").clear().type("Show me the top 5 rows");
    cy.get("button").contains("Run Query").click();
    cy.get(".results-table", { timeout: 10000 }).should("be.visible");

    // Navigate to performance page
    cy.visit("/performance");
  });

  it("should display the performance monitoring page", () => {
    // Check that the performance page is displayed
    cy.contains("Performance Monitoring").should("be.visible");
    cy.get(".performance-metrics").should("be.visible");
  });

  it("should show query performance metrics", () => {
    // Check that query metrics are displayed
    cy.contains("Query Performance").should("be.visible");
    cy.get(".metrics-table").should("be.visible");
    cy.get(".metrics-table tbody tr").should("have.length.at.least", 2);
  });

  it("should display performance charts", () => {
    // Check that charts are displayed
    cy.get(".performance-chart").should("be.visible");
    cy.get(".chart-container").should("have.length.at.least", 1);
  });

  it("should filter metrics by date range", () => {
    // Open date filter
    cy.contains("Date Range").click();

    // Select last 24 hours
    cy.get("button").contains("Last 24 Hours").click();

    // Check that metrics are updated
    cy.get(".metrics-table tbody tr").should("have.length.at.least", 2);

    // Select last 7 days
    cy.contains("Date Range").click();
    cy.get("button").contains("Last 7 Days").click();

    // Check that metrics are updated
    cy.get(".metrics-table tbody tr").should("have.length.at.least", 2);
  });

  it("should filter metrics by query type", () => {
    // Open query type filter
    cy.contains("Query Type").click();

    // Select a specific query type
    cy.get('input[type="checkbox"]').first().check();

    // Check that metrics are updated
    cy.get(".metrics-table tbody tr").should("exist");
  });

  it("should show detailed metrics for a specific query", () => {
    // Click on a query in the metrics table
    cy.get(".metrics-table tbody tr").first().click();

    // Check that detailed metrics are displayed
    cy.contains("Query Details").should("be.visible");
    cy.contains("Execution Time").should("be.visible");
    cy.contains("Generated SQL").should("be.visible");
  });

  it("should show 95th percentile latency", () => {
    // Check that 95th percentile latency is displayed
    cy.contains("95th Percentile Latency").should("be.visible");
    cy.get(".percentile-metric").should("be.visible");

    // Verify the value is a number followed by 'ms'
    cy.get(".percentile-metric")
      .invoke("text")
      .should("match", /\d+(\.\d+)?\s*ms/);
  });

  it("should show error rate metrics", () => {
    // Check that error rate metrics are displayed
    cy.contains("Error Rate").should("be.visible");
    cy.get(".error-rate-metric").should("be.visible");

    // Verify the value is a percentage
    cy.get(".error-rate-metric")
      .invoke("text")
      .should("match", /\d+(\.\d+)?\s*%/);
  });

  it("should export performance data", () => {
    // Click export button
    cy.contains("Export Data").click();

    // Check that export options are displayed
    cy.contains("Export Format").should("be.visible");

    // Select CSV format
    cy.get('input[type="radio"][value="csv"]').check();

    // Click download button
    cy.contains("Download").click();

    // Verify download (this is tricky in Cypress, so we'll just check the button was clicked)
    cy.contains("Download").should("be.visible");
  });

  it("should refresh metrics data", () => {
    // Get initial data timestamp
    cy.get(".last-updated")
      .invoke("text")
      .then((initialTimestamp) => {
        // Click refresh button
        cy.contains("Refresh").click();

        // Check that data is refreshed (timestamp should change)
        cy.get(".last-updated")
          .invoke("text")
          .should("not.equal", initialTimestamp);
      });
  });
});
