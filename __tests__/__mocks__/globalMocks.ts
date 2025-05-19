import React from "react";
import { NextApiRequest, NextApiResponse } from "next";

// Mock next-auth
jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(() =>
    Promise.resolve({
      user: { email: "test@example.com", id: "test-user-id" },
    })
  ),
}));

// Mock next/router
jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock ProjectService
const mockGetProjectById = jest.fn();
const mockGetProjects = jest.fn();
const mockCreateProject = jest.fn();
const mockAddFileToProject = jest.fn();

jest.mock("../../lib/project/projectService", () => {
  return {
    ProjectService: jest.fn().mockImplementation(() => {
      return {
        getProjectById: mockGetProjectById,
        getProjects: mockGetProjects,
        createProject: mockCreateProject,
        addFileToProject: mockAddFileToProject,
      };
    }),
  };
});

// Mock executeQuery
jest.mock("../../lib/database", () => ({
  executeQuery: jest.fn(() => Promise.resolve([])),
}));

// Mock components

jest.mock("../../components/SchemaColumnMapper", () => {
  return function MockSchemaColumnMapper() {
    return React.createElement("div", {}, "Mock SchemaColumnMapper");
  };
});

jest.mock("../../components/FileSynopsis", () => {
  return function MockFileSynopsis() {
    return React.createElement("div", {}, "Mock FileSynopsis");
  };
});

jest.mock("../../components/FileActivationButton", () => {
  return function MockFileActivationButton() {
    return React.createElement("div", {}, "Mock FileActivationButton");
  };
});

// Mock fetch
global.fetch = jest.fn();

// Export mock functions for use in tests
export {
  mockGetProjectById,
  mockGetProjects,
  mockCreateProject,
  mockAddFileToProject,
};

// Helper function to create mock session
export const createMockSession = (
  email: string = "test@example.com",
  id: string = "test-user-id"
) => {
  return {
    data: {
      user: {
        email,
        id,
      },
    },
    status: "authenticated",
  };
};

// Helper function to create mock router
export const createMockRouter = (query: Record<string, string> = {}) => {
  return {
    push: jest.fn(),
    query,
  };
};

// Helper function to setup common mocks
export const setupCommonMocks = (
  router = createMockRouter(),
  session = createMockSession()
) => {
  // Reset all mocks
  jest.clearAllMocks();

  // Setup router mock
  const { useRouter } = require("next/router");
  (useRouter as jest.Mock).mockReturnValue(router);

  // Setup session mock
  const { useSession } = require("next-auth/react");
  (useSession as jest.Mock).mockReturnValue(session);

  // Setup fetch mock for successful responses
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({}),
  });

  return {
    router,
    session,
  };
};
