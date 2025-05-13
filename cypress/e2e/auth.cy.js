// Authentication tests

describe("Authentication", () => {
  beforeEach(() => {
    // Visit the sign-in page before each test
    cy.visit("/auth/signin");
  });

  it("should display the sign-in page", () => {
    // Check that the sign-in page is displayed
    cy.contains("Sign in to your account").should("be.visible");
    cy.get("form").should("be.visible");
  });

  it("should show validation errors for empty form submission", () => {
    // Submit the form without entering any data
    cy.get("form").submit();

    // Check for validation errors
    cy.contains("Email is required").should("be.visible");
    cy.contains("Password is required").should("be.visible");
  });

  it("should show error for invalid credentials", () => {
    // Enter invalid credentials
    cy.get('input[name="email"]').type("invalid@example.com");
    cy.get('input[name="password"]').type("wrongpassword");

    // Submit the form
    cy.get("form").submit();

    // Check for error message
    cy.contains("Invalid email or password").should("be.visible");
  });

  it("should redirect to dashboard after successful login", () => {
    // Use test user credentials from cypress.env.json
    const { email, password } = Cypress.env("testUser");

    // Enter valid credentials
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);

    // Submit the form
    cy.get("form").submit();

    // Check that we are redirected to the dashboard
    cy.url().should("include", "/dashboard");
    cy.contains("Dashboard").should("be.visible");
  });

  it("should allow user to sign out", () => {
    // First sign in
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();

    // Wait for dashboard to load
    cy.url().should("include", "/dashboard");

    // Click sign out button
    cy.contains("Sign out").click();

    // Check that we are redirected to the home page
    cy.url().should("not.include", "/dashboard");
    cy.contains("Sign in").should("be.visible");
  });
});
