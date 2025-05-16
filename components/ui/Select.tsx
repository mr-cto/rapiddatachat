import React from "react";
import { cva } from "class-variance-authority";

// Define select variants using class-variance-authority
const selectVariants = cva(
  // Base styles applied to all selects
  "flex w-full rounded-md border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-no-repeat bg-right pr-8",
  {
    variants: {
      variant: {
        default:
          "border-ui-border bg-ui-primary text-gray-300 focus-visible:ring-accent-primary",
        error:
          "border-red-500 bg-ui-primary text-gray-300 focus-visible:ring-red-500",
      },
      selectSize: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      selectSize: "md",
    },
  }
);

// Define the props for our Select component
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  variant?: "default" | "error";
  selectSize?: "sm" | "md" | "lg";
  error?: string;
  label?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
}

// Create the Select component
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      variant,
      selectSize,
      error,
      label,
      helperText,
      options,
      ...props
    },
    ref
  ) => {
    // If there's an error, use the error variant
    const selectVariant = error ? "error" : variant;

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

        <div className="relative">
          <select
            className={selectVariants({
              variant: selectVariant,
              selectSize,
              className,
            })}
            ref={ref}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg
              className="h-4 w-4 fill-current"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {(error || helperText) && (
          <p className={`text-xs ${error ? "text-red-400" : "text-gray-400"}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select, selectVariants };
