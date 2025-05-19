// Sign up flow tests

describe("Sign Up", () => {
  beforeEach(() => {
    cy.visit("/auth/signup");
  });

  it("should display the sign up page", () => {
    cy.contains("Create Account").should("be.visible");
    cy.get("form").should("be.visible");
  });

  it("should show validation error for empty submission", () => {
    cy.get("form").submit();
    cy.contains("Name is required").should("be.visible");
  });

  it("should show error for invalid email", () => {
    cy.get('input[placeholder="Full Name"]').type("Test User");
    cy.get('input[placeholder="Email"]').type("invalid-email");
    cy.get('input[placeholder="Password"]').type("Password1!");
    cy.get('input[placeholder="Confirm Password"]').type("Password1!");
    cy.get("form").submit();
    cy.contains("valid email address").should("be.visible");
  });

  it("should show error when passwords do not match", () => {
    cy.get('input[placeholder="Full Name"]').type("Test User");
    cy.get('input[placeholder="Email"]').type(`test+${Date.now()}@example.com`);
    cy.get('input[placeholder="Password"]').type("Password1!");
    cy.get('input[placeholder="Confirm Password"]').type("Password2!");
    cy.get("form").submit();
    cy.contains("Passwords do not match").should("be.visible");
  });

  it("should create a new account and redirect to projects", () => {
    const uniqueEmail = `cypress+${Date.now()}@example.com`;
    cy.get('input[placeholder="Full Name"]').type("Cypress Test");
    cy.get('input[placeholder="Email"]').type(uniqueEmail);
    cy.get('input[placeholder="Password"]').type("Password1!");
    cy.get('input[placeholder="Confirm Password"]').type("Password1!");
    cy.get("form").submit();

    cy.url().should("include", "/project");
    cy.contains("Project").should("be.visible");
  });
});
