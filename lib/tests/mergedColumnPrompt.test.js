const { SchemaService } = require("../nlToSql/schemaService");
const { executeQuery } = require("../database");
const { createMergedColumnView } = require("../columnMergeService");

// Mock the executeQuery function
jest.mock("../database", () => ({
  executeQuery: jest.fn(),
}));

// Mock the getMergedColumnViews function
jest.mock("../columnMergeService", () => ({
  getMergedColumnViews: jest.fn(),
  createMergedColumnView: jest.fn(),
}));

describe("SchemaService with merged columns", () => {
  let schemaService;

  beforeEach(() => {
    jest.clearAllMocks();
    schemaService = new SchemaService();
  });

  describe("formatSchemaForPrompt", () => {
    it("should include merged columns in the schema information", async () => {
      // Mock the necessary data
      const schema = {
        tables: [
          {
            name: "file_123456",
            columns: [
              {
                name: "data",
                type: "jsonb",
                nullable: false,
                isPrimaryKey: false,
                isForeignKey: false,
              },
            ],
            rowCount: 100,
          },
        ],
      };

      // Mock the getSampleDataWithStructure method
      schemaService.getSampleDataWithStructure = jest.fn().mockResolvedValue([
        {
          data: {
            first_name: "John",
            last_name: "Doe",
            email: "john.doe@example.com",
          },
        },
      ]);

      // Mock the getMergedColumnsForFile method
      schemaService.getMergedColumnsForFile = jest.fn().mockResolvedValue([
        {
          viewName: "merged_user_123456_full_name",
          mergeName: "full_name",
          columnList: ["first_name", "last_name"],
          delimiter: " ",
        },
      ]);

      // Call the formatSchemaForPrompt method
      const formattedSchema = await schemaService.formatSchemaForPrompt(schema);

      // Verify that the merged columns are included in the schema information
      expect(formattedSchema).toContain(
        "This table also has the following merged columns:"
      );
      expect(formattedSchema).toContain(
        "full_name: A merged column combining [first_name, last_name]"
      );
      expect(formattedSchema).toContain("Access with: data->'full_name'");
    });
  });

  describe("getMergedColumnsForFile", () => {
    it("should retrieve merged columns for a file", async () => {
      // Mock the executeQuery function to return a user ID
      executeQuery.mockResolvedValueOnce([{ user_id: "test-user" }]);

      // Mock the getMergedColumnViews function to return merged columns
      const { getMergedColumnViews } = require("../columnMergeService");
      getMergedColumnViews.mockResolvedValueOnce([
        {
          viewName: "merged_user_123456_full_name",
          mergeName: "full_name",
          columnList: ["first_name", "last_name"],
          delimiter: " ",
        },
      ]);

      // Call the getMergedColumnsForFile method
      const mergedColumns = await schemaService.getMergedColumnsForFile(
        "123456"
      );

      // Verify that the executeQuery function was called with the correct SQL
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT user_id FROM view_metadata")
      );

      // Verify that the getMergedColumnViews function was called with the correct parameters
      expect(getMergedColumnViews).toHaveBeenCalledWith("test-user", "123456");

      // Verify that the merged columns were returned
      expect(mergedColumns).toHaveLength(1);
      expect(mergedColumns[0].mergeName).toBe("full_name");
      expect(mergedColumns[0].columnList).toEqual(["first_name", "last_name"]);
      expect(mergedColumns[0].delimiter).toBe(" ");
    });

    it("should return an empty array if no user ID is found", async () => {
      // Mock the executeQuery function to return an empty array
      executeQuery.mockResolvedValueOnce([]);

      // Call the getMergedColumnsForFile method
      const mergedColumns = await schemaService.getMergedColumnsForFile(
        "123456"
      );

      // Verify that the executeQuery function was called with the correct SQL
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT user_id FROM view_metadata")
      );

      // Verify that the getMergedColumnViews function was not called
      const { getMergedColumnViews } = require("../columnMergeService");
      expect(getMergedColumnViews).not.toHaveBeenCalled();

      // Verify that an empty array was returned
      expect(mergedColumns).toEqual([]);
    });
  });
});

describe("End-to-end test for merged columns in LLM prompts", () => {
  // This test simulates the entire flow from creating a merged column to including it in the LLM prompt
  it("should include merged columns in the LLM prompt", async () => {
    // Mock the necessary functions
    const { createMergedColumnView } = require("../columnMergeService");
    createMergedColumnView.mockResolvedValue({
      success: true,
      viewName: "merged_user_123456_full_name",
      message: "Successfully created merged column view",
    });

    // Create a merged column
    const mergeConfig = {
      id: "merge-123",
      userId: "test-user",
      fileId: "123456",
      mergeName: "full_name",
      columnList: ["first_name", "last_name"],
      delimiter: " ",
    };

    const result = await createMergedColumnView(mergeConfig);
    expect(result.success).toBe(true);

    // Mock the SchemaService methods
    const schemaService = new SchemaService();
    schemaService.getSchemaForActiveTables = jest.fn().mockResolvedValue({
      tables: [
        {
          name: "file_123456",
          columns: [
            {
              name: "data",
              type: "jsonb",
              nullable: false,
              isPrimaryKey: false,
              isForeignKey: false,
            },
          ],
          rowCount: 100,
        },
      ],
    });

    schemaService.getSampleDataWithStructure = jest.fn().mockResolvedValue([
      {
        data: {
          first_name: "John",
          last_name: "Doe",
          email: "john.doe@example.com",
        },
      },
    ]);

    schemaService.getMergedColumnsForFile = jest.fn().mockResolvedValue([
      {
        viewName: "merged_user_123456_full_name",
        mergeName: "full_name",
        columnList: ["first_name", "last_name"],
        delimiter: " ",
      },
    ]);

    // Get the schema for active tables
    const schema = await schemaService.getSchemaForActiveTables("test-user");

    // Format the schema for the LLM prompt
    const formattedSchema = await schemaService.formatSchemaForPrompt(schema);

    // Verify that the merged columns are included in the schema information
    expect(formattedSchema).toContain(
      "This table also has the following merged columns:"
    );
    expect(formattedSchema).toContain(
      "full_name: A merged column combining [first_name, last_name]"
    );
    expect(formattedSchema).toContain("Access with: data->'full_name'");
  });
});
