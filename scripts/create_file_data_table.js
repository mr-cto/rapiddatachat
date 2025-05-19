// Script to create the file_data table if it doesn't exist
const { PrismaClient } = require("@prisma/client");

async function createFileDataTable() {
  const prisma = new PrismaClient();

  try {
    console.log("Checking if file_data table exists...");

    // Check if the table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'file_data'
      ) as exists
    `;

    if (tableExists[0].exists) {
      console.log("file_data table already exists.");
      return;
    }

    console.log("Creating file_data table...");

    // Create the table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "file_data" (
        "id" TEXT NOT NULL,
        "file_id" TEXT NOT NULL,
        "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "data" JSONB NOT NULL,
        CONSTRAINT "file_data_pkey" PRIMARY KEY ("id")
      )
    `;

    // Create the index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "idx_file_data_file" ON "file_data"("file_id")
    `;

    // Add the foreign key constraint
    await prisma.$executeRaw`
      ALTER TABLE "file_data" 
      ADD CONSTRAINT "file_data_file_id_fkey" 
      FOREIGN KEY ("file_id") 
      REFERENCES "files"("id") 
      ON DELETE CASCADE 
      ON UPDATE CASCADE
    `;

    console.log("file_data table created successfully.");
  } catch (error) {
    console.error("Error creating file_data table:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createFileDataTable()
  .then(() => console.log("Done"))
  .catch((error) => console.error("Script failed:", error));
