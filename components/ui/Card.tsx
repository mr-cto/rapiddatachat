import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

// Define card variants using class-variance-authority
const cardVariants = cva(
  // Base styles applied to all cards
  "rounded-lg shadow-sm overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-ui-primary border border-ui-border",
        secondary: "bg-ui-secondary border border-ui-border",
        outline: "bg-transparent border border-ui-border",
        ghost: "bg-transparent border-none shadow-none",
        success: "bg-green-900/20 border border-green-800",
        warning: "bg-yellow-900/20 border border-yellow-800",
        danger: "bg-red-900/20 border border-red-800",
        info: "bg-blue-900/20 border border-blue-800",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

// Define the props for our Card component
export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

// Create the Card component
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, children, ...props }, ref) => {
    return (
      <div
        className={cardVariants({ variant, padding, className })}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// Define the props for our CardHeader component
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

// Create the CardHeader component
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        className={`border-b border-ui-border p-4 ${className || ""}`}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// Define the props for our CardContent component
export interface CardContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

// Create the CardContent component
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className={`p-4 ${className || ""}`} ref={ref} {...props}>
        {children}
      </div>
    );
  }
);

// Define the props for our CardFooter component
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

// Create the CardFooter component
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        className={`border-t border-ui-border p-4 ${className || ""}`}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// Define the props for our CardTitle component
export interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

// Create the CardTitle component
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        className={`text-lg font-semibold text-gray-300 ${className || ""}`}
        ref={ref}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

// Define the props for our CardDescription component
export interface CardDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

// Create the CardDescription component
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  CardDescriptionProps
>(({ className, children, ...props }, ref) => {
  return (
    <p
      className={`text-sm text-gray-400 ${className || ""}`}
      ref={ref}
      {...props}
    >
      {children}
    </p>
  );
});

Card.displayName = "Card";
CardHeader.displayName = "CardHeader";
CardContent.displayName = "CardContent";
CardFooter.displayName = "CardFooter";
CardTitle.displayName = "CardTitle";
CardDescription.displayName = "CardDescription";

export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
  cardVariants,
};
