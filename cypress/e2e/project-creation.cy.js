// Project Creation Flow tests

describe("Project Creation Flow", () => {
  const projectName = `E2E Project ${Date.now()}`;
  const projectDescription = "Project created via Cypress test";

  beforeEach(() => {
    // Login before each test
    cy.visit("/auth/signin");
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();

    // Navigate to projects page
    cy.visit("/project");
  });

  it("opens the create project modal", () => {
    cy.contains("Create Project").click();
    cy.contains("Create New Project").should("be.visible");
    cy.get('input#name').should("be.visible");
    cy.get('textarea#description').should("be.visible");
  });

  it("shows validation error when name is empty", () => {
    cy.contains("Create Project").click();
    cy.get("form").submit();
    cy.contains("Project name is required").should("be.visible");
  });

  it("creates a project successfully", () => {
    cy.contains("Create Project").click();
    cy.get('input#name').type(projectName);
    cy.get('textarea#description').type(projectDescription);
    cy.get("form").submit();

    // Should redirect to project dashboard
    cy.url().should("include", "/project/");
    cy.url().should("include", "/dashboard");
    cy.contains(projectName).should("be.visible");
  });
});
