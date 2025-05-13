// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Import cypress-file-upload plugin
import "cypress-file-upload";

// Command to login
Cypress.Commands.add("login", () => {
  cy.visit("/auth/signin");
  const { email, password } = Cypress.env("testUser");
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.get("form").submit();
  cy.url().should("include", "/dashboard");
});

// Command to upload a file
Cypress.Commands.add(
  "uploadFile",
  (fileName, fileType, selector = 'input[type="file"]') => {
    cy.fixture(fileName, "base64").then((fileContent) => {
      cy.get(selector).attachFile({
        fileContent,
        fileName,
        mimeType: fileType,
      });
    });
  }
);

// Command to check performance metrics
Cypress.Commands.add("checkPerformance", () => {
  // Get performance metrics using the browser's Performance API
  cy.window().then((win) => {
    const perfEntries = win.performance.getEntriesByType("navigation");
    if (perfEntries.length > 0) {
      const navEntry = perfEntries[0];
      // Log performance metrics
      cy.log(`Page Load Time: ${navEntry.loadEventEnd - navEntry.startTime}ms`);
      cy.log(
        `DOM Content Loaded: ${
          navEntry.domContentLoadedEventEnd - navEntry.startTime
        }ms`
      );
      cy.log(
        `First Paint: ${
          win.performance.getEntriesByName("first-paint")[0]?.startTime || "N/A"
        }ms`
      );

      // Assert that page load time is within acceptable limits
      expect(navEntry.loadEventEnd - navEntry.startTime).to.be.lessThan(3000);
    }
  });
});

// Command to run a natural language query
Cypress.Commands.add("runQuery", (queryText) => {
  cy.visit("/query");
  cy.get("textarea").clear().type(queryText);
  cy.get("button").contains("Run Query").click();
  cy.get(".results-table", { timeout: 10000 }).should("be.visible");
});

// Command to activate a file
Cypress.Commands.add("activateFile", (fileName) => {
  cy.visit("/files");
  cy.contains(fileName)
    .parent()
    .then(($row) => {
      if ($row.text().includes("pending")) {
        cy.wrap($row).find('button[title="Activate File"]').click();
        cy.contains(fileName)
          .parent()
          .contains("active", { timeout: 30000 })
          .should("be.visible");
      }
    });
});

// Command to check accessibility
Cypress.Commands.add("checkA11y", (context, options) => {
  cy.injectAxe();
  cy.checkA11y(context, options);
});

// Command to test responsive layout
Cypress.Commands.add(
  "testResponsive",
  (sizes = ["iphone-6", "ipad-2", "macbook-13"]) => {
    sizes.forEach((size) => {
      cy.viewport(size);
      cy.wait(200); // Allow time for layout to adjust
      cy.screenshot(`responsive-${size}`);
    });
  }
);
