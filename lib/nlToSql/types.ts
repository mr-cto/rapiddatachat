/**
 * Table schema information
 */
export interface Table {
  /**
   * Table name
   */
  name: string;

  /**
   * File ID associated with this table
   */
  fileId: string;

  /**
   * Columns in the table
   */
  columns: Column[];

  /**
   * Number of rows in the table
   */
  rowCount: number;
}

/**
 * Column schema information
 */
export interface Column {
  /**
   * Column name
   */
  name: string;

  /**
   * Column data type
   */
  type: string;

  /**
   * Whether the column can be null
   */
  nullable: boolean;
}

/**
 * Database schema information
 */
export interface DatabaseSchema {
  /**
   * Tables in the database
   */
  tables: Table[];
}
