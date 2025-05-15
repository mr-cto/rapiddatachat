// This file contains setup code that will be run before each test
// Add any global setup here

// Import jest-dom extensions
require("@testing-library/jest-dom");

// Mock fetch globally
global.fetch = jest.fn();

// Reset mocks before each test
beforeEach(() => {
  jest.resetAllMocks();
});
