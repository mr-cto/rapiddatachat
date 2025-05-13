import { TransformationRule } from "../components/schema/TransformationRuleForm";

/**
 * Service for handling data transformations
 */
export class TransformationService {
  /**
   * Apply a transformation rule to a value
   * @param value Value to transform
   * @param rule Transformation rule to apply
   * @returns Transformed value
   */
  applyTransformation(value: any, rule: TransformationRule): any {
    try {
      // Handle null/undefined values
      if (value === null || value === undefined) {
        return null;
      }

      // Convert value to string for most transformations
      let stringValue = String(value);

      // Apply transformation based on rule type
      switch (rule.type) {
        case "format":
          return this.applyFormatTransformation(stringValue, rule.params);
        case "replace":
          return this.applyReplaceTransformation(stringValue, rule.params);
        case "truncate":
          return this.applyTruncateTransformation(stringValue, rule.params);
        case "pad":
          return this.applyPadTransformation(stringValue, rule.params);
        case "number":
          return this.applyNumberTransformation(value, rule.params);
        case "date":
          return this.applyDateTransformation(value, rule.params);
        case "custom":
          return this.applyCustomTransformation(value, rule.params);
        default:
          return value;
      }
    } catch (error) {
      console.error(
        `[TransformationService] Error applying transformation:`,
        error
      );
      return value; // Return original value on error
    }
  }

  /**
   * Apply format transformation
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformed value
   */
  private applyFormatTransformation(value: string, params: any): string {
    const { formatType } = params;

    switch (formatType) {
      case "uppercase":
        return value.toUpperCase();
      case "lowercase":
        return value.toLowerCase();
      case "capitalize":
        return value
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");
      case "trim":
        return value.trim();
      default:
        return value;
    }
  }

  /**
   * Apply replace transformation
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformed value
   */
  private applyReplaceTransformation(value: string, params: any): string {
    const { pattern, value: replaceValue } = params;

    try {
      // Check if pattern is a regex
      if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
        const lastSlashIndex = pattern.lastIndexOf("/");
        const regexPattern = pattern.substring(1, lastSlashIndex);
        const flags = pattern.substring(lastSlashIndex + 1);
        const regex = new RegExp(regexPattern, flags);
        return value.replace(regex, replaceValue || "");
      } else {
        // Simple string replacement
        return value.replace(new RegExp(pattern, "g"), replaceValue || "");
      }
    } catch (error) {
      console.error(
        `[TransformationService] Error applying replace transformation:`,
        error
      );
      return value;
    }
  }

  /**
   * Apply truncate transformation
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformed value
   */
  private applyTruncateTransformation(value: string, params: any): string {
    const { length } = params;
    return value.substring(0, length);
  }

  /**
   * Apply pad transformation
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformed value
   */
  private applyPadTransformation(value: string, params: any): string {
    const { length, char, direction } = params;

    if (value.length >= length) {
      return value;
    }

    const padChar = char || " ";
    const padLength = length - value.length;
    const padding = padChar.repeat(padLength);

    return direction === "left" ? padding + value : value + padding;
  }

  /**
   * Apply number transformation
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformed value
   */
  private applyNumberTransformation(value: any, params: any): string {
    const { format, decimalPlaces } = params;
    let numValue: number;

    // Convert value to number
    try {
      numValue = Number(value);
      if (isNaN(numValue)) {
        return value;
      }
    } catch (error) {
      return value;
    }

    // Apply number format
    switch (format) {
      case "fixed":
        return numValue.toFixed(decimalPlaces || 0);
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numValue);
      case "percentage":
        return new Intl.NumberFormat("en-US", {
          style: "percent",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numValue / 100);
      default:
        return String(numValue);
    }
  }

  /**
   * Apply date transformation
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformed value
   */
  private applyDateTransformation(value: any, params: any): string {
    const { format } = params;
    let dateValue: Date;

    // Convert value to date
    try {
      dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        return value;
      }
    } catch (error) {
      return value;
    }

    // Apply date format
    try {
      switch (format) {
        case "YYYY-MM-DD":
          return this.formatDate(dateValue, "YYYY-MM-DD");
        case "MM/DD/YYYY":
          return this.formatDate(dateValue, "MM/DD/YYYY");
        case "DD/MM/YYYY":
          return this.formatDate(dateValue, "DD/MM/YYYY");
        case "YYYY-MM-DD HH:mm:ss":
          return this.formatDate(dateValue, "YYYY-MM-DD HH:mm:ss");
        default:
          return dateValue.toISOString();
      }
    } catch (error) {
      console.error(
        `[TransformationService] Error applying date transformation:`,
        error
      );
      return value;
    }
  }

  /**
   * Format date according to format string
   * @param date Date to format
   * @param format Format string
   * @returns Formatted date string
   */
  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return format
      .replace("YYYY", String(year))
      .replace("MM", month)
      .replace("DD", day)
      .replace("HH", hours)
      .replace("mm", minutes)
      .replace("ss", seconds);
  }

  /**
   * Apply custom transformation
   * @param value Value to transform
   * @param params Transformation parameters
   * @returns Transformed value
   */
  private applyCustomTransformation(value: any, params: any): any {
    const { formula } = params;

    try {
      // Create a safe evaluation context
      const context = {
        value,
        CONCAT: (...args: any[]) => args.join(""),
        SUBSTRING: (str: string, start: number, length?: number) =>
          str.substring(
            start,
            length !== undefined ? start + length : undefined
          ),
        REPLACE: (str: string, search: string, replacement: string) =>
          str.replace(new RegExp(search, "g"), replacement),
        ROUND: (num: number, decimals: number = 0) =>
          Number(Math.round(Number(num + "e" + decimals)) + "e-" + decimals),
        FLOOR: Math.floor,
        CEILING: Math.ceil,
        ABS: Math.abs,
        UPPER: (str: string) => str.toUpperCase(),
        LOWER: (str: string) => str.toLowerCase(),
        TRIM: (str: string) => str.trim(),
        LENGTH: (str: string) => str.length,
        LEFT: (str: string, length: number) => str.substring(0, length),
        RIGHT: (str: string, length: number) =>
          str.substring(str.length - length),
        IF: (condition: boolean, trueValue: any, falseValue: any) =>
          condition ? trueValue : falseValue,
        CONTAINS: (str: string, search: string) => str.includes(search),
        STARTSWITH: (str: string, search: string) => str.startsWith(search),
        ENDSWITH: (str: string, search: string) => str.endsWith(search),
      };

      // Replace function names with context references
      let safeFormula = formula
        .replace(/CONCAT\(/g, "context.CONCAT(")
        .replace(/SUBSTRING\(/g, "context.SUBSTRING(")
        .replace(/REPLACE\(/g, "context.REPLACE(")
        .replace(/ROUND\(/g, "context.ROUND(")
        .replace(/FLOOR\(/g, "context.FLOOR(")
        .replace(/CEILING\(/g, "context.CEILING(")
        .replace(/ABS\(/g, "context.ABS(")
        .replace(/UPPER\(/g, "context.UPPER(")
        .replace(/LOWER\(/g, "context.LOWER(")
        .replace(/TRIM\(/g, "context.TRIM(")
        .replace(/LENGTH\(/g, "context.LENGTH(")
        .replace(/LEFT\(/g, "context.LEFT(")
        .replace(/RIGHT\(/g, "context.RIGHT(")
        .replace(/IF\(/g, "context.IF(")
        .replace(/CONTAINS\(/g, "context.CONTAINS(")
        .replace(/STARTSWITH\(/g, "context.STARTSWITH(")
        .replace(/ENDSWITH\(/g, "context.ENDSWITH(")
        .replace(/value/g, "context.value");

      // Evaluate the formula
      // eslint-disable-next-line no-new-func
      const result = new Function("context", `return ${safeFormula}`)(context);
      return result;
    } catch (error) {
      console.error(
        `[TransformationService] Error applying custom transformation:`,
        error
      );
      return value;
    }
  }

  /**
   * Apply multiple transformation rules to a value
   * @param value Value to transform
   * @param rules Transformation rules to apply
   * @returns Transformed value
   */
  applyTransformations(value: any, rules: TransformationRule[]): any {
    let transformedValue = value;

    for (const rule of rules) {
      transformedValue = this.applyTransformation(transformedValue, rule);
    }

    return transformedValue;
  }
}

export default new TransformationService();
