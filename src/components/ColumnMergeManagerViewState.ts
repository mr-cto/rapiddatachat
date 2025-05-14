import { ViewStateManager } from "../lib/viewStateManager";

/**
 * Helper functions to integrate ColumnMergeManager with ViewStateManager
 */

/**
 * Sync column merges with the view state manager
 * @param viewStateManager ViewStateManager instance
 * @param columnMerges Column merges to sync
 */
export function syncColumnMergesToViewState(
  viewStateManager: ViewStateManager,
  columnMerges: Array<{
    id: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }>
): void {
  if (!viewStateManager) return;

  // Add each column merge to the view state
  columnMerges.forEach((merge) => {
    viewStateManager.addColumnMerge(
      merge.id,
      merge.mergeName,
      merge.columnList,
      merge.delimiter
    );
  });
}

/**
 * Load column merges from the view state manager
 * @param viewStateManager ViewStateManager instance
 * @returns Column merges from the view state
 */
export function loadColumnMergesFromViewState(
  viewStateManager: ViewStateManager
): Array<{
  id: string;
  mergeName: string;
  columnList: string[];
  delimiter: string;
}> {
  if (!viewStateManager) return [];

  const viewState = viewStateManager.getViewState();

  // Convert view state column merges to the format expected by ColumnMergeManager
  return viewState.columnMerges.map((cm) => ({
    id: cm.id,
    mergeName: cm.name,
    columnList: cm.columns,
    delimiter: cm.delimiter,
  }));
}

/**
 * Update the ColumnMergeManager with view state data
 * @param viewStateManager ViewStateManager instance
 * @param setColumnMerges Function to update column merges state
 * @param onColumnMergesChange Optional callback for column merges change
 */
export function updateColumnMergesFromViewState(
  viewStateManager: ViewStateManager,
  setColumnMerges: (
    merges: Array<{
      id: string;
      mergeName: string;
      columnList: string[];
      delimiter: string;
    }>
  ) => void,
  onColumnMergesChange?: (
    merges: Array<{
      id: string;
      mergeName: string;
      columnList: string[];
      delimiter: string;
    }>
  ) => void
): void {
  if (!viewStateManager) return;

  const columnMerges = loadColumnMergesFromViewState(viewStateManager);

  // Update state
  setColumnMerges(columnMerges);

  // Notify parent if callback provided
  if (onColumnMergesChange) {
    onColumnMergesChange(columnMerges);
  }
}

/**
 * Add a column merge to the view state manager
 * @param viewStateManager ViewStateManager instance
 * @param merge Column merge to add
 */
export function addColumnMergeToViewState(
  viewStateManager: ViewStateManager,
  merge: {
    id: string;
    mergeName: string;
    columnList: string[];
    delimiter: string;
  }
): void {
  if (!viewStateManager) return;

  viewStateManager.addColumnMerge(
    merge.id,
    merge.mergeName,
    merge.columnList,
    merge.delimiter
  );
}

/**
 * Remove a column merge from the view state manager
 * @param viewStateManager ViewStateManager instance
 * @param mergeId ID of the column merge to remove
 */
export function removeColumnMergeFromViewState(
  viewStateManager: ViewStateManager,
  mergeId: string
): void {
  if (!viewStateManager) return;

  viewStateManager.removeColumnMerge(mergeId);
}
