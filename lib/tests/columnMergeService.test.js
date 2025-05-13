const {
  createMergedColumnView,
  updateMergedColumnView,
  dropMergedColumnView,
  getMergedColumnViews,
  getMergedColumnView,
} = require("../columnMergeService");
const { executeQuery } = require("../database");

// Mock the executeQuery function
jest.mock("../database", () => ({
  executeQuery: jest.fn(),
}));

// Mock the error handling function
jest.mock("../errorHandling", () => ({
  handleFileError: jest.fn(),
  ErrorType: {
    DATABASE: "DATABASE",
  },
  ErrorSeverity: {
    MEDIUM: "MEDIUM",
  },
}));

describe("Column Merge Service", () => {
  // Sample column merge configuration
  const sampleConfig = {
    id: "test-merge-id",
    userId: "test-user-id",
    fileId: "test-file-id",
    mergeName: "full_name",
    columnList: ["first_name", "last_name"],
    delimiter: " ",
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("createMergedColumnView", () => {
    it("should create a view for merged columns", async () => {
      // Mock the checkIfViewExists function to return false (view doesn't exist)
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);
      // Mock the checkIfViewExists function for base view to return true
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the checkIfTableExists function to return false
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);
      // Mock the executeQuery function for view creation
      executeQuery.mockImplementationOnce(() => []);

      const result = await createMergedColumnView(sampleConfig);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.viewName).toBe(
        "merged_test-user-id_test-file-id_full_name"
      );
      expect(result.message).toBe(
        "Successfully created merged column view merged_test-user-id_test-file-id_full_name"
      );

      // Verify the SQL query for view creation
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("CREATE OR REPLACE VIEW")
      );
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "COALESCE(data->'first_name', '') || ' ' || COALESCE(data->'last_name', '')"
        )
      );
    });

    it("should handle errors during view creation", async () => {
      // Mock the checkIfViewExists function to throw an error
      executeQuery.mockImplementationOnce(() => {
        throw new Error("Database error");
      });

      const result = await createMergedColumnView(sampleConfig);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.viewName).toBe("");
      expect(result.message).toBe(
        "Failed to create merged column view: Database error"
      );
    });

    it("should handle single column merges", async () => {
      // Mock the checkIfViewExists function to return false (view doesn't exist)
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);
      // Mock the checkIfViewExists function for base view to return true
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the checkIfTableExists function to return false
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);
      // Mock the executeQuery function for view creation
      executeQuery.mockImplementationOnce(() => []);

      const singleColumnConfig = {
        ...sampleConfig,
        columnList: ["first_name"],
      };

      const result = await createMergedColumnView(singleColumnConfig);

      // Verify the result
      expect(result.success).toBe(true);

      // Verify the SQL query for view creation
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("data->'first_name'")
      );
      expect(executeQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("||")
      );
    });
  });

  describe("updateMergedColumnView", () => {
    it("should update an existing view", async () => {
      // Mock the checkIfViewExists function to return true (view exists)
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the checkIfViewExists function for base view to return true
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the checkIfTableExists function to return false
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);
      // Mock the executeQuery function for view update
      executeQuery.mockImplementationOnce(() => []);

      const result = await updateMergedColumnView(sampleConfig);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.viewName).toBe(
        "merged_test-user-id_test-file-id_full_name"
      );
      expect(result.message).toBe(
        "Successfully updated merged column view merged_test-user-id_test-file-id_full_name"
      );

      // Verify the SQL query for view update
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("CREATE OR REPLACE VIEW")
      );
    });

    it("should create a view if it does not exist", async () => {
      // Mock the checkIfViewExists function to return false (view doesn't exist)
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);
      // Mock the checkIfViewExists function to return false (view doesn't exist) for createMergedColumnView
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);
      // Mock the checkIfViewExists function for base view to return true
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the checkIfTableExists function to return false
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);
      // Mock the executeQuery function for view creation
      executeQuery.mockImplementationOnce(() => []);

      const result = await updateMergedColumnView(sampleConfig);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.viewName).toBe(
        "merged_test-user-id_test-file-id_full_name"
      );
      expect(result.message).toBe(
        "Successfully created merged column view merged_test-user-id_test-file-id_full_name"
      );
    });
  });

  describe("dropMergedColumnView", () => {
    it("should drop an existing view", async () => {
      // Mock the checkIfViewExists function to return true (view exists)
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the executeQuery function for view drop
      executeQuery.mockImplementationOnce(() => []);
      // Mock the checkIfTableExists function to return false
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);

      const result = await dropMergedColumnView(sampleConfig);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "Successfully dropped merged column view merged_test-user-id_test-file-id_full_name"
      );

      // Verify the SQL query for view drop
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("DROP VIEW IF EXISTS")
      );
    });

    it("should handle non-existent views", async () => {
      // Mock the checkIfViewExists function to return false (view doesn't exist)
      executeQuery.mockImplementationOnce(() => [{ exists: false }]);

      const result = await dropMergedColumnView(sampleConfig);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        "View merged_test-user-id_test-file-id_full_name does not exist, nothing to drop"
      );

      // Verify that no DROP VIEW query was executed
      expect(executeQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("DROP VIEW")
      );
    });
  });

  describe("getMergedColumnViews", () => {
    it("should get all merged column views for a user and file", async () => {
      // Mock the checkIfTableExists function to return true
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the executeQuery function for getting views
      executeQuery.mockImplementationOnce(() => [
        {
          view_name: "merged_test-user-id_test-file-id_full_name",
          original_filename: "full_name",
          merged_columns: JSON.stringify(["first_name", "last_name"]),
          delimiter: " ",
        },
        {
          view_name: "merged_test-user-id_test-file-id_email",
          original_filename: "email",
          merged_columns: JSON.stringify(["username", "domain"]),
          delimiter: "@",
        },
      ]);

      const result = await getMergedColumnViews("test-user-id", "test-file-id");

      // Verify the result
      expect(result).toHaveLength(2);
      expect(result[0].viewName).toBe(
        "merged_test-user-id_test-file-id_full_name"
      );
      expect(result[0].mergeName).toBe("full_name");
      expect(result[0].columnList).toEqual(["first_name", "last_name"]);
      expect(result[0].delimiter).toBe(" ");
      expect(result[1].viewName).toBe("merged_test-user-id_test-file-id_email");
      expect(result[1].mergeName).toBe("email");
      expect(result[1].columnList).toEqual(["username", "domain"]);
      expect(result[1].delimiter).toBe("@");
    });

    it("should handle errors when getting views", async () => {
      // Mock the checkIfTableExists function to throw an error
      executeQuery.mockImplementationOnce(() => {
        throw new Error("Database error");
      });

      const result = await getMergedColumnViews("test-user-id", "test-file-id");

      // Verify the result
      expect(result).toEqual([]);
    });
  });

  describe("getMergedColumnView", () => {
    it("should get a specific merged column view", async () => {
      // Mock the checkIfTableExists function to return true
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the executeQuery function for getting the view
      executeQuery.mockImplementationOnce(() => [
        {
          view_name: "merged_test-user-id_test-file-id_full_name",
          original_filename: "full_name",
          merged_columns: JSON.stringify(["first_name", "last_name"]),
          delimiter: " ",
        },
      ]);

      const result = await getMergedColumnView(
        "test-user-id",
        "test-file-id",
        "full_name"
      );

      // Verify the result
      expect(result).not.toBeNull();
      expect(result.viewName).toBe(
        "merged_test-user-id_test-file-id_full_name"
      );
      expect(result.mergeName).toBe("full_name");
      expect(result.columnList).toEqual(["first_name", "last_name"]);
      expect(result.delimiter).toBe(" ");
    });

    it("should return null for non-existent views", async () => {
      // Mock the checkIfTableExists function to return true
      executeQuery.mockImplementationOnce(() => [{ exists: true }]);
      // Mock the executeQuery function for getting the view (empty result)
      executeQuery.mockImplementationOnce(() => []);

      const result = await getMergedColumnView(
        "test-user-id",
        "test-file-id",
        "non_existent"
      );

      // Verify the result
      expect(result).toBeNull();
    });
  });
});
