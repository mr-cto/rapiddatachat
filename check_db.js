const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkTables() {
  try {
    const fileCount = await prisma.file.count();
    const projectCount = await prisma.project.count();
    const userCount = await prisma.user.count();

    console.log("Files:", fileCount);
    console.log("Projects:", projectCount);
    console.log("Users:", userCount);
  } catch (error) {
    console.error("Error checking tables:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
