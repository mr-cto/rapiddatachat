import { getCacheManager } from "../cache/cacheManager";
import { ColumnMapping, GlobalSchema } from "../schemaManagement";

/**
 * Cached schema service that wraps the existing schema service methods with caching
 */
export class CachedSchemaService {
  /**
   * Get a global schema by ID with caching
   * @param schemaId Schema ID
   * @returns Promise<GlobalSchema | null> Schema or null if not found
   */
  static async getGlobalSchemaById(
    schemaId: string
  ): Promise<GlobalSchema | null> {
    const cacheManager = getCacheManager();
    const cacheKey = `schema:${schemaId}`;

    return cacheManager.getOrCompute(
      cacheKey,
      async () => {
        // Import dynamically to avoid circular dependencies
        const { SchemaService } = await import("../schemaManagement");
        const schemaService = new SchemaService();
        return schemaService.getGlobalSchemaById(schemaId);
      },
      cacheManager.getSchemaTTL()
    );
  }

  /**
   * Get all global schemas for a project with caching
   * @param projectId Project ID
   * @returns Promise<GlobalSchema[]> Schemas
   */
  static async getGlobalSchemasForProject(
    projectId: string
  ): Promise<GlobalSchema[]> {
    const cacheManager = getCacheManager();
    const cacheKey = `schemas:project:${projectId}`;

    return cacheManager.getOrCompute(
      cacheKey,
      async () => {
        // Import dynamically to avoid circular dependencies
        const { SchemaService } = await import("../schemaManagement");
        const schemaService = new SchemaService();
        return schemaService.getGlobalSchemasForProject(projectId);
      },
      cacheManager.getSchemaTTL()
    );
  }

  /**
   * Get column mapping for a file and schema with caching
   * @param fileId File ID
   * @param schemaId Schema ID
   * @returns Promise<ColumnMapping | null> Column mapping or null if not found
   */
  static async getColumnMapping(
    fileId: string,
    schemaId: string
  ): Promise<ColumnMapping | null> {
    const cacheManager = getCacheManager();
    const cacheKey = `column-mapping:${fileId}:${schemaId}`;

    return cacheManager.getOrCompute(
      cacheKey,
      async () => {
        // Import dynamically to avoid circular dependencies
        const { ColumnMappingService } = await import("./columnMappingService");
        return ColumnMappingService.getColumnMapping(fileId, schemaId);
      },
      cacheManager.getColumnMappingTTL()
    );
  }

  /**
   * Save column mapping with cache invalidation
   * @param mapping Column mapping to save
   * @returns Promise<boolean> Success
   */
  static async saveColumnMapping(mapping: ColumnMapping): Promise<boolean> {
    try {
      // Import dynamically to avoid circular dependencies
      const { ColumnMappingService } = await import("./columnMappingService");
      const result = await ColumnMappingService.saveColumnMapping(mapping);

      if (result) {
        // Invalidate related cache entries
        const cacheManager = getCacheManager();
        cacheManager.delete(
          `column-mapping:${mapping.fileId}:${mapping.schemaId}`
        );
        cacheManager.invalidateByPrefix(`schema:${mapping.schemaId}`);
      }

      return result;
    } catch (error) {
      console.error(
        `[CachedSchemaService] Error saving column mapping:`,
        error
      );
      return false;
    }
  }

  /**
   * Update a global schema with cache invalidation
   * @param schema Schema to update
   * @returns Promise<GlobalSchema | null> Updated schema or null if failed
   */
  static async updateGlobalSchema(
    schema: GlobalSchema
  ): Promise<GlobalSchema | null> {
    try {
      // Import dynamically to avoid circular dependencies
      const { SchemaService } = await import("../schemaManagement");
      const schemaService = new SchemaService();
      const result = await schemaService.updateGlobalSchema(schema);

      if (result) {
        // Invalidate related cache entries
        const cacheManager = getCacheManager();
        cacheManager.delete(`schema:${schema.id}`);
        cacheManager.invalidateByPrefix(`schemas:project:${schema.projectId}`);
        cacheManager.invalidateByPrefix(`column-mapping:*:${schema.id}`);
      }

      return result;
    } catch (error) {
      console.error(`[CachedSchemaService] Error updating schema:`, error);
      return null;
    }
  }

  /**
   * Create a new global schema with cache invalidation
   * @param projectId Project ID
   * @param name Schema name
   * @param description Schema description
   * @param columns Schema columns
   * @returns Promise<GlobalSchema | null> Created schema or null if failed
   */
  static async createGlobalSchema(
    projectId: string,
    name: string,
    description: string | null,
    columns: Array<{
      name: string;
      type: string;
      description?: string;
      isRequired?: boolean;
    }>
  ): Promise<GlobalSchema | null> {
    try {
      // Import dynamically to avoid circular dependencies
      const { SchemaUpdateService } = await import("./schemaUpdateService");

      // Convert columns to the format expected by SchemaUpdateService
      const formattedColumns = columns.map((column) => ({
        name: column.name,
        description: column.description,
        dataType: column.type,
        isRequired: column.isRequired || false,
      }));

      // Use the optimized service to create the schema
      const result = await SchemaUpdateService.createGlobalSchema(
        projectId,
        name,
        description,
        formattedColumns
      );

      if (result) {
        // Invalidate related cache entries
        const cacheManager = getCacheManager();
        cacheManager.invalidateByPrefix(`schemas:project:${projectId}`);
      }

      return result;
    } catch (error) {
      console.error(`[CachedSchemaService] Error creating schema:`, error);
      return null;
    }
  }

  /**
   * Delete a global schema with cache invalidation
   * @param schemaId Schema ID
   * @returns Promise<boolean> Success
   */
  static async deleteGlobalSchema(schemaId: string): Promise<boolean> {
    try {
      // First get the schema to know its projectId for cache invalidation
      const schema = await CachedSchemaService.getGlobalSchemaById(schemaId);

      if (!schema) {
        return false;
      }

      // Import dynamically to avoid circular dependencies
      const { SchemaService } = await import("../schemaManagement");
      const schemaService = new SchemaService();
      const result = await schemaService.deleteGlobalSchema(schemaId);

      if (result) {
        // Invalidate related cache entries
        const cacheManager = getCacheManager();
        cacheManager.delete(`schema:${schemaId}`);
        cacheManager.invalidateByPrefix(`schemas:project:${schema.projectId}`);
        cacheManager.invalidateByPrefix(`column-mapping:*:${schemaId}`);
      }

      return result;
    } catch (error) {
      console.error(`[CachedSchemaService] Error deleting schema:`, error);
      return false;
    }
  }
}
