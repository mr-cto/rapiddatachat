import { v4 as uuidv4 } from "uuid";
import { executeQuery } from "../database";

/**
 * Interface for transformation rule
 */
export interface TransformationRule {
  id: string;
  name: string;
  description?: string;
  type: TransformationType;
  params: Record<string, any>;
  priority?: number;
  condition?: TransformationCondition;
}

/**
 * Transformation rule types
 */
export enum TransformationType {
  FORMAT = "format",
  REPLACE = "replace",
  TRUNCATE = "truncate",
  PAD = "pad",
  NUMBER = "number",
  DATE = "date",
  AGGREGATE = "aggregate",
  CALCULATION = "calculation",
  CONDITIONAL = "conditional",
  CUSTOM = "custom",
}

/**
 * Interface for transformation condition
 */
export interface TransformationCondition {
  field: string;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "regex";
  value: any;
  combinator?: "and" | "or";
  conditions?: TransformationCondition[];
}

/**
 * Interface for transformation result
 */
export interface TransformationResult {
  success: boolean;
  value: any;
  originalValue: any;
  errors?: string[];
}

/**
 * Interface for transformation context
 */
export interface TransformationContext {
  row?: Record<string, any>;
  allRows?: Record<string, any>[];
  rowIndex?: number;
  variables?: Record<string, any>;
}

/**
 * Interface for rule set
 */
export interface RuleSet {
  id: string;
  name: string;
  description?: string;
  rules: TransformationRule[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  projectId: string;
}

/**
 * Transformation Rule Engine class
 *
 * Responsible for executing transformation rules on data
 */
export class TransformationRuleEngine {
  /**
   * Apply transformation rules to a batch of data
   *
   * @param data Data to transform
   * @param rules Transformation rules
   * @param context Transformation context
   * @returns Transformed data
   */
  async applyTransformations(
    data: any[],
    rules: Record<string, TransformationRule[]>,
    context?: Partial<TransformationContext>
  ): Promise<any[]> {
    try {
      // Create transformation context
      const transformationContext: TransformationContext = {
        allRows: data,
        variables: {},
        ...context,
      };

      // Transform data
      return data.map((row, rowIndex) => {
        const transformedRow = { ...row };

        // Update context for current row
        transformationContext.row = row;
        transformationContext.rowIndex = rowIndex;

        // Apply transformation rules to each column
        Object.entries(rules).forEach(([columnName, columnRules]) => {
          if (transformedRow[columnName] !== undefined) {
            let value = transformedRow[columnName];

            // Sort rules by priority
            const sortedRules = [...columnRules].sort(
              (a, b) => (b.priority || 0) - (a.priority || 0)
            );

            // Apply each rule in sequence
            for (const rule of sortedRules) {
              // Check if rule should be applied based on condition
              if (
                rule.condition &&
                !this.evaluateCondition(
                  rule.condition,
                  transformedRow,
                  transformationContext
                )
              ) {
                continue;
              }

              // Apply transformation
              const result = this.applyTransformation(
                value,
                rule,
                transformationContext
              );

              // Update value if transformation was successful
              if (result.success) {
                value = result.value;
              }
            }

            // Update transformed row
            transformedRow[columnName] = value;
          }
        });

        return transformedRow;
      });
    } catch (error) {
      console.error("Error applying transformations:", error);
      throw error;
    }
  }

  /**
   * Apply a single transformation rule to a value
   *
   * @param value Value to transform
   * @param rule Transformation rule
   * @param context Transformation context
   * @returns Transformation result
   */
  applyTransformation(
    value: any,
    rule: TransformationRule,
    context: TransformationContext
  ): TransformationResult {
    try {
      // Handle null or undefined values
      if (value === null || value === undefined) {
        return {
          success: true,
          value,
          originalValue: value,
        };
      }

      // Apply transformation based on type
      switch (rule.type) {
        case TransformationType.FORMAT:
          return this.applyFormatTransformation(value, rule.params);
        case TransformationType.REPLACE:
          return this.applyReplaceTransformation(value, rule.params);
        case TransformationType.TRUNCATE:
          return this.applyTruncateTransformation(value, rule.params);
        case TransformationType.PAD:
          return this.applyPadTransformation(value, rule.params);
        case TransformationType.NUMBER:
          return this.applyNumberTransformation(value, rule.params);
        case TransformationType.DATE:
          return this.applyDateTransformation(value, rule.params);
        case TransformationType.AGGREGATE:
          return this.applyAggregateTransformation(value, rule.params, context);
        case TransformationType.CALCULATION:
          return this.applyCalculationTransformation(
            value,
            rule.params,
            context
          );
        case TransformationType.CONDITIONAL:
          return this.applyConditionalTransformation(
            value,
            rule.params,
            context
          );
        case TransformationType.CUSTOM:
          return this.applyCustomTransformation(value, rule.params, context);
        default:
          return {
            success: false,
            value,
            originalValue: value,
            errors: [`Unsupported transformation type: ${rule.type}`],
          };
      }
    } catch (error) {
      return {
        success: false,
        value,
        originalValue: value,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Evaluate a transformation condition
   *
   * @param condition Transformation condition
   * @param row Current row
   * @param context Transformation context
   * @returns True if condition is met
   */
  evaluateCondition(
    condition: TransformationCondition,
    row: Record<string, any>,
    context: TransformationContext
  ): boolean {
    try {
      // Handle nested conditions
      if (condition.conditions && condition.conditions.length > 0) {
        const results = condition.conditions.map((c) =>
          this.evaluateCondition(c, row, context)
        );

        return condition.combinator === "or"
          ? results.some((r) => r)
          : results.every((r) => r);
      }

      // Get field value
      const fieldValue = row[condition.field];

      // Evaluate condition
      switch (condition.operator) {
        case "eq":
          return fieldValue === condition.value;
        case "neq":
          return fieldValue !== condition.value;
        case "gt":
          return fieldValue > condition.value;
        case "gte":
          return fieldValue >= condition.value;
        case "lt":
          return fieldValue < condition.value;
        case "lte":
          return fieldValue <= condition.value;
        case "contains":
          return String(fieldValue).includes(String(condition.value));
        case "startsWith":
          return String(fieldValue).startsWith(String(condition.value));
        case "endsWith":
          return String(fieldValue).endsWith(String(condition.value));
        case "regex":
          return new RegExp(condition.value).test(String(fieldValue));
        default:
          return false;
      }
    } catch (error) {
      console.error("Error evaluating condition:", error);
      return false;
    }
  }

  /**
   * Apply format transformation
   *
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformation result
   */
  applyFormatTransformation(value: any, params: any): TransformationResult {
    const originalValue = value;

    try {
      const formatType = params.formatType || "lowercase";
      let formattedValue = String(value);

      switch (formatType) {
        case "lowercase":
          formattedValue = formattedValue.toLowerCase();
          break;
        case "uppercase":
          formattedValue = formattedValue.toUpperCase();
          break;
        case "capitalize":
          formattedValue =
            formattedValue.charAt(0).toUpperCase() +
            formattedValue.slice(1).toLowerCase();
          break;
        case "title":
          formattedValue = formattedValue
            .split(" ")
            .map(
              (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(" ");
          break;
        case "trim":
          formattedValue = formattedValue.trim();
          break;
        case "slug":
          formattedValue = formattedValue
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-");
          break;
        default:
          return {
            success: false,
            value: originalValue,
            originalValue,
            errors: [`Unsupported format type: ${formatType}`],
          };
      }

      return {
        success: true,
        value: formattedValue,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Apply replace transformation
   *
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformation result
   */
  applyReplaceTransformation(value: any, params: any): TransformationResult {
    const originalValue = value;

    try {
      const {
        pattern,
        replacement = "",
        useRegex = false,
        global = true,
        caseSensitive = true,
      } = params;

      if (!pattern) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ["Pattern is required for replace transformation"],
        };
      }

      let replacedValue = String(value);

      if (useRegex) {
        const flags = `${global ? "g" : ""}${!caseSensitive ? "i" : ""}`;
        const regex = new RegExp(pattern, flags);
        replacedValue = replacedValue.replace(regex, replacement);
      } else {
        if (global) {
          const regex = new RegExp(
            pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"),
            caseSensitive ? "g" : "gi"
          );
          replacedValue = replacedValue.replace(regex, replacement);
        } else {
          if (caseSensitive) {
            replacedValue = replacedValue.replace(pattern, replacement);
          } else {
            const index = replacedValue
              .toLowerCase()
              .indexOf(pattern.toLowerCase());
            if (index !== -1) {
              replacedValue =
                replacedValue.substring(0, index) +
                replacement +
                replacedValue.substring(index + pattern.length);
            }
          }
        }
      }

      return {
        success: true,
        value: replacedValue,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Apply truncate transformation
   *
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformation result
   */
  applyTruncateTransformation(value: any, params: any): TransformationResult {
    const originalValue = value;

    try {
      const { length = 100, suffix = "..." } = params;

      if (typeof length !== "number" || length < 0) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ["Length must be a non-negative number"],
        };
      }

      const stringValue = String(value);

      if (stringValue.length <= length) {
        return {
          success: true,
          value: stringValue,
          originalValue,
        };
      }

      const truncatedValue = stringValue.substring(0, length) + suffix;

      return {
        success: true,
        value: truncatedValue,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Apply pad transformation
   *
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformation result
   */
  applyPadTransformation(value: any, params: any): TransformationResult {
    const originalValue = value;

    try {
      const { length = 10, char = " ", position = "end" } = params;

      if (typeof length !== "number" || length < 0) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ["Length must be a non-negative number"],
        };
      }

      const stringValue = String(value);

      if (stringValue.length >= length) {
        return {
          success: true,
          value: stringValue,
          originalValue,
        };
      }

      const padChar = String(char).charAt(0);
      const padLength = length - stringValue.length;
      const padding = padChar.repeat(padLength);

      let paddedValue: string;

      switch (position) {
        case "start":
          paddedValue = padding + stringValue;
          break;
        case "end":
          paddedValue = stringValue + padding;
          break;
        case "both":
          const startPadLength = Math.floor(padLength / 2);
          const endPadLength = padLength - startPadLength;
          paddedValue =
            padChar.repeat(startPadLength) +
            stringValue +
            padChar.repeat(endPadLength);
          break;
        default:
          return {
            success: false,
            value: originalValue,
            originalValue,
            errors: [`Unsupported pad position: ${position}`],
          };
      }

      return {
        success: true,
        value: paddedValue,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Apply number transformation
   *
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformation result
   */
  applyNumberTransformation(value: any, params: any): TransformationResult {
    const originalValue = value;

    try {
      const { format = "decimal", precision = 2, locale = "en-US" } = params;

      // Convert to number
      const numValue = Number(value);

      if (isNaN(numValue)) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ["Value is not a valid number"],
        };
      }

      let formattedValue: string;

      switch (format) {
        case "decimal":
          formattedValue = numValue.toFixed(precision);
/**
   * Apply aggregate transformation
   * 
   * @param value Value to transform
   * @param params Transformation parameters
   * @param context Transformation context
   * @returns Transformation result
   */
  applyAggregateTransformation(
    value: any,
    params: any,
    context: TransformationContext
  ): TransformationResult {
    const originalValue = value;
    
    try {
      const { operation = 'sum', field, filter } = params;
      
      if (!context.allRows || !Array.isArray(context.allRows) || context.allRows.length === 0) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ['No data available for aggregation'],
        };
      }
      
      // Filter rows if filter is provided
      let rows = context.allRows;
      
      if (filter) {
        rows = rows.filter(row => this.evaluateCondition(filter, row, context));
      }
      
      // Get values to aggregate
      let values: any[];
      
      if (field) {
        values = rows.map(row => row[field]).filter(v => v !== undefined && v !== null);
      } else {
        values = [value];
      }
      
      if (values.length === 0) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ['No values available for aggregation'],
        };
      }
      
      // Apply aggregation
      let result: any;
      
      switch (operation) {
        case 'sum':
          result = values.reduce((sum, v) => sum + Number(v), 0);
          break;
        case 'avg':
          result = values.reduce((sum, v) => sum + Number(v), 0) / values.length;
          break;
        case 'min':
          result = Math.min(...values.map(v => Number(v)));
          break;
        case 'max':
          result = Math.max(...values.map(v => Number(v)));
          break;
        case 'count':
          result = values.length;
          break;
        case 'concat':
          const separator = params.separator || '';
          result = values.join(separator);
          break;
        default:
          return {
            success: false,
            value: originalValue,
            originalValue,
            errors: [`Unsupported aggregate operation: ${operation}`],
          };
      }
      
      return {
        success: true,
        value: result,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Apply calculation transformation
   * 
   * @param value Value to transform
   * @param params Transformation parameters
   * @param context Transformation context
   * @returns Transformation result
   */
  applyCalculationTransformation(
    value: any,
    params: any,
    context: TransformationContext
  ): TransformationResult {
    const originalValue = value;
    
    try {
      const { formula, variables = {} } = params;
      
      if (!formula) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ['Formula is required for calculation transformation'],
        };
      }
      
      // Create evaluation context
      const evalContext: Record<string, any> = {
        value: originalValue,
        ...variables,
      };
      
      // Add row values to context
      if (context.row) {
        Object.entries(context.row).forEach(([key, val]) => {
          evalContext[key] = val;
        });
      }
      
      // Add safe math functions
      const mathFunctions = {
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        round: Math.round,
        min: Math.min,
        max: Math.max,
        pow: Math.pow,
        sqrt: Math.sqrt,
        log: Math.log,
        log10: Math.log10,
        exp: Math.exp,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        atan2: Math.atan2,
        random: Math.random,
      };
      
      Object.entries(mathFunctions).forEach(([key, func]) => {
        evalContext[key] = func;
      });
      
      // Evaluate formula
      const result = this.evaluateFormula(formula, evalContext);
      
      return {
        success: true,
        value: result,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Apply conditional transformation
   * 
   * @param value Value to transform
   * @param params Transformation parameters
   * @param context Transformation context
   * @returns Transformation result
   */
  applyConditionalTransformation(
    value: any,
    params: any,
    context: TransformationContext
  ): TransformationResult {
    const originalValue = value;
    
    try {
      const { condition, trueValue, falseValue } = params;
      
      if (!condition) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ['Condition is required for conditional transformation'],
        };
      }
      
      // Evaluate condition
      const conditionMet = this.evaluateCondition(condition, context.row || {}, context);
      
      // Return appropriate value
      return {
        success: true,
        value: conditionMet
          ? trueValue !== undefined ? trueValue : originalValue
          : falseValue !== undefined ? falseValue : originalValue,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Apply custom transformation
   * 
   * @param value Value to transform
   * @param params Transformation parameters
   * @param context Transformation context
   * @returns Transformation result
   */
  applyCustomTransformation(
    value: any,
    params: any,
    context: TransformationContext
  ): TransformationResult {
    const originalValue = value;
    
    try {
      const { code } = params;
      
      if (!code) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ['Code is required for custom transformation'],
        };
      }
      
      // Create evaluation context
      const evalContext: Record<string, any> = {
        value: originalValue,
        row: context.row || {},
        allRows: context.allRows || [],
        rowIndex: context.rowIndex || 0,
        variables: context.variables || {},
      };
      
      // Add safe math functions
      const mathFunctions = {
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        round: Math.round,
        min: Math.min,
        max: Math.max,
        pow: Math.pow,
        sqrt: Math.sqrt,
        log: Math.log,
        log10: Math.log10,
        exp: Math.exp,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        atan2: Math.atan2,
        random: Math.random,
      };
      
      Object.entries(mathFunctions).forEach(([key, func]) => {
        evalContext[key] = func;
      });
      
      // Evaluate code
      const result = this.evaluateFormula(`(function() { ${code} })()`, evalContext);
      
      return {
        success: true,
        value: result,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Evaluate a formula safely
   * 
   * @param formula Formula to evaluate
   * @param context Evaluation context
   * @returns Evaluation result
   */
  private evaluateFormula(formula: string, context: Record<string, any>): any {
    // Create a safe evaluation function
    const safeEval = (code: string, context: Record<string, any>) => {
      // Create parameter names and values arrays
      const paramNames = Object.keys(context);
      const paramValues = Object.values(context);
      
      // Create a new function with the context variables as parameters
      const func = new Function(...paramNames, `return ${code}`);
      
      // Call the function with the context values
      return func(...paramValues);
    };
    
    // Evaluate the formula
    return safeEval(formula, context);
  }

  /**
   * Check if a table exists
   * 
   * @param tableName Table name
   * @returns True if the table exists
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await executeQuery(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '${tableName}'
        ) as exists
      `) as Array<{ exists: boolean }>;
      
      return result && result.length > 0 && result[0].exists;
    } catch (error) {
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }
}

export default new TransformationRuleEngine();
          break;
        case "currency":
          const currency = params.currency || "USD";
          formattedValue = new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
          }).format(numValue);
          break;
        case "percent":
          formattedValue = new Intl.NumberFormat(locale, {
            style: "percent",
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
          }).format(numValue / 100);
          break;
        case "scientific":
          formattedValue = numValue.toExponential(precision);
          break;
        case "compact":
          formattedValue = new Intl.NumberFormat(locale, {
            notation: "compact",
            compactDisplay: params.compactDisplay || "short",
          }).format(numValue);
          break;
        default:
          return {
            success: false,
            value: originalValue,
            originalValue,
            errors: [`Unsupported number format: ${format}`],
          };
      }

      return {
        success: true,
        value: formattedValue,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Apply date transformation
   *
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformation result
   */
  applyDateTransformation(value: any, params: any): TransformationResult {
    const originalValue = value;

    try {
      const { format = "ISO", locale = "en-US", timezone } = params;

      // Parse date
      const dateValue = new Date(value);

      if (isNaN(dateValue.getTime())) {
        return {
          success: false,
          value: originalValue,
          originalValue,
          errors: ["Value is not a valid date"],
        };
      }

      let formattedValue: string;

      switch (format) {
        case "ISO":
          formattedValue = dateValue.toISOString();
          break;
        case "short":
          formattedValue = new Intl.DateTimeFormat(locale, {
            dateStyle: "short",
            timeZone: timezone,
          }).format(dateValue);
          break;
        case "medium":
          formattedValue = new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeZone: timezone,
          }).format(dateValue);
          break;
        case "long":
          formattedValue = new Intl.DateTimeFormat(locale, {
            dateStyle: "long",
            timeZone: timezone,
          }).format(dateValue);
          break;
        case "full":
          formattedValue = new Intl.DateTimeFormat(locale, {
            dateStyle: "full",
            timeZone: timezone,
          }).format(dateValue);
          break;
        case "custom":
          const customFormat = params.customFormat || "yyyy-MM-dd";
          formattedValue = this.formatDateWithPattern(
            dateValue,
            customFormat,
            locale
          );
          break;
        default:
          return {
            success: false,
            value: originalValue,
            originalValue,
            errors: [`Unsupported date format: ${format}`],
          };
      }

      return {
        success: true,
        value: formattedValue,
        originalValue,
      };
    } catch (error) {
      return {
        success: false,
        value: originalValue,
        originalValue,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Format date with pattern
   *
   * @param date Date to format
   * @param pattern Format pattern
   * @param locale Locale
   * @returns Formatted date
   */
  private formatDateWithPattern(
    date: Date,
    pattern: string,
    locale: string
  ): string {
    // Simple implementation of date formatting with patterns
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    return pattern
      .replace(/yyyy/g, year.toString())
      .replace(/yy/g, (year % 100).toString().padStart(2, "0"))
      .replace(/MM/g, month.toString().padStart(2, "0"))
      .replace(/M/g, month.toString())
      .replace(/dd/g, day.toString().padStart(2, "0"))
      .replace(/d/g, day.toString())
      .replace(/HH/g, hours.toString().padStart(2, "0"))
      .replace(/H/g, hours.toString())
      .replace(/mm/g, minutes.toString().padStart(2, "0"))
      .replace(/m/g, minutes.toString())
      .replace(/ss/g, seconds.toString().padStart(2, "0"))
      .replace(/s/g, seconds.toString());
  }
}

export default new TransformationRuleEngine();
