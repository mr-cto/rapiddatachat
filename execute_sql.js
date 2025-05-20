const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log("Reading SQL file...");
    const sqlPath = path.join(__dirname, "create_column_mappings.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing SQL...");
    // Split the SQL file by semicolons to execute each statement separately
    const statements = sql
      .split(";")
      .filter((statement) => statement.trim() !== "")
      .map((statement) => statement.trim() + ";");

    for (const statement of statements) {
      console.log(`Executing: ${statement}`);
      await prisma.$executeRawUnsafe(statement);
    }

    console.log("SQL executed successfully!");
  } catch (error) {
    console.error("Error executing SQL:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
