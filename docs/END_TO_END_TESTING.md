# End-to-End Testing and Integration

This document outlines the comprehensive end-to-end testing approach for the data upload and schema management flow.

## Overview

The testing framework consists of several components:

1. **Cypress End-to-End Tests**: Browser-based tests that simulate user interactions with the application
2. **API Integration Tests**: Tests that verify the API endpoints and their interactions
3. **Performance Tests**: Tests that measure the performance of key operations
4. **Data Integrity Tests**: Tests that verify data consistency throughout the flow

## Test Files

### Cypress End-to-End Tests

- `cypress/e2e/data-upload-flow.cy.js`: Tests the complete data upload and schema management flow from the user's perspective
- `cypress/e2e/api-integration.cy.js`: Tests the API endpoints and their interactions

### Test Fixtures

- `cypress/fixtures/first_upload.csv`: Sample CSV file for the first upload
- `cypress/fixtures/second_upload.csv`: Sample CSV file with additional columns for the second upload

### Performance Tests

- `scripts/performance-test-upload-flow.js`: Measures the performance of the data upload and schema management flow

### Data Integrity Tests

- `scripts/data-integrity-test.js`: Verifies data consistency throughout the flow

## Running the Tests

### Cypress Tests

1. Start the application in development mode:

   ```
   npm run dev
   ```

2. Run Cypress tests:

   ```
   npx cypress open
   ```

   Or run them headlessly:

   ```
   npx cypress run
   ```

### Performance Tests

```
node scripts/performance-test-upload-flow.js
```

The performance test will generate a report in `reports/performance-report.json` and an HTML visualization in `reports/performance-report.html`.

### Data Integrity Tests

```
node scripts/data-integrity-test.js
```

## Test Coverage

The tests cover the following aspects of the data upload and schema management flow:

### 1. Project Creation

- Creating a new project
- Verifying project details

### 2. File Upload

- Uploading CSV and XLSX files
- Handling file processing
- Verifying file metadata and contents

### 3. Schema Management

- Creating a global schema
- Viewing schema columns
- Editing schema columns
- Adding new columns
- Viewing schema version history
- Rolling back to previous schema versions

### 4. Schema Evolution

- Identifying new columns in uploaded files
- Adding new columns to the global schema
- Mapping file columns to schema columns
- Handling data migration

### 5. Data Querying

- Querying normalized data
- Verifying query results
- Testing complex queries

## Performance Metrics

The performance tests measure the following metrics:

- Project creation time
- File upload time
- File processing time
- Schema creation time
- Schema evolution time
- Query execution time

These metrics are collected for files of different sizes to understand how the system performs under various loads.

## Data Integrity Verification

The data integrity tests verify that:

- Uploaded data is correctly parsed and stored
- Schema evolution preserves existing data
- New columns are correctly added to the schema
- Data can be queried accurately after schema evolution
- All rows from all files are accessible through the normalized view

## Continuous Integration

These tests can be integrated into a CI/CD pipeline to ensure that changes to the codebase do not break the data upload and schema management flow.

### GitHub Actions Example

```yaml
name: End-to-End Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  cypress-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "18"
      - name: Install dependencies
        run: npm ci
      - name: Start application
        run: npm run dev & npx wait-on http://localhost:3000
      - name: Run Cypress tests
        run: npx cypress run
      - name: Upload screenshots
        uses: actions/upload-artifact@v2
        if: failure()
        with:
          name: cypress-screenshots
          path: cypress/screenshots

  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "18"
      - name: Install dependencies
        run: npm ci
      - name: Start application
        run: npm run dev & npx wait-on http://localhost:3000
      - name: Run data integrity tests
        run: node scripts/data-integrity-test.js
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on the state created by other tests
2. **Realistic Data**: Use realistic data that represents actual user scenarios
3. **Error Handling**: Test error cases as well as happy paths
4. **Performance Awareness**: Be mindful of performance implications when writing tests
5. **Maintainability**: Keep tests DRY (Don't Repeat Yourself) and well-organized

## Troubleshooting

### Common Issues

1. **Tests timing out**: Increase the timeout in Cypress configuration or add explicit waits
2. **Flaky tests**: Look for race conditions or timing issues and add appropriate waits
3. **Database state**: Ensure the database is in a clean state before running tests

### Debugging Tips

1. Use `cy.log()` to output debug information in Cypress tests
2. Use `console.log()` in Node.js scripts
3. Use Cypress's time-travel debugging to inspect the state at each step
4. Check the network tab in the browser to see API requests and responses

## Future Improvements

1. Add more comprehensive error case testing
2. Expand performance testing to include more scenarios
3. Add visual regression testing for UI components
4. Implement load testing for high-volume scenarios
5. Add accessibility testing
