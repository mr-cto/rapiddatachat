#!/usr/bin/env node

/**
 * Performance Testing Script
 *
 * This script runs performance tests on the RapidDataChat application
 * to verify that it meets the performance requirements (95th percentile latency ≤ 1200ms).
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

// Configuration
const config = {
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  iterations: process.env.ITERATIONS ? parseInt(process.env.ITERATIONS) : 20,
  outputFile:
    process.env.OUTPUT_FILE ||
    path.join(__dirname, "..", "performance-results.json"),
  auth: {
    email: process.env.TEST_EMAIL || "test@example.com",
    password: process.env.TEST_PASSWORD || "testpassword",
  },
  threshold: 1200, // 95th percentile latency threshold in ms
};

// Test scenarios
const scenarios = [
  {
    name: "Dashboard Load",
    action: async (page) => {
      await page.goto(`${config.baseUrl}/dashboard`);
      await page.waitForSelector('h1:has-text("Dashboard")');
    },
  },
  {
    name: "Files Page Load",
    action: async (page) => {
      await page.goto(`${config.baseUrl}/files`);
      await page.waitForSelector('h1:has-text("Files")');
    },
  },
  {
    name: "Query Page Load",
    action: async (page) => {
      await page.goto(`${config.baseUrl}/query`);
      await page.waitForSelector("textarea");
    },
  },
  {
    name: "Simple Query Execution",
    action: async (page) => {
      await page.goto(`${config.baseUrl}/query`);
      await page.waitForSelector("textarea");
      await page.fill("textarea", "Show me all data");
      await page.click('button:has-text("Run Query")');
      await page.waitForSelector(".results-table");
    },
  },
  {
    name: "Complex Query Execution",
    action: async (page) => {
      await page.goto(`${config.baseUrl}/query`);
      await page.waitForSelector("textarea");
      await page.fill(
        "textarea",
        "Show me the top 10 rows where the first column is not null, sorted by the second column in descending order"
      );
      await page.click('button:has-text("Run Query")');
      await page.waitForSelector(".results-table");
    },
  },
  {
    name: "Performance Page Load",
    action: async (page) => {
      await page.goto(`${config.baseUrl}/performance`);
      await page.waitForSelector('h1:has-text("Performance")');
    },
  },
];

// Main function
async function runPerformanceTests() {
  console.log("Starting performance tests...");
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Iterations: ${config.iterations}`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  console.log("Logging in...");
  await page.goto(`${config.baseUrl}/auth/signin`);
  await page.fill('input[name="email"]', config.auth.email);
  await page.fill('input[name="password"]', config.auth.password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();

  // Results object
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: config.baseUrl,
    iterations: config.iterations,
    scenarios: {},
    summary: {},
  };

  // Run each scenario
  for (const scenario of scenarios) {
    console.log(`Running scenario: ${scenario.name}`);
    const timings = [];

    for (let i = 0; i < config.iterations; i++) {
      const start = performance.now();
      await scenario.action(page);
      const end = performance.now();
      const duration = end - start;
      timings.push(duration);

      console.log(
        `  Iteration ${i + 1}/${config.iterations}: ${Math.round(duration)}ms`
      );
    }

    // Calculate statistics
    timings.sort((a, b) => a - b);
    const min = timings[0];
    const max = timings[timings.length - 1];
    const median = timings[Math.floor(timings.length / 2)];
    const sum = timings.reduce((a, b) => a + b, 0);
    const avg = sum / timings.length;
    const p95Index = Math.ceil(timings.length * 0.95) - 1;
    const p95 = timings[p95Index];

    // Store results
    results.scenarios[scenario.name] = {
      timings,
      stats: {
        min: Math.round(min),
        max: Math.round(max),
        avg: Math.round(avg),
        median: Math.round(median),
        p95: Math.round(p95),
      },
    };

    console.log(`  Results for ${scenario.name}:`);
    console.log(`    Min: ${Math.round(min)}ms`);
    console.log(`    Max: ${Math.round(max)}ms`);
    console.log(`    Avg: ${Math.round(avg)}ms`);
    console.log(`    Median: ${Math.round(median)}ms`);
    console.log(`    95th percentile: ${Math.round(p95)}ms`);
    console.log(
      `    Meets requirement (≤ ${config.threshold}ms): ${
        p95 <= config.threshold ? "YES ✅" : "NO ❌"
      }`
    );
  }

  // Calculate overall statistics
  const allP95Values = Object.values(results.scenarios).map((s) => s.stats.p95);
  const overallP95 = Math.max(...allP95Values);
  const meetsRequirement = overallP95 <= config.threshold;

  results.summary = {
    overallP95: Math.round(overallP95),
    threshold: config.threshold,
    meetsRequirement,
  };

  console.log("\nOverall Results:");
  console.log(`  Overall 95th percentile: ${Math.round(overallP95)}ms`);
  console.log(`  Threshold: ${config.threshold}ms`);
  console.log(`  Meets requirement: ${meetsRequirement ? "YES ✅" : "NO ❌"}`);

  // Save results to file
  fs.writeFileSync(config.outputFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${config.outputFile}`);

  // Close browser
  await browser.close();

  // Exit with appropriate code
  process.exit(meetsRequirement ? 0 : 1);
}

// Run the tests
runPerformanceTests().catch((error) => {
  console.error("Error running performance tests:", error);
  process.exit(1);
});
