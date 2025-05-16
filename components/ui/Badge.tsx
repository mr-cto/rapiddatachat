import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

// Define badge variants using class-variance-authority
const badgeVariants = cva(
  // Base styles applied to all badges
  "inline-flex items-center rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-ui-tertiary text-gray-300",
        primary: "bg-accent-primary/20 text-accent-primary",
        secondary: "bg-gray-800 text-gray-300",
        success: "bg-green-900/30 text-green-400",
        warning: "bg-yellow-900/30 text-yellow-400",
        danger: "bg-red-900/30 text-red-400",
        outline: "border border-ui-border text-gray-300",
        info: "bg-blue-900/30 text-blue-400",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-2.5 py-0.5",
        lg: "text-base px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// Define the props for our Badge component
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
}

// Create the Badge component
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => {
    return (
      <div
        className={badgeVariants({ variant, size, className })}
        ref={ref}
        {...props}
      >
        {icon && <span className="mr-1">{icon}</span>}
        {children}
      </div>
    );
  }
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
