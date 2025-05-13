#!/usr/bin/env node

/**
 * Test Data Generator
 *
 * This script generates test CSV files for testing RapidDataChat.
 * It creates files with different sizes and structures for comprehensive testing.
 */

const fs = require("fs");
const path = require("path");
const { faker } = require("@faker-js/faker");

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, "..", "test-data");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Generate a CSV file with random data
 * @param {string} filename - Output filename
 * @param {number} rows - Number of rows to generate
 * @param {string[]} columns - Column names
 * @param {Function[]} generators - Functions to generate column values
 */
function generateCSV(filename, rows, columns, generators) {
  const outputPath = path.join(outputDir, filename);

  // Create CSV header
  let csvContent = columns.join(",") + "\n";

  // Generate rows
  for (let i = 0; i < rows; i++) {
    const rowValues = generators.map((generator) => {
      const value = generator();
      // Escape commas and quotes in values
      if (typeof value === "string") {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvContent += rowValues.join(",") + "\n";
  }

  // Write to file
  fs.writeFileSync(outputPath, csvContent);
  console.log(
    `Generated ${filename} with ${rows} rows and ${columns.length} columns`
  );
}

// Generate small sales dataset
function generateSalesData() {
  const columns = [
    "id",
    "date",
    "product",
    "category",
    "price",
    "quantity",
    "customer",
    "region",
  ];
  const generators = [
    () => faker.string.uuid(),
    () => faker.date.past().toISOString().split("T")[0],
    () => faker.commerce.productName(),
    () => faker.commerce.department(),
    () => faker.commerce.price(),
    () => faker.number.int({ min: 1, max: 10 }),
    () => faker.person.fullName(),
    () => faker.location.country(),
  ];

  generateCSV("sales_small.csv", 100, columns, generators);
  generateCSV("sales_medium.csv", 1000, columns, generators);
  generateCSV("sales_large.csv", 10000, columns, generators);
}

// Generate employee dataset
function generateEmployeeData() {
  const columns = [
    "id",
    "first_name",
    "last_name",
    "email",
    "department",
    "position",
    "salary",
    "hire_date",
    "manager_id",
    "location",
  ];
  const generators = [
    () => faker.string.uuid(),
    () => faker.person.firstName(),
    () => faker.person.lastName(),
    () => faker.internet.email(),
    () => faker.commerce.department(),
    () => faker.person.jobTitle(),
    () => faker.number.int({ min: 30000, max: 150000 }),
    () => faker.date.past().toISOString().split("T")[0],
    () => faker.string.uuid(),
    () => faker.location.city(),
  ];

  generateCSV("employees.csv", 500, columns, generators);
}

// Generate product inventory dataset
function generateInventoryData() {
  const columns = [
    "product_id",
    "product_name",
    "category",
    "supplier",
    "stock_quantity",
    "reorder_level",
    "unit_price",
    "last_restock_date",
    "expiration_date",
  ];
  const generators = [
    () => faker.string.uuid(),
    () => faker.commerce.productName(),
    () => faker.commerce.department(),
    () => faker.company.name(),
    () => faker.number.int({ min: 0, max: 1000 }),
    () => faker.number.int({ min: 10, max: 100 }),
    () => faker.commerce.price(),
    () => faker.date.recent().toISOString().split("T")[0],
    () => faker.date.future().toISOString().split("T")[0],
  ];

  generateCSV("inventory.csv", 300, columns, generators);
}

// Generate customer dataset
function generateCustomerData() {
  const columns = [
    "customer_id",
    "first_name",
    "last_name",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "postal_code",
    "country",
    "registration_date",
    "last_purchase_date",
    "total_purchases",
    "loyalty_points",
    "customer_segment",
  ];
  const generators = [
    () => faker.string.uuid(),
    () => faker.person.firstName(),
    () => faker.person.lastName(),
    () => faker.internet.email(),
    () => faker.phone.number(),
    () => faker.location.streetAddress(),
    () => faker.location.city(),
    () => faker.location.state(),
    () => faker.location.zipCode(),
    () => faker.location.country(),
    () => faker.date.past().toISOString().split("T")[0],
    () => faker.date.recent().toISOString().split("T")[0],
    () => faker.number.int({ min: 1, max: 100 }),
    () => faker.number.int({ min: 0, max: 10000 }),
    () => faker.helpers.arrayElement(["Premium", "Standard", "Basic"]),
  ];

  generateCSV("customers.csv", 1000, columns, generators);
}

// Generate financial transactions dataset
function generateTransactionsData() {
  const columns = [
    "transaction_id",
    "date",
    "account_id",
    "type",
    "amount",
    "currency",
    "description",
    "category",
    "status",
  ];
  const generators = [
    () => faker.string.uuid(),
    () => faker.date.recent().toISOString().split("T")[0],
    () => faker.finance.accountNumber(),
    () =>
      faker.helpers.arrayElement([
        "deposit",
        "withdrawal",
        "transfer",
        "payment",
      ]),
    () => faker.finance.amount(),
    () => faker.finance.currencyCode(),
    () => faker.finance.transactionDescription(),
    () =>
      faker.helpers.arrayElement([
        "food",
        "transport",
        "entertainment",
        "utilities",
        "rent",
      ]),
    () => faker.helpers.arrayElement(["completed", "pending", "failed"]),
  ];

  generateCSV("transactions.csv", 5000, columns, generators);
}

// Main function
function main() {
  console.log("Generating test data files...");

  try {
    generateSalesData();
    generateEmployeeData();
    generateInventoryData();
    generateCustomerData();
    generateTransactionsData();

    console.log("\nTest data generation complete!");
    console.log(`Files are located in: ${outputDir}`);
  } catch (error) {
    console.error("Error generating test data:", error);
  }
}

// Run the main function
main();
