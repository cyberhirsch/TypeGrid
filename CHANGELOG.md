# TypeGrid: Changelog

### [Unreleased] – 2026-08-08
**"IconGrid Stabilization"** — Phase 1 bug-fix pass on the new IconGrid tool.
*   **Fixed**: `js/iconApp.js` syntax error that 500'd the dev server and broke IconGrid entirely (orphaned `init()` body left outside any method after an earlier undo/redo edit).
*   **Fixed**: Variant rename — double-click never fired because the single-click handler rebuilt the list first; now detects double-click via `e.detail === 2` before refreshing.
*   **Fixed**: Usage-preview swatches showed grid guides instead of a clean mark; added a `showGuides` option to `drawInto()`.
*   **Fixed**: `primaryColor` only affected export, not the live canvas — relabeled to "Export Color" to remove the mismatch.
*   **Fixed**: `localStorage.setItem` quota errors (private browsing, full storage) now caught and logged once instead of throwing uncaught and silently killing autosave.
*   **Fixed**: Loading the wrong project file type (e.g. `.tgf` into IconGrid) now shows a clear error instead of silently producing garbage state.
*   **Fixed**: Export seam/notch artifacts at stroke joins — `ARC_STEPS` raised 12→32 so independently-drawn round caps approximate a true circle closely enough that shared joints no longer facet.
*   **Fixed**: Drag performance on large grids — `pointermove` now only re-renders the canvas; the full thumbnail/preview rebuild + autosave is deferred to `pointerup` (was ~1.1s/step at 15×15, now matches the default-grid frame time).
*   **Changed**: `opentype.js` and `polygon-clipping` are now bundled via npm/Vite instead of loaded from jsdelivr/esm.sh CDNs at runtime — no more runtime dependency on external CDNs.
*   **Added**: `vitest` test runner and geometry regression tests (`js/geometry.test.js`) covering the arc-sampling bug class that shipped twice (malformed br-arc endpoint, swapped swf=0 angles) — verified the suite catches the historical bug by reintroducing it.

### [v4.0] – 2026-03-05
**"Vertical Evolution & Dynamic Scaling"**
*   **Total Layout Refactor**: Moved character inventory from the bottom to a high-density, scrollable Right Overview column.
*   **Dynamic Aspect Ratio System**: 
    *   Added an Aspect Ratio slider in the Left Sidebar.
    *   The entire UI (canvas and all preview thumbnails) now fluidly scales horizontally to match the chosen proportions.
    *   The workspace now centers the canvas and adapts smoothly to extreme widths/heights.
*   **Dual-mode Tool System**: 
    *   Added **Fill Tool** for solid area segments.
    *   Added **Line Tool** for line-based strokes on grid edges.
    *   Added **Stroke Weight Slider** in the left sidebar to control stroke thickness globally.
*   **Live Preview Snapshots**: The Right Overview now renders SVG previews of every character (A-Z) in real-time as you draw on the main canvas.
*   **Clean Under-the-Hood Rewrite**: Unified the drawing engine into a shared `drawInto()` function for both main editor and preview thumbnails, ensuring perfect visual parity.

### [0.3.0] – 2026-03-05
**"Curvilinear & Aesthetic"**
*   **New Curvature Grid Type**: Added a sophisticated arc-based segment system using overlapping circular guides.
*   **Aesthetic Shift**: Switched search for "glassmorphism" to a high-contrast, minimalist "White-on-Black" theme.
*   **Font Export Upgrade**: Refactored the TrueType generator to approximate circular arcs using quadratic Bézier curves.

### [0.2.0] – 2026-03-05
**"Font Synthesis Engine"**
*   **Initial opentype.js support**: Enabled TTF/OTF font generation and direct browser downloads.
*   **A-Z Glyph State**: Added full alphabet management and character switching.
*   **Persistence**: Implemented `localStorage` project saving/loading.

### [0.1.0] – 2026-03-05
**"The Grid Proto"**
*   **Initial Release**: Core grid drawing interface with Geometric (Rect), Triangle-split, and Hexagonal grid structures.
*   **Export**: Basic SVG path export for individual characters.
