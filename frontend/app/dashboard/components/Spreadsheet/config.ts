// Grid dimensions
export const CELL_WIDTH = 100;
export const CELL_HEIGHT = 25;
export const NUM_ROWS = 200;
export const NUM_COLS = 50;

// Headers
export const HEADER_WIDTH = 50;
export const HEADER_HEIGHT = CELL_HEIGHT;
export const HEADER_BG = '#f2f2e3';

// Colors
export const CANVAS_BG = '#ffffef';
export const TEXT_COLOR = '#000000';
export const SELECTION_HIGHLIGHT = 'rgba(0, 100, 200, 0.12)';
export const HEADER_SELECTION_HIGHLIGHT = '#cce0ff';
export const EDITING_OUTLINE = 'rgba(0, 100, 200, 0.3)';
export const ACTIVE_CELL_BORDER = '#0064c8';
export const CELL_BORDER = 'rgba(0, 0, 0, 0.2)';
export const HEADER_BORDER = 'rgba(0, 0, 0, 0.4)';
export const POINTING_SELECTION_BORDER = '#8b5cf6';
export const POINTING_SELECTION_HIGHLIGHT = 'rgba(200, 180, 240, 0.3)';

// Color palette for formula references (different color per reference)
export const FORMULA_REFERENCE_COLORS = [
  { fill: 'rgba(200, 180, 240, 0.3)', border: '#8b5cf6' },  // Original Purple
  { fill: 'rgba(16, 185, 129, 0.2)', border: '#10b981' },   // Green
  { fill: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b' },    // Amber
  { fill: 'rgba(239, 68, 68, 0.2)', border: '#ef4444' },    // Red
  { fill: 'rgba(236, 72, 153, 0.2)', border: '#ec4899' },  // Pink
  { fill: 'rgba(14, 165, 233, 0.2)', border: '#0ea5e9' },  // Sky
];

// LLM animation color
export const LLM_ANIMATION_COLOR = {
  fill: 'rgba(5, 150, 105, 0.2)',  // Emerald-600 at 20% opacity
  border: '#059669'                 // Emerald-600 solid
};

// Font sizes
export const CELL_FONT_SIZE = 13;
export const HEADER_FONT_SIZE = 10;

// Spacing
export const CELL_TEXT_PADDING = 5;

// Line widths
export const DEFAULT_BORDER_WIDTH = 1;
export const ACTIVE_BORDER_WIDTH = 2;
export const LLM_ANIMATION_BORDER_WIDTH = 3;
export const EDITING_OUTLINE_WIDTH = 4;

// Freeze panes
export const FREEZE_PANE_DIVIDER_COLOR = '#000000';
export const FREEZE_PANE_DIVIDER_WIDTH = 2;

// Marching ants
export const DASH_PATTERN = [5, 5];
export const DASH_OFFSET_MODULO = 10;
export const MARCHING_ANTS_INTERVAL_MS = 80;

// Auto-save
export const AUTO_SAVE_DELAY_MS = 300;
