// API integration tests for data upload and schema management

describe("API Integration Tests", () => {
  // Project details for testing
  const projectName = "API Test Project " + Date.now();
  const projectDescription = "Project for API integration testing";
  let projectId;
  let schemaId;
  let fileId;
  let authToken;

  before(() => {
    // Login and get auth token
    cy.request({
      method: "POST",
      url: "/api/auth/signin",
      body: {
        email: Cypress.env("testUser").email,
        password: Cypress.env("testUser").password,
      },
    }).then((response) => {
      authToken = response.body.token;
      // Set auth token for subsequent requests
      Cypress.env("authToken", authToken);
    });
  });

  it("should create a project via API", () => {
    cy.request({
      method: "POST",
      url: "/api/projects",
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
      body: {
        name: projectName,
        description: projectDescription,
      },
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property("id");
      projectId = response.body.id;
      Cypress.env("testProjectId", projectId);
    });
  });

  it("should upload a file via API", () => {
    cy.fixture("first_upload.csv", "binary").then((fileContent) => {
      const blob = Cypress.Blob.binaryStringToBlob(fileContent, "text/csv");
      const formData = new FormData();
      formData.append("file", blob, "first_upload.csv");
      formData.append("projectId", Cypress.env("testProjectId"));

      cy.request({
        method: "POST",
        url: "/api/upload",
        headers: {
          Authorization: `Bearer ${Cypress.env("authToken")}`,
        },
        body: formData,
        form: true,
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property("id");
        fileId = response.body.id;
        Cypress.env("testFileId", fileId);
      });
    });
  });

  it("should create a schema via API", () => {
    cy.request({
      method: "POST",
      url: "/api/schema-management",
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
      body: {
        userId: Cypress.env("testUser").id,
        projectId: Cypress.env("testProjectId"),
        name: "API Test Schema",
        description: "Schema created via API",
        columns: [
          {
            name: "id",
            type: "text",
            description: "Unique identifier",
            isRequired: true,
            isPrimaryKey: true,
          },
          {
            name: "name",
            type: "text",
            description: "Full name",
            isRequired: true,
          },
          {
            name: "email",
            type: "text",
            description: "Email address",
            isRequired: true,
          },
        ],
      },
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property("id");
      schemaId = response.body.id;
      Cypress.env("testSchemaId", schemaId);
    });
  });

  it("should get schema by ID via API", () => {
    cy.request({
      method: "GET",
      url: `/api/schema-management/${Cypress.env("testSchemaId")}`,
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("id", Cypress.env("testSchemaId"));
      expect(response.body).to.have.property("columns").and.to.have.length(3);
    });
  });

  it("should update schema via API", () => {
    // First get the current schema
    cy.request({
      method: "GET",
      url: `/api/schema-management/${Cypress.env("testSchemaId")}`,
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
    }).then((response) => {
      const schema = response.body;

      // Add a new column
      schema.columns.push({
        name: "age",
        type: "numeric",
        description: "Age in years",
        isRequired: false,
      });

      // Update version
      schema.version += 1;

      // Update the schema
      cy.request({
        method: "PUT",
        url: `/api/schema-management/${Cypress.env("testSchemaId")}`,
        headers: {
          Authorization: `Bearer ${Cypress.env("authToken")}`,
        },
        body: schema,
      }).then((updateResponse) => {
        expect(updateResponse.status).to.eq(200);
        expect(updateResponse.body)
          .to.have.property("columns")
          .and.to.have.length(4);
        expect(updateResponse.body.columns[3]).to.have.property("name", "age");
      });
    });
  });

  it("should get schema versions via API", () => {
    cy.request({
      method: "GET",
      url: `/api/schema-versions?schemaId=${Cypress.env("testSchemaId")}`,
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an("array").and.to.have.length.at.least(2);
      expect(response.body[0]).to.have.property("version", 2);
      expect(response.body[1]).to.have.property("version", 1);
    });
  });

  it("should rollback schema via API", () => {
    cy.request({
      method: "POST",
      url: "/api/schema-versions/rollback",
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
      body: {
        schemaId: Cypress.env("testSchemaId"),
        version: 1,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("success", true);
      expect(response.body).to.have.property("schema");
      expect(response.body.schema)
        .to.have.property("columns")
        .and.to.have.length(3);
      expect(response.body.schema).to.have.property("version", 3);
    });
  });

  it("should get file contributions via API", () => {
    cy.request({
      method: "GET",
      url: `/api/schema-file-contributions?schemaId=${Cypress.env(
        "testSchemaId"
      )}`,
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an("array");
      // Note: This might be empty if file contributions are not automatically linked
    });
  });

  it("should identify new columns via API", () => {
    // Get columns from second file
    const fileColumns = [
      {
        name: "id",
        originalName: "id",
        type: "text",
        sampleValues: ["1", "2", "3"],
      },
      {
        name: "name",
        originalName: "name",
        type: "text",
        sampleValues: ["John Doe", "Jane Smith", "Bob Johnson"],
      },
      {
        name: "email",
        originalName: "email",
        type: "text",
        sampleValues: [
          "john@example.com",
          "jane@example.com",
          "bob@example.com",
        ],
      },
      {
        name: "age",
        originalName: "age",
        type: "numeric",
        sampleValues: [32, 28, 45],
      },
      {
        name: "address",
        originalName: "address",
        type: "text",
        sampleValues: ["123 Main St", "456 Oak Ave", "789 Pine Rd"],
      },
    ];

    cy.request({
      method: "POST",
      url: "/api/schema-evolution?action=identify",
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
      body: {
        fileColumns,
        schemaId: Cypress.env("testSchemaId"),
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("mappings").and.to.be.an("array");
      expect(response.body)
        .to.have.property("newColumns")
        .and.to.be.an("array");
      expect(response.body)
        .to.have.property("exactMatches")
        .and.to.be.an("array");
      expect(response.body)
        .to.have.property("fuzzyMatches")
        .and.to.be.an("array");

      // After rollback to version 1, "age" should be a new column again
      expect(response.body.newColumns).to.have.length.at.least(1);
      expect(response.body.exactMatches).to.have.length(3); // id, name, email
    });
  });

  it("should evolve schema via API", () => {
    const newColumns = [
      {
        name: "age",
        originalName: "age",
        type: "numeric",
        sampleValues: [32, 28, 45],
      },
      {
        name: "address",
        originalName: "address",
        type: "text",
        sampleValues: ["123 Main St", "456 Oak Ave", "789 Pine Rd"],
      },
    ];

    cy.request({
      method: "POST",
      url: "/api/schema-evolution?action=evolve",
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
      body: {
        schemaId: Cypress.env("testSchemaId"),
        newColumns,
        options: {
          addNewColumns: true,
          migrateData: false,
          updateExistingRecords: false,
          createNewVersion: true,
        },
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("success", true);
      expect(response.body).to.have.property("schema");
      expect(response.body.schema)
        .to.have.property("columns")
        .and.to.have.length(5);
      expect(response.body.schema).to.have.property("version", 4);
    });
  });

  it("should query normalized data via API", () => {
    cy.request({
      method: "POST",
      url: "/api/normalized-data/query",
      headers: {
        Authorization: `Bearer ${Cypress.env("authToken")}`,
      },
      body: {
        projectId: Cypress.env("testProjectId"),
        query: "SELECT * FROM normalized_data LIMIT 10",
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("results").and.to.be.an("array");
      // Note: This might be empty if no data has been normalized yet
    });
  });
});
