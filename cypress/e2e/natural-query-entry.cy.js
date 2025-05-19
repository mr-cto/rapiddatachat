// Cypress flows for natural language query entry

describe("Natural Query Entry", () => {
  const projectName = `Natural Query Project ${Date.now()}`;
  const projectDescription = "Project for natural query entry tests";
  const fileName = "first_upload.csv";
  let projectId;

  before(() => {
    // Sign in
    cy.visit("/auth/signin");
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();

    // Create a new project for testing
    cy.visit("/project");
    cy.contains("Create Project").click();
    cy.get('input[name="name"]').type(projectName);
    cy.get('textarea[name="description"]').type(projectDescription);
    cy.get("form").submit();

    cy.contains(projectName).should("be.visible");
    cy.url().then((url) => {
      projectId = url.split("/").pop();
      Cypress.env("naturalQueryProjectId", projectId);
    });

    // Upload a CSV file to enable queries
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
  });

  beforeEach(() => {
    // Ensure we are logged in before each test
    cy.visit("/auth/signin");
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();

    projectId = Cypress.env("naturalQueryProjectId");
  });

  it("should display example queries", () => {
    cy.visit(`/project/${projectId}/dashboard`);
    cy.get('button[title="Show example queries"]').click();
    cy.contains("Example Queries").should("be.visible");
  });

  it("should execute a natural language query", () => {
    cy.visit(`/project/${projectId}/dashboard`);
    cy.get('input[placeholder="Ask a question about your data..."]').type(
      "Show me all data"
    );
    cy.contains("button", "Ask").click();
    cy.contains("Query Results", { timeout: 20000 }).should("be.visible");
  });
});

