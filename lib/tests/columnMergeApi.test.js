const { createMocks } = require("node-mocks-http");
const { PrismaClient } = require("@prisma/client");
const columnMergesHandler =
  require("../../src/pages/api/column-merges").default;
const columnMergeByIdHandler =
  require("../../src/pages/api/column-merges/[id]").default;

// Mock Next.js authentication
jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(() => {
    return Promise.resolve({
      user: {
        email: "test@example.com",
      },
    });
  }),
}));

// Mock Prisma client
jest.mock("@prisma/client", () => {
  const mockPrismaClient = {
    columnMerge: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    file: {
      findFirst: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe("Column Merge API Endpoints", () => {
  let prisma;

  beforeEach(() => {
    // Get a fresh mock for each test
    prisma = new PrismaClient();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("GET /api/column-merges", () => {
    it("should return a list of column merges", async () => {
      // Mock data
      const mockColumnMerges = [
        {
          id: "1",
          userId: "test@example.com",
          fileId: "file-1",
          mergeName: "full_name",
          columnList: ["first_name", "last_name"],
          delimiter: " ",
          createdAt: new Date(),
          updatedAt: new Date(),
          file: {
            id: "file-1",
            filename: "test.csv",
          },
        },
      ];

      // Setup mocks
      prisma.columnMerge.count.mockResolvedValue(1);
      prisma.columnMerge.findMany.mockResolvedValue(mockColumnMerges);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "GET",
        query: {},
      });

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        columnMerges: mockColumnMerges,
        pagination: {
          page: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
        sorting: {
          column: "createdAt",
          direction: "desc",
        },
      });
      expect(prisma.columnMerge.count).toHaveBeenCalledWith({
        where: { userId: "test@example.com" },
      });
      expect(prisma.columnMerge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "test@example.com" },
        })
      );
    });

    it("should filter by fileId when provided", async () => {
      // Mock data
      const fileId = "file-1";

      // Setup mocks
      prisma.columnMerge.count.mockResolvedValue(0);
      prisma.columnMerge.findMany.mockResolvedValue([]);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "GET",
        query: { fileId },
      });

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(200);
      expect(prisma.columnMerge.count).toHaveBeenCalledWith({
        where: { userId: "test@example.com", fileId },
      });
      expect(prisma.columnMerge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "test@example.com", fileId },
        })
      );
    });

    it("should handle pagination parameters", async () => {
      // Create mock request and response
      const { req, res } = createMocks({
        method: "GET",
        query: { page: "2", pageSize: "5" },
      });

      // Setup mocks
      prisma.columnMerge.count.mockResolvedValue(10);
      prisma.columnMerge.findMany.mockResolvedValue([]);

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(200);
      expect(prisma.columnMerge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
      expect(JSON.parse(res._getData()).pagination).toEqual({
        page: 2,
        pageSize: 5,
        totalCount: 10,
        totalPages: 2,
      });
    });

    it("should handle invalid pagination parameters", async () => {
      // Create mock request and response
      const { req, res } = createMocks({
        method: "GET",
        query: { page: "invalid", pageSize: "5" },
      });

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Page must be a positive integer",
      });
    });
  });

  describe("POST /api/column-merges", () => {
    it("should create a new column merge", async () => {
      // Mock data
      const mockColumnMerge = {
        id: "1",
        userId: "test@example.com",
        fileId: "file-1",
        mergeName: "full_name",
        columnList: ["first_name", "last_name"],
        delimiter: " ",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      prisma.file.findFirst.mockResolvedValue({ id: "file-1" });
      prisma.columnMerge.findFirst.mockResolvedValue(null);
      prisma.columnMerge.create.mockResolvedValue(mockColumnMerge);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "POST",
        body: {
          fileId: "file-1",
          mergeName: "full_name",
          columnList: ["first_name", "last_name"],
          delimiter: " ",
        },
      });

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(201);
      expect(JSON.parse(res._getData())).toEqual({
        columnMerge: mockColumnMerge,
      });
      expect(prisma.columnMerge.create).toHaveBeenCalledWith({
        data: {
          userId: "test@example.com",
          fileId: "file-1",
          mergeName: "full_name",
          columnList: ["first_name", "last_name"],
          delimiter: " ",
        },
      });
    });

    it("should validate required fields", async () => {
      // Create mock request and response with missing fields
      const { req, res } = createMocks({
        method: "POST",
        body: {
          fileId: "file-1",
          // Missing mergeName
          columnList: ["first_name", "last_name"],
        },
      });

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Merge name is required",
      });
      expect(prisma.columnMerge.create).not.toHaveBeenCalled();
    });

    it("should check if file exists", async () => {
      // Setup mocks
      prisma.file.findFirst.mockResolvedValue(null);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "POST",
        body: {
          fileId: "non-existent-file",
          mergeName: "full_name",
          columnList: ["first_name", "last_name"],
        },
      });

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: "File not found",
      });
      expect(prisma.columnMerge.create).not.toHaveBeenCalled();
    });

    it("should check for duplicate merge names", async () => {
      // Setup mocks
      prisma.file.findFirst.mockResolvedValue({ id: "file-1" });
      prisma.columnMerge.findFirst.mockResolvedValue({ id: "existing-merge" });

      // Create mock request and response
      const { req, res } = createMocks({
        method: "POST",
        body: {
          fileId: "file-1",
          mergeName: "existing_merge",
          columnList: ["first_name", "last_name"],
        },
      });

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(409);
      expect(JSON.parse(res._getData())).toEqual({
        error: "A column merge with this name already exists for this file",
      });
      expect(prisma.columnMerge.create).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/column-merges/[id]", () => {
    it("should return a specific column merge", async () => {
      // Mock data
      const mockColumnMerge = {
        id: "merge-1",
        userId: "test@example.com",
        fileId: "file-1",
        mergeName: "full_name",
        columnList: ["first_name", "last_name"],
        delimiter: " ",
        createdAt: new Date(),
        updatedAt: new Date(),
        file: {
          id: "file-1",
          filename: "test.csv",
        },
      };

      // Setup mocks
      prisma.columnMerge.findFirst.mockResolvedValue(mockColumnMerge);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "GET",
        query: { id: "merge-1" },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        columnMerge: mockColumnMerge,
      });
      expect(prisma.columnMerge.findFirst).toHaveBeenCalledWith({
        where: {
          id: "merge-1",
          userId: "test@example.com",
        },
        include: {
          file: {
            select: {
              id: true,
              filename: true,
            },
          },
        },
      });
    });

    it("should return 404 if column merge not found", async () => {
      // Setup mocks
      prisma.columnMerge.findFirst.mockResolvedValue(null);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "GET",
        query: { id: "non-existent-merge" },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Column merge not found",
      });
    });
  });

  describe("PUT /api/column-merges/[id]", () => {
    it("should update a column merge", async () => {
      // Mock data
      const mockColumnMerge = {
        id: "merge-1",
        userId: "test@example.com",
        fileId: "file-1",
        mergeName: "full_name",
        columnList: ["first_name", "last_name"],
        delimiter: " ",
        createdAt: new Date(),
        updatedAt: new Date(),
        file: {
          id: "file-1",
          filename: "test.csv",
        },
      };

      const updatedColumnMerge = {
        ...mockColumnMerge,
        mergeName: "complete_name",
        delimiter: ", ",
      };

      // Setup mocks
      prisma.columnMerge.findFirst.mockResolvedValue(mockColumnMerge);
      prisma.columnMerge.update.mockResolvedValue(updatedColumnMerge);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "PUT",
        query: { id: "merge-1" },
        body: {
          mergeName: "complete_name",
          columnList: ["first_name", "last_name"],
          delimiter: ", ",
        },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        columnMerge: updatedColumnMerge,
      });
      expect(prisma.columnMerge.update).toHaveBeenCalledWith({
        where: {
          id: "merge-1",
        },
        data: {
          mergeName: "complete_name",
          columnList: ["first_name", "last_name"],
          delimiter: ", ",
          updatedAt: expect.any(Date),
        },
        include: {
          file: {
            select: {
              id: true,
              filename: true,
            },
          },
        },
      });
    });

    it("should validate required fields", async () => {
      // Create mock request and response with missing fields
      const { req, res } = createMocks({
        method: "PUT",
        query: { id: "merge-1" },
        body: {
          // Missing mergeName
          columnList: ["first_name", "last_name"],
        },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Merge name is required",
      });
      expect(prisma.columnMerge.update).not.toHaveBeenCalled();
    });

    it("should check if column merge exists", async () => {
      // Setup mocks
      prisma.columnMerge.findFirst.mockResolvedValue(null);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "PUT",
        query: { id: "non-existent-merge" },
        body: {
          mergeName: "complete_name",
          columnList: ["first_name", "last_name"],
        },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Column merge not found",
      });
      expect(prisma.columnMerge.update).not.toHaveBeenCalled();
    });

    it("should check for duplicate merge names", async () => {
      // Setup mocks
      prisma.columnMerge.findFirst.mockImplementation((args) => {
        if (args.where.id === "merge-1") {
          return Promise.resolve({
            id: "merge-1",
            userId: "test@example.com",
            fileId: "file-1",
            file: { id: "file-1" },
          });
        } else {
          return Promise.resolve({ id: "existing-merge" });
        }
      });

      // Create mock request and response
      const { req, res } = createMocks({
        method: "PUT",
        query: { id: "merge-1" },
        body: {
          mergeName: "existing_merge",
          columnList: ["first_name", "last_name"],
        },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(409);
      expect(JSON.parse(res._getData())).toEqual({
        error:
          "Another column merge with this name already exists for this file",
      });
      expect(prisma.columnMerge.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/column-merges/[id]", () => {
    it("should delete a column merge", async () => {
      // Mock data
      const mockColumnMerge = {
        id: "merge-1",
        userId: "test@example.com",
        fileId: "file-1",
      };

      // Setup mocks
      prisma.columnMerge.findFirst.mockResolvedValue(mockColumnMerge);
      prisma.columnMerge.delete.mockResolvedValue(mockColumnMerge);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "DELETE",
        query: { id: "merge-1" },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: "Column merge deleted successfully",
      });
      expect(prisma.columnMerge.delete).toHaveBeenCalledWith({
        where: {
          id: "merge-1",
        },
      });
    });

    it("should return 404 if column merge not found", async () => {
      // Setup mocks
      prisma.columnMerge.findFirst.mockResolvedValue(null);

      // Create mock request and response
      const { req, res } = createMocks({
        method: "DELETE",
        query: { id: "non-existent-merge" },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Column merge not found",
      });
      expect(prisma.columnMerge.delete).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should handle internal server errors in GET /api/column-merges", async () => {
      // Setup mocks
      prisma.columnMerge.count.mockRejectedValue(new Error("Database error"));

      // Create mock request and response
      const { req, res } = createMocks({
        method: "GET",
        query: {},
      });

      // Call the API handler
      await columnMergesHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Failed to fetch column merges",
        details: "Database error",
      });
    });

    it("should handle internal server errors in GET /api/column-merges/[id]", async () => {
      // Setup mocks
      prisma.columnMerge.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      // Create mock request and response
      const { req, res } = createMocks({
        method: "GET",
        query: { id: "merge-1" },
      });

      // Call the API handler
      await columnMergeByIdHandler(req, res);

      // Assertions
      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Failed to fetch column merge",
        details: "Database error",
      });
    });
  });
});
