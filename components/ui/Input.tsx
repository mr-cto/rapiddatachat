import React from "react";
import { cva } from "class-variance-authority";

// Define input variants using class-variance-authority
const inputVariants = cva(
  // Base styles applied to all inputs
  "flex w-full rounded-md border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-ui-border bg-ui-primary text-gray-300 placeholder:text-gray-500 focus-visible:ring-accent-primary",
        error:
          "border-red-500 bg-ui-primary text-gray-300 placeholder:text-gray-500 focus-visible:ring-red-500",
      },
      inputSize: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md",
    },
  }
);

// Define the props for our Input component
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: "default" | "error";
  inputSize?: "sm" | "md" | "lg";
  error?: string;
  label?: string;
  helperText?: string;
}

// Create the Input component
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, variant, inputSize, error, label, helperText, ...props },
    ref
  ) => {
    // If there's an error, use the error variant
    const inputVariant = error ? "error" : variant;

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-gray-300"
          >
            {label}
          </label>
        )}

        <input
          className={inputVariants({
            variant: inputVariant,
            inputSize,
            className,
          })}
          ref={ref}
          {...props}
        />

        {(error || helperText) && (
          <p className={`text-xs ${error ? "text-red-400" : "text-gray-400"}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, inputVariants };
