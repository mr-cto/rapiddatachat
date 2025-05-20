const { PrismaClient } = require("@prisma/client");

async function checkTable() {
  const prisma = new PrismaClient();

  try {
    console.log("Checking if column_mappings table exists...");

    // Try to count records in the table
    const count = await prisma.columnMapping.count();

    console.log(
      `Table exists! Found ${count} records in column_mappings table.`
    );
    return true;
  } catch (error) {
    console.error("Error accessing column_mappings table:", error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

checkTable()
  .then((exists) => {
    process.exit(exists ? 0 : 1);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
