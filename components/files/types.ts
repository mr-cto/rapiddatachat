import { ReactNode } from "react";

export interface FileData {
  id: string;
  filename: string;
  uploadedAt: string;
  ingestedAt: string | null;
  sizeBytes: number;
  format: string | null;
  status: string;
  metadata: {
    ingestion_progress?:
      | string
      | {
          processed: number;
          total: number | null;
          percentage: number | null;
          rowsPerSecond: number;
          elapsedSeconds: number;
          eta: number | null;
          lastUpdated: string;
        };
    columns?: string[];
    [key: string]: unknown;
  } | null;
  _count: {
    fileErrors: number;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Sorting {
  column: string;
  direction: "asc" | "desc";
}

export interface FilesPaneProps {
  onSelectFile: (fileId: string) => void;
  selectedFileId?: string;
  projectId?: string;
  onPreviewParsed?: (preview: Record<string, unknown>[]) => void;
  onFileCountChange?: (count: number) => void;
}

export interface FileItemProps {
  file: FileData;
  onSelectFile: (fileId: string) => void;
  viewSynopsis: (fileId: string) => void;
  handleDeleteClick: (fileId: string) => void;
  deleteConfirmation: string | null;
  handleDeleteFile: (fileId: string) => void;
  cancelDelete: () => void;
  formatFileSize: (bytes: number) => string;
  getStatusBadgeColor: (status: string) => string;
  retryFileIngestion: (fileId: string) => void;
  retryingFiles: Record<string, boolean>;
  retryErrors: Record<string, string>;
  onViewFileDetails: (fileId: string) => void;
}

export interface FileUploadComponentProps {
  dragActive: boolean;
  uploading: boolean;
  uploadStatus: string;
  uploadProgress: number;
  isFirstUpload: boolean;
  hasActiveSchema: boolean;
  MAX_FILE_SIZE: number;
  handleDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface FileDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
  // These props are now optional since they can come from the context
  formatFileSize?: (bytes: number) => string;
  getStatusBadgeColor?: (status: string) => string;
  retryFileIngestion?: (fileId: string) => void;
  retryingFiles?: Record<string, boolean>;
}
