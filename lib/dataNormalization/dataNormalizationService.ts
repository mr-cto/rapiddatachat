import { executeQuery } from "../database";
import { v4 as uuidv4 } from "uuid";
import { ColumnMapping } from "../schemaManagement";

/**
 * Interface for normalized data
 */
export interface NormalizedData {
  id: string;
  projectId: string;
  fileId: string;
  data: any;
  createdAt: Date;
}

/**
 * DataNormalizationService class for normalizing and storing data
 */
export class DataNormalizationService {
  /**
   * Normalize and store data according to column mappings
   * @param fileId File ID
   * @param projectId Project ID
   * @param rawData Raw data from the file
   * @param columnMapping Column mapping
   * @returns Promise<boolean> True if successful
   */
  async normalizeAndStoreData(
    fileId: string,
    projectId: string,
    rawData: any[],
    columnMapping: ColumnMapping
  ): Promise<boolean> {
    try {
      console.log(
        `[DataNormalizationService] Normalizing data for file ${fileId} in project ${projectId}`
      );

      // Check if the normalized_data table exists
      const tableExists = await this.checkIfTableExists("normalized_data");

      if (!tableExists) {
        // Create the table if it doesn't exist
        await executeQuery(`
          CREATE TABLE normalized_data (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            file_id TEXT NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }

      // Apply column mappings to normalize the data
      const normalizedData = this.applyColumnMappings(rawData, columnMapping);

      // Store each normalized data record
      for (const data of normalizedData) {
        const id = `normalized_data_${uuidv4()}`;
        await executeQuery(`
          INSERT INTO normalized_data (id, project_id, file_id, data, created_at)
          VALUES (
            '${id}',
            '${projectId}',
            '${fileId}',
            '${JSON.stringify(data)}',
            CURRENT_TIMESTAMP
          )
        `);
      }

      return true;
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error normalizing data for file ${fileId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Apply column mappings to normalize data
   * @param rawData Raw data from the file
   * @param columnMapping Column mapping
   * @returns any[] Normalized data
   */
  private applyColumnMappings(
    rawData: any[],
    columnMapping: ColumnMapping
  ): any[] {
    const normalizedData = [];

    for (const row of rawData) {
      const normalizedRow: any = {};

      // Apply each mapping
      for (const mapping of columnMapping.mappings) {
        const { fileColumn, schemaColumn, transformationRule } = mapping;

        // Get the value from the raw data
        let value = row[fileColumn];

        // Apply transformation rule if provided
        if (transformationRule && value !== undefined && value !== null) {
          value = this.applyTransformation(value, transformationRule);
        }

        // Set the value in the normalized row
        normalizedRow[schemaColumn] = value;
      }

      normalizedData.push(normalizedRow);
    }

    return normalizedData;
  }

  /**
   * Apply a transformation rule to a value
   * @param value Value to transform
   * @param transformationRule Transformation rule
   * @returns any Transformed value
   */
  private applyTransformation(value: any, transformationRule: string): any {
    // Simple transformation rules
    if (transformationRule === "UPPER") {
      return typeof value === "string" ? value.toUpperCase() : value;
    } else if (transformationRule === "LOWER") {
      return typeof value === "string" ? value.toLowerCase() : value;
    } else if (transformationRule === "TRIM") {
      return typeof value === "string" ? value.trim() : value;
    } else if (transformationRule.startsWith("NUMBER")) {
      return Number(value);
    } else if (transformationRule.startsWith("STRING")) {
      return String(value);
    } else if (transformationRule.startsWith("BOOLEAN")) {
      return Boolean(value);
    } else if (transformationRule.startsWith("DATE")) {
      return new Date(value);
    }

    // For more complex transformations, we would need to implement a rule engine
    // This is a placeholder for future implementation
    console.warn(
      `[DataNormalizationService] Transformation rule not implemented: ${transformationRule}`
    );
    return value;
  }

  /**
   * Get normalized data for a project
   * @param projectId Project ID
   * @returns Promise<NormalizedData[]> Normalized data
   */
  async getNormalizedData(projectId: string): Promise<NormalizedData[]> {
    try {
      // Check if the normalized_data table exists
      const tableExists = await this.checkIfTableExists("normalized_data");

      if (!tableExists) {
        return [];
      }

      // Get all normalized data for the project
      const result = (await executeQuery(`
        SELECT id, project_id, file_id, data, created_at
        FROM normalized_data
        WHERE project_id = '${projectId}'
        ORDER BY created_at DESC
      `)) as Array<{
        id: string;
        project_id: string;
        file_id: string;
        data: string;
        created_at: string;
      }>;

      // Convert the result to NormalizedData objects
      return (result || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        fileId: row.file_id,
        data: JSON.parse(row.data),
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error getting normalized data for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get normalized data for a file
   * @param fileId File ID
   * @returns Promise<NormalizedData[]> Normalized data
   */
  async getNormalizedDataForFile(fileId: string): Promise<NormalizedData[]> {
    try {
      // Check if the normalized_data table exists
      const tableExists = await this.checkIfTableExists("normalized_data");

      if (!tableExists) {
        return [];
      }

      // Get all normalized data for the file
      const result = (await executeQuery(`
        SELECT id, project_id, file_id, data, created_at
        FROM normalized_data
        WHERE file_id = '${fileId}'
        ORDER BY created_at DESC
      `)) as Array<{
        id: string;
        project_id: string;
        file_id: string;
        data: string;
        created_at: string;
      }>;

      // Convert the result to NormalizedData objects
      return (result || []).map((row) => ({
        id: row.id,
        projectId: row.project_id,
        fileId: row.file_id,
        data: JSON.parse(row.data),
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error getting normalized data for file ${fileId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const result = (await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(
        `[DataNormalizationService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}
