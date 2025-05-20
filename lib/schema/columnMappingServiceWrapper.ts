import { ColumnMapping } from "../schemaManagement";
import { ColumnMappingServiceFallback } from "./columnMappingServiceFallback";

/**
 * Wrapper for ColumnMappingService that uses the fallback service
 * This allows us to gracefully handle the case where the column_mappings table doesn't exist
 */
export class ColumnMappingService {
  /**
   * Save column mapping using the fallback service
   * @param mapping Column mapping to save
   * @returns Promise<boolean> Success
   */
  static async saveColumnMapping(mapping: ColumnMapping): Promise<boolean> {
    try {
      console.log(
        `[ColumnMappingService] Using fallback service to save mapping for schema ${mapping.schemaId}`
      );
      return await ColumnMappingServiceFallback.saveColumnMapping(mapping);
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error saving column mapping for file ${mapping.fileId} and schema ${mapping.schemaId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get column mapping for a file and schema using the fallback service
   * @param fileId File ID
   * @param schemaId Schema ID
   * @returns Promise<ColumnMapping | null> Column mapping or null if not found
   */
  static async getColumnMapping(
    fileId: string,
    schemaId: string
  ): Promise<ColumnMapping | null> {
    try {
      console.log(
        `[ColumnMappingService] Using fallback service to get mapping for file ${fileId} and schema ${schemaId}`
      );
      return await ColumnMappingServiceFallback.getColumnMapping(
        fileId,
        schemaId
      );
    } catch (error) {
      console.error(
        `[ColumnMappingService] Error getting column mapping for file ${fileId} and schema ${schemaId}:`,
        error
      );
      return null;
    }
  }
}
