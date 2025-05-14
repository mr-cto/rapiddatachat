/**
 * Query utilities for filtering, sorting, and pagination
 */

import { QueryOptions } from "./dataNormalization/normalizedStorageService";

/**
 * Filter operator types
 */
export enum FilterOperator {
  EQUALS = "eq",
  NOT_EQUALS = "neq",
  GREATER_THAN = "gt",
  GREATER_THAN_OR_EQUALS = "gte",
  LESS_THAN = "lt",
  LESS_THAN_OR_EQUALS = "lte",
  CONTAINS = "contains",
  STARTS_WITH = "startsWith",
  ENDS_WITH = "endsWith",
  IN = "in",
  NOT_IN = "notIn",
  IS_NULL = "isNull",
  IS_NOT_NULL = "isNotNull",
  BETWEEN = "between",
}

/**
 * Filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
}

/**
 * Sort direction
 */
export enum SortDirection {
  ASC = "asc",
  DESC = "desc",
}

/**
 * Sort option
 */
export interface SortOption {
  field: string;
  direction: SortDirection;
}

/**
 * Pagination type
 */
export enum PaginationType {
  OFFSET = "offset",
  CURSOR = "cursor",
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  type: PaginationType;
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMetadata {
  total: number;
  limit?: number;
  offset?: number;
  cursor?: string;
  nextCursor?: string;
  hasMore: boolean;
  page?: number;
  totalPages?: number;
}

/**
 * Query parser class
 */
export class QueryParser {
  /**
   * Parse query parameters from request query
   * @param query Request query
   * @returns QueryOptions
   */
  static parseQueryParams(query: any): QueryOptions {
    const queryOptions: QueryOptions = {};

    // Parse pagination parameters
    if (query.limit) {
      queryOptions.limit = parseInt(query.limit as string, 10);
    }

    if (query.offset) {
      queryOptions.offset = parseInt(query.offset as string, 10);
    }

    // Parse sorting parameters
    if (query.orderBy) {
      queryOptions.orderBy = query.orderBy as string;
      queryOptions.orderDirection =
        (query.orderDirection as "asc" | "desc") || "asc";
    }

    // Parse filter parameters
    if (query.filters) {
      try {
        queryOptions.filters =
          typeof query.filters === "string"
            ? JSON.parse(query.filters)
            : query.filters;
      } catch (error) {
        throw new Error("Invalid filters format");
      }
    }

    // Parse other parameters
    if (query.includeInactive) {
      queryOptions.includeInactive = query.includeInactive === "true";
    }

    if (query.includeHistory) {
      queryOptions.includeHistory = query.includeHistory === "true";
    }

    if (query.version) {
      queryOptions.version = parseInt(query.version as string, 10);
    }

    if (query.asOfDate) {
      queryOptions.asOfDate = new Date(query.asOfDate as string);
    }

    return queryOptions;
  }

  /**
   * Build SQL WHERE clause from filters
   * @param filters Filters object
   * @param tableAlias Table alias
   * @returns SQL WHERE clause and parameters
   */
  static buildWhereClause(
    filters: Record<string, any>,
    tableAlias: string = "nr"
  ): { whereClause: string; params: any[] } {
    let whereClause = "";
    const params: any[] = [];
    let paramIndex = 1;

    for (const [field, value] of Object.entries(filters)) {
      if (value === null) {
        whereClause += `${
          whereClause ? " AND " : ""
        } ${tableAlias}.data->>'${field}' IS NULL`;
      } else if (typeof value === "object" && value !== null) {
        // Handle operator-based filters
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case FilterOperator.EQUALS:
              whereClause += `${
                whereClause ? " AND " : ""
              } ${tableAlias}.data->>'${field}' = $${paramIndex++}`;
              params.push(opValue);
              break;
            case FilterOperator.NOT_EQUALS:
              whereClause += `${
                whereClause ? " AND " : ""
              } ${tableAlias}.data->>'${field}' != $${paramIndex++}`;
              params.push(opValue);
              break;
            case FilterOperator.GREATER_THAN:
              whereClause += `${
                whereClause ? " AND " : ""
              } (${tableAlias}.data->>'${field}')::numeric > $${paramIndex++}`;
              params.push(opValue);
              break;
            case FilterOperator.GREATER_THAN_OR_EQUALS:
              whereClause += `${
                whereClause ? " AND " : ""
              } (${tableAlias}.data->>'${field}')::numeric >= $${paramIndex++}`;
              params.push(opValue);
              break;
            case FilterOperator.LESS_THAN:
              whereClause += `${
                whereClause ? " AND " : ""
              } (${tableAlias}.data->>'${field}')::numeric < $${paramIndex++}`;
              params.push(opValue);
              break;
            case FilterOperator.LESS_THAN_OR_EQUALS:
              whereClause += `${
                whereClause ? " AND " : ""
              } (${tableAlias}.data->>'${field}')::numeric <= $${paramIndex++}`;
              params.push(opValue);
              break;
            case FilterOperator.CONTAINS:
              whereClause += `${
                whereClause ? " AND " : ""
              } ${tableAlias}.data->>'${field}' LIKE $${paramIndex++}`;
              params.push(`%${opValue}%`);
              break;
            case FilterOperator.STARTS_WITH:
              whereClause += `${
                whereClause ? " AND " : ""
              } ${tableAlias}.data->>'${field}' LIKE $${paramIndex++}`;
              params.push(`${opValue}%`);
              break;
            case FilterOperator.ENDS_WITH:
              whereClause += `${
                whereClause ? " AND " : ""
              } ${tableAlias}.data->>'${field}' LIKE $${paramIndex++}`;
              params.push(`%${opValue}`);
              break;
            case FilterOperator.IN:
              if (Array.isArray(opValue) && opValue.length > 0) {
                const placeholders = opValue
                  .map(() => `$${paramIndex++}`)
                  .join(", ");
                whereClause += `${
                  whereClause ? " AND " : ""
                } ${tableAlias}.data->>'${field}' IN (${placeholders})`;
                params.push(...opValue);
              }
              break;
            case FilterOperator.NOT_IN:
              if (Array.isArray(opValue) && opValue.length > 0) {
                const placeholders = opValue
                  .map(() => `$${paramIndex++}`)
                  .join(", ");
                whereClause += `${
                  whereClause ? " AND " : ""
                } ${tableAlias}.data->>'${field}' NOT IN (${placeholders})`;
                params.push(...opValue);
              }
              break;
            case FilterOperator.IS_NULL:
              if (opValue === true) {
                whereClause += `${
                  whereClause ? " AND " : ""
                } ${tableAlias}.data->>'${field}' IS NULL`;
              }
              break;
            case FilterOperator.IS_NOT_NULL:
              if (opValue === true) {
                whereClause += `${
                  whereClause ? " AND " : ""
                } ${tableAlias}.data->>'${field}' IS NOT NULL`;
              }
              break;
            case FilterOperator.BETWEEN:
              if (Array.isArray(opValue) && opValue.length === 2) {
                whereClause += `${
                  whereClause ? " AND " : ""
                } (${tableAlias}.data->>'${field}')::numeric BETWEEN $${paramIndex++} AND $${paramIndex++}`;
                params.push(opValue[0], opValue[1]);
              }
              break;
          }
        }
      } else {
        // Simple equality filter
        whereClause += `${
          whereClause ? " AND " : ""
        } ${tableAlias}.data->>'${field}' = $${paramIndex++}`;
        params.push(value);
      }
    }

    return { whereClause, params };
  }

  /**
   * Build SQL ORDER BY clause from sort options
   * @param orderBy Field to order by
   * @param orderDirection Sort direction
   * @param tableAlias Table alias
   * @returns SQL ORDER BY clause
   */
  static buildOrderByClause(
    orderBy?: string,
    orderDirection: "asc" | "desc" = "asc",
    tableAlias: string = "nr"
  ): string {
    if (!orderBy) {
      return `${tableAlias}.created_at DESC`;
    }

    return `${tableAlias}.data->>'${orderBy}' ${orderDirection.toUpperCase()}`;
  }

  /**
   * Build SQL LIMIT and OFFSET clause from pagination options
   * @param limit Limit
   * @param offset Offset
   * @returns SQL LIMIT and OFFSET clause
   */
  static buildLimitOffsetClause(limit?: number, offset?: number): string {
    let clause = "";

    if (limit) {
      clause = `LIMIT ${limit}`;
      if (offset) {
        clause += ` OFFSET ${offset}`;
      }
    }

    return clause;
  }

  /**
   * Generate pagination metadata
   * @param total Total number of records
   * @param limit Limit
   * @param offset Offset
   * @param cursor Cursor
   * @param nextCursor Next cursor
   * @returns Pagination metadata
   */
  static generatePaginationMetadata(
    total: number,
    limit?: number,
    offset?: number,
    cursor?: string,
    nextCursor?: string
  ): PaginationMetadata {
    const metadata: PaginationMetadata = {
      total,
      limit,
      offset,
      cursor,
      nextCursor,
      hasMore: false,
    };

    // Calculate if there are more records
    if (limit && offset !== undefined) {
      metadata.hasMore = total > offset + limit;
      metadata.page = Math.floor(offset / limit) + 1;
      metadata.totalPages = Math.ceil(total / limit);
    } else if (nextCursor) {
      metadata.hasMore = !!nextCursor;
    }

    return metadata;
  }

  /**
   * Generate cursor for cursor-based pagination
   * @param record Record to generate cursor from
   * @param cursorField Field to use for cursor
   * @returns Cursor
   */
  static generateCursor(record: any, cursorField: string): string {
    const value = record[cursorField];
    if (value === undefined) {
      throw new Error(`Cursor field '${cursorField}' not found in record`);
    }

    // Encode the cursor value as base64
    return Buffer.from(JSON.stringify({ field: cursorField, value })).toString(
      "base64"
    );
  }

  /**
   * Parse cursor for cursor-based pagination
   * @param cursor Cursor
   * @returns Parsed cursor
   */
  static parseCursor(cursor: string): { field: string; value: any } {
    try {
      const decoded = Buffer.from(cursor, "base64").toString();
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error("Invalid cursor format");
    }
  }
}
