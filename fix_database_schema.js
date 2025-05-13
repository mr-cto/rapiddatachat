const { executeQuery } = require("./lib/database");

async function fixDatabaseSchema() {
  try {
    console.log("Starting database schema fix...");

    // Check if queries table exists
    const queriesTableExists = await checkTableExists("queries");
    console.log(`Queries table exists: ${queriesTableExists}`);

    if (!queriesTableExists) {
      console.log("Creating queries table...");
      await createQueriesTable();
      console.log("Queries table created successfully");
    }

    // Check if files table has activation_progress column
    const activationProgressColumnExists = await checkColumnExists(
      "files",
      "activation_progress"
    );
    console.log(
      `Activation progress column exists: ${activationProgressColumnExists}`
    );

    if (!activationProgressColumnExists) {
      console.log("Adding activation progress columns to files table...");
      await addActivationProgressColumns();
      console.log("Activation progress columns added successfully");
    }

    console.log("Database schema fix completed successfully");
  } catch (error) {
    console.error("Error fixing database schema:", error);
  }
}

async function checkTableExists(tableName) {
  try {
    const result = await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${tableName}'
      ) as exists
    `);

    return result && result.length > 0 && result[0].exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const result = await executeQuery(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '${tableName}' AND column_name = '${columnName}'
      ) as exists
    `);

    return result && result.length > 0 && result[0].exists;
  } catch (error) {
    console.error(
      `Error checking if column ${columnName} exists in table ${tableName}:`,
      error
    );
    return false;
  }
}

async function createQueriesTable() {
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS queries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query_text TEXT NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL,
        error TEXT
      )
    `);

    // Create indexes
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id)
    `);

    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at)
    `);

    return true;
  } catch (error) {
    console.error("Error creating queries table:", error);
    throw error;
  }
}

async function addActivationProgressColumns() {
  try {
    // Add activation progress columns to files table
    await executeQuery(`
      ALTER TABLE files
      ADD COLUMN IF NOT EXISTS activation_progress INTEGER,
      ADD COLUMN IF NOT EXISTS activation_started_at TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS activation_completed_at TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS activation_error TEXT
    `);

    return true;
  } catch (error) {
    console.error("Error adding activation progress columns:", error);
    throw error;
  }
}

// Run the function
fixDatabaseSchema();
