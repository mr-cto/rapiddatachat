const { executeQuery } = require('./lib/database');

async function checkDatabase() {
  try {
    // Check if view_metadata table exists
    console.log('Checking if view_metadata table exists...');
    const tableResult = await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'view_metadata'
      ) as exists
    `);
    console.log('view_metadata table exists:', tableResult[0].exists);

    // Get active files
    console.log('\nChecking active files...');
    const activeFiles = await executeQuery(`
      SELECT id, filename, status FROM files
      WHERE status = 'active'
    `);
    console.log('Active files:', activeFiles);

    // If view_metadata exists, check entries
    if (tableResult[0].exists) {
      console.log('\nChecking view_metadata entries...');
      const viewMetadata = await executeQuery(`
        SELECT * FROM view_metadata
      `);
      console.log('View metadata entries:', viewMetadata);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabase();
