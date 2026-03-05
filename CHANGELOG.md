# TypeGrid: Changelog

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
