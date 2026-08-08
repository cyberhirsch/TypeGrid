# TypeGrid: Changelog

### [Unreleased] – 2026-08-08
**"IconGrid Stabilization"** — Phase 1 bug-fix pass on the new IconGrid tool.
*   **Fixed**: Flip and nudge silently deleted every curvature arc. Three hand-rolled arc regexes had diverged — the renderer emitted `M 100 0 A ...` while flip/nudge matched `M100 0 A100 ...` — so the match failed and the arc was dropped instead of transformed.
*   **Fixed**: Changing rows/columns orphaned existing strokes: they kept rendering but no longer matched any hit zone, so they could not be erased or extended.
*   **Changed**: Strokes are now addressed by grid topology (`s-h-2-3`, `s-c-1-4-br`) like fills have always been, instead of by absolute pixel coordinates and literal SVG path strings. Pixel geometry is derived from the grid config at render time, so transforms are integer arithmetic and flips are exact involutions. Saved `.tgf`/`.igf` projects migrate automatically on load — the bundled `vectoroid.tgf` (189 glyphs, 1073 strokes) converts with zero loss and byte-identical export output.
*   **Changed**: Extracted `js/gridEditor.js`, a shared base class for both tools. IconGrid previously duplicated ~350 lines of Typegrid's pointer handling, transforms and path-finding, so every fix had to be written twice; the two controllers shrank from 1220 lines to 649 plus 330 shared.
*   **Fixed**: Arcs meeting lines are now treated as a joint rather than two terminals, since `collectShapes` builds one connectivity graph over both.
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
