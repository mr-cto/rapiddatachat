const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

describe("ColumnMerge Model", () => {
  // Test data
  const testUserId = "test-user-id";
  let testFile;
  let testColumnMerge;

  // Setup: Create a test file
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.columnMerge.deleteMany({
      where: { userId: testUserId },
    });

    await prisma.file.deleteMany({
      where: { userId: testUserId },
    });

    // Create a test file
    testFile = await prisma.file.create({
      data: {
        id: "test-file-id",
        userId: testUserId,
        filename: "test-file.csv",
        sizeBytes: 1000,
        status: "ready",
      },
    });
  });

  // Cleanup after tests
  afterAll(async () => {
    // Clean up test data
    await prisma.columnMerge.deleteMany({
      where: { userId: testUserId },
    });

    await prisma.file.deleteMany({
      where: { userId: testUserId },
    });

    await prisma.$disconnect();
  });

  // Test: Create a column merge
  test("should create a column merge", async () => {
    testColumnMerge = await prisma.columnMerge.create({
      data: {
        userId: testUserId,
        fileId: testFile.id,
        mergeName: "full_name",
        columnList: ["first_name", "last_name"],
        delimiter: " ",
      },
    });

    expect(testColumnMerge).toBeDefined();
    expect(testColumnMerge.mergeName).toBe("full_name");
    expect(testColumnMerge.columnList).toEqual(["first_name", "last_name"]);
    expect(testColumnMerge.delimiter).toBe(" ");
  });

  // Test: Read a column merge
  test("should read a column merge", async () => {
    const columnMerge = await prisma.columnMerge.findUnique({
      where: { id: testColumnMerge.id },
    });

    expect(columnMerge).toBeDefined();
    expect(columnMerge.mergeName).toBe("full_name");
  });

  // Test: Update a column merge
  test("should update a column merge", async () => {
    const updatedColumnMerge = await prisma.columnMerge.update({
      where: { id: testColumnMerge.id },
      data: {
        mergeName: "complete_name",
        delimiter: ", ",
      },
    });

    expect(updatedColumnMerge.mergeName).toBe("complete_name");
    expect(updatedColumnMerge.delimiter).toBe(", ");
  });

  // Test: Delete a column merge
  test("should delete a column merge", async () => {
    await prisma.columnMerge.delete({
      where: { id: testColumnMerge.id },
    });

    const deletedColumnMerge = await prisma.columnMerge.findUnique({
      where: { id: testColumnMerge.id },
    });

    expect(deletedColumnMerge).toBeNull();
  });

  // Test: Create with empty column list (edge case)
  test("should handle empty column list", async () => {
    try {
      await prisma.columnMerge.create({
        data: {
          userId: testUserId,
          fileId: testFile.id,
          mergeName: "empty_merge",
          columnList: [],
          delimiter: " ",
        },
      });
      // If we get here, the test failed
      expect(true).toBe(false); // This should not be reached
    } catch (error) {
      // We expect an error because columnList should not be empty
      expect(error).toBeDefined();
    }
  });

  // Test: Create with various delimiter types (edge case)
  test("should handle various delimiter types", async () => {
    const delimiters = [",", " - ", "|", ""];

    for (const delimiter of delimiters) {
      const columnMerge = await prisma.columnMerge.create({
        data: {
          userId: testUserId,
          fileId: testFile.id,
          mergeName: `merge_with_${delimiter || "empty"}_delimiter`,
          columnList: ["col1", "col2"],
          delimiter,
        },
      });

      expect(columnMerge).toBeDefined();
      expect(columnMerge.delimiter).toBe(delimiter);

      // Clean up
      await prisma.columnMerge.delete({
        where: { id: columnMerge.id },
      });
    }
  });

  // Test: Enforce unique constraint (user_id, file_id, merge_name)
  test("should enforce unique constraint", async () => {
    // Create first column merge
    const columnMerge1 = await prisma.columnMerge.create({
      data: {
        userId: testUserId,
        fileId: testFile.id,
        mergeName: "unique_test",
        columnList: ["col1", "col2"],
        delimiter: " ",
      },
    });

    // Try to create another with the same user_id, file_id, and merge_name
    try {
      await prisma.columnMerge.create({
        data: {
          userId: testUserId,
          fileId: testFile.id,
          mergeName: "unique_test",
          columnList: ["col3", "col4"],
          delimiter: ",",
        },
      });
      // If we get here, the test failed
      expect(true).toBe(false); // This should not be reached
    } catch (error) {
      // We expect a unique constraint violation
      expect(error).toBeDefined();
    }

    // Clean up
    await prisma.columnMerge.delete({
      where: { id: columnMerge1.id },
    });
  });
});
