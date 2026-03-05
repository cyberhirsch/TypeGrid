# TypeGrid: Geometric Font Synth

TypeGrid is a minimalist, grid-based font editor designed for rapid experimentation with geometric type. It allows designers to "synth" alphabets by toggling segments within various grid structures, including rectangular, curvilinear, and hexagonal systems.

![TypeGrid UI](https://img.shields.io/badge/Aesthetic-Minimalist-black?style=for-the-badge)
![Tech](https://img.shields.io/badge/Built%20with-Vanilla%20JS%20%2B%20SVG-white?style=for-the-badge)

## 🚀 Features

- **Dynamic Grid Engine**: Switch between multiple grid types:
  - **Geometric (Rect)**: Classic modular grid.
  - **Curvature**: Overlapping circular arcs for calligraphic, fluid forms.
  - **Triangle Split**: Diagonal subdivisions for faceted designs.
  - **Hexagonal**: Honeycomb-style modularity.
- **Dual-Mode Drawing**:
  - **Fill Tool**: Toggle solid area segments.
  - **Line Tool**: Toggle strokes on grid lines with adjustable weight.
- **Proportional Scaling**: Global aspect ratio control that fluidly resizes the workspace and all character previews.
- **Real-time Overview**: A high-density character inventory that provides live snapshots of your entire A-Z alphabet.
- **Professional Export**:
  - **SVG**: Vector snapshots for individual glyphs.
  - **TTF (TrueType)**: Full font file generation using `opentype.js`.
- **Zero-Dependency Core**: Runs as a standalone HTML file—no local server or build process required.

## 🛠 Usage

1. **Draw**: Select a tool (Fill/Line) and a Grid Type. Click segments on the central canvas to build your glyph.
2. **Navigate**: Select characters from the right-hand overview to switch between letters.
3. **Refine**: Adjust the Rows, Columns, and Aspect Ratio sliders to transform your entire typeface instantly.
4. **Save**: Use the "Save" button to persist your progress in `localStorage`.
5. **Export**: Click "Export Font (TTF)" to download a functional font file for use in any design software.

## 🧪 Technical Implementation

- **Drawing**: Rendered entirely with high-performance SVG.
- **Font Generation**: Uses a custom wrapper for `opentype.js` to translate SVG paths and lines into TrueType outlines.
- **Persistence**: Project state is serialized and managed via the Browser Web Storage API.

---
*Created for experimental type design.*
