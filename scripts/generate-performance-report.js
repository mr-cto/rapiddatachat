#!/usr/bin/env node

/**
 * Performance Report Generator
 *
 * This script generates an HTML performance report from the performance test results.
 */

const fs = require("fs");
const path = require("path");

// Configuration
const config = {
  resultsFile:
    process.env.RESULTS_FILE ||
    path.join(__dirname, "..", "performance-results.json"),
  templateFile:
    process.env.TEMPLATE_FILE ||
    path.join(__dirname, "..", "templates", "performance-report.html"),
  outputFile:
    process.env.OUTPUT_FILE ||
    path.join(__dirname, "..", "performance-report.html"),
};

// Main function
function generateReport() {
  console.log("Generating performance report...");

  // Check if results file exists
  if (!fs.existsSync(config.resultsFile)) {
    console.error(`Error: Results file not found: ${config.resultsFile}`);
    console.error("Run performance tests first with: npm run test:performance");
    process.exit(1);
  }

  // Check if template file exists
  if (!fs.existsSync(config.templateFile)) {
    console.error(`Error: Template file not found: ${config.templateFile}`);
    process.exit(1);
  }

  try {
    // Read results and template
    const results = JSON.parse(fs.readFileSync(config.resultsFile, "utf8"));
    const template = fs.readFileSync(config.templateFile, "utf8");

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(config.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Copy the template to the output file
    fs.copyFileSync(config.templateFile, config.outputFile);

    // Copy the results file to the output directory
    const outputResultsFile = path.join(outputDir, "performance-results.json");
    fs.writeFileSync(outputResultsFile, JSON.stringify(results, null, 2));

    console.log(`Performance report generated: ${config.outputFile}`);
    console.log(`Results data: ${outputResultsFile}`);

    // Print summary
    console.log("\nPerformance Summary:");
    console.log(`Overall 95th percentile: ${results.summary.overallP95}ms`);
    console.log(`Threshold: ${results.summary.threshold}ms`);
    console.log(
      `Meets requirement: ${
        results.summary.meetsRequirement ? "YES ✅" : "NO ❌"
      }`
    );

    // Open the report in the default browser if on a desktop environment
    const isDesktop =
      process.env.DISPLAY ||
      process.platform === "win32" ||
      process.platform === "darwin";
    if (isDesktop) {
      const open = (url) => {
        const { exec } = require("child_process");
        const cmd =
          process.platform === "win32"
            ? "start"
            : process.platform === "darwin"
            ? "open"
            : "xdg-open";
        exec(`${cmd} ${url}`);
      };

      console.log("\nOpening report in browser...");
      open(`file://${config.outputFile}`);
    }
  } catch (error) {
    console.error("Error generating performance report:", error);
    process.exit(1);
  }
}

// Run the generator
generateReport();
