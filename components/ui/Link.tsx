import React from "react";
import NextLink from "next/link";
import { cva } from "class-variance-authority";

// Define link variants using class-variance-authority
const linkVariants = cva(
  // Base styles applied to all links
  "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "text-accent-primary hover:text-accent-primary-hover focus-visible:ring-accent-primary",
        secondary:
          "text-gray-300 hover:text-gray-100 focus-visible:ring-gray-300",
        destructive:
          "text-red-400 hover:text-red-300 focus-visible:ring-red-400",
        ghost:
          "hover:bg-ui-secondary hover:text-gray-100 focus-visible:ring-ui-border",
        button:
          "bg-accent-primary text-white hover:bg-accent-primary-hover rounded-md px-4 py-2 focus-visible:ring-accent-primary",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      },
      underline: {
        true: "underline underline-offset-4",
        false: "no-underline",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      underline: false,
    },
  }
);

// Define the props for our Link component
export interface LinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: "default" | "secondary" | "destructive" | "ghost" | "button";
  size?: "sm" | "md" | "lg";
  underline?: boolean;
  external?: boolean;
}

// Create the Link component
const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    { className, variant, size, underline, external, href, children, ...props },
    ref
  ) => {
    // If the link is external, use a regular anchor tag
    if (external) {
      return (
        <a
          className={linkVariants({ variant, size, underline, className })}
          href={href}
          ref={ref}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    }

    // Otherwise, use Next.js Link for client-side navigation
    return (
      <NextLink href={href} passHref legacyBehavior>
        <a
          className={linkVariants({ variant, size, underline, className })}
          ref={ref}
          {...props}
        >
          {children}
        </a>
      </NextLink>
    );
  }
);

Link.displayName = "Link";

export { Link, linkVariants };
