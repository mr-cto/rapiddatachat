const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

async function executeSql() {
  const prisma = new PrismaClient();

  try {
    console.log("Reading SQL file...");
    const sqlPath = path.join(__dirname, "create_column_mappings.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Split the SQL into individual statements
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      try {
        await prisma.$executeRawUnsafe(`${statement};`);
        console.log(`Statement ${i + 1} executed successfully`);
      } catch (error) {
        console.error(`Error executing statement ${i + 1}:`, error.message);
        // Continue with next statement even if this one fails
      }
    }

    console.log("SQL execution completed");
    return true;
  } catch (error) {
    console.error("Error executing SQL:", error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

executeSql()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
