import { create } from 'zustand';
import type { CellData, CellFormat, CellFormatData, CellType, Selection, CopiedRange, ComputedData } from '../components/Spreadsheet/types';
import { getCellKey } from '../components/Spreadsheet/drawUtils';

type SheetMetadata = {
  sheetId: string;
  fetchId: string | null;
  name: string;
  createdAt: string;
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
  computedData: ComputedData;
  baselineData: CellData;
  baselineFormat: CellFormatData;
  dirtyCells: Set<string>;
  dirtySettings: boolean;

  // UI state
  selection: Selection | null;
  highlightedCells: Selection[] | null;
  inputValue: string;
  isEditing: boolean;
  copiedRange: CopiedRange;
  animatingRanges: CopiedRange[];

  // Sheet management
  workspaceId: string | null;
  activeSheetId: string | null;
  sheets: SheetMetadata[];

  // Column widths
  columnWidths: Map<number, number>;
  columnWidthsBySheet: Map<string, Map<number, number>>;

  // Freeze panes (per-sheet)
  frozenRows: number;
  frozenColumns: number;
  frozenRowsBySheet: Map<string, number>;
  frozenColumnsBySheet: Map<string, number>;

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
  setComputedData: (data: ComputedData) => void;
  setBaselineData: (data: CellData) => void;
  setBaselineFormat: (format: CellFormatData) => void;
  setDirtyCells: (cells: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setDirtySettings: (dirty: boolean) => void;
  setSelection: (selection: Selection | null | ((prev: Selection | null) => Selection | null)) => void;
  setHighlightedCells: (cells: Selection[] | null | ((prev: Selection[] | null) => Selection[] | null)) => void;
  setInputValue: (value: string | ((prev: string) => string)) => void;
  setIsEditing: (editing: boolean | ((prev: boolean) => boolean)) => void;
  setCopiedRange: (range: CopiedRange | ((prev: CopiedRange) => CopiedRange)) => void;
  setAnimatingRanges: (ranges: CopiedRange[] | ((prev: CopiedRange[]) => CopiedRange[])) => void;
  setWorkspaceId: (id: string | null) => void;
  setActiveSheetId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setSheets: (sheets: SheetMetadata[] | ((prev: SheetMetadata[]) => SheetMetadata[])) => void;
  setColumnWidthsBySheet: (widths: Map<string, Map<number, number>> | ((prev: Map<string, Map<number, number>>) => Map<string, Map<number, number>>)) => void;
  setFrozenRows: (rows: number) => void;
  setFrozenColumns: (cols: number) => void;
  setFrozenRowsBySheet: (rows: Map<string, number> | ((prev: Map<string, number>) => Map<string, number>)) => void;
  setFrozenColumnsBySheet: (cols: Map<string, number> | ((prev: Map<string, number>) => Map<string, number>)) => void;

  // Actions
  updateCell: (key: string, value: { raw: string; type: CellType } | null, batchWithPrevious?: boolean) => void;
  updateCellFormat: (key: string, format: CellFormat | null, batchWithPrevious?: boolean) => void;
  updateCells: (newCellData: Map<string, { raw: string; type: CellType }>, batchWithPrevious?: boolean) => void;
  updateCellFormats: (newCellFormat: Map<string, CellFormat>, batchWithPrevious?: boolean) => void;
  updateColumnWidths: (sheetId: string, col: number, width: number) => void;
  updateFrozenRows: (sheetId: string, rows: number) => void;
  updateFrozenColumns: (sheetId: string, cols: number) => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;

  // Formula engine integration
  getDisplayValue: (key: string) => string;
  setGetDisplayValue: (fn: (key: string) => string) => void;
}

type SpreadsheetStore = SpreadsheetState & SpreadsheetActions;

const BATCH_WINDOW_MS = 500;

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

  // Store for the getDisplayValue function from formula engine
  let _getDisplayValue: (key: string) => string = (key) => {
    const cell = get().cellData.get(key);
    return cell?.raw || '';
  };

  return {
    // Initial state
    cellData: new Map(),
    cellFormat: new Map(),
    computedData: new Map(),
    baselineData: new Map(),
    baselineFormat: new Map(),
    dirtyCells: new Set(),
    dirtySettings: false,
    selection: null,
    highlightedCells: null,
    inputValue: '',
    isEditing: false,
    copiedRange: null,
    animatingRanges: [],
    workspaceId: null,
    activeSheetId: null,
    sheets: [],
    columnWidths: new Map(),
    columnWidthsBySheet: new Map(),
    frozenRows: 0,
    frozenColumns: 0,
    frozenRowsBySheet: new Map(),
    frozenColumnsBySheet: new Map(),
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

    setComputedData: (data) => set({ computedData: data }),

    setBaselineData: (data) => set({ baselineData: data }),

    setBaselineFormat: (format) => set({ baselineFormat: format }),

    setDirtyCells: (cells) => set(state => {
      const newCells = typeof cells === 'function' ? cells(state.dirtyCells) : cells;
      return { dirtyCells: newCells, hasUnsavedChanges: newCells.size > 0 || state.dirtySettings };
    }),

    setDirtySettings: (dirty) => set(state => ({
      dirtySettings: dirty,
      hasUnsavedChanges: state.dirtyCells.size > 0 || dirty,
    })),

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

    setWorkspaceId: (id) => set({ workspaceId: id }),

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

    setColumnWidthsBySheet: (widths) => set(state => {
      const newWidths = typeof widths === 'function' ? widths(state.columnWidthsBySheet) : widths;
      const columnWidths = newWidths.get(state.activeSheetId || '') || new Map();
      return { columnWidthsBySheet: newWidths, columnWidths };
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

        const baselineValue = state.baselineData.get(key);
        const newRaw = value?.raw || '';
        const baselineRaw = baselineValue?.raw || '';
        const newDirtyCells = new Set(state.dirtyCells);

        if (newRaw !== baselineRaw) {
          newDirtyCells.add(key);
        } else {
          newDirtyCells.delete(key);
        }

        return {
          cellData: next,
          dirtyCells: newDirtyCells,
          hasUnsavedChanges: newDirtyCells.size > 0 || state.dirtySettings,
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

        const baselineFmt = state.baselineFormat.get(key);
        const formatStr = format ? JSON.stringify(format) : '';
        const baselineStr = baselineFmt ? JSON.stringify(baselineFmt) : '';
        const newDirtyCells = new Set(state.dirtyCells);

        if (formatStr !== baselineStr) {
          newDirtyCells.add(key);
        } else {
          newDirtyCells.delete(key);
        }

        return {
          cellFormat: next,
          dirtyCells: newDirtyCells,
          hasUnsavedChanges: newDirtyCells.size > 0 || state.dirtySettings,
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
        const newDirtyCells = new Set(state.dirtyCells);
        const allKeys = new Set([...state.cellData.keys(), ...newCellData.keys()]);

        allKeys.forEach(key => {
          const nextValue = newCellData.get(key);
          const baselineValue = state.baselineData.get(key);
          const nextRaw = nextValue?.raw || '';
          const baselineRaw = baselineValue?.raw || '';

          if (nextRaw !== baselineRaw) {
            newDirtyCells.add(key);
          } else {
            newDirtyCells.delete(key);
          }
        });

        return {
          cellData: newCellData,
          dirtyCells: newDirtyCells,
          hasUnsavedChanges: newDirtyCells.size > 0 || state.dirtySettings,
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
        const newDirtyCells = new Set(state.dirtyCells);
        const allKeys = new Set([...state.cellFormat.keys(), ...newCellFormat.keys()]);

        allKeys.forEach(key => {
          const nextFormat = newCellFormat.get(key);
          const baselineFmt = state.baselineFormat.get(key);
          const nextStr = nextFormat ? JSON.stringify(nextFormat) : '';
          const baselineStr = baselineFmt ? JSON.stringify(baselineFmt) : '';

          if (nextStr !== baselineStr) {
            newDirtyCells.add(key);
          } else {
            newDirtyCells.delete(key);
          }
        });

        return {
          cellFormat: newCellFormat,
          dirtyCells: newDirtyCells,
          hasUnsavedChanges: newDirtyCells.size > 0 || state.dirtySettings,
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
        return {
          columnWidthsBySheet: newWidths,
          columnWidths,
          dirtySettings: true,
          hasUnsavedChanges: true,
        };
      });
    },

    updateFrozenRows: (sheetId, rows) => {
      set(state => {
        const newMap = new Map(state.frozenRowsBySheet);
        newMap.set(sheetId, rows);
        const frozenRows = newMap.get(state.activeSheetId || '') || 0;
        return {
          frozenRowsBySheet: newMap,
          frozenRows,
          dirtySettings: true,
          hasUnsavedChanges: true,
        };
      });
    },

    updateFrozenColumns: (sheetId, cols) => {
      set(state => {
        const newMap = new Map(state.frozenColumnsBySheet);
        newMap.set(sheetId, cols);
        const frozenColumns = newMap.get(state.activeSheetId || '') || 0;
        return {
          frozenColumnsBySheet: newMap,
          frozenColumns,
          dirtySettings: true,
          hasUnsavedChanges: true,
        };
      });
    },

    markSaved: () => set(state => ({
      baselineData: new Map(state.cellData),
      baselineFormat: new Map(state.cellFormat),
      dirtyCells: new Set(),
      dirtySettings: false,
      hasUnsavedChanges: false,
    })),

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

        // Update dirty tracking
        const newDirtyCells = new Set(state.dirtyCells);
        const allKeys = new Set([...action.dataDelta.keys(), ...action.formatDelta.keys()]);
        allKeys.forEach(key => {
          const baselineValue = state.baselineData.get(key);
          const baselineFmt = state.baselineFormat.get(key);
          let isDirty = false;

          if (action.dataDelta.has(key)) {
            const oldValue = action.dataDelta.get(key)!.old;
            const oldRaw = oldValue?.raw || '';
            const baselineRaw = baselineValue?.raw || '';
            if (oldRaw !== baselineRaw) isDirty = true;
          }

          if (action.formatDelta.has(key)) {
            const oldFmt = action.formatDelta.get(key)!.old;
            const oldStr = oldFmt ? JSON.stringify(oldFmt) : '';
            const baselineStr = baselineFmt ? JSON.stringify(baselineFmt) : '';
            if (oldStr !== baselineStr) isDirty = true;
          }

          if (isDirty) {
            newDirtyCells.add(key);
          } else {
            newDirtyCells.delete(key);
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

        return {
          cellData: newCellData,
          cellFormat: newCellFormat,
          dirtyCells: newDirtyCells,
          hasUnsavedChanges: newDirtyCells.size > 0 || state.dirtySettings,
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

        // Update dirty tracking
        const newDirtyCells = new Set(state.dirtyCells);
        const allKeys = new Set([...action.dataDelta.keys(), ...action.formatDelta.keys()]);
        allKeys.forEach(key => {
          const baselineValue = state.baselineData.get(key);
          const baselineFmt = state.baselineFormat.get(key);
          let isDirty = false;

          if (action.dataDelta.has(key)) {
            const newValue = action.dataDelta.get(key)!.new;
            const newRaw = newValue?.raw || '';
            const baselineRaw = baselineValue?.raw || '';
            if (newRaw !== baselineRaw) isDirty = true;
          }

          if (action.formatDelta.has(key)) {
            const newFmt = action.formatDelta.get(key)!.new;
            const newStr = newFmt ? JSON.stringify(newFmt) : '';
            const baselineStr = baselineFmt ? JSON.stringify(baselineFmt) : '';
            if (newStr !== baselineStr) isDirty = true;
          }

          if (isDirty) {
            newDirtyCells.add(key);
          } else {
            newDirtyCells.delete(key);
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

        return {
          cellData: newCellData,
          cellFormat: newCellFormat,
          dirtyCells: newDirtyCells,
          hasUnsavedChanges: newDirtyCells.size > 0 || state.dirtySettings,
          inputValue: newInputValue,
          undoStack: newUndoStack,
          redoStack: newRedoStack,
          canUndo: true,
          canRedo: newRedoStack.length > 0,
        };
      });
    },

    // Formula engine integration
    getDisplayValue: (key) => _getDisplayValue(key),

    setGetDisplayValue: (fn) => {
      _getDisplayValue = fn;
    },
  };
});

// Selector helpers for common patterns
export const useActiveSheet = () => useSpreadsheetStore(state => {
  const sheet = state.sheets.find(s => s.sheetId === state.activeSheetId);
  return {
    sheetId: sheet?.fetchId || null,
    sheetName: sheet?.name || null,
  };
});
