import React from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "warning" | "danger" | "info";
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
}) => {
  if (!isOpen) return null;

  // Determine colors based on variant
  const getVariantClasses = () => {
    switch (variant) {
      case "danger":
        return {
          bg: "bg-red-900/20",
          border: "border-red-800",
          button: "bg-red-500 hover:bg-red-600",
        };
      case "info":
        return {
          bg: "bg-blue-900/20",
          border: "border-blue-800",
          button: "bg-blue-500 hover:bg-blue-600",
        };
      case "warning":
      default:
        return {
          bg: "bg-yellow-900/20",
          border: "border-yellow-800",
          button: "bg-yellow-500 hover:bg-yellow-600",
        };
    }
  };

  const variantClasses = getVariantClasses();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm animate-fadeIn">
      <div
        className={`rounded-lg shadow-xl relative animate-scaleIn max-w-md w-full ${variantClasses.bg} ${variantClasses.border} border`}
      >
        <div className="p-4 border-b border-ui-border">
          <h3 className="text-lg font-semibold text-gray-300">{title}</h3>
        </div>
        <div className="p-4">
          <p className="text-gray-300">{message}</p>
        </div>
        <div className="flex justify-end space-x-2 p-4 border-t border-ui-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ui-tertiary hover:bg-ui-tertiary/80 text-gray-300 rounded-md transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-white rounded-md transition-colors ${variantClasses.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
