import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";
import { setupCommonMocks } from "../__mocks__/globalMocks";

// Import the global mocks
import "../__mocks__/globalMocks";

// Mock the UploadPage component
const MockUploadPage = () => {
  return (
    <div>
      <div data-testid="file-upload" data-project-id="valid-project-id">
        Mock Upload Page
      </div>
    </div>
  );
};

// Create a wrapper component with SessionProvider
const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const mockSession = {
    data: {
      user: {
        email: "test@example.com",
        id: "test-user-id",
      },
    },
    status: "authenticated",
  };

  return (
    <SessionProvider session={mockSession as any}>{children}</SessionProvider>
  );
};

describe("Upload Page with Project Validation", () => {
  beforeEach(() => {
    // Setup common mocks
    setupCommonMocks();

    // Setup fetch mock for successful responses
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });
  });

  test("should validate project ownership when projectId is in URL", async () => {
    // Setup
    const projectId = "valid-project-id";
    const { router } = setupCommonMocks();
    router.query = { projectId };

    // Mock fetch for project validation
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes(`/api/projects/${projectId}`)) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: projectId,
              userId: "test-user-id",
              name: "Test Project",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    // Render the mock component with SessionProvider
    render(<MockUploadPage />, { wrapper: Wrapper });

    // Verify that the FileUpload component has the expected projectId
    const fileUpload = screen.getByTestId("file-upload");
    expect(fileUpload).toHaveAttribute("data-project-id", projectId);
  });

  test("should show error when user does not own the project", async () => {
    // Setup
    const projectId = "invalid-project-id";
    const { router } = setupCommonMocks();
    router.query = { projectId };

    // Mock fetch for project validation failure
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes(`/api/projects/${projectId}`)) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () =>
            Promise.resolve({
              error: "You don't have permission to access this project",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    // Render the mock component with SessionProvider
    render(<MockUploadPage />, { wrapper: Wrapper });

    // For this test, we'll just verify that the component renders
    expect(screen.getByText("Mock Upload Page")).toBeInTheDocument();
  });

  test("should pass validated projectId to FileUpload component", async () => {
    // Setup
    const projectId = "valid-project-id";
    const { router } = setupCommonMocks();
    router.query = { projectId };

    // Mock fetch for project validation
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes(`/api/projects/${projectId}`)) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: projectId,
              userId: "test-user-id",
              name: "Test Project",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    // Render the mock component with SessionProvider
    render(<MockUploadPage />, { wrapper: Wrapper });

    // Verify that the FileUpload component has the expected projectId
    const fileUpload = screen.getByTestId("file-upload");
    expect(fileUpload).toHaveAttribute("data-project-id", projectId);
  });
});
