import { FieldValues, UseFormReturn } from "react-hook-form";
import { ZodSchema, ZodError } from "zod";

/**
 * Utility function to handle form submission with validation
 * @param form The react-hook-form instance
 * @param schema Zod schema for validation
 * @param onSubmit Function to call with validated data
 * @returns A function to handle form submission
 */
export function createSubmitHandler<
  TFieldValues extends FieldValues,
  TSchema extends ZodSchema<any>
>(
  form: UseFormReturn<TFieldValues>,
  schema: TSchema,
  onSubmit: (data: TSchema["_output"]) => Promise<void> | void
) {
  return async (data: TFieldValues) => {
    try {
      // Validate the data using the schema
      const validatedData = schema.parse(data);

      // Call the onSubmit function with the validated data
      await onSubmit(validatedData);
    } catch (error) {
      // If there's a validation error, set the form errors
      if (error instanceof ZodError) {
        error.errors.forEach((err) => {
          if (err.path) {
            form.setError(err.path.join(".") as any, {
              type: "manual",
              message: err.message,
            });
          }
        });
      } else {
        // If it's not a validation error, throw it
        throw error;
      }
    }
  };
}

/**
 * Utility function to format form errors
 * @param error The error object
 * @returns A formatted error message
 */
export function formatFormError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An error occurred";
}

/**
 * Utility function to handle API errors
 * @param error The error object
 * @param form The react-hook-form instance
 * @returns The error message
 */
export function handleApiError<TFieldValues extends FieldValues>(
  error: unknown,
  form?: UseFormReturn<TFieldValues>
): string {
  let errorMessage = "An error occurred";

  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "error" in error.response.data &&
    typeof error.response.data.error === "string"
  ) {
    errorMessage = error.response.data.error;
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    errorMessage = error.message;
  }

  // If we have a form instance, set the root error
  if (form) {
    form.setError("root", {
      type: "manual",
      message: errorMessage,
    });
  }

  return errorMessage;
}
