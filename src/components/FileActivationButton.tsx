import React from "react";
import { FaCheckCircle } from "react-icons/fa";

/**
 * FileActivationButton (compatibility component)
 *
 * This component is maintained for backward compatibility with existing code.
 * In the simplified upload flow, files are automatically activated after upload,
 * so this component always shows files as active.
 */

interface FileActivationButtonProps {
  fileId: string;
  initialStatus: string;
  onActivated?: () => void;
}

const FileActivationButton: React.FC<FileActivationButtonProps> = ({
  fileId,
  initialStatus,
  onActivated,
}) => {
  // In the simplified flow, files are always active
  // Call the onActivated callback if provided (for compatibility)
  React.useEffect(() => {
    if (onActivated) {
      onActivated();
    }
  }, [onActivated]);

  return (
    <div>
      <button
        className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-md cursor-default flex items-center"
        disabled
      >
        <FaCheckCircle className="mr-2" />
        <span>Active</span>
      </button>
    </div>
  );
};

export default FileActivationButton;
