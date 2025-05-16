import React from "react";
import { Link } from "./Link";

// Define the props for our BreadcrumbItem component
export interface BreadcrumbItemProps {
  href?: string;
  label: string;
  isCurrent?: boolean;
}

// Define the props for our Breadcrumb component
export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItemProps[];
  separator?: React.ReactNode;
}

// Create the Breadcrumb component
const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ className, items, separator = "/", ...props }, ref) => {
    return (
      <nav
        className={`flex ${className || ""}`}
        aria-label="Breadcrumb"
        ref={ref}
        {...props}
      >
        <ol className="flex items-center space-x-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <span className="mx-2 text-gray-400 text-sm">{separator}</span>
              )}
              {item.isCurrent ? (
                <span
                  className="text-gray-300 text-sm font-medium"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  variant="default"
                  size="sm"
                  className="hover:text-accent-primary-hover"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-400 text-sm">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  }
);

// Define the props for our BreadcrumbSeparator component
export interface BreadcrumbSeparatorProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

// Create the BreadcrumbSeparator component
const BreadcrumbSeparator = React.forwardRef<
  HTMLSpanElement,
  BreadcrumbSeparatorProps
>(({ className, children, ...props }, ref) => {
  return (
    <span
      className={`mx-2 text-gray-400 text-sm ${className || ""}`}
      ref={ref}
      {...props}
    >
      {children || "/"}
    </span>
  );
});

Breadcrumb.displayName = "Breadcrumb";
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

export { Breadcrumb, BreadcrumbSeparator };
