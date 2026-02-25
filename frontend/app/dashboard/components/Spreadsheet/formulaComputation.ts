import { evaluateFormula, extractDependencies } from './formulaEngine';
import type { CellData, ComputedData, ComputedValue } from './types';

type SheetInfo = { sheetId: string; name: string };

type DependencyGraph = {
  dependsOn: Map<string, Set<string>>;
  dependents: Map<string, Set<string>>;
};

// Module-level dependency graph singleton
// All keys are absolute: "sheetId:row,col"
const depGraph: DependencyGraph = {
  dependsOn: new Map(),
  dependents: new Map(),
};

function rawToValue(cell: { raw: string; type: string }): ComputedValue {
  if (cell.type === 'number') {
    const num = parseFloat(cell.raw);
    return { value: isNaN(num) ? cell.raw : num };
  }
  return { value: cell.raw };
}

function buildSheetNameToId(sheets: SheetInfo[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of sheets) map.set(s.name, s.sheetId);
  return map;
}

function buildSheetIdToName(sheets: SheetInfo[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of sheets) map.set(s.sheetId, s.name);
  return map;
}

/**
 * Convert a dependency key from extractDependencies (which uses sheet names)
 * to an absolute key using sheetId.
 * Input: "row,col" or "SheetName:row,col"
 * Output: "sheetId:row,col"
 */
function toAbsoluteKey(
  depKey: string,
  ownerSheetId: string,
  sheetNameToId: Map<string, string>,
): string {
  if (depKey.includes(':')) {
    const colonIdx = depKey.indexOf(':');
    const sheetName = depKey.slice(0, colonIdx);
    const cellKey = depKey.slice(colonIdx + 1);
    const sheetId = sheetNameToId.get(sheetName);
    if (!sheetId) return `${ownerSheetId}:${depKey}`; // fallback
    return `${sheetId}:${cellKey}`;
  }
  return `${ownerSheetId}:${depKey}`;
}

/**
 * Update the dependency graph for a formula cell.
 * All keys are absolute "sheetId:row,col".
 */
function updateDependencies(
  absKey: string,
  formula: string,
  ownerSheetId: string,
  sheetNameToId: Map<string, string>,
): void {
  const oldDeps = depGraph.dependsOn.get(absKey);
  if (oldDeps) {
    for (const dep of oldDeps) {
      depGraph.dependents.get(dep)?.delete(absKey);
    }
  }

  const rawDeps = extractDependencies(formula);
  const absDeps = new Set(rawDeps.map(d => toAbsoluteKey(d, ownerSheetId, sheetNameToId)));
  depGraph.dependsOn.set(absKey, absDeps);

  for (const dep of absDeps) {
    if (!depGraph.dependents.has(dep)) {
      depGraph.dependents.set(dep, new Set());
    }
    depGraph.dependents.get(dep)!.add(absKey);
  }
}

function removeDependencies(absKey: string): void {
  const oldDeps = depGraph.dependsOn.get(absKey);
  if (oldDeps) {
    for (const dep of oldDeps) {
      depGraph.dependents.get(dep)?.delete(absKey);
    }
    depGraph.dependsOn.delete(absKey);
  }
}

/**
 * Build a getCellValue function for formula evaluation.
 * The evaluator calls getCellValue("row,col", "SheetName?").
 * We resolve to the correct data and look up computed values by absolute key.
 */
function buildGetCellValue(
  allSheetsData: Map<string, CellData>,
  sheetNameToId: Map<string, string>,
  ownerSheetId: string,
  ownerSheetName: string,
  computedMap: Map<string, ComputedValue>,
  evaluatingCells: Set<string>,
): (cellKey: string, sheet?: string) => ComputedValue | null {
  const getCellValue = (cellKey: string, sheet?: string): ComputedValue | null => {
    // Resolve which sheet this reference targets
    const targetSheetId = sheet && sheet !== ownerSheetName
      ? (sheetNameToId.get(sheet) || null)
      : ownerSheetId;

    if (!targetSheetId) return { value: null, error: '#REF!' };

    const absKey = `${targetSheetId}:${cellKey}`;

    if (evaluatingCells.has(absKey)) {
      return { value: null, error: '#CIRCULAR!' };
    }

    const data = allSheetsData.get(targetSheetId);
    if (!data) return { value: null, error: '#REF!' };

    const cell = data.get(cellKey);
    if (!cell) return null;

    if (cell.type === 'formula') {
      if (computedMap.has(absKey)) {
        return computedMap.get(absKey)!;
      }
      // Evaluate on the fly (handles deps not yet reached in topological order)
      evaluatingCells.add(absKey);
      const result = evaluateFormula(cell.raw, getCellValue);
      evaluatingCells.delete(absKey);
      computedMap.set(absKey, result);
      return result;
    }

    return rawToValue(cell);
  };

  return getCellValue;
}

/**
 * Get a cell from allSheetsData by absolute key "sheetId:row,col"
 */
function getCellByAbsKey(
  absKey: string,
  allSheetsData: Map<string, CellData>,
): { raw: string; type: string } | null {
  const colonIdx = absKey.indexOf(':');
  if (colonIdx === -1) return null;
  const sheetId = absKey.slice(0, colonIdx);
  const cellKey = absKey.slice(colonIdx + 1);
  return allSheetsData.get(sheetId)?.get(cellKey) || null;
}

/**
 * Split a combined computed map (with absolute "sheetId:row,col" keys)
 * into per-sheet maps with plain "row,col" keys.
 */
function splitComputed(
  combinedComputed: Map<string, ComputedValue>,
): Map<string, ComputedData> {
  const result = new Map<string, ComputedData>();

  for (const [absKey, value] of combinedComputed) {
    const colonIdx = absKey.indexOf(':');
    if (colonIdx === -1) continue;
    const sheetId = absKey.slice(0, colonIdx);
    const cellKey = absKey.slice(colonIdx + 1);

    if (!result.has(sheetId)) result.set(sheetId, new Map());
    result.get(sheetId)!.set(cellKey, value);
  }

  return result;
}

/**
 * Recalculate ALL formulas across all sheets.
 * Used after bulk operations: initial load, undo, redo.
 */
export function recalculateAll(
  allSheetsData: Map<string, CellData>,
  sheets: SheetInfo[],
): Map<string, ComputedData> {
  depGraph.dependsOn.clear();
  depGraph.dependents.clear();

  const sheetNameToId = buildSheetNameToId(sheets);
  const sheetIdToName = buildSheetIdToName(sheets);

  // Collect all formulas and build dependency graph
  const allFormulas: { absKey: string; formula: string; sheetId: string }[] = [];

  for (const [sheetId, data] of allSheetsData) {
    if (!sheetIdToName.has(sheetId)) continue;

    for (const [key, cell] of data) {
      if (cell.type === 'formula') {
        const absKey = `${sheetId}:${key}`;
        allFormulas.push({ absKey, formula: cell.raw, sheetId });
        updateDependencies(absKey, cell.raw, sheetId, sheetNameToId);
      }
    }
  }

  // Topological sort
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    const deps = depGraph.dependsOn.get(key);
    if (deps) {
      for (const dep of deps) visit(dep);
    }
    order.push(key);
  }

  for (const { absKey } of allFormulas) visit(absKey);

  // Evaluate in topological order
  const combinedComputed = new Map<string, ComputedValue>();
  const evaluatingCells = new Set<string>();

  for (const absKey of order) {
    const cell = getCellByAbsKey(absKey, allSheetsData);
    if (!cell || cell.type !== 'formula') continue;

    // Determine which sheet owns this formula for getCellValue resolution
    const colonIdx = absKey.indexOf(':');
    const ownerSheetId = absKey.slice(0, colonIdx);
    const ownerSheetName = sheetIdToName.get(ownerSheetId) || '';

    const getCellValue = buildGetCellValue(
      allSheetsData, sheetNameToId, ownerSheetId, ownerSheetName,
      combinedComputed, evaluatingCells,
    );

    evaluatingCells.clear();
    evaluatingCells.add(absKey);
    const result = evaluateFormula(cell.raw, getCellValue);
    combinedComputed.set(absKey, result);
    evaluatingCells.delete(absKey);
  }

  return splitComputed(combinedComputed);
}

/**
 * Recalculate only cells affected by changes to specific keys on the active sheet.
 * changedKeys are plain "row,col" keys on the active sheet.
 */
export function recalculateDirty(
  changedKeys: string[],
  allSheetsData: Map<string, CellData>,
  sheets: SheetInfo[],
  activeSheetId: string,
  prevAllSheetsComputed: Map<string, ComputedData>,
): Map<string, ComputedData> {
  const sheetNameToId = buildSheetNameToId(sheets);
  const sheetIdToName = buildSheetIdToName(sheets);

  // Convert changed keys to absolute keys
  const absChangedKeys = changedKeys.map(k => `${activeSheetId}:${k}`);

  // Update dependency graph for changed cells
  const activeData = allSheetsData.get(activeSheetId);
  for (let i = 0; i < changedKeys.length; i++) {
    const cellKey = changedKeys[i];
    const absKey = absChangedKeys[i];
    const cell = activeData?.get(cellKey);
    if (cell?.type === 'formula') {
      updateDependencies(absKey, cell.raw, activeSheetId, sheetNameToId);
    } else {
      removeDependencies(absKey);
    }
  }

  // Find all cells needing recalculation: changed formulas + transitive dependents
  const cellsToRecalc = new Set<string>();

  for (let i = 0; i < changedKeys.length; i++) {
    const cellKey = changedKeys[i];
    const absKey = absChangedKeys[i];
    const cell = activeData?.get(cellKey);
    if (cell?.type === 'formula') {
      cellsToRecalc.add(absKey);
    }

    // BFS to find transitive dependents
    const queue = [absKey];
    const bfsVisited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (bfsVisited.has(current)) continue;
      bfsVisited.add(current);
      const deps = depGraph.dependents.get(current);
      if (deps) {
        for (const dep of deps) {
          cellsToRecalc.add(dep);
          queue.push(dep);
        }
      }
    }
  }

  if (cellsToRecalc.size === 0) {
    return prevAllSheetsComputed;
  }

  // Topological sort of dirty cells
  const topoVisited = new Set<string>();
  const order: string[] = [];

  function visit(key: string) {
    if (topoVisited.has(key)) return;
    topoVisited.add(key);
    const deps = depGraph.dependsOn.get(key);
    if (deps) {
      for (const dep of deps) {
        if (cellsToRecalc.has(dep)) visit(dep);
      }
    }
    order.push(key);
  }

  for (const key of cellsToRecalc) visit(key);

  // Seed combined computed map with all previous values (converted to absolute keys)
  const combinedComputed = new Map<string, ComputedValue>();
  for (const [sheetId, sheetComputed] of prevAllSheetsComputed) {
    for (const [cellKey, value] of sheetComputed) {
      combinedComputed.set(`${sheetId}:${cellKey}`, value);
    }
  }

  // Evaluate dirty cells in topological order
  const evaluatingCells = new Set<string>();

  for (const absKey of order) {
    const cell = getCellByAbsKey(absKey, allSheetsData);
    if (!cell || cell.type !== 'formula') {
      combinedComputed.delete(absKey);
      continue;
    }

    const colonIdx = absKey.indexOf(':');
    const ownerSheetId = absKey.slice(0, colonIdx);
    const ownerSheetName = sheetIdToName.get(ownerSheetId) || '';

    const getCellValue = buildGetCellValue(
      allSheetsData, sheetNameToId, ownerSheetId, ownerSheetName,
      combinedComputed, evaluatingCells,
    );

    evaluatingCells.clear();
    evaluatingCells.add(absKey);
    const result = evaluateFormula(cell.raw, getCellValue);
    combinedComputed.set(absKey, result);
    evaluatingCells.delete(absKey);
  }

  return splitComputed(combinedComputed);
}

/**
 * Get the display string for a cell.
 */
export function getDisplayValue(key: string, cellData: CellData, computedData: ComputedData): string {
  const cell = cellData.get(key);
  if (!cell) return '';

  if (cell.type === 'formula') {
    const computed = computedData.get(key);
    if (computed?.error) return computed.error;
    if (computed?.value === null || computed?.value === undefined) return '';
    return String(computed.value);
  }

  return cell.raw;
}
