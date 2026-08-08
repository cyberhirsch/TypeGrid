# Tasks

Two phases: **Bugs** (fix first — restore/complete behavior that's supposed
to already work) then **Features** (net-new capability, requested or
suggested). Within each phase, sorted by which Claude model fits the work —
Haiku = mechanical/local/low-risk, Sonnet = contained logic changes with one
clear approach, Opus = architectural, touches multiple files, or needs a
design decision before coding starts.

## Phase 1 — Bugs

**Complete.** All Phase 1 items, including both architectural Opus items
(stroke-identity unification and the shared `js/gridEditor.js` base class), are
done and recorded in [CHANGELOG.md](CHANGELOG.md) under "IconGrid Stabilization".

Two notes carried forward for Phase 2 work:

- Stroke ids are now topological (`s-h-2-3`, `s-c-1-4-br`, `s-xh/xl/xr-i-j`),
  defined in [js/strokeId.js](js/strokeId.js). `gridStrokeIds(config)` is the
  single source of truth for what exists on a grid — the renderer draws exactly
  those hit zones and transforms validate against them, so an unaddressable
  stroke is now unrepresentable. **Any new grid type must extend that module**
  (id kind, `strokeGeom` case, `gridStrokeIds` enumeration, and flip/nudge
  mapping) rather than adding another per-type branch in the renderer.
- Shared editor logic lives in [js/gridEditor.js](js/gridEditor.js). New
  behaviour that applies to both tools (undo/redo, keyboard shortcuts, inline
  modals) belongs there, not duplicated into both controllers.

## Phase 2 — Features

### Haiku

- [ ] **Replace native `prompt()`/`confirm()` dialogs with in-app UI** —
  requested: no browser popups, everything inline. Four call sites use
  native dialogs today: `js/iconApp.js` — "Add Variant" (`prompt()`,
  [js/iconApp.js:203](js/iconApp.js:203)), "Rename variant"
  (`prompt()`, [js/iconApp.js:579](js/iconApp.js:579)), "Delete variant"
  (`confirm()`, [js/iconApp.js:590](js/iconApp.js:590)), and "New"
  (`confirm()`, [js/iconApp.js:163](js/iconApp.js:163)); `main.js` has the
  same "New" `confirm()` ([main.js:135](main.js:135)). Replace with the
  existing `.modal` pattern already used for the metadata dialogs
  (`#metadataModal`/`#iconMetadataModal` in `index.html`) — a small reusable
  inline text-input modal and a small reusable inline confirm modal, styled
  to match rather than the browser chrome. Do this together with the
  variant-rename fix above, since rename needs both a working
  double-click/click affordance *and* a non-native input.
- [ ] **Port the Topology debug view from Typegrid to IconGrid** — `main.js`
  has a `showTopo` toggle (`vectorPreview`/`topoBtn`) that swaps the normal
  render for `drawGuidesOnly()` + `drawTopoOverlay()` from `js/topology.js`
  ([main.js:534-536](main.js)); `js/iconApp.js` has no equivalent button,
  config flag, or render branch. Both helper functions are already
  grid-type-agnostic and used as-is by Typegrid, so this is copying the
  button + `config.showTopo` flag + the two-line render branch into
  `iconApp.js`, not writing new geometry logic.
- [ ] **Wire the undo/redo buttons (currently dead in both apps) and fix their placement** —
  confirmed via grep: `#undoBtn`/`#redoBtn` ([index.html:35-36](index.html:35)) have
  no `.onclick` handler anywhere in `main.js` or `js/iconApp.js`, and there's no
  `Ctrl+Z`/`Ctrl+Y` keyboard listener either — clicking them is currently a no-op
  in both Typegrid and IconGrid. `iconApp.js` has an internal history/redoStack and
  `undo()`/`redo()` methods already, but nothing calls them; `main.js` has no undo
  system at all. Also: `.undo-redo-controls` ([style.css:161](style.css:161)) is
  markup-wise sandwiched between the app-switcher and the tagline
  (`<div class="header"><div class="app-switcher">...</div><div class="undo-redo-controls">...</div><p class="tagline">...</p></div>`),
  which renders as a stray centered row floating between the logo and the tagline
  instead of living near New/Load/Save where a user would expect history controls.
  Fix both: wire click handlers + keyboard shortcuts in both apps (porting/finishing
  iconApp's history pattern to main.js), and move the undo/redo buttons into the
  New/Load/Save button row (or otherwise group them with persistence controls).

### Sonnet

- [ ] **Add Dot Grid and Squircle Grid cell-shape variants** — requested:
  a polka-dot grid, a grid of squares with visible gutters between them,
  and a squircle/app-icon-style rounded-square grid. All three can reuse
  the existing rectangular `f-r-i-j` addressing that `geometric` already
  uses ([js/renderer.js:100-107](js/renderer.js:100)) — no new topology,
  hit-zone, or `collectShapes` addressing scheme is needed, just new
  rendering for the fill shape itself (inset circle / inset rounded rect
  instead of a flush rect) plus two new config knobs (`cellInset`,
  `cellCornerRadius`). Lowest-risk way in: add them as new `gridType`
  values that share the `geometric` branch's fill-hit-zone loop and only
  diverge in the visual shape drawn and the corresponding
  `collectShapes` ring builder.
- [ ] **Add small-size PNG export (16/32px) and batch "export all variants"**
  for IconGrid — currently only 64/512px, one variant at a time, which is
  three manual round-trips for a brand handoff. Reuse the existing
  `buildCleanSVG`/`exportPNG` pipeline in `js/export.js` with a loop over
  `Object.keys(state.glyphs)`.
- [ ] **Finish and generalize the undo/redo implementation** — the current
  `iconApp.js` sketch snapshots the entire config+glyphs as JSON on every
  change (uncapped growth beyond the 50-entry cap is fine, but every
  `pointermove` during a drag would push a new snapshot once wired into
  `refresh()` — needs to snapshot on `pointerup`/discrete actions only, not
  continuously).

### Opus

- [ ] **Add a global "round all corners" post-effect, non-destructive.**
  Requested as a filter applied on top of the drawn mark — every corner of
  the final silhouette gets rounded by a configurable radius — without
  altering the underlying fill/stroke data, so it can be toggled or the
  radius adjusted freely without losing the original geometry. This is
  different from the Dot/Squircle request above (which changes the shape
  drawn *per cell*, before union): this operates on the *final unioned
  outline* from `unionShapes` ([js/geometry.js](js/geometry.js)), which
  means a real polygon-filleting algorithm — replacing each vertex with a
  circular arc of the requested radius, handling convex and reflex
  (concave) corners differently, and clamping the radius per-corner so
  fillets on adjacent short edges don't overlap or self-intersect. Needs to
  run on both outer rings and holes.
  Open design question before implementation: does this apply live on the
  interactive canvas, or only in the export/preview path? Today the
  interactive canvas draws raw per-cell shapes directly (fast, hit-testable)
  and only `js/export.js`'s `buildCleanSVG`/`buildUnionedPath` run shapes
  through `collectShapes` + `unionShapes` to get a clean outline. Filleting
  only at export/preview-swatch time is a much smaller change (post-process
  the merged rings in `buildCleanSVG` before converting to a path string);
  filleting live on the main canvas as a true "non-destructive filter" means
  also rendering a second, unioned+filleted overlay in `drawInto` without
  breaking the existing hit-zone shapes underneath — decide this scope
  before starting.
- [ ] **Add a Radial/Polar grid type** (concentric rings + spokes, like a
  compass/target). Unlike the Dot/Squircle request above, this is a genuinely
  new topology, not a rendering variant of `geometric` — cells are addressed
  by (ring, wedge) instead of (row, col), which means: new guide drawing
  (concentric circles + radial spokes, replacing the row/col loop in
  `drawGuides`), a new fill decomposition (annulus-wedge segments instead of
  rects/triangles, new `drawFills` + `collectShapes` branches), new line
  hit-zones for both radial spokes and circular arcs, and polar-to-Cartesian
  math throughout export. Comparable in scope to how Hexagonal was added
  originally (touches `drawGuides`/`drawFills`/`drawLineHitZones` in
  `js/renderer.js` and the fill/stroke branches in `collectShapes` in
  `js/geometry.js`), likely harder since polar coordinates aren't a simple
  affine transform of the existing grid math the other four types share.
  Best tackled after (or alongside) the stroke-identity unification in
  Phase 1, since a fifth topology makes the current per-type hardcoding in
  3-4 functions even more expensive to maintain.
