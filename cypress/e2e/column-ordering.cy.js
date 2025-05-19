describe("Column Ordering", () => {
  const projectName = `Column Order Project ${Date.now()}`;
  const projectDescription = "Project for testing column ordering";
  let projectId;

  before(() => {
    // Login and create a new project
    cy.login();
    cy.visit("/project");
    cy.contains("Create Project").click();
    cy.get('input[name="name"]').type(projectName);
    cy.get('textarea[name="description"]').type(projectDescription);
    cy.get("form").submit();
    cy.contains(projectName).should("be.visible");
    cy.url().then((url) => {
      projectId = url.split("/").pop();
      Cypress.env("orderProjectId", projectId);
    });

    // Upload first CSV file and create initial schema
    cy.visit(`/project/${projectId}/upload`);
    cy.fixture("first_upload.csv", "base64").then((fileContent) => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: "first_upload.csv",
        mimeType: "text/csv",
      });
    });
    cy.contains("File uploaded successfully").should("be.visible");
    cy.contains("Processing complete", { timeout: 30000 }).should("be.visible");
    cy.url().should("include", "/schema/evolution");
    cy.get('input[type="checkbox"]').should("be.checked");
    cy.contains("Apply Schema Evolution").click();
    cy.url().should("include", "/schema/columns");
  });

  it("reorders columns via the column filter modal", () => {
    const pid = Cypress.env("orderProjectId");
    cy.visit(`/project/${pid}/query`);
    cy.contains("Query Interface").should("be.visible");
    cy.get('textarea[name="query"]').type(
      "SELECT * FROM normalized_data LIMIT 5"
    );
    cy.contains("Run Query").click();

    cy.contains("Query Results").should("be.visible");
    cy.get("table").should("be.visible");
    cy.get("table thead tr th").then(($headers) => {
      expect($headers.eq(0)).to.contain("id");
      expect($headers.eq(1)).to.contain("name");
      expect($headers.eq(2)).to.contain("email");
    });

    cy.contains("button", "Columns").click();

    const dataTransfer = new DataTransfer();
    cy.contains("label", "email")
      .trigger("dragstart", { dataTransfer });
    cy.contains("label", "id")
      .trigger("dragover", { dataTransfer })
      .trigger("drop", { dataTransfer });
    cy.contains("label", "email").trigger("dragend");

    cy.contains("button", "Apply").click();

    cy.get("table thead tr th").then(($headers) => {
      expect($headers.eq(0)).to.contain("email");
      expect($headers.eq(1)).to.contain("id");
      expect($headers.eq(2)).to.contain("name");
    });
  });
});
