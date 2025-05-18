import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

// Mock Prisma client used in the API route
jest.mock("@prisma/client", () => {
  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

// Import the handler after mocking Prisma
import handler from "../../src/pages/api/projects/[id]";

// Import the global mocks
import "../__mocks__/globalMocks";

// Set up test environment
const originalEnv = process.env.NODE_ENV;
beforeAll(() => {
  // Use Object.defineProperty to avoid the read-only error
  Object.defineProperty(process.env, "NODE_ENV", { value: "development" });
});

afterAll(() => {
  // Restore original environment
  Object.defineProperty(process.env, "NODE_ENV", { value: originalEnv });
});

describe("Project Ownership Validation", () => {
  const prisma = new (require("@prisma/client").PrismaClient)();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows access for project owner", async () => {
    // Mock project owned by the requesting user
    const mockProject = {
      id: "project-1",
      userId: "owner@example.com",
      name: "Owner Project",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.project.findUnique.mockResolvedValueOnce(mockProject);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: "project-1" },
      headers: { "x-test-user-email": "owner@example.com" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ project: mockProject });
  });

  test("rejects access for non-owner", async () => {
    // Mock project owned by someone else
    const mockProject = {
      id: "project-1",
      userId: "owner@example.com",
      name: "Owner Project",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.project.findUnique.mockResolvedValueOnce(mockProject);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: "project-1" },
      headers: { "x-test-user-email": "intruder@example.com" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(JSON.parse(res._getData())).toEqual({ message: "Forbidden" });
  });
});
