# Product Requirements Document (PRD): IconGrid

## 1. Executive Summary
**IconGrid** is a specialized, grid-based design tool built on the foundation of TypeGrid. While TypeGrid focuses on character generation and font synthesis, IconGrid is optimized for **Logo and Icon Design**. It allows designers to rapidly prototype geometric marks by manipulating modular grid segments across multiple related "variants" (e.g., Primary, Monochrome, Favicon).

## 2. Problem Statement
Designing scalable, consistent icon sets or logos often requires moving between different software for sketching, vectorizing, and testing at various scales. There is a lack of a lightweight, web-based tool that allows for:
*   Rapid geometric prototyping using modular grids.
*   Simultaneous editing of multiple related mark versions (variants).
*   Instant verification of legibility at small scales (favicon/app icon).

## 3. Target Audience
*   **Logo Designers**: Creating minimalist, geometric brand marks.
*   **UI/UX Designers**: Generating consistent icon sets for interfaces.
*   **Brand Identity Designers**: Developing cohesive visual systems across different media.

## 4. Core Features

### 4.1 Geometric Grid Engine (Inherited from TypeGrid)
*   **Multiple Grid Topologies**: Support for Rectangular, Curvature, Triangle Split, and Hexagonal grids.
*   **Dual-Mode Drawing**: 
    *   **Fill Tool**: Toggle solid area segments within the grid.
    *   **Line Tool**: Toggle strokes on grid edges with adjustable weight/cap/join.
*   **Transformations**: Horizontal/Vertical flipping, 180° rotation, and precise coordinate nudging.

### 4.2 Icon-Specific Features (The "Icon" Difference)
*   **Variant Management System**: Unlike TypeGrid's character-based approach, IconGrid manages a collection of named variants for a single brand identity.
    *   Users can add/rename/delete variants (e.s., "Master", "Black & White", "Small Scale").
    *   Changes to the grid structure or geometry apply globally across all variants.
*   **Brand Metadata**: Ability to attach metadata to the design (Brand Name, Primary Color, Description) for professional export.
*   **Dynamic Usage Preview**: A real-time preview pane showing how the current mark looks in common icon sizes (64px, 32px, 16px) and themes (Light/Dark).
*   **Clear-Space Guide**: An optional overlay to ensure sufficient padding for safe usage in UI environments.

### 4.3 Export Pipeline
*   **Scalable Vector Graphics (SVG)**: High-quality vector output for professional design workflows.
*   **Rasterized PNGs**: Instant generation of optimized, pre-sized PNG files (64px and 512px) for rapid prototyping/mockups.

## 5. Technical Requirements
*   **Rendering Engine**: High-performance SVG rendering in the browser.
*   **Zero-Dependency Core**: Standalone HTML/JS architecture; no local server or build process required.
*   **Persistence**: Use of Browser Web Storage API (`localStorage`) for automatic project saving and loading.
*   **Performance**: Ability to handle complex grids (up to 15x15) and multiple variants without UI lag.

## 6. User Flow
1.  **Initialize**: Open the app; choose a grid type (e.g., Hexagonal).
2.  **Design Primary Mark**: Use Fill/Line tools on the central canvas to construct the main logo.
3.  **Create Variants**: Add a "Monochrome" variant; switch to it and adjust strokes for high-contrast visibility.
4.  **Refine Geometry**: Adjust Rows/Columns or Aspect Ratio to find the perfect balance.
5.  **Review**: Check the `Usage Preview` pane to ensure legibility at 16px.
6.  **Export**: Download the SVG for production and PNGs for documentation.

## 7. Future Roadmap (Post-MVP)
*   **Symmetry Modes**: Automatic mirror/radial symmetry during drawing.
*   **Color Palettes**: Advanced color management for multi-color logo variants.
*   **Pattern Generation**: Ability to tile the created icon into a repeatable pattern.
