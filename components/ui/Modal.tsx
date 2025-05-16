import React, { useEffect, useRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

// Define modal variants using class-variance-authority
const modalVariants = cva(
  // Base styles applied to all modals
  "rounded-lg shadow-xl relative animate-scaleIn",
  {
    variants: {
      variant: {
        default: "bg-ui-primary border border-ui-border",
        destructive: "bg-ui-primary border border-red-500",
        success: "bg-ui-primary border border-green-500",
        warning: "bg-ui-primary border border-yellow-500",
        info: "bg-ui-primary border border-blue-500",
      },
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        "3xl": "max-w-3xl",
        "4xl": "max-w-4xl",
        "5xl": "max-w-5xl",
        full: "max-w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// Define the props for our Modal component
export interface ModalProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof modalVariants> {
  isOpen: boolean;
  onClose: () => void;
  closeOnClickOutside?: boolean;
  closeOnEsc?: boolean;
}

// Create the Modal component
const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      className,
      variant,
      size,
      isOpen,
      onClose,
      closeOnClickOutside = true,
      closeOnEsc = true,
      children,
      ...props
    },
    ref
  ) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Close modal when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          closeOnClickOutside &&
          modalRef.current &&
          !modalRef.current.contains(event.target as Node)
        ) {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        // Prevent scrolling when modal is open
        document.body.style.overflow = "hidden";
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.body.style.overflow = "auto";
      };
    }, [isOpen, onClose, closeOnClickOutside]);

    // Close modal when pressing Escape key
    useEffect(() => {
      const handleEscKey = (event: KeyboardEvent) => {
        if (closeOnEsc && event.key === "Escape") {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener("keydown", handleEscKey);
      }

      return () => {
        document.removeEventListener("keydown", handleEscKey);
      };
    }, [isOpen, onClose, closeOnEsc]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm animate-fadeIn">
        <div
          ref={modalRef}
          className={modalVariants({ variant, size, className })}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
);

// Define the props for our ModalHeader component
export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  showCloseButton?: boolean;
  onClose?: () => void;
}

// Create the ModalHeader component
const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, showCloseButton = true, onClose, children, ...props }, ref) => {
    return (
      <div
        className={`flex justify-between items-center p-4 border-b border-ui-border ${
          className || ""
        }`}
        ref={ref}
        {...props}
      >
        <div className="flex-1">{children}</div>
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

// Define the props for our ModalContent component
export interface ModalContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

// Create the ModalContent component
const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className={`p-4 ${className || ""}`} ref={ref} {...props}>
        {children}
      </div>
    );
  }
);

// Define the props for our ModalFooter component
export interface ModalFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

// Create the ModalFooter component
const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        className={`flex justify-end space-x-2 p-4 border-t border-ui-border ${
          className || ""
        }`}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// Define the props for our ModalTitle component
export interface ModalTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

// Create the ModalTitle component
const ModalTitle = React.forwardRef<HTMLHeadingElement, ModalTitleProps>(
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

// Define the props for our ModalDescription component
export interface ModalDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

// Create the ModalDescription component
const ModalDescription = React.forwardRef<
  HTMLParagraphElement,
  ModalDescriptionProps
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

Modal.displayName = "Modal";
ModalHeader.displayName = "ModalHeader";
ModalContent.displayName = "ModalContent";
ModalFooter.displayName = "ModalFooter";
ModalTitle.displayName = "ModalTitle";
ModalDescription.displayName = "ModalDescription";

export {
  Modal,
  ModalHeader,
  ModalContent,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  modalVariants,
};
