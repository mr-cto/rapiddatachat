import {
  Project,
  File,
  GlobalSchema,
  SchemaColumn,
  ColumnMapping,
  FileData,
} from "@prisma/client";

/**
 * Project with related files and global schemas
 */
export type ProjectWithRelations = Project & {
  files?: File[];
  globalSchemas?: GlobalSchema[];
};

/**
 * File with related project and column mappings
 */
export type FileWithRelations = File & {
  project?: Project | null;
  columnMappings?: ColumnMapping[];
  fileData?: FileData[];
};

/**
 * Global schema with related columns and mappings
 */
export type GlobalSchemaWithRelations = GlobalSchema & {
  columns?: SchemaColumn[];
  columnMappings?: ColumnMapping[];
  project?: Project;
};

/**
 * Schema column with related global schema and mappings
 */
export type SchemaColumnWithRelations = SchemaColumn & {
  globalSchema?: GlobalSchema;
  columnMappings?: ColumnMapping[];
};

/**
 * Column mapping with related file, global schema, and schema column
 */
export type ColumnMappingWithRelations = ColumnMapping & {
  file?: File;
  globalSchema?: GlobalSchema;
  schemaColumn?: SchemaColumn;
};

/**
 * File data with related file
 */
export type FileDataWithRelations = FileData & {
  file?: File;
};

/**
 * Project creation input
 */
export interface ProjectCreateInput {
  name: string;
  description?: string;
  userId: string;
}

/**
 * Project update input
 */
export interface ProjectUpdateInput {
  name?: string;
  description?: string;
}

/**
 * Global schema creation input
 */
export interface GlobalSchemaCreateInput {
  name: string;
  description?: string;
  projectId: string;
  columns?: SchemaColumnCreateInput[];
}

/**
 * Global schema update input
 */
export interface GlobalSchemaUpdateInput {
  name?: string;
  description?: string;
}

/**
 * Schema column creation input
 */
export interface SchemaColumnCreateInput {
  name: string;
  description?: string;
  dataType: string;
  isRequired?: boolean;
  globalSchemaId?: string; // Optional if creating as part of a global schema
}

/**
 * Schema column update input
 */
export interface SchemaColumnUpdateInput {
  name?: string;
  description?: string;
  dataType?: string;
  isRequired?: boolean;
}

/**
 * Column mapping creation input
 */
export interface ColumnMappingCreateInput {
  fileId: string;
  globalSchemaId: string;
  schemaColumnId: string;
  fileColumn: string;
  transformationRule?: string;
}

/**
 * Column mapping update input
 */
export interface ColumnMappingUpdateInput {
  fileColumn?: string;
  transformationRule?: string;
}

/**
 * File data creation input
 */
export interface FileDataCreateInput {
  fileId: string;
  data: Record<string, any>;
}

/**
 * Project with pagination info
 */
export interface ProjectsWithPagination {
  projects: ProjectWithRelations[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Files with pagination info
 */
export interface FilesWithPagination {
  files: FileWithRelations[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Global schemas with pagination info
 */
export interface GlobalSchemasWithPagination {
  globalSchemas: GlobalSchemaWithRelations[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Schema columns with pagination info
 */
export interface SchemaColumnsWithPagination {
  schemaColumns: SchemaColumnWithRelations[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Column mappings with pagination info
 */
export interface ColumnMappingsWithPagination {
  columnMappings: ColumnMappingWithRelations[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * File data with pagination info
 */
export interface FileDataWithPagination {
  fileData: FileDataWithRelations[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
