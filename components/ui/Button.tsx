import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

// Define button variants using class-variance-authority
const buttonVariants = cva(
  // Base styles applied to all buttons
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-primary text-white hover:bg-accent-primary-hover focus-visible:ring-accent-primary",
        secondary:
          "bg-ui-tertiary text-gray-300 hover:bg-ui-tertiary/80 focus-visible:ring-ui-tertiary",
        outline:
          "border border-ui-border bg-transparent hover:bg-ui-secondary text-gray-300 focus-visible:ring-ui-border",
        ghost:
          "bg-transparent hover:bg-ui-secondary text-gray-300 focus-visible:ring-ui-border",
        danger:
          "bg-red-500/90 text-white hover:bg-red-500 focus-visible:ring-red-500",
        success:
          "bg-green-500/90 text-white hover:bg-green-500 focus-visible:ring-green-500",
        warning:
          "bg-yellow-500/90 text-white hover:bg-yellow-500 focus-visible:ring-yellow-500",
        info: "bg-blue-500/90 text-white hover:bg-blue-500 focus-visible:ring-blue-500",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

// Define the props for our Button component
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "success"
    | "warning"
    | "info";
  size?: "sm" | "md" | "lg" | "icon";
  fullWidth?: boolean;
  isLoading?: boolean;
}

// Create the Button component
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, fullWidth, isLoading, children, ...props },
    ref
  ) => {
    return (
      <button
        className={buttonVariants({ variant, size, fullWidth, className })}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Loading...</span>
          </div>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
