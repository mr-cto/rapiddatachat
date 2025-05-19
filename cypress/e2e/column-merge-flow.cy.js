// Cypress end-to-end tests for column merge functionality

describe("Column Merge Flow", () => {
  const projectName = `Merge Project ${Date.now()}`;
  const projectDescription = "Project for column merge testing";
  const fileName = "second_upload.csv";
  let projectId;

  beforeEach(() => {
    // Login before each test
    cy.visit("/auth/signin");
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();
  });

  it("should merge columns in query results", () => {
    // Create a new project
    cy.visit("/project");
    cy.contains("Create Project").click();
    cy.get('input[name="name"]').type(projectName);
    cy.get('textarea[name="description"]').type(projectDescription);
    cy.get("form").submit();
    cy.url().then((url) => {
      projectId = url.split("/").pop();
    });

    // Upload CSV file
    cy.visit(`/project/${projectId}/upload`);
    cy.fixture(fileName, "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName,
        mimeType: "text/csv",
      });
    });
    cy.contains("File uploaded successfully").should("be.visible");
    cy.contains("Processing complete").should("be.visible", { timeout: 30000 });
    cy.url().should("include", "/schema/evolution");
    cy.contains("Apply Schema Evolution").click();
    cy.url().should("include", "/schema/columns");

    // Execute a simple query to get results
    cy.visit(`/project/${projectId}/query`);
    cy.get('textarea[name="query"]').type(
      "SELECT * FROM normalized_data LIMIT 5"
    );
    cy.contains("Run Query").click();
    cy.contains("Query Results").should("be.visible");
    cy.get("table").contains("name").should("be.visible");
    cy.get("table").contains("email").should("be.visible");

    // Open the column merge modal
    cy.contains("Merge Columns").click();

    // Create a merge of the name and email columns
    cy.get('input[placeholder="e.g., full_name"]').type("contact");
    cy.contains("label", "name").find('input[type="checkbox"]').check();
    cy.contains("label", "email").find('input[type="checkbox"]').check();
    cy.contains("Preview Data").should("be.visible");
    cy.contains("Confirm Merge").click();

    // Verify the merged column is shown in the results table
    cy.get("table").contains("contact").should("be.visible");
    cy.get("table").contains("John Doe john@example.com").should("be.visible");

    // Delete the merge
    cy.contains("Merge Columns").click();
    cy.contains("contact").parent().find('button[title="Delete merge"]').click();
    cy.get('button[aria-label="Close"]').click();
    cy.get("table").contains("contact").should("not.exist");
  });
});
