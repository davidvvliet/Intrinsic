import { useState, useCallback, useRef, useMemo } from 'react';
import type { CellData, ComputedData, ComputedValue } from './types';
import { evaluateFormula, extractDependencies, isFormula } from './formulaEngine';

type DependencyGraph = {
  // For each cell, which cells it depends on
  dependsOn: Map<string, Set<string>>;
  // For each cell, which cells depend on it
  dependents: Map<string, Set<string>>;
};

/**
 * Hook that manages formula evaluation and dependency tracking
 */
export function useFormulaEngine(cellData: CellData) {
  const [computedData, setComputedData] = useState<ComputedData>(new Map());
  
  // Dependency graph stored in ref (doesn't need to trigger re-renders)
  const depsGraph = useRef<DependencyGraph>({
    dependsOn: new Map(),
    dependents: new Map(),
  });

  // Track cells currently being evaluated (for circular reference detection)
  const evaluatingCells = useRef<Set<string>>(new Set());

  /**
   * Get the computed value for a cell (used during formula evaluation)
   */
  const getCellValue = useCallback((key: string): ComputedValue | null => {
    // Check for circular reference
    if (evaluatingCells.current.has(key)) {
      return { value: null, error: '#CIRCULAR!' };
    }

    // Check if we have a cached computed value
    const cached = computedData.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Get raw cell data
    const cell = cellData.get(key);
    if (!cell) {
      return null; // Empty cell
    }

    // If it's a formula, evaluate it
    if (cell.type === 'formula') {
      evaluatingCells.current.add(key);
      const result = evaluateFormula(cell.raw, getCellValue);
      evaluatingCells.current.delete(key);
      return result;
    }

    // For non-formula cells, return the raw value as computed
    if (cell.type === 'number') {
      const num = parseFloat(cell.raw);
      return { value: isNaN(num) ? cell.raw : num };
    }
    return { value: cell.raw };
  }, [cellData, computedData]);

  /**
   * Update dependencies for a cell
   */
  const updateDependencies = useCallback((cellKey: string, formula: string) => {
    const graph = depsGraph.current;
    
    // Remove old dependencies
    const oldDeps = graph.dependsOn.get(cellKey);
    if (oldDeps) {
      for (const dep of oldDeps) {
        graph.dependents.get(dep)?.delete(cellKey);
      }
    }

    // Add new dependencies
    const newDeps = extractDependencies(formula);
    graph.dependsOn.set(cellKey, new Set(newDeps));
    
    for (const dep of newDeps) {
      if (!graph.dependents.has(dep)) {
        graph.dependents.set(dep, new Set());
      }
      graph.dependents.get(dep)!.add(cellKey);
    }
  }, []);

  /**
   * Get all cells that need to be recalculated when a cell changes
   * Uses topological sort to ensure correct evaluation order
   */
  const getRecalculationOrder = useCallback((changedKey: string): string[] => {
    const graph = depsGraph.current;
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(key: string) {
      if (visited.has(key)) return;
      if (visiting.has(key)) {
        // Circular dependency detected - will be handled during evaluation
        return;
      }

      visiting.add(key);
      
      // Visit all cells that depend on this one
      const deps = graph.dependents.get(key);
      if (deps) {
        for (const dep of deps) {
          visit(dep);
        }
      }

      visiting.delete(key);
      visited.add(key);
      result.push(key);
    }

    visit(changedKey);
    
    // Return in reverse order (dependencies first)
    return result.reverse();
  }, []);

  /**
   * Recalculate a cell and all its dependents
   */
  const recalculate = useCallback((changedKey: string) => {
    const cell = cellData.get(changedKey);
    
    // Update dependencies if it's a formula
    if (cell?.type === 'formula') {
      updateDependencies(changedKey, cell.raw);
    } else {
      // Clear dependencies if not a formula
      const graph = depsGraph.current;
      const oldDeps = graph.dependsOn.get(changedKey);
      if (oldDeps) {
        for (const dep of oldDeps) {
          graph.dependents.get(dep)?.delete(changedKey);
        }
        graph.dependsOn.delete(changedKey);
      }
    }

    // Get all cells that need recalculation
    const cellsToRecalc = getRecalculationOrder(changedKey);

    // Recalculate all affected cells
    setComputedData(prev => {
      const next = new Map(prev);
      
      for (const key of cellsToRecalc) {
        const cellToEval = cellData.get(key);
        
        if (!cellToEval) {
          next.delete(key);
          continue;
        }

        if (cellToEval.type === 'formula') {
          evaluatingCells.current.clear();
          evaluatingCells.current.add(key);
          
          // Create a getter that uses the new computed values
          const getVal = (k: string): ComputedValue | null => {
            if (evaluatingCells.current.has(k)) {
              return { value: null, error: '#CIRCULAR!' };
            }
            if (next.has(k)) {
              return next.get(k)!;
            }
            const c = cellData.get(k);
            if (!c) return null;
            if (c.type === 'number') {
              const num = parseFloat(c.raw);
              return { value: isNaN(num) ? c.raw : num };
            }
            return { value: c.raw };
          };

          const result = evaluateFormula(cellToEval.raw, getVal);
          next.set(key, result);
          evaluatingCells.current.delete(key);
        } else {
          // Non-formula: store raw value as computed
          if (cellToEval.type === 'number') {
            const num = parseFloat(cellToEval.raw);
            next.set(key, { value: isNaN(num) ? cellToEval.raw : num });
          } else {
            next.set(key, { value: cellToEval.raw });
          }
        }
      }

      return next;
    });
  }, [cellData, updateDependencies, getRecalculationOrder]);

  /**
   * Recalculate all formula cells
   */
  const recalculateAll = useCallback(() => {
    const newComputed = new Map<string, ComputedValue>();
    const graph = depsGraph.current;
    
    // Clear dependency graph
    graph.dependsOn.clear();
    graph.dependents.clear();

    // First pass: collect all formulas and their dependencies
    const formulaCells: string[] = [];
    for (const [key, cell] of cellData) {
      if (cell.type === 'formula') {
        formulaCells.push(key);
        updateDependencies(key, cell.raw);
      } else {
        // Store non-formula values
        if (cell.type === 'number') {
          const num = parseFloat(cell.raw);
          newComputed.set(key, { value: isNaN(num) ? cell.raw : num });
        } else {
          newComputed.set(key, { value: cell.raw });
        }
      }
    }

    // Topological sort for evaluation order
    const visited = new Set<string>();
    const order: string[] = [];

    function visit(key: string) {
      if (visited.has(key)) return;
      visited.add(key);
      
      const deps = graph.dependsOn.get(key);
      if (deps) {
        for (const dep of deps) {
          if (cellData.get(dep)?.type === 'formula') {
            visit(dep);
          }
        }
      }
      order.push(key);
    }

    for (const key of formulaCells) {
      visit(key);
    }

    // Evaluate in dependency order
    for (const key of order) {
      const cell = cellData.get(key);
      if (cell?.type === 'formula') {
        evaluatingCells.current.clear();
        evaluatingCells.current.add(key);
        
        const getVal = (k: string): ComputedValue | null => {
          if (evaluatingCells.current.has(k)) {
            return { value: null, error: '#CIRCULAR!' };
          }
          if (newComputed.has(k)) {
            return newComputed.get(k)!;
          }
          const c = cellData.get(k);
          if (!c) return null;
          if (c.type === 'number') {
            const num = parseFloat(c.raw);
            return { value: isNaN(num) ? c.raw : num };
          }
          return { value: c.raw };
        };

        const result = evaluateFormula(cell.raw, getVal);
        newComputed.set(key, result);
        evaluatingCells.current.delete(key);
      }
    }

    setComputedData(newComputed);
  }, [cellData, updateDependencies]);

  /**
   * Get display value for a cell (computed value or raw value)
   */
  const getDisplayValue = useCallback((key: string): string => {
    const cell = cellData.get(key);
    if (!cell) return '';

    if (cell.type === 'formula') {
      const computed = computedData.get(key);
      if (computed?.error) {
        return computed.error;
      }
      if (computed?.value === null || computed?.value === undefined) {
        return '';
      }
      return String(computed.value);
    }

    return cell.raw;
  }, [cellData, computedData]);

  return {
    computedData,
    recalculate,
    recalculateAll,
    getCellValue,
    getDisplayValue,
  };
}
