import {
  PrismaClient,
  ValidationRule,
  ValidationResult,
  ValidationRun,
} from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

/**
 * Validation severity levels
 */
export enum ValidationSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
}

/**
 * Validation remediation actions
 */
export enum ValidationRemediation {
  REJECT = "reject",
  CORRECT = "correct",
  ACCEPT = "accept",
}

/**
 * Validation rule input
 */
export interface ValidationRuleInput {
  id?: string;
  entity: string;
  field?: string;
  type: string;
  parameters?: any;
  message: string;
  severity: ValidationSeverity;
  remediation: ValidationRemediation;
  projectId: string;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  skipInvalidRecords?: boolean;
  validateSchema?: boolean;
  validateRelationships?: boolean;
  validateBusinessRules?: boolean;
  validateDataQuality?: boolean;
}

/**
 * Validation status
 */
export enum ValidationStatus {
  VALID = "valid",
  INVALID = "invalid",
  WARNING = "warning",
}

/**
 * Field validation result
 */
export interface FieldValidationResult {
  field: string;
  status: ValidationStatus;
  errors: string[];
  warnings: string[];
}

/**
 * Record validation result
 */
export interface RecordValidationResult {
  recordId: string;
  status: ValidationStatus;
  fieldResults: FieldValidationResult[];
}

/**
 * Validation run result
 */
export interface ValidationRunResult {
  id: string;
  entity: string;
  totalRecords: number;
  passedRecords: number;
  failedRecords: number;
  warningRecords: number;
  metrics: {
    completenessRate: number;
    accuracyRate: number;
    consistencyRate: number;
    errorRate: number;
    warningRate: number;
  };
  recordResults: RecordValidationResult[];
}

/**
 * Validation report
 */
export interface ValidationReport {
  summary: {
    totalRecords: number;
    passedRecords: number;
    failedRecords: number;
    warningRecords: number;
  };
  metrics: {
    completenessRate: number;
    accuracyRate: number;
    consistencyRate: number;
    errorRate: number;
    warningRate: number;
  };
  details: RecordValidationResult[];
}

/**
 * Validation service
 */
export class ValidationService {
  private prisma: PrismaClient;
  private validators: Map<
    string,
    (value: any, parameters: any) => { valid: boolean; message?: string }
  >;

  /**
   * Constructor
   */
  constructor() {
    this.prisma = new PrismaClient();
    this.validators = new Map();
    this.registerBuiltInValidators();
  }

  /**
   * Register built-in validators
   */
  private registerBuiltInValidators() {
    // Type validators
    this.validators.set("required", (value, _) => ({
      valid: value !== undefined && value !== null && value !== "",
      message: "Value is required",
    }));

    this.validators.set("type", (value, parameters) => {
      if (value === null || value === undefined) {
        return { valid: true };
      }

      const type = parameters.type;
      let valid = false;

      switch (type) {
        case "string":
          valid = typeof value === "string";
          break;
        case "number":
          valid = typeof value === "number";
          break;
        case "boolean":
          valid = typeof value === "boolean";
          break;
        case "object":
          valid = typeof value === "object" && !Array.isArray(value);
          break;
        case "array":
          valid = Array.isArray(value);
          break;
        case "date":
          valid = value instanceof Date || !isNaN(Date.parse(value));
          break;
        default:
          valid = true;
      }

      return {
        valid,
        message: `Value must be of type ${type}`,
      };
    });

    // String validators
    this.validators.set("minLength", (value, parameters) => {
      if (value === null || value === undefined || typeof value !== "string") {
        return { valid: true };
      }

      const minLength = parameters.minLength;
      return {
        valid: value.length >= minLength,
        message: `Value must be at least ${minLength} characters long`,
      };
    });

    this.validators.set("maxLength", (value, parameters) => {
      if (value === null || value === undefined || typeof value !== "string") {
        return { valid: true };
      }

      const maxLength = parameters.maxLength;
      return {
        valid: value.length <= maxLength,
        message: `Value must be at most ${maxLength} characters long`,
      };
    });

    this.validators.set("pattern", (value, parameters) => {
      if (value === null || value === undefined || typeof value !== "string") {
        return { valid: true };
      }

      const pattern = parameters.pattern;
      return {
        valid: new RegExp(pattern).test(value),
        message: `Value must match pattern ${pattern}`,
      };
    });

    this.validators.set("email", (value, _) => {
      if (value === null || value === undefined || typeof value !== "string") {
        return { valid: true };
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return {
        valid: emailRegex.test(value),
        message: "Value must be a valid email address",
      };
    });

    this.validators.set("url", (value, _) => {
      if (value === null || value === undefined || typeof value !== "string") {
        return { valid: true };
      }

      try {
        new URL(value);
        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          message: "Value must be a valid URL",
        };
      }
    });

    // Number validators
    this.validators.set("min", (value, parameters) => {
      if (value === null || value === undefined || typeof value !== "number") {
        return { valid: true };
      }

      const min = parameters.min;
      return {
        valid: value >= min,
        message: `Value must be greater than or equal to ${min}`,
      };
    });

    this.validators.set("max", (value, parameters) => {
      if (value === null || value === undefined || typeof value !== "number") {
        return { valid: true };
      }

      const max = parameters.max;
      return {
        valid: value <= max,
        message: `Value must be less than or equal to ${max}`,
      };
    });

    this.validators.set("positive", (value, _) => {
      if (value === null || value === undefined || typeof value !== "number") {
        return { valid: true };
      }

      return {
        valid: value > 0,
        message: "Value must be positive",
      };
    });

    this.validators.set("negative", (value, _) => {
      if (value === null || value === undefined || typeof value !== "number") {
        return { valid: true };
      }

      return {
        valid: value < 0,
        message: "Value must be negative",
      };
    });

    this.validators.set("integer", (value, _) => {
      if (value === null || value === undefined || typeof value !== "number") {
        return { valid: true };
      }

      return {
        valid: Number.isInteger(value),
        message: "Value must be an integer",
      };
    });

    // Date validators
    this.validators.set("minDate", (value, parameters) => {
      if (value === null || value === undefined) {
        return { valid: true };
      }

      const minDate = new Date(parameters.minDate);
      const date = new Date(value);

      return {
        valid: !isNaN(date.getTime()) && date >= minDate,
        message: `Date must be after ${minDate.toISOString()}`,
      };
    });

    this.validators.set("maxDate", (value, parameters) => {
      if (value === null || value === undefined) {
        return { valid: true };
      }

      const maxDate = new Date(parameters.maxDate);
      const date = new Date(value);

      return {
        valid: !isNaN(date.getTime()) && date <= maxDate,
        message: `Date must be before ${maxDate.toISOString()}`,
      };
    });

    // Array validators
    this.validators.set("minItems", (value, parameters) => {
      if (value === null || value === undefined || !Array.isArray(value)) {
        return { valid: true };
      }

      const minItems = parameters.minItems;
      return {
        valid: value.length >= minItems,
        message: `Array must have at least ${minItems} items`,
      };
    });

    this.validators.set("maxItems", (value, parameters) => {
      if (value === null || value === undefined || !Array.isArray(value)) {
        return { valid: true };
      }

      const maxItems = parameters.maxItems;
      return {
        valid: value.length <= maxItems,
        message: `Array must have at most ${maxItems} items`,
      };
    });

    this.validators.set("uniqueItems", (value, _) => {
      if (value === null || value === undefined || !Array.isArray(value)) {
        return { valid: true };
      }

      const uniqueItems = new Set(value);
      return {
        valid: uniqueItems.size === value.length,
        message: "Array must have unique items",
      };
    });

    // Object validators
    this.validators.set("requiredFields", (value, parameters) => {
      if (
        value === null ||
        value === undefined ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        return { valid: true };
      }

      const requiredFields = parameters.requiredFields;
      const missingFields = requiredFields.filter(
        (field: string) => !(field in value)
      );

      return {
        valid: missingFields.length === 0,
        message: `Object is missing required fields: ${missingFields.join(
          ", "
        )}`,
      };
    });

    this.validators.set("allowedFields", (value, parameters) => {
      if (
        value === null ||
        value === undefined ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        return { valid: true };
      }

      const allowedFields = parameters.allowedFields;
      const extraFields = Object.keys(value).filter(
        (field) => !allowedFields.includes(field)
      );

      return {
        valid: extraFields.length === 0,
        message: `Object has extra fields: ${extraFields.join(", ")}`,
      };
    });
  }

  /**
   * Register a custom validator
   * @param type Validator type
   * @param validator Validator function
   */
  registerValidator(
    type: string,
    validator: (
      value: any,
      parameters: any
    ) => { valid: boolean; message?: string }
  ) {
    this.validators.set(type, validator);
  }

  /**
   * Define a validation rule
   * @param input Validation rule input
   * @returns Promise<ValidationRule> Created validation rule
   */
  async defineValidationRule(
    input: ValidationRuleInput
  ): Promise<ValidationRule> {
    try {
      // Generate ID if not provided
      const id = input.id || `rule_${uuidv4()}`;

      // Create validation rule
      const rule = await this.prisma.validationRule.create({
        data: {
          id,
          entity: input.entity,
          field: input.field,
          type: input.type,
          parameters: input.parameters
            ? JSON.stringify(input.parameters)
            : undefined,
          message: input.message,
          severity: input.severity,
          remediation: input.remediation,
          projectId: input.projectId,
        },
      });

      return rule;
    } catch (error) {
      console.error(
        "[ValidationService] Error defining validation rule:",
        error
      );
      throw error;
    }
  }

  /**
   * Get validation rules
   * @param projectId Project ID
   * @param entity Optional entity
   * @param field Optional field
   * @returns Promise<ValidationRule[]> Validation rules
   */
  async getValidationRules(
    projectId: string,
    entity?: string,
    field?: string
  ): Promise<ValidationRule[]> {
    try {
      // Build filter
      const filter: any = {
        projectId,
      };

      if (entity) {
        filter.entity = entity;
      }

      if (field) {
        filter.field = field;
      }

      // Get validation rules
      const rules = await this.prisma.validationRule.findMany({
        where: filter,
      });

      return rules;
    } catch (error) {
      console.error(
        "[ValidationService] Error getting validation rules:",
        error
      );
      throw error;
    }
  }

  /**
   * Get validation rule by ID
   * @param id Validation rule ID
   * @returns Promise<ValidationRule | null> Validation rule or null if not found
   */
  async getValidationRuleById(id: string): Promise<ValidationRule | null> {
    try {
      // Get validation rule
      const rule = await this.prisma.validationRule.findUnique({
        where: {
          id,
        },
      });

      return rule;
    } catch (error) {
      console.error(
        "[ValidationService] Error getting validation rule by ID:",
        error
      );
      throw error;
    }
  }

  /**
   * Update validation rule
   * @param id Validation rule ID
   * @param input Validation rule input
   * @returns Promise<ValidationRule> Updated validation rule
   */
  async updateValidationRule(
    id: string,
    input: Partial<ValidationRuleInput>
  ): Promise<ValidationRule> {
    try {
      // Build update data
      const data: any = {};

      if (input.entity) {
        data.entity = input.entity;
      }

      if (input.field !== undefined) {
        data.field = input.field;
      }

      if (input.type) {
        data.type = input.type;
      }

      if (input.parameters !== undefined) {
        data.parameters = input.parameters
          ? JSON.stringify(input.parameters)
          : null;
      }

      if (input.message) {
        data.message = input.message;
      }

      if (input.severity) {
        data.severity = input.severity;
      }

      if (input.remediation) {
        data.remediation = input.remediation;
      }

      // Update validation rule
      const rule = await this.prisma.validationRule.update({
        where: {
          id,
        },
        data,
      });

      return rule;
    } catch (error) {
      console.error(
        "[ValidationService] Error updating validation rule:",
        error
      );
      throw error;
    }
  }

  /**
   * Delete validation rule
   * @param id Validation rule ID
   * @returns Promise<ValidationRule> Deleted validation rule
   */
  async deleteValidationRule(id: string): Promise<ValidationRule> {
    try {
      // Delete validation rule
      const rule = await this.prisma.validationRule.delete({
        where: {
          id,
        },
      });

      return rule;
    } catch (error) {
      console.error(
        "[ValidationService] Error deleting validation rule:",
        error
      );
      throw error;
    }
  }

  /**
   * Validate data
   * @param entity Entity name
   * @param data Data to validate
   * @param projectId Project ID
   * @param fileId Optional file ID
   * @param options Validation options
   * @returns Promise<ValidationRunResult> Validation run result
   */
  async validate(
    entity: string,
    data: any[],
    projectId: string,
    fileId?: string,
    options: ValidationOptions = {}
  ): Promise<ValidationRunResult> {
    try {
      console.log(
        `[ValidationService] Validating ${data.length} ${entity} records`
      );

      // Set default options
      const mergedOptions: ValidationOptions = {
        skipInvalidRecords: false,
        validateSchema: true,
        validateRelationships: true,
        validateBusinessRules: true,
        validateDataQuality: true,
        ...options,
      };

      // Get validation rules for the entity
      const rules = await this.getValidationRules(projectId, entity);

      // Initialize counters
      let passedRecords = 0;
      let failedRecords = 0;
      let warningRecords = 0;

      // Initialize metrics
      let totalFields = 0;
      let completeFields = 0;
      let accurateFields = 0;
      let consistentFields = 0;
      let errorFields = 0;
      let warningFields = 0;

      // Initialize record results
      const recordResults: RecordValidationResult[] = [];
      const validationResults: any[] = [];

      // Validate each record
      for (const record of data) {
        const recordId = record.id || `record_${data.indexOf(record)}`;
        const fieldResults: FieldValidationResult[] = [];
        let recordStatus = ValidationStatus.VALID;

        // Get all fields in the record
        const fields = Object.keys(record);

        // Validate each field
        for (const field of fields) {
          const value = record[field];
          const fieldRules = rules.filter(
            (rule) => !rule.field || rule.field === field
          );
          const errors: string[] = [];
          const warnings: string[] = [];

          totalFields++;

          // Apply each rule
          for (const rule of fieldRules) {
            // Skip rules that don't apply to this field
            if (rule.field && rule.field !== field) {
              continue;
            }

            // Get validator
            const validator = this.validators.get(rule.type);
            if (!validator) {
              console.warn(
                `[ValidationService] Validator not found for type: ${rule.type}`
              );
              continue;
            }

            // Parse parameters
            const parameters = rule.parameters
              ? JSON.parse(rule.parameters as string)
              : {};

            // Validate value
            const result = validator(value, parameters);
            if (!result.valid) {
              const message = result.message || rule.message;

              // Handle based on severity
              if (rule.severity === ValidationSeverity.ERROR) {
                errors.push(message);
                errorFields++;
                recordStatus = ValidationStatus.INVALID;
              } else if (rule.severity === ValidationSeverity.WARNING) {
                warnings.push(message);
                warningFields++;
                if (recordStatus !== ValidationStatus.INVALID) {
                  recordStatus = ValidationStatus.WARNING;
                }
              }

              // Create validation result
              const validationResultId = `result_${uuidv4()}`;
              validationResults.push({
                id: validationResultId,
                entity,
                recordId,
                ruleId: rule.id,
                field,
                status: result.valid ? "valid" : "invalid",
                message: result.valid ? null : message,
                severity: rule.severity,
                createdAt: new Date(),
              });
            } else {
              // Update metrics
              if (rule.type === "required" && result.valid) {
                completeFields++;
              } else if (rule.type === "type" && result.valid) {
                accurateFields++;
              } else if (rule.type === "pattern" && result.valid) {
                consistentFields++;
              }
            }
          }

          // Add field result
          fieldResults.push({
            field,
            status:
              errors.length > 0
                ? ValidationStatus.INVALID
                : warnings.length > 0
                ? ValidationStatus.WARNING
                : ValidationStatus.VALID,
            errors,
            warnings,
          });
        }

        // Add record result
        recordResults.push({
          recordId,
          status: recordStatus,
          fieldResults,
        });

        // Update counters
        if (recordStatus === ValidationStatus.VALID) {
          passedRecords++;
        } else if (recordStatus === ValidationStatus.INVALID) {
          failedRecords++;
        } else if (recordStatus === ValidationStatus.WARNING) {
          warningRecords++;
        }
      }

      // Calculate metrics
      const completenessRate =
        totalFields > 0 ? completeFields / totalFields : 1;
      const accuracyRate = totalFields > 0 ? accurateFields / totalFields : 1;
      const consistencyRate =
        totalFields > 0 ? consistentFields / totalFields : 1;
      const errorRate = totalFields > 0 ? errorFields / totalFields : 0;
      const warningRate = totalFields > 0 ? warningFields / totalFields : 0;

      // Create validation run
      const runId = `run_${uuidv4()}`;
      const run = await this.prisma.validationRun.create({
        data: {
          id: runId,
          entity,
          projectId,
          fileId,
          totalRecords: data.length,
          passedRecords,
          failedRecords,
          warningRecords,
          metrics: JSON.stringify({
            completenessRate,
            accuracyRate,
            consistencyRate,
            errorRate,
            warningRate,
          }),
        },
      });

      // Create validation results
      if (validationResults.length > 0) {
        await this.prisma.validationResult.createMany({
          data: validationResults,
        });
      }

      // Return validation run result
      return {
        id: run.id,
        entity,
        totalRecords: data.length,
        passedRecords,
        failedRecords,
        warningRecords,
        metrics: {
          completenessRate,
          accuracyRate,
          consistencyRate,
          errorRate,
          warningRate,
        },
        recordResults,
      };
    } catch (error) {
      console.error("[ValidationService] Error validating data:", error);
      throw error;
    }
  }

  /**
   * Get validation run
   * @param id Validation run ID
   * @returns Promise<ValidationRun | null> Validation run or null if not found
   */
  async getValidationRun(id: string): Promise<ValidationRun | null> {
    try {
      // Get validation run
      const run = await this.prisma.validationRun.findUnique({
        where: {
          id,
        },
      });

      return run;
    } catch (error) {
      console.error("[ValidationService] Error getting validation run:", error);
      throw error;
    }
  }

  /**
   * Get validation results for a run
   * @param runId Validation run ID
   * @returns Promise<ValidationResult[]> Validation results
   */
  async getValidationResults(runId: string): Promise<ValidationResult[]> {
    try {
      // Get validation run
      const run = await this.getValidationRun(runId);
      if (!run) {
        throw new Error(`Validation run ${runId} not found`);
      }

      // Get validation results
      const results = await this.prisma.validationResult.findMany({
        where: {
          entity: run.entity,
          createdAt: {
            gte: run.createdAt,
            lte: new Date(run.createdAt.getTime() + 1000), // 1 second window
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return results;
    } catch (error) {
      console.error(
        "[ValidationService] Error getting validation results:",
        error
      );
      throw error;
    }
  }

  /**
   * Generate validation report
   * @param runId Validation run ID
   * @returns Promise<ValidationReport> Validation report
   */
  async generateValidationReport(runId: string): Promise<ValidationReport> {
    try {
      // Get validation run
      const run = await this.getValidationRun(runId);
      if (!run) {
        throw new Error(`Validation run ${runId} not found`);
      }

      // Get validation results
      const results = await this.getValidationResults(runId);

      // Group results by record ID
      const recordResults = new Map<string, RecordValidationResult>();

      for (const result of results) {
        const recordId = result.recordId;
        const field = result.field || "";

        // Get or create record result
        let recordResult = recordResults.get(recordId);
        if (!recordResult) {
          recordResult = {
            recordId,
            status: ValidationStatus.VALID,
            fieldResults: [],
          };
          recordResults.set(recordId, recordResult);
        }

        // Get or create field result
        let fieldResult = recordResult.fieldResults.find(
          (fr) => fr.field === field
        );
        if (!fieldResult) {
          fieldResult = {
            field,
            status: ValidationStatus.VALID,
            errors: [],
            warnings: [],
          };
          recordResult.fieldResults.push(fieldResult);
        }

        // Update field result
        if (result.status === "invalid") {
          if (result.severity === ValidationSeverity.ERROR) {
            fieldResult.errors.push(result.message || "");
            fieldResult.status = ValidationStatus.INVALID;
            recordResult.status = ValidationStatus.INVALID;
          } else if (result.severity === ValidationSeverity.WARNING) {
            fieldResult.warnings.push(result.message || "");
            if (fieldResult.status !== ValidationStatus.INVALID) {
              fieldResult.status = ValidationStatus.WARNING;
            }
            if (recordResult.status !== ValidationStatus.INVALID) {
              recordResult.status = ValidationStatus.WARNING;
            }
          }
        }
      }

      // Parse metrics
      const metrics = run.metrics
        ? JSON.parse(run.metrics as string)
        : {
            completenessRate: 1,
            accuracyRate: 1,
            consistencyRate: 1,
            errorRate: 0,
            warningRate: 0,
          };

      // Return validation report
      return {
        summary: {
          totalRecords: run.totalRecords,
          passedRecords: run.passedRecords,
          failedRecords: run.failedRecords,
          warningRecords: run.warningRecords,
        },
        metrics,
        details: Array.from(recordResults.values()),
      };
    } catch (error) {
      console.error(
        "[ValidationService] Error generating validation report:",
        error
      );
      throw error;
    }
  }

  /**
   * Check if a table exists
   * @param tableName Table name
   * @returns Promise<boolean> True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const result = (await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = ${tableName}
        ) as exists
      `) as Array<{ exists: boolean }>;

      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(
        `[ValidationService] Error checking if table ${tableName} exists:`,
        error
      );
      return false;
    }
  }
}
