import { executeQuery } from "./database";

// Types for view state management
export interface VirtualColumn {
  name: string;
  expression: string;
  sourceQuery: string;
  createdAt: Date;
}

export interface ColumnMerge {
  id: string;
  name: string;
  columns: string[];
  delimiter: string;
  createdAt: Date;
}

export interface ColumnFilter {
  column: string;
  value: any;
  operator: string; // 'equals', 'contains', 'gt', 'lt', etc.
  createdAt: Date;
}

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
  createdAt: Date;
}

export interface ViewState {
  baseQuery: string;
  baseTable: string;
  virtualColumns: VirtualColumn[];
  columnMerges: ColumnMerge[];
  filters: ColumnFilter[];
  sortConfig: SortConfig[];
  hiddenColumns: string[];
  currentPage: number;
  pageSize: number;
  lastModified: Date;
}

/**
 * ViewStateManager class for managing the current view state of data
 * This service maintains the state of transformations applied to the data view
 */
export class ViewStateManager {
  private viewState: ViewState;
  private userId: string;
  private storageKey: string;

  /**
   * Constructor for the ViewStateManager
   * @param userId User ID for state persistence
   * @param initialState Optional initial state
   */
  constructor(userId: string, initialState?: Partial<ViewState>) {
    this.userId = userId;
    this.storageKey = `viewState_${userId}`;

    // Initialize with default state or load from storage
    const savedState = this.loadFromStorage();

    this.viewState = {
      baseQuery: initialState?.baseQuery || savedState?.baseQuery || "",
      baseTable: initialState?.baseTable || savedState?.baseTable || "",
      virtualColumns:
        initialState?.virtualColumns || savedState?.virtualColumns || [],
      columnMerges:
        initialState?.columnMerges || savedState?.columnMerges || [],
      filters: initialState?.filters || savedState?.filters || [],
      sortConfig: initialState?.sortConfig || savedState?.sortConfig || [],
      hiddenColumns:
        initialState?.hiddenColumns || savedState?.hiddenColumns || [],
      currentPage: initialState?.currentPage || savedState?.currentPage || 1,
      pageSize: initialState?.pageSize || savedState?.pageSize || 25,
      lastModified: new Date(),
    };

    // Save initial state
    this.saveToStorage();
  }

  /**
   * Get the current view state
   * @returns Current view state
   */
  getViewState(): ViewState {
    return { ...this.viewState };
  }

  /**
   * Set the base query and table
   * @param query Base SQL query
   * @param table Base table name
   */
  setBaseQuery(query: string, table: string): void {
    this.viewState.baseQuery = query;
    this.viewState.baseTable = table;
    this.viewState.lastModified = new Date();
    this.saveToStorage();
  }

  /**
   * Add a virtual column to the view state
   * @param name Column name
   * @param expression SQL expression for the column
   * @param sourceQuery Original query that created this column
   * @returns Updated view state
   */
  addVirtualColumn(
    name: string,
    expression: string,
    sourceQuery: string
  ): ViewState {
    // Check if column already exists
    const existingIndex = this.viewState.virtualColumns.findIndex(
      (vc) => vc.name === name
    );

    if (existingIndex >= 0) {
      // Update existing column
      this.viewState.virtualColumns[existingIndex] = {
        name,
        expression,
        sourceQuery,
        createdAt: new Date(),
      };
    } else {
      // Add new column
      this.viewState.virtualColumns.push({
        name,
        expression,
        sourceQuery,
        createdAt: new Date(),
      });
    }

    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Add a column merge to the view state
   * @param id Unique ID for the merge
   * @param name Merged column name
   * @param columns Columns to merge
   * @param delimiter Delimiter to use between merged values
   * @returns Updated view state
   */
  addColumnMerge(
    id: string,
    name: string,
    columns: string[],
    delimiter: string
  ): ViewState {
    // Check if merge already exists
    const existingIndex = this.viewState.columnMerges.findIndex(
      (cm) => cm.id === id
    );

    if (existingIndex >= 0) {
      // Update existing merge
      this.viewState.columnMerges[existingIndex] = {
        id,
        name,
        columns,
        delimiter,
        createdAt: new Date(),
      };
    } else {
      // Add new merge
      this.viewState.columnMerges.push({
        id,
        name,
        columns,
        delimiter,
        createdAt: new Date(),
      });
    }

    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Remove a column merge from the view state
   * @param id Merge ID to remove
   * @returns Updated view state
   */
  removeColumnMerge(id: string): ViewState {
    this.viewState.columnMerges = this.viewState.columnMerges.filter(
      (cm) => cm.id !== id
    );
    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Add a filter to the view state
   * @param column Column to filter
   * @param value Filter value
   * @param operator Filter operator
   * @returns Updated view state
   */
  addFilter(column: string, value: any, operator: string): ViewState {
    // Remove any existing filter for this column
    this.viewState.filters = this.viewState.filters.filter(
      (f) => f.column !== column
    );

    // Add new filter
    this.viewState.filters.push({
      column,
      value,
      operator,
      createdAt: new Date(),
    });

    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Remove a filter from the view state
   * @param column Column to remove filter for
   * @returns Updated view state
   */
  removeFilter(column: string): ViewState {
    this.viewState.filters = this.viewState.filters.filter(
      (f) => f.column !== column
    );
    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Set the sort configuration
   * @param column Column to sort by
   * @param direction Sort direction
   * @returns Updated view state
   */
  setSort(column: string, direction: "asc" | "desc"): ViewState {
    // Check if sort already exists
    const existingIndex = this.viewState.sortConfig.findIndex(
      (s) => s.column === column
    );

    if (existingIndex >= 0) {
      // Update existing sort
      this.viewState.sortConfig[existingIndex] = {
        column,
        direction,
        createdAt: new Date(),
      };
    } else {
      // Add new sort
      this.viewState.sortConfig.push({
        column,
        direction,
        createdAt: new Date(),
      });
    }

    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Remove a sort configuration
   * @param column Column to remove sort for
   * @returns Updated view state
   */
  removeSort(column: string): ViewState {
    this.viewState.sortConfig = this.viewState.sortConfig.filter(
      (s) => s.column !== column
    );
    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Set hidden columns
   * @param columns Columns to hide
   * @returns Updated view state
   */
  setHiddenColumns(columns: string[]): ViewState {
    this.viewState.hiddenColumns = [...columns];
    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Set pagination configuration
   * @param page Current page
   * @param pageSize Page size
   * @returns Updated view state
   */
  setPagination(page: number, pageSize: number): ViewState {
    this.viewState.currentPage = page;
    this.viewState.pageSize = pageSize;
    this.viewState.lastModified = new Date();
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Reset the view state to default
   * @returns Updated view state
   */
  resetViewState(): ViewState {
    this.viewState = {
      baseQuery: "",
      baseTable: "",
      virtualColumns: [],
      columnMerges: [],
      filters: [],
      sortConfig: [],
      hiddenColumns: [],
      currentPage: 1,
      pageSize: 25,
      lastModified: new Date(),
    };
    this.saveToStorage();
    return this.getViewState();
  }

  /**
   * Generate a SQL query that applies all current view state transformations
   * @param baseQuery Optional base query to use instead of the stored one
   * @returns SQL query with all transformations applied
   */
  generateTransformedQuery(baseQuery?: string): string {
    const query = baseQuery || this.viewState.baseQuery;

    if (!query) {
      return "";
    }

    // Start building the transformed query
    let transformedQuery = query;

    // Extract the SELECT and FROM parts of the query
    const selectMatch = query.match(
      /SELECT\s+(.*?)\s+FROM\s+(.*?)(?:\s+WHERE|\s+GROUP BY|\s+ORDER BY|\s+LIMIT|\s*$)/i
    );

    if (!selectMatch) {
      return query; // Can't parse the query, return as is
    }

    const selectPart = selectMatch[1];
    const fromPart = selectMatch[2];
    const restOfQuery = query.substring(selectMatch[0].length);

    // Build a new SELECT clause with virtual columns
    let newSelectPart = selectPart;

    // Add virtual columns
    this.viewState.virtualColumns.forEach((vc) => {
      if (!newSelectPart.includes(vc.name)) {
        newSelectPart += `, ${vc.expression} AS ${vc.name}`;
      }
    });

    // Handle column merges
    this.viewState.columnMerges.forEach((cm) => {
      if (!newSelectPart.includes(cm.name)) {
        const mergeExpression = cm.columns
          .map((col) => `COALESCE(${col}::text, '')`)
          .join(` || '${cm.delimiter}' || `);
        newSelectPart += `, (${mergeExpression}) AS ${cm.name}`;
      }
    });

    // Start rebuilding the query
    transformedQuery = `SELECT ${newSelectPart} FROM ${fromPart}`;

    // Handle WHERE clause for filters
    if (this.viewState.filters.length > 0) {
      const whereConditions = this.viewState.filters
        .map((filter) => {
          switch (filter.operator) {
            case "equals":
              return `${filter.column} = '${filter.value}'`;
            case "contains":
              return `${filter.column} LIKE '%${filter.value}%'`;
            case "gt":
              return `${filter.column} > ${filter.value}`;
            case "lt":
              return `${filter.column} < ${filter.value}`;
            default:
              return `${filter.column} = '${filter.value}'`;
          }
        })
        .join(" AND ");

      if (restOfQuery.toUpperCase().includes("WHERE")) {
        transformedQuery += ` ${restOfQuery.replace(
          /WHERE/i,
          `WHERE (${whereConditions}) AND `
        )}`;
      } else {
        transformedQuery += ` WHERE ${whereConditions} ${restOfQuery}`;
      }
    } else {
      transformedQuery += restOfQuery;
    }

    // Handle ORDER BY for sorting
    if (this.viewState.sortConfig.length > 0) {
      const orderByPart = this.viewState.sortConfig
        .map((sort) => `${sort.column} ${sort.direction}`)
        .join(", ");

      if (transformedQuery.toUpperCase().includes("ORDER BY")) {
        transformedQuery = transformedQuery.replace(
          /ORDER BY.*?(?=LIMIT|$)/i,
          `ORDER BY ${orderByPart} `
        );
      } else {
        transformedQuery += ` ORDER BY ${orderByPart}`;
      }
    }

    // Handle pagination
    const limitPart = ` LIMIT ${this.viewState.pageSize} OFFSET ${
      (this.viewState.currentPage - 1) * this.viewState.pageSize
    }`;

    if (transformedQuery.toUpperCase().includes("LIMIT")) {
      transformedQuery = transformedQuery.replace(/LIMIT.*$/i, limitPart);
    } else {
      transformedQuery += limitPart;
    }

    return transformedQuery;
  }

  /**
   * Parse a natural language query result to extract virtual columns
   * @param nlQuery Natural language query
   * @param sqlQuery Generated SQL query
   * @returns Array of extracted virtual columns
   */
  parseVirtualColumnsFromQuery(
    nlQuery: string,
    sqlQuery: string
  ): VirtualColumn[] {
    const virtualColumns: VirtualColumn[] = [];

    // Look for AS clauses in the SQL query
    const asMatches = sqlQuery.matchAll(/(\S+\([^)]*\)|\S+)\s+AS\s+(\w+)/gi);

    for (const match of asMatches) {
      const expression = match[1];
      const name = match[2];

      // Skip if it's a simple column reference
      if (!/[+\-*\/(){}[\]<>=!~%^&|,]/.test(expression)) {
        continue;
      }

      virtualColumns.push({
        name,
        expression,
        sourceQuery: nlQuery,
        createdAt: new Date(),
      });
    }

    return virtualColumns;
  }

  /**
   * Apply virtual columns from a new query
   * @param nlQuery Natural language query
   * @param sqlQuery Generated SQL query
   * @returns Updated view state
   */
  applyVirtualColumnsFromQuery(nlQuery: string, sqlQuery: string): ViewState {
    const newVirtualColumns = this.parseVirtualColumnsFromQuery(
      nlQuery,
      sqlQuery
    );

    // Add each new virtual column to the view state
    newVirtualColumns.forEach((vc) => {
      this.addVirtualColumn(vc.name, vc.expression, nlQuery);
    });

    return this.getViewState();
  }

  /**
   * Save the current view state to storage
   */
  private saveToStorage(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.storageKey, JSON.stringify(this.viewState));
    }
  }

  /**
   * Load the view state from storage
   * @returns Loaded view state or null if not found
   */
  private loadFromStorage(): ViewState | null {
    if (typeof window !== "undefined") {
      const savedState = localStorage.getItem(this.storageKey);
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          // Convert date strings back to Date objects
          parsedState.lastModified = new Date(parsedState.lastModified);
          parsedState.virtualColumns.forEach((vc: any) => {
            vc.createdAt = new Date(vc.createdAt);
          });
          parsedState.columnMerges.forEach((cm: any) => {
            cm.createdAt = new Date(cm.createdAt);
          });
          parsedState.filters.forEach((f: any) => {
            f.createdAt = new Date(f.createdAt);
          });
          parsedState.sortConfig.forEach((s: any) => {
            s.createdAt = new Date(s.createdAt);
          });
          return parsedState;
        } catch (error) {
          console.error("Error parsing saved view state:", error);
          return null;
        }
      }
    }
    return null;
  }
}

/**
 * Create a ViewStateManager instance
 * @param userId User ID for state persistence
 * @param initialState Optional initial state
 * @returns ViewStateManager instance
 */
export function createViewStateManager(
  userId: string,
  initialState?: Partial<ViewState>
): ViewStateManager {
  return new ViewStateManager(userId, initialState);
}
