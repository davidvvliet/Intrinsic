import { useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';
import { useSpreadsheetContext } from './SpreadsheetContext';
import { NUM_ROWS, NUM_COLS } from './config';
import type { CellFormat, CellType } from './types';

export function useSheetPersistence() {
  const { accessToken } = useAccessToken();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    cellData,
    cellFormat,
    dirtyCells,
    markSaved,
    setCellData,
    setCellFormat,
    setBaselineData,
    setBaselineFormat,
    setDirtyCells,
  } = useSpreadsheetContext();

  // Get sheet ID from URL (don't generate until first save)
  const sheetIdFromUrl = searchParams.get('sheet');

  // Convert Maps to JSON format for API
  const serializeSheetData = useCallback(() => {
    const cells: Record<string, { raw: string; type: CellType }> = {};
    cellData.forEach((value, key) => {
      cells[key] = {
        raw: value.raw,
        type: value.type,
      };
    });

    const formatting: Record<string, CellFormat> = {};
    cellFormat.forEach((format, key) => {
      formatting[key] = format;
    });

    return {
      cells,
      dimensions: { rows: NUM_ROWS, cols: NUM_COLS },
      settings: {},
      formatting,
    };
  }, [cellData, cellFormat]);

  // Save batch of dirty cells to server
  const saveBatch = useCallback(async () => {
    if (dirtyCells.size === 0 || !accessToken) return;

    const sheetData = serializeSheetData();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };

    let response: Response;
    let returnedSheetId: string;

    if (!sheetIdFromUrl) {
      // First save - create new sheet via POST
      response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sheets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(sheetData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create sheet: ${response.statusText}`);
      }

      const result = await response.json();
      returnedSheetId = result.id;
    } else {
      // Update existing sheet via PUT
      response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sheets/${sheetIdFromUrl}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(sheetData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save sheet: ${response.statusText}`);
      }

      const result = await response.json();
      returnedSheetId = result.id;
    }

    // Mark as saved after successful save
    markSaved();

    // Update URL with sheet ID (from response for new sheets, or existing for updates)
    router.replace(`/dashboard?sheet=${returnedSheetId}`);
  }, [dirtyCells, serializeSheetData, markSaved, sheetIdFromUrl, accessToken, router]);

  // Load sheet from server
  const loadSheet = useCallback(async (sheetIdToLoad: string) => {
    if (!accessToken) return;

    const headers: HeadersInit = {
      'Authorization': `Bearer ${accessToken}`,
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sheets/${sheetIdToLoad}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      // If sheet doesn't exist (404), that's fine - it's a new sheet
      if (response.status === 404) {
        return;
      }
      throw new Error(`Failed to load sheet: ${response.statusText}`);
    }

    const sheet = await response.json();
    const data = sheet.data;

    // Deserialize cells
    const newCellData = new Map<string, { raw: string; type: CellType }>();
    if (data.cells) {
      Object.entries(data.cells).forEach(([key, value]: [string, any]) => {
        newCellData.set(key, {
          raw: value.raw,
          type: value.type,
        });
      });
    }

    // Deserialize formatting
    const newCellFormat = new Map<string, CellFormat>();
    if (data.formatting) {
      Object.entries(data.formatting).forEach(([key, format]: [string, any]) => {
        newCellFormat.set(key, format as CellFormat);
      });
    }

    // Set current state
    setCellData(newCellData);
    setCellFormat(newCellFormat);

    // Set baseline (what was loaded = last saved state)
    setBaselineData(new Map(newCellData));
    setBaselineFormat(new Map(newCellFormat));

    // Clear dirty cells
    setDirtyCells(new Set());

    // Update URL to match loaded sheet
    router.replace(`/dashboard?sheet=${sheetIdToLoad}`);
  }, [accessToken, setCellData, setCellFormat, setBaselineData, setBaselineFormat, setDirtyCells, router]);

  // Auto-save: debounced save after 750ms of inactivity
  useEffect(() => {
    if (dirtyCells.size === 0 || !accessToken) return;

    const timer = setTimeout(() => {
      saveBatch().catch(err => {
        console.error('Auto-save failed:', err);
      });
    }, 750);

    return () => clearTimeout(timer);
  }, [dirtyCells, accessToken, saveBatch]);

  // Initialize: Load sheet from URL if param exists
  useEffect(() => {
    if (!accessToken || !sheetIdFromUrl) return;

    // Sheet ID in URL - load it
    loadSheet(sheetIdFromUrl).catch(err => {
      console.error('Load sheet failed:', err);
    });
  }, [accessToken, sheetIdFromUrl, loadSheet]);
}
