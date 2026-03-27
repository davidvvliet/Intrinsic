import { create } from 'zustand';
import type { CellData, CellFormat, CellFormatData, CellType, Selection, CopiedRange, ComputedData } from '../components/Spreadsheet/types';
import type { ChartConfig } from '../components/Spreadsheet/chartDataResolver';
import { getCellKey } from '../components/Spreadsheet/drawUtils';
import { recalculateAll, recalculateDirty, getDisplayValue as computeDisplayValue } from '../components/Spreadsheet/formulaComputation';

const EMPTY_COMPUTED: ComputedData = new Map();

type SheetMetadata = {
  sheetId: string;
  name: string;
  createdAt: string;
  isSaved: boolean;
};

type DeltaEntry<T> = { old: T | null; new: T | null };

type Action = {
  dataDelta: Map<string, DeltaEntry<{ raw: string; type: CellType }>>;
  formatDelta: Map<string, DeltaEntry<CellFormat>>;
  timestamp: number;
};

interface SpreadsheetState {
  // Cell data
  cellData: CellData;
  cellFormat: CellFormatData;
  dirtySheets: Set<string>;

  // UI state
  selection: Selection | null;
  highlightedCells: Selection[] | null;
  inputValue: string;
  isEditing: boolean;
  copiedRange: CopiedRange;
  animatingRanges: CopiedRange[];

  // Sheet management
  workspaceId: string | null;
  workspaceName: string | null;
  activeSheetId: string | null;
  sheets: SheetMetadata[];

  // Cross-sheet data (for cross-sheet formula references)
  allSheetsData: Map<string, CellData>;
  allSheetsFormat: Map<string, CellFormatData>;
  allSheetsComputed: Map<string, ComputedData>;

  // Column widths
  columnWidths: Map<number, number>;
  columnWidthsBySheet: Map<string, Map<number, number>>;

  // Scroll position (per-sheet)
  scrollPositionBySheet: Map<string, { left: number; top: number }>;

  // Freeze panes (per-sheet)
  frozenRows: number;
  frozenColumns: number;
  frozenRowsBySheet: Map<string, number>;
  frozenColumnsBySheet: Map<string, number>;

  // Find
  findOpen: boolean;
  findQuery: string;
  findMatches: { row: number; col: number }[];
  findMatchIndex: number;

  // View options
  showGridlines: boolean;

  // Charts
  chartsBySheet: Map<string, ChartConfig[]>;
  editingChartId: string | null;

  // Undo/Redo
  undoStack: Action[];
  redoStack: Action[];
  canUndo: boolean;
  canRedo: boolean;

  // Computed
  hasUnsavedChanges: boolean;
}

interface SpreadsheetActions {
  // Setters
  setCellData: (data: CellData | ((prev: CellData) => CellData)) => void;
  setCellFormat: (format: CellFormatData | ((prev: CellFormatData) => CellFormatData)) => void;
  setSelection: (selection: Selection | null | ((prev: Selection | null) => Selection | null)) => void;
  setHighlightedCells: (cells: Selection[] | null | ((prev: Selection[] | null) => Selection[] | null)) => void;
  setInputValue: (value: string | ((prev: string) => string)) => void;
  setIsEditing: (editing: boolean | ((prev: boolean) => boolean)) => void;
  setCopiedRange: (range: CopiedRange | ((prev: CopiedRange) => CopiedRange)) => void;
  setAnimatingRanges: (ranges: CopiedRange[] | ((prev: CopiedRange[]) => CopiedRange[])) => void;
  setWorkspaceId: (id: string | null) => void;
  setWorkspaceName: (name: string | null) => void;
  setActiveSheetId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setSheets: (sheets: SheetMetadata[] | ((prev: SheetMetadata[]) => SheetMetadata[])) => void;
  setSheetCellData: (sheetId: string, data: CellData) => void;
  setSheetCellFormat: (sheetId: string, format: CellFormatData) => void;
  setColumnWidthsBySheet: (widths: Map<string, Map<number, number>> | ((prev: Map<string, Map<number, number>>) => Map<string, Map<number, number>>)) => void;
  setFrozenRows: (rows: number) => void;
  setFrozenColumns: (cols: number) => void;
  setScrollPosition: (sheetId: string, left: number, top: number) => void;
  setFrozenRowsBySheet: (rows: Map<string, number> | ((prev: Map<string, number>) => Map<string, number>)) => void;
  setFrozenColumnsBySheet: (cols: Map<string, number> | ((prev: Map<string, number>) => Map<string, number>)) => void;
  setFindOpen: (open: boolean) => void;
  setFindQuery: (query: string) => void;
  setFindMatches: (matches: { row: number; col: number }[]) => void;
  setFindMatchIndex: (index: number) => void;
  toggleGridlines: () => void;

  // Charts
  addChart: (chart: ChartConfig) => void;
  removeChart: (sheetId: string, chartId: string) => void;
  updateChart: (sheetId: string, chartId: string, updates: Partial<ChartConfig>) => void;
  setEditingChartId: (id: string | null) => void;
  setChartsBySheet: (charts: Map<string, ChartConfig[]> | ((prev: Map<string, ChartConfig[]>) => Map<string, ChartConfig[]>)) => void;

  // Actions
  updateCell: (key: string, value: { raw: string; type: CellType } | null, batchWithPrevious?: boolean) => void;
  updateCellFormat: (key: string, format: CellFormat | null, batchWithPrevious?: boolean) => void;
  updateCells: (newCellData: Map<string, { raw: string; type: CellType }>, batchWithPrevious?: boolean) => void;
  updateCellFormats: (newCellFormat: Map<string, CellFormat>, batchWithPrevious?: boolean) => void;
  markSheetDirty: (sheetId: string) => void;
  updateColumnWidths: (sheetId: string, col: number, width: number) => void;
  updateFrozenRows: (sheetId: string, rows: number) => void;
  updateFrozenColumns: (sheetId: string, cols: number) => void;
  markSaved: (sheetIds?: string[]) => void;
  undo: () => void;
  redo: () => void;

  // Formula engine
  recalculateFormulas: () => void;
  getDisplayValue: (key: string) => string;
}

type SpreadsheetStore = SpreadsheetState & SpreadsheetActions;

const BATCH_WINDOW_MS = 500;

// Helper to add activeSheetId to dirtySheets
const addDirtySheet = (state: SpreadsheetState): { dirtySheets: Set<string>; hasUnsavedChanges: boolean } => {
  if (!state.activeSheetId) return { dirtySheets: state.dirtySheets, hasUnsavedChanges: state.hasUnsavedChanges };
  const next = new Set(state.dirtySheets);
  next.add(state.activeSheetId);
  return { dirtySheets: next, hasUnsavedChanges: true };
};

export const useSpreadsheetStore = create<SpreadsheetStore>((set, get) => {
  // Internal helper for pushing actions to undo stack
  const pushAction = (action: Action, batchWithPrevious: boolean = false) => {
    set(state => {
      const now = Date.now();
      let newUndoStack = [...state.undoStack];

      if (batchWithPrevious && newUndoStack.length > 0) {
        const lastAction = newUndoStack[newUndoStack.length - 1];
        if (now - lastAction.timestamp < BATCH_WINDOW_MS) {
          const merged: Action = {
            dataDelta: new Map([...lastAction.dataDelta, ...action.dataDelta]),
            formatDelta: new Map([...lastAction.formatDelta, ...action.formatDelta]),
            timestamp: lastAction.timestamp,
          };
          newUndoStack = [...newUndoStack.slice(0, -1), merged];
        } else {
          newUndoStack = [...newUndoStack, action];
        }
      } else {
        newUndoStack = [...newUndoStack, action];
      }

      return {
        undoStack: newUndoStack,
        redoStack: [],
        canUndo: newUndoStack.length > 0,
        canRedo: false,
      };
    });
  };

  return {
    // Initial state
    cellData: new Map(),
    cellFormat: new Map(),
    dirtySheets: new Set(),
    selection: null,
    highlightedCells: null,
    inputValue: '',
    isEditing: false,
    copiedRange: null,
    animatingRanges: [],
    workspaceId: null,
    workspaceName: null,
    activeSheetId: null,
    sheets: [],
    allSheetsData: new Map(),
    allSheetsFormat: new Map(),
    allSheetsComputed: new Map(),
    columnWidths: new Map(),
    columnWidthsBySheet: new Map(),
    frozenRows: 0,
    frozenColumns: 0,
    scrollPositionBySheet: new Map(),
    frozenRowsBySheet: new Map(),
    frozenColumnsBySheet: new Map(),
    findOpen: false,
    findQuery: '',
    findMatches: [],
    findMatchIndex: -1,
    showGridlines: true,
    chartsBySheet: new Map(),
    editingChartId: null,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    hasUnsavedChanges: false,

    // Setters
    setCellData: (data) => set(state => {
      const newData = typeof data === 'function' ? data(state.cellData) : data;
      return { cellData: newData };
    }),

    setCellFormat: (format) => set(state => {
      const newFormat = typeof format === 'function' ? format(state.cellFormat) : format;
      return { cellFormat: newFormat };
    }),

    setSelection: (selection) => set(state => {
      const newSelection = typeof selection === 'function' ? selection(state.selection) : selection;
      return { selection: newSelection };
    }),

    setHighlightedCells: (cells) => set(state => {
      const newCells = typeof cells === 'function' ? cells(state.highlightedCells) : cells;
      return { highlightedCells: newCells };
    }),

    setInputValue: (value) => set(state => {
      const newValue = typeof value === 'function' ? value(state.inputValue) : value;
      return { inputValue: newValue };
    }),

    setIsEditing: (editing) => set(state => {
      const newEditing = typeof editing === 'function' ? editing(state.isEditing) : editing;
      return { isEditing: newEditing };
    }),

    setCopiedRange: (range) => set(state => {
      const newRange = typeof range === 'function' ? range(state.copiedRange) : range;
      return { copiedRange: newRange };
    }),

    setAnimatingRanges: (ranges) => set(state => {
      const newRanges = typeof ranges === 'function' ? ranges(state.animatingRanges) : ranges;
      return { animatingRanges: newRanges };
    }),

    setWorkspaceName: (name) => set({ workspaceName: name }),

    setWorkspaceId: (id) => set(state => {
      if (state.workspaceId !== id) {
        return {
          workspaceId: id,
          workspaceName: null,
          cellData: new Map(),
          cellFormat: new Map(),
          dirtySheets: new Set(),
          allSheetsData: new Map(),
          allSheetsFormat: new Map(),
          allSheetsComputed: new Map(),
          sheets: [],
          activeSheetId: null,
          selection: null,
          highlightedCells: null,
          inputValue: '',
          isEditing: false,
          findOpen: false,
          findQuery: '',
          findMatches: [],
          findMatchIndex: -1,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          hasUnsavedChanges: false,
        };
      }
      return { workspaceId: id };
    }),

    setActiveSheetId: (id) => set(state => {
      const newId = typeof id === 'function' ? id(state.activeSheetId) : id;
      // Update columnWidths and frozen panes when activeSheetId changes
      const columnWidths = state.columnWidthsBySheet.get(newId || '') || new Map();
      const frozenRows = state.frozenRowsBySheet.get(newId || '') || 0;
      const frozenColumns = state.frozenColumnsBySheet.get(newId || '') || 0;
      return { activeSheetId: newId, columnWidths, frozenRows, frozenColumns };
    }),

    setSheets: (sheets) => set(state => {
      const newSheets = typeof sheets === 'function' ? sheets(state.sheets) : sheets;
      return { sheets: newSheets };
    }),

    setSheetCellData: (sheetId, data) => set(state => {
      const next = new Map(state.allSheetsData);
      next.set(sheetId, data);
      return { allSheetsData: next };
    }),

    markSheetDirty: (sheetId) => set(state => {
      const next = new Set(state.dirtySheets);
      next.add(sheetId);
      return { dirtySheets: next, hasUnsavedChanges: true };
    }),

    setSheetCellFormat: (sheetId, format) => set(state => {
      const next = new Map(state.allSheetsFormat);
      next.set(sheetId, format);
      return { allSheetsFormat: next };
    }),

    setColumnWidthsBySheet: (widths) => set(state => {
      const newWidths = typeof widths === 'function' ? widths(state.columnWidthsBySheet) : widths;
      const columnWidths = newWidths.get(state.activeSheetId || '') || new Map();
      return { columnWidthsBySheet: newWidths, columnWidths };
    }),

    setScrollPosition: (sheetId, left, top) => set(state => {
      const next = new Map(state.scrollPositionBySheet);
      next.set(sheetId, { left, top });
      return { scrollPositionBySheet: next };
    }),

    setFrozenRows: (rows) => set(state => {
      const newMap = new Map(state.frozenRowsBySheet);
      if (state.activeSheetId) {
        newMap.set(state.activeSheetId, rows);
      }
      return { frozenRows: rows, frozenRowsBySheet: newMap };
    }),

    setFrozenColumns: (cols) => set(state => {
      const newMap = new Map(state.frozenColumnsBySheet);
      if (state.activeSheetId) {
        newMap.set(state.activeSheetId, cols);
      }
      return { frozenColumns: cols, frozenColumnsBySheet: newMap };
    }),

    setFrozenRowsBySheet: (rows) => set(state => {
      const newRows = typeof rows === 'function' ? rows(state.frozenRowsBySheet) : rows;
      const frozenRows = newRows.get(state.activeSheetId || '') || 0;
      return { frozenRowsBySheet: newRows, frozenRows };
    }),

    setFrozenColumnsBySheet: (cols) => set(state => {
      const newCols = typeof cols === 'function' ? cols(state.frozenColumnsBySheet) : cols;
      const frozenColumns = newCols.get(state.activeSheetId || '') || 0;
      return { frozenColumnsBySheet: newCols, frozenColumns };
    }),

    setFindOpen: (open) => set({ findOpen: open }),
    setFindQuery: (query) => set({ findQuery: query }),
    setFindMatches: (matches) => set({ findMatches: matches }),
    setFindMatchIndex: (index) => set({ findMatchIndex: index }),
    toggleGridlines: () => set(state => ({ showGridlines: !state.showGridlines })),

    // Charts
    addChart: (chart) => set(state => {
      const next = new Map(state.chartsBySheet);
      const existing = next.get(chart.sheetId) || [];
      next.set(chart.sheetId, [...existing, chart]);
      return { chartsBySheet: next, ...addDirtySheet(state) };
    }),
    removeChart: (sheetId, chartId) => set(state => {
      const next = new Map(state.chartsBySheet);
      const existing = next.get(sheetId) || [];
      next.set(sheetId, existing.filter(c => c.id !== chartId));
      return { chartsBySheet: next, ...addDirtySheet(state) };
    }),
    updateChart: (sheetId, chartId, updates) => set(state => {
      const next = new Map(state.chartsBySheet);
      const existing = next.get(sheetId) || [];
      next.set(sheetId, existing.map(c => c.id === chartId ? { ...c, ...updates } : c));
      return { chartsBySheet: next, ...addDirtySheet(state) };
    }),
    setEditingChartId: (id) => set({ editingChartId: id }),
    setChartsBySheet: (charts) => set(state => ({
      chartsBySheet: typeof charts === 'function' ? charts(state.chartsBySheet) : charts,
    })),

    // Actions
    updateCell: (key, value, batchWithPrevious = false) => {
      const state = get();
      const oldValue = state.cellData.get(key) || null;

      const action: Action = {
        dataDelta: new Map([[key, { old: oldValue, new: value }]]),
        formatDelta: new Map(),
        timestamp: Date.now(),
      };

      pushAction(action, batchWithPrevious);

      set(state => {
        const next = new Map(state.cellData);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }

        // Mirror into allSheetsData for cross-sheet formula references
        let allSheetsData = state.allSheetsData;
        if (state.activeSheetId) {
          allSheetsData = new Map(state.allSheetsData);
          allSheetsData.set(state.activeSheetId, next);
        }

        // Recalculate affected formulas
        const sheetsInfo = state.sheets.map(s => ({ sheetId: s.sheetId, name: s.name }));
        const allSheetsComputed = recalculateDirty(
          [key], allSheetsData, sheetsInfo, state.activeSheetId!,
          state.allSheetsComputed,
        );

        return {
          cellData: next,
          allSheetsData,
          allSheetsComputed,
          ...addDirtySheet(state),
        };
      });
    },

    updateCellFormat: (key, format, batchWithPrevious = false) => {
      const state = get();
      const oldFormat = state.cellFormat.get(key) || null;

      const action: Action = {
        dataDelta: new Map(),
        formatDelta: new Map([[key, { old: oldFormat, new: format }]]),
        timestamp: Date.now(),
      };

      pushAction(action, batchWithPrevious);

      set(state => {
        const next = new Map(state.cellFormat);
        if (format) {
          next.set(key, format);
        } else {
          next.delete(key);
        }

        // Mirror into allSheetsFormat
        let allSheetsFormat = state.allSheetsFormat;
        if (state.activeSheetId) {
          allSheetsFormat = new Map(state.allSheetsFormat);
          allSheetsFormat.set(state.activeSheetId, next);
        }

        return {
          cellFormat: next,
          allSheetsFormat,
          ...addDirtySheet(state),
        };
      });
    },

    updateCells: (newCellData, batchWithPrevious = false) => {
      const state = get();
      const dataDelta = new Map<string, DeltaEntry<{ raw: string; type: CellType }>>();
      const allKeys = new Set([...state.cellData.keys(), ...newCellData.keys()]);

      allKeys.forEach(key => {
        const oldValue = state.cellData.get(key) || null;
        const newValue = newCellData.get(key) || null;
        const oldRaw = oldValue?.raw || '';
        const newRaw = newValue?.raw || '';
        if (oldRaw !== newRaw) {
          dataDelta.set(key, { old: oldValue, new: newValue });
        }
      });

      if (dataDelta.size > 0) {
        const action: Action = {
          dataDelta,
          formatDelta: new Map(),
          timestamp: Date.now(),
        };
        pushAction(action, batchWithPrevious);
      }

      set(state => {
        // Mirror into allSheetsData for cross-sheet formula references
        let allSheetsData = state.allSheetsData;
        if (state.activeSheetId) {
          allSheetsData = new Map(state.allSheetsData);
          allSheetsData.set(state.activeSheetId, newCellData);
        }

        // Recalculate all formulas (bulk operation)
        const sheetsInfo = state.sheets.map(s => ({ sheetId: s.sheetId, name: s.name }));
        const allSheetsComputed = recalculateAll(allSheetsData, sheetsInfo);

        return {
          cellData: newCellData,
          allSheetsData,
          allSheetsComputed,
          ...addDirtySheet(state),
        };
      });
    },

    updateCellFormats: (newCellFormat, batchWithPrevious = false) => {
      const state = get();
      const formatDelta = new Map<string, DeltaEntry<CellFormat>>();
      const allKeys = new Set([...state.cellFormat.keys(), ...newCellFormat.keys()]);

      allKeys.forEach(key => {
        const oldFormat = state.cellFormat.get(key) || null;
        const newFormat = newCellFormat.get(key) || null;
        const oldStr = oldFormat ? JSON.stringify(oldFormat) : '';
        const newStr = newFormat ? JSON.stringify(newFormat) : '';
        if (oldStr !== newStr) {
          formatDelta.set(key, { old: oldFormat, new: newFormat });
        }
      });

      if (formatDelta.size > 0) {
        const action: Action = {
          dataDelta: new Map(),
          formatDelta,
          timestamp: Date.now(),
        };
        pushAction(action, batchWithPrevious);
      }

      set(state => {
        // Mirror into allSheetsFormat
        let allSheetsFormat = state.allSheetsFormat;
        if (state.activeSheetId) {
          allSheetsFormat = new Map(state.allSheetsFormat);
          allSheetsFormat.set(state.activeSheetId, newCellFormat);
        }

        return {
          cellFormat: newCellFormat,
          allSheetsFormat,
          ...addDirtySheet(state),
        };
      });
    },

    updateColumnWidths: (sheetId, col, width) => {
      set(state => {
        const newWidths = new Map(state.columnWidthsBySheet);
        const sheetWidths = new Map(newWidths.get(sheetId) || new Map());
        sheetWidths.set(col, width);
        newWidths.set(sheetId, sheetWidths);
        const columnWidths = newWidths.get(state.activeSheetId || '') || new Map();
        const nextDirty = new Set(state.dirtySheets);
        nextDirty.add(sheetId);
        return {
          columnWidthsBySheet: newWidths,
          columnWidths,
          dirtySheets: nextDirty,
          hasUnsavedChanges: true,
        };
      });
    },

    updateFrozenRows: (sheetId, rows) => {
      set(state => {
        const newMap = new Map(state.frozenRowsBySheet);
        newMap.set(sheetId, rows);
        const frozenRows = newMap.get(state.activeSheetId || '') || 0;
        const nextDirty = new Set(state.dirtySheets);
        nextDirty.add(sheetId);
        return {
          frozenRowsBySheet: newMap,
          frozenRows,
          dirtySheets: nextDirty,
          hasUnsavedChanges: true,
        };
      });
    },

    updateFrozenColumns: (sheetId, cols) => {
      set(state => {
        const newMap = new Map(state.frozenColumnsBySheet);
        newMap.set(sheetId, cols);
        const frozenColumns = newMap.get(state.activeSheetId || '') || 0;
        const nextDirty = new Set(state.dirtySheets);
        nextDirty.add(sheetId);
        return {
          frozenColumnsBySheet: newMap,
          frozenColumns,
          dirtySheets: nextDirty,
          hasUnsavedChanges: true,
        };
      });
    },

    markSaved: (sheetIds?) => set(state => {
      if (sheetIds) {
        const next = new Set(state.dirtySheets);
        for (const id of sheetIds) {
          next.delete(id);
        }
        return {
          dirtySheets: next,
          hasUnsavedChanges: next.size > 0,
        };
      }
      return {
        dirtySheets: new Set(),
        hasUnsavedChanges: false,
      };
    }),

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) return;

      const action = state.undoStack[state.undoStack.length - 1];

      set(state => {
        const newCellData = new Map(state.cellData);
        action.dataDelta.forEach((delta, key) => {
          if (delta.old === null) {
            newCellData.delete(key);
          } else {
            newCellData.set(key, delta.old);
          }
        });

        const newCellFormat = new Map(state.cellFormat);
        action.formatDelta.forEach((delta, key) => {
          if (delta.old === null) {
            newCellFormat.delete(key);
          } else {
            newCellFormat.set(key, delta.old);
          }
        });

        // Update input value if selection matches
        let newInputValue = state.inputValue;
        if (state.selection) {
          const key = getCellKey(state.selection.start.row, state.selection.start.col);
          if (action.dataDelta.has(key)) {
            const oldValue = action.dataDelta.get(key)!.old;
            newInputValue = oldValue?.raw || '';
          }
        }

        const newUndoStack = state.undoStack.slice(0, -1);
        const newRedoStack = [...state.redoStack, action];

        // Recalculate formulas after undo
        let allSheetsData = state.allSheetsData;
        if (state.activeSheetId) {
          allSheetsData = new Map(state.allSheetsData);
          allSheetsData.set(state.activeSheetId, newCellData);
        }
        const sheetsInfo = state.sheets.map(s => ({ sheetId: s.sheetId, name: s.name }));
        const allSheetsComputed = recalculateAll(allSheetsData, sheetsInfo);

        return {
          cellData: newCellData,
          cellFormat: newCellFormat,
          allSheetsData,
          allSheetsComputed,
          ...addDirtySheet(state),
          inputValue: newInputValue,
          undoStack: newUndoStack,
          redoStack: newRedoStack,
          canUndo: newUndoStack.length > 0,
          canRedo: true,
        };
      });
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) return;

      const action = state.redoStack[state.redoStack.length - 1];

      set(state => {
        const newCellData = new Map(state.cellData);
        action.dataDelta.forEach((delta, key) => {
          if (delta.new === null) {
            newCellData.delete(key);
          } else {
            newCellData.set(key, delta.new);
          }
        });

        const newCellFormat = new Map(state.cellFormat);
        action.formatDelta.forEach((delta, key) => {
          if (delta.new === null) {
            newCellFormat.delete(key);
          } else {
            newCellFormat.set(key, delta.new);
          }
        });

        // Update input value if selection matches
        let newInputValue = state.inputValue;
        if (state.selection) {
          const key = getCellKey(state.selection.start.row, state.selection.start.col);
          if (action.dataDelta.has(key)) {
            const newValue = action.dataDelta.get(key)!.new;
            newInputValue = newValue?.raw || '';
          }
        }

        const newRedoStack = state.redoStack.slice(0, -1);
        const newUndoStack = [...state.undoStack, action];

        // Recalculate formulas after redo
        let allSheetsData = state.allSheetsData;
        if (state.activeSheetId) {
          allSheetsData = new Map(state.allSheetsData);
          allSheetsData.set(state.activeSheetId, newCellData);
        }
        const sheetsInfo = state.sheets.map(s => ({ sheetId: s.sheetId, name: s.name }));
        const allSheetsComputed = recalculateAll(allSheetsData, sheetsInfo);

        return {
          cellData: newCellData,
          cellFormat: newCellFormat,
          allSheetsData,
          allSheetsComputed,
          ...addDirtySheet(state),
          inputValue: newInputValue,
          undoStack: newUndoStack,
          redoStack: newRedoStack,
          canUndo: true,
          canRedo: newRedoStack.length > 0,
        };
      });
    },

    // Formula engine
    recalculateFormulas: () => {
      const state = get();
      const sheetsInfo = state.sheets.map(s => ({ sheetId: s.sheetId, name: s.name }));
      const allSheetsComputed = recalculateAll(state.allSheetsData, sheetsInfo);
      set({ allSheetsComputed });
    },

    getDisplayValue: (key) => {
      const state = get();
      const sheetComputed = state.allSheetsComputed.get(state.activeSheetId || '') || EMPTY_COMPUTED;
      return computeDisplayValue(key, state.cellData, sheetComputed);
    },
  };
});

// Selector helpers for common patterns
export const useActiveSheet = () => useSpreadsheetStore(state => {
  const sheet = state.sheets.find(s => s.sheetId === state.activeSheetId);
  return {
    sheetId: sheet?.sheetId || null,
    sheetName: sheet?.name || null,
  };
});
