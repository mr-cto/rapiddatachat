// Cypress flow tests for uploading CSV files

describe("CSV Upload Flow", () => {
  beforeEach(() => {
    cy.login();
    cy.visit("/upload");
  });

  it("should upload a CSV file via drag and drop", () => {
    cy.get('input[type="file"]').attachFile("first_upload.csv", {
      subjectType: "drag-n-drop",
    });

    cy.contains("File uploaded successfully").should("be.visible");

    cy.visit("/files");
    cy.contains("first_upload.csv").should("be.visible");
  });

  it("should upload multiple CSV files sequentially", () => {
    cy.uploadFile("first_upload.csv", "text/csv");
    cy.contains("File uploaded successfully").should("be.visible");

    cy.uploadFile("second_upload.csv", "text/csv");
    cy.contains("File uploaded successfully").should("be.visible");

    cy.visit("/files");
    cy.contains("first_upload.csv").should("be.visible");
    cy.contains("second_upload.csv").should("be.visible");
  });
});
