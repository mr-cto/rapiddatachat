// End-to-end tests for the complete data upload and schema management flow

describe("Data Upload and Schema Management Flow", () => {
  // Project details for testing
  const projectName = "Test Project " + Date.now();
  const projectDescription = "Project for testing data upload flow";
  let projectId;

  // File details for testing
  const firstFileName = "first_upload.csv";
  const secondFileName = "second_upload.csv";

  beforeEach(() => {
    // Login before each test
    cy.visit("/auth/signin");
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();
  });

  it("should create a new project", () => {
    // Navigate to projects page
    cy.visit("/project");

    // Click on create project button
    cy.contains("Create Project").click();

    // Fill in project details
    cy.get('input[name="name"]').type(projectName);
    cy.get('textarea[name="description"]').type(projectDescription);
    cy.get("form").submit();

    // Check that project was created successfully
    cy.contains(projectName).should("be.visible");

    // Store project ID for later tests
    cy.url().then((url) => {
      projectId = url.split("/").pop();
      cy.log(`Project ID: ${projectId}`);
      // Save project ID to Cypress environment
      Cypress.env("testProjectId", projectId);
    });
  });

  it("should upload the first file and create a schema", () => {
    // Get project ID from previous test
    const projectId = Cypress.env("testProjectId");
    cy.visit(`/project/${projectId}/upload`);

    // Upload first CSV file
    cy.fixture(firstFileName, "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: firstFileName,
        mimeType: "text/csv",
      });
    });

    // Check for success message
    cy.contains("File uploaded successfully").should("be.visible");

    // Wait for file processing to complete
    cy.contains("Processing complete").should("be.visible", { timeout: 30000 });

    // Check that we're redirected to schema creation page
    cy.url().should("include", "/schema/evolution");

    // Verify that columns from the file are displayed
    cy.contains("New Columns").should("be.visible");
    cy.get("table").contains("id").should("be.visible");
    cy.get("table").contains("name").should("be.visible");
    cy.get("table").contains("email").should("be.visible");

    // Select all columns to include in schema
    cy.get('input[type="checkbox"]').should("be.checked"); // All should be checked by default

    // Apply schema evolution
    cy.contains("Apply Schema Evolution").click();

    // Verify we're redirected to schema columns page
    cy.url().should("include", "/schema/columns");

    // Verify schema was created with the columns
    cy.contains("Schema Management").should("be.visible");
    cy.get("table").contains("id").should("be.visible");
    cy.get("table").contains("name").should("be.visible");
    cy.get("table").contains("email").should("be.visible");
  });

  it("should upload a second file and map new columns", () => {
    // Get project ID from previous test
    const projectId = Cypress.env("testProjectId");
    cy.visit(`/project/${projectId}/upload`);

    // Upload second CSV file with additional columns
    cy.fixture(secondFileName, "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: secondFileName,
        mimeType: "text/csv",
      });
    });

    // Check for success message
    cy.contains("File uploaded successfully").should("be.visible");

    // Wait for file processing to complete
    cy.contains("Processing complete").should("be.visible", { timeout: 30000 });

    // Check that we're redirected to schema evolution page
    cy.url().should("include", "/schema/evolution");

    // Verify that new columns from the file are displayed
    cy.contains("New Columns").should("be.visible");
    cy.get("table").contains("age").should("be.visible");
    cy.get("table").contains("address").should("be.visible");

    // Verify that existing columns are shown as exact matches
    cy.contains("Exact Matches").should("be.visible");
    cy.get("table").contains("id").should("be.visible");
    cy.get("table").contains("name").should("be.visible");
    cy.get("table").contains("email").should("be.visible");

    // Select all new columns to include in schema
    cy.get('input[type="checkbox"]').should("be.checked"); // All should be checked by default

    // Apply schema evolution
    cy.contains("Apply Schema Evolution").click();

    // Verify we're redirected to schema columns page
    cy.url().should("include", "/schema/columns");

    // Verify schema was updated with the new columns
    cy.contains("Schema Management").should("be.visible");
    cy.get("table").contains("id").should("be.visible");
    cy.get("table").contains("name").should("be.visible");
    cy.get("table").contains("email").should("be.visible");
    cy.get("table").contains("age").should("be.visible");
    cy.get("table").contains("address").should("be.visible");
  });

  it("should manage schema columns", () => {
    // Get project ID from previous test
    const projectId = Cypress.env("testProjectId");
    cy.visit(`/project/${projectId}/schema/columns`);

    // Verify schema management interface is displayed
    cy.contains("Schema Management").should("be.visible");

    // Add a new column
    cy.contains("Add Column").click();
    cy.get('input[name="name"]').type("phone");
    cy.get('select[name="type"]').select("text");
    cy.get('input[name="description"]').type("Phone number");
    cy.contains("Add Column").click();

    // Verify new column was added
    cy.get("table").contains("phone").should("be.visible");

    // Edit an existing column
    cy.get("table").contains("name").parent().parent().contains("Edit").click();
    cy.get('input[name="description"]').clear().type("Full name");
    cy.contains("Update Column").click();

    // Verify column was updated
    cy.get("table").contains("Full name").should("be.visible");

    // View version history
    cy.contains("Version History").click();
    cy.contains("Schema Version History").should("be.visible");
    cy.contains("Version 1").should("be.visible");
    cy.contains("Version 2").should("be.visible");
    cy.contains("Version 3").should("be.visible");

    // View file contributions
    cy.contains("File Contributions").click();
    cy.contains("File Contributions").should("be.visible");
    cy.contains(firstFileName).should("be.visible");
    cy.contains(secondFileName).should("be.visible");
  });

  it("should query data using the global schema", () => {
    // Get project ID from previous test
    const projectId = Cypress.env("testProjectId");
    cy.visit(`/project/${projectId}/query`);

    // Verify query interface is displayed
    cy.contains("Query Interface").should("be.visible");

    // Enter a query
    cy.get('textarea[name="query"]').type(
      "SELECT * FROM normalized_data LIMIT 10"
    );
    cy.contains("Run Query").click();

    // Verify query results are displayed
    cy.contains("Query Results").should("be.visible");
    cy.get("table").should("be.visible");
    cy.get("table").contains("id").should("be.visible");
    cy.get("table").contains("name").should("be.visible");
    cy.get("table").contains("email").should("be.visible");
    cy.get("table").contains("age").should("be.visible");
    cy.get("table").contains("address").should("be.visible");

    // Try a more complex query
    cy.get('textarea[name="query"]')
      .clear()
      .type("SELECT name, email FROM normalized_data WHERE age > 30");
    cy.contains("Run Query").click();

    // Verify filtered query results
    cy.contains("Query Results").should("be.visible");
    cy.get("table").should("be.visible");
    cy.get("table").contains("name").should("be.visible");
    cy.get("table").contains("email").should("be.visible");
  });

  it("should handle schema rollback", () => {
    // Get project ID from previous test
    const projectId = Cypress.env("testProjectId");
    cy.visit(`/project/${projectId}/schema/columns`);

    // Navigate to version history tab
    cy.contains("Version History").click();

    // Rollback to version 2 (after first file upload)
    cy.contains("Version 2")
      .parent()
      .contains("Rollback to this version")
      .click();

    // Confirm rollback
    cy.contains("Are you sure").should("be.visible");
    cy.contains("Confirm").click();

    // Verify schema was rolled back
    cy.contains("Columns").click();
    cy.get("table").contains("id").should("be.visible");
    cy.get("table").contains("name").should("be.visible");
    cy.get("table").contains("email").should("be.visible");

    // Verify that columns from version 3 are no longer present
    cy.get("table").contains("age").should("not.exist");
    cy.get("table").contains("address").should("not.exist");
    cy.get("table").contains("phone").should("not.exist");
  });
});
