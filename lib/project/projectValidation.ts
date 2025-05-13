import { z } from "zod";

/**
 * Validation schema for project creation
 */
export const projectCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name cannot exceed 100 characters"),
  description: z
    .string()
    .max(500, "Project description cannot exceed 500 characters")
    .optional(),
});

/**
 * Type for project creation form data
 */
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

/**
 * Validation schema for global schema creation
 */
export const schemaCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Schema name is required")
    .max(100, "Schema name cannot exceed 100 characters"),
  description: z
    .string()
    .max(500, "Schema description cannot exceed 500 characters")
    .optional(),
  columns: z.array(
    z.object({
      name: z
        .string()
        .min(1, "Column name is required")
        .max(100, "Column name cannot exceed 100 characters"),
      type: z.enum(["text", "integer", "numeric", "boolean", "timestamp"]),
      description: z
        .string()
        .max(200, "Column description cannot exceed 200 characters")
        .optional(),
      isRequired: z.boolean().optional(),
      isSelected: z.boolean().optional(),
    })
  ),
});

/**
 * Type for schema creation form data
 */
export type SchemaCreateInput = z.infer<typeof schemaCreateSchema>;

/**
 * Validation schema for column mapping
 */
export const columnMappingSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  schemaId: z.string().min(1, "Schema ID is required"),
  mappings: z.array(
    z.object({
      fileColumn: z.string().min(1, "File column is required"),
      schemaColumn: z.string().min(1, "Schema column is required"),
      transformationRule: z.string().optional(),
    })
  ),
});

/**
 * Type for column mapping form data
 */
export type ColumnMappingInput = z.infer<typeof columnMappingSchema>;

/**
 * Validation schema for file upload
 */
export const fileUploadSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  file: z.any(),
});

/**
 * Type for file upload form data
 */
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
