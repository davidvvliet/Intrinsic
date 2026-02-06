import { useEffect } from 'react';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import styles from './SheetBar.module.css';

type SheetMetadata = {
  sheetId: string; // Frontend ID for internal organization
  fetchId: string | null; // Backend sheet ID (null if unsaved)
  name: string;
  createdAt: string;
};

export default function SheetBar() {
  const { accessToken } = useAccessToken();
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const setActiveSheetId = useSpreadsheetStore(state => state.setActiveSheetId);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const setSheets = useSpreadsheetStore(state => state.setSheets);

  // Load sheets from localStorage on mount, create default if none exist
  useEffect(() => {
    try {
      const stored = localStorage.getItem('spreadsheet_sheets');
      let parsed: SheetMetadata[] = [];
      
      if (stored) {
        parsed = JSON.parse(stored) as SheetMetadata[];
      }
      
      // If no sheets exist, create default sheet
      if (parsed.length === 0) {
        const sheetId = Date.now().toString();
        const defaultSheet: SheetMetadata = {
          sheetId,
          fetchId: null, // Unsaved sheet
          name: 'Sheet',
          createdAt: new Date().toISOString(),
        };
        parsed = [defaultSheet];
        localStorage.setItem('spreadsheet_sheets', JSON.stringify(parsed));
      }
      
      setSheets(parsed);
      
      // Restore activeSheetId from localStorage
      if (parsed.length > 0) {
        const lastActiveId = localStorage.getItem('spreadsheet_last_active_sheet_id');
        if (lastActiveId) {
          const lastActiveSheet = parsed.find(s => s.sheetId === lastActiveId);
          if (lastActiveSheet) {
            setActiveSheetId(lastActiveId);
          } else {
            // Last active sheet not found, use first sheet
            setActiveSheetId(parsed[0].sheetId);
          }
        } else {
          // No last active sheet, use first sheet
          setActiveSheetId(parsed[0].sheetId);
        }
      }
    } catch (err) {
      console.error('Failed to load sheets from localStorage:', err);
    }
  }, [setActiveSheetId, setSheets]);

  // Create new sheet
  const handleCreateSheet = () => {
    const sheetId = Date.now().toString();
    const newSheet: SheetMetadata = {
      sheetId,
      fetchId: null, // Unsaved sheet
      name: 'Sheet',
      createdAt: new Date().toISOString(),
    };

    const updatedSheets = [...sheets, newSheet];
    setSheets(updatedSheets);
    
    try {
      localStorage.setItem('spreadsheet_sheets', JSON.stringify(updatedSheets));
    } catch (err) {
      console.error('Failed to save sheets to localStorage:', err);
    }

    // Set new sheet as active
    setActiveSheetId(sheetId);
  };

  // Handle tab click
  const handleTabClick = (sheet: SheetMetadata) => {
    setActiveSheetId(sheet.sheetId);
  };

  // Handle delete sheet
  const handleDeleteSheet = async (sheetToDelete: SheetMetadata) => {
    // Delete from backend if fetchId exists
    if (sheetToDelete.fetchId && accessToken) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sheets/${sheetToDelete.fetchId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to delete sheet from backend:', response.statusText);
        }
      } catch (err) {
        console.error('Failed to delete sheet from backend:', err);
      }
    }

    // Find deleted sheet's index before removing
    const deletedIndex = sheets.findIndex(s => s.sheetId === sheetToDelete.sheetId);
    
    // Remove sheet from array
    const updatedSheets = sheets.filter(s => s.sheetId !== sheetToDelete.sheetId);
    
    // If it was the only sheet, create a new default sheet
    if (updatedSheets.length === 0) {
      const sheetId = Date.now().toString();
      const defaultSheet: SheetMetadata = {
        sheetId,
        fetchId: null,
        name: 'Sheet',
        createdAt: new Date().toISOString(),
      };
      const newSheets = [defaultSheet];
      setSheets(newSheets);
      setActiveSheetId(sheetId);
      
      try {
        localStorage.setItem('spreadsheet_sheets', JSON.stringify(newSheets));
        localStorage.setItem('spreadsheet_last_active_sheet_id', sheetId);
      } catch (err) {
        console.error('Failed to save sheets to localStorage:', err);
      }
      return;
    }

    // Update state and localStorage
    setSheets(updatedSheets);
    
    try {
      localStorage.setItem('spreadsheet_sheets', JSON.stringify(updatedSheets));
    } catch (err) {
      console.error('Failed to save sheets to localStorage:', err);
    }

    // If deleting active sheet, switch to nearest tab (right first, then left)
    if (sheetToDelete.sheetId === activeSheetId) {
      let newActiveSheetId: string;
      
      // Try right tab first
      if (deletedIndex + 1 < sheets.length) {
        newActiveSheetId = sheets[deletedIndex + 1].sheetId;
      }
      // Else try left tab
      else if (deletedIndex - 1 >= 0) {
        newActiveSheetId = sheets[deletedIndex - 1].sheetId;
      }
      // Fallback to first remaining sheet (shouldn't happen, but safety)
      else {
        newActiveSheetId = updatedSheets[0].sheetId;
      }
      
      setActiveSheetId(newActiveSheetId);
      try {
        localStorage.setItem('spreadsheet_last_active_sheet_id', newActiveSheetId);
      } catch (err) {
        console.error('Failed to save active sheet to localStorage:', err);
      }
    }
  };

  return (
    <div className={styles.sheetBar}>
      <button
        className={styles.addButton}
        onClick={handleCreateSheet}
        title="Add new sheet"
      >
        +
      </button>
      <div className={styles.tabs}>
        {sheets.map((sheet, index) => (
          <div
            key={sheet.sheetId}
            className={`${styles.tabContainer} ${activeSheetId === sheet.sheetId ? styles.active : ''}`}
          >
            <button
              className={styles.tab}
              onClick={() => handleTabClick(sheet)}
            >
              {sheet.name} {index + 1}
            </button>
            <button
              className={styles.deleteButton}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSheet(sheet);
              }}
              title="Delete sheet"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
