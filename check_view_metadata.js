const { executeQuery } = require("./lib/database").default;

async function checkViewMetadata() {
  try {
    // Check if view_metadata table exists
    const tableResult = await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'view_metadata'
      ) as exists
    `);
    console.log("view_metadata table exists:", tableResult[0].exists);

    if (tableResult[0].exists) {
      // Get all entries in view_metadata
      const viewMetadata = await executeQuery(`
        SELECT * FROM view_metadata
      `);
      console.log("View metadata entries:", viewMetadata);
    }

    // Get active files
    const activeFiles = await executeQuery(`
      SELECT id, filename, status FROM files
      WHERE status = 'active'
    `);
    console.log("Active files:", activeFiles);
  } catch (error) {
    console.error("Error:", error);
  }
}

checkViewMetadata();
