// Define the interface for a table column
export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
}

// Define the interface for a table
export interface Table {
  name: string;
  columns: Column[];
  rowCount: number;
  viewName?: string; // Optional view name for the table
}

// Define the interface for the database schema
export interface DatabaseSchema {
  tables: Table[];
}

// Define the interface for merged columns
export interface MergedColumn {
  viewName: string;
  mergeName: string;
  columnList: string[];
  delimiter: string;
}
