// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";

// Import additional plugins
import "cypress-axe";
import "cypress-real-events";

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Hide fetch/XHR requests from command log
const app = window.top;
if (!app.document.head.querySelector("[data-hide-command-log-request]")) {
  const style = app.document.createElement("style");
  style.innerHTML =
    ".command-name-request, .command-name-xhr { display: none }";
  style.setAttribute("data-hide-command-log-request", "");
  app.document.head.appendChild(style);
}

// Preserve cookies between tests
Cypress.Cookies.defaults({
  preserve: [
    "next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
  ],
});

// Handle uncaught exceptions
Cypress.on("uncaught:exception", (err, runnable) => {
  // returning false here prevents Cypress from failing the test
  console.error("Uncaught exception:", err.message);
  return false;
});

// Log test name at start of each test
beforeEach(() => {
  const testTitle = Cypress.currentTest.title;
  cy.log(`Running test: ${testTitle}`);
});

// Add custom assertion for performance metrics
chai.Assertion.addMethod("performWithin", function (threshold) {
  const responseTime = this._obj;
  this.assert(
    responseTime <= threshold,
    `Expected response time ${responseTime}ms to be less than or equal to ${threshold}ms`,
    `Expected response time ${responseTime}ms to be greater than ${threshold}ms`
  );
});

// Add global error handling
Cypress.on("fail", (error, runnable) => {
  // Log additional information on test failure
  console.error("Test failed:", runnable.title);
  console.error("Error:", error.message);

  // Take a screenshot on failure
  cy.screenshot(`failure-${runnable.title.replace(/\s+/g, "-")}`);

  // Re-throw the error to fail the test
  throw error;
});
