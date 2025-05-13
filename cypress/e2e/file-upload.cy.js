// File upload tests

describe("File Upload", () => {
  beforeEach(() => {
    // Login before each test
    cy.visit("/auth/signin");
    const { email, password } = Cypress.env("testUser");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type(password);
    cy.get("form").submit();

    // Navigate to upload page
    cy.visit("/upload");
  });

  it("should display the file upload page", () => {
    // Check that the upload page is displayed
    cy.contains("Upload Files").should("be.visible");
    cy.get('input[type="file"]').should("exist");
  });

  it("should show error for invalid file type", () => {
    // Attempt to upload an invalid file type
    cy.fixture("invalid.txt", "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: "invalid.txt",
        mimeType: "text/plain",
      });
    });

    // Check for error message
    cy.contains("Invalid file type").should("be.visible");
  });

  it("should upload a valid CSV file", () => {
    // Upload a valid CSV file
    cy.fixture("sample.csv", "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: "sample.csv",
        mimeType: "text/csv",
      });
    });

    // Check for success message
    cy.contains("File uploaded successfully").should("be.visible");

    // Check that the file appears in the files list
    cy.visit("/files");
    cy.contains("sample.csv").should("be.visible");
  });

  it("should upload a valid XLSX file", () => {
    // Upload a valid XLSX file
    cy.fixture("sample.xlsx", "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: "sample.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    });

    // Check for success message
    cy.contains("File uploaded successfully").should("be.visible");

    // Check that the file appears in the files list
    cy.visit("/files");
    cy.contains("sample.xlsx").should("be.visible");
  });

  it("should show progress during upload", () => {
    // Start uploading a large file
    cy.fixture("large_sample.csv", "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: "large_sample.csv",
        mimeType: "text/csv",
      });
    });

    // Check that progress indicator is shown
    cy.get(".progress-bar").should("be.visible");

    // Check that progress increases
    cy.get(".progress-bar")
      .invoke("attr", "aria-valuenow")
      .then((initialValue) => {
        // Wait and check that progress has increased
        cy.wait(1000);
        cy.get(".progress-bar")
          .invoke("attr", "aria-valuenow")
          .should((newValue) => {
            expect(Number(newValue)).to.be.greaterThan(Number(initialValue));
          });
      });
  });

  it("should handle file ingestion after upload", () => {
    // Upload a valid CSV file
    cy.fixture("sample.csv", "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: "sample.csv",
        mimeType: "text/csv",
      });
    });

    // Check for success message
    cy.contains("File uploaded successfully").should("be.visible");

    // Navigate to files page
    cy.visit("/files");

    // Check that file status changes from "pending" to "active"
    cy.contains("sample.csv").parent().contains("pending").should("be.visible");

    // Wait for ingestion to complete (may need to adjust timeout)
    cy.contains("sample.csv")
      .parent()
      .contains("active", { timeout: 30000 })
      .should("be.visible");
  });
});
