import React, { useState, useEffect } from "react";
import { ColumnMergeManager } from "../ColumnMergeManager";
import ColumnFilterModal from "../ColumnFilterModal";
import ColumnMergeModal from "../ColumnMergeModal";
import { ViewStateManager } from "../../lib/viewStateManager";
import { Button, Badge, Card } from "../ui";
import {
  syncColumnMergesToViewState,
  loadColumnMergesFromViewState,
} from "../ColumnMergeManagerViewState";
import { FaColumns, FaFilter, FaInfoCircle } from "react-icons/fa";

interface UploadPreviewPaneProps {
  data: Record<string, unknown>[];
  onClear: () => void;
  viewStateManager?: ViewStateManager;
  projectId?: string; // Add projectId prop
}

const UploadPreviewPane: React.FC<UploadPreviewPaneProps> = ({
  data,
  onClear,
  viewStateManager,
  projectId,
}) => {
  const [showColumnFilterModal, setShowColumnFilterModal] = useState(false);
  const [showColumnMergeModal, setShowColumnMergeModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [allColumns, setAllColumns] = useState<string[]>([]);

  useEffect(() => {
    const cols = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((k) => cols.add(k));
    });
    const arr = Array.from(cols);
    setAllColumns(arr);
    if (visibleColumns.length === 0) {
      setVisibleColumns(arr);
    }
  }, [data]);

  const handleApplyColumnFilters = (columns: string[]) => {
    setVisibleColumns(columns);
    if (viewStateManager) {
      const hidden = allColumns.filter((c) => !columns.includes(c));
      viewStateManager.setHiddenColumns(hidden);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="py-3 px-4 bg-ui-primary border-b border-ui-border sticky top-0 z-10 w-full shadow-sm mb-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-accent-primary">
              Upload Preview
            </h3>
            <Badge variant="info" size="sm" className="ml-3">
              {data.length} rows
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowColumnMergeModal(true)}
              variant="secondary"
              size="sm"
              className="flex items-center"
            >
              <FaColumns className="mr-1" /> Merge Columns
            </Button>
            <Button
              onClick={() => setShowColumnFilterModal(true)}
              variant="secondary"
              size="sm"
              className="flex items-center"
            >
              <FaFilter className="mr-1" /> Columns
            </Button>
            <Button
              onClick={onClear}
              variant="secondary"
              size="sm"
              className="flex items-center"
            >
              <FaInfoCircle className="mr-1" /> Close Preview
            </Button>
          </div>
        </div>
        <p className="text-xs text-accent-primary mt-2">
          Ingestion is in progress. Queries and CSV export will not include this
          data until complete.
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <Card variant="default" padding="none" className="h-full">
          <ColumnMergeManager
            fileId="upload-preview"
            data={data}
            visibleColumns={visibleColumns}
            initialColumnMerges={
              viewStateManager
                ? loadColumnMergesFromViewState(viewStateManager)
                : []
            }
            onColumnMergesChange={(merges) => {
              if (viewStateManager) {
                syncColumnMergesToViewState(viewStateManager, merges);
              }
            }}
            viewStateManager={viewStateManager}
          />
        </Card>
      </div>
      <ColumnFilterModal
        isOpen={showColumnFilterModal}
        onClose={() => setShowColumnFilterModal(false)}
        columns={allColumns}
        initialVisibleColumns={visibleColumns}
        onApplyFilters={handleApplyColumnFilters}
        viewStateManager={viewStateManager}
        fileId="upload-preview"
        projectId={projectId}
      />
      <ColumnMergeModal
        isOpen={showColumnMergeModal}
        onClose={() => setShowColumnMergeModal(false)}
        fileId="upload-preview"
        columns={allColumns}
        initialColumnMerges={[]}
        data={data}
        projectId={projectId}
        onColumnMergesChange={(merges) => {
          if (viewStateManager) {
            syncColumnMergesToViewState(viewStateManager, merges);
          }
        }}
        viewStateManager={viewStateManager}
      />
    </div>
  );
};

export default UploadPreviewPane;
