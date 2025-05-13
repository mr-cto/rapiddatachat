import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

export async function initDuckDBSchema(conn: AsyncDuckDBConnection) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS files (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      status TEXT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ingested_at TIMESTAMP,
      source_id TEXT,
      size_bytes BIGINT,
      format TEXT
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS queries (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      query_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS results (
      id UUID PRIMARY KEY,
      query_id UUID NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      result_json TEXT
    );
  `);
}
