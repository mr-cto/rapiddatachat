/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Get status badge color based on file status
 */
export const getStatusBadgeColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "processing":
      return "bg-blue-100 text-blue-800";
    case "headers_extracted":
      return "bg-purple-100 text-purple-800";
    case "error":
      return "bg-red-100 text-red-800";
    case "timeout":
      return "bg-orange-100 text-orange-800";
    case "too_large":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

/**
 * Validate files for upload
 */
export const validateFiles = (
  files: FileList,
  maxFileSize: number,
  allowedFileTypes: string[]
): { valid: File[]; errors: string[] } => {
  const validFiles: File[] = [];
  const errors: string[] = [];

  Array.from(files).forEach((file) => {
    // Check file size
    if (file.size > maxFileSize) {
      errors.push(
        `${file.name}: File size exceeds the limit of ${Math.round(
          maxFileSize / (1024 * 1024)
        )}MB`
      );
      return;
    }

    // Check file type
    if (!allowedFileTypes.includes(file.type)) {
      errors.push(
        `${file.name}: File type not supported. Please upload CSV or XLSX files only.`
      );
      return;
    }

    validFiles.push(file);
  });

  return { valid: validFiles, errors };
};

// Constants
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
export const ALLOWED_FILE_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
