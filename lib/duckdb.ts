import * as duckdb from "@duckdb/duckdb-wasm";

type Param = string | number | boolean | Date | object | null;
type QueryResult = unknown;

export class DuckDBClient {
  private static instance: DuckDBClient;
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;

  private constructor() {}

  static getInstance(): DuckDBClient {
    if (!DuckDBClient.instance) {
      DuckDBClient.instance = new DuckDBClient();
    }
    return DuckDBClient.instance;
  }

  private async initDB() {
    // Check if we're in a browser environment (window and Worker are available)
    const isBrowser =
      typeof window !== "undefined" && typeof Worker !== "undefined";

    if (!isBrowser) {
      console.warn(
        "DuckDB initialization skipped: Running in server environment where Web Workers are not available"
      );
      // Instead of throwing an error, we'll return early
      // This allows the code to continue execution in server environments
      return false;
    }

    if (!this.db) {
      try {
        const logger = new duckdb.ConsoleLogger();
        const bundles = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(bundles);
        const worker = new Worker(bundle.mainWorker!);
        this.db = new duckdb.AsyncDuckDB(logger, worker);
        await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      } catch (error) {
        console.error("Failed to initialize DuckDB:", error);
        throw new Error("DuckDB initialization failed");
      }
    }

    if (!this.conn) {
      this.conn = await this.db.connect();
    }

    return true;
  }

  private quoteParam(val: Param): string {
    if (val === null) return `NULL`;
    if (typeof val === "number" || typeof val === "boolean") return `${val}`;
    if (val instanceof Date) return `'${val.toISOString()}'`;
    // strings & objects → JSON-quoted
    return JSON.stringify(val);
  }

  private bindParams(sql: string, params?: Param[]): string {
    if (!params || params.length === 0) return sql;
    let idx = 0;
    return sql.replace(/\?/g, () => {
      if (idx >= params.length) {
        throw new Error("Not enough parameters provided");
      }
      const quoted = this.quoteParam(params[idx++]);
      return quoted;
    });
  }

  async getConnection() {
    const initialized = await this.initDB();
    if (!initialized) {
      throw new Error("DuckDB is not available in server environments");
    }
    return this.conn!;
  }

  async initSchema() {
    const c = await this.getConnection();
    // files
    await c.query(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        size_bytes INTEGER NOT NULL,
        metadata JSON
      );
    `);
    await c.query(
      `CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);`
    );

    // sources
    await c.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        details JSON,
        FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
      );
    `);

    // queries
    await c.query(`
      CREATE TABLE IF NOT EXISTS queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        query_text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL
      );
    `);
    await c.query(
      `CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);`
    );

    // results
    await c.query(`
      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_id INTEGER NOT NULL,
        result_data JSON,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(query_id) REFERENCES queries(id) ON DELETE CASCADE
      );
    `);
  }

  async execute(sql: string, params?: Param[]): Promise<QueryResult> {
    try {
      const c = await this.getConnection();
      const bound = this.bindParams(sql, params);
      console.debug("[DuckDB] →", bound);
      return await c.query(bound);
    } catch (e) {
      // Check if this is a server environment error
      if (
        e instanceof Error &&
        e.message === "DuckDB is not available in server environments"
      ) {
        console.warn(
          "[DuckDB] Operation skipped: Running in server environment"
        );
        // Return an empty result instead of throwing
        return [];
      }
      console.error("[DuckDB] Error:", e);
      throw e;
    }
  }

  async transaction<T>(
    fn: (conn: duckdb.AsyncDuckDBConnection) => Promise<T>
  ): Promise<T> {
    const c = await this.getConnection();
    await c.query("BEGIN;");
    try {
      const result = await fn(c);
      await c.query("COMMIT;");
      return result;
    } catch (err) {
      await c.query("ROLLBACK;");
      console.error("[DuckDB] Transaction failed:", err);
      throw err;
    }
  }

  private sanitizeWorkspaceId(id: string) {
    if (!/^[A-Za-z0-9_]+$/.test(id)) {
      throw new Error(
        "Invalid workspaceId; only letters, numbers, and _ allowed"
      );
    }
    return id;
  }

  async createWorkspaceSchema(workspaceId: string) {
    const ws = this.sanitizeWorkspaceId(workspaceId);
    await (
      await this.getConnection()
    ).query(`CREATE SCHEMA IF NOT EXISTS ws_${ws};`);
  }

  async useWorkspaceSchema(workspaceId: string) {
    const ws = this.sanitizeWorkspaceId(workspaceId);
    await (await this.getConnection()).query(`SET schema 'ws_${ws}';`);
  }

  async dropWorkspaceSchema(workspaceId: string) {
    const ws = this.sanitizeWorkspaceId(workspaceId);
    await (
      await this.getConnection()
    ).query(`DROP SCHEMA IF EXISTS ws_${ws} CASCADE;`);
  }
}

// convenience exports
export const duck = DuckDBClient.getInstance();
export const initSchema = () => duck.initSchema();
export const executeQuery = (sql: string, params?: Param[]) =>
  duck.execute(sql, params);
export const withTransaction = <T>(
  fn: (conn: duckdb.AsyncDuckDBConnection) => Promise<T>
) => duck.transaction(fn);
export const createWorkspaceSchema = (id: string) =>
  duck.createWorkspaceSchema(id);
export const useWorkspaceSchema = (id: string) => duck.useWorkspaceSchema(id);
export const dropWorkspaceSchema = (id: string) => duck.dropWorkspaceSchema(id);
