# Tasks

Two phases: **Bugs** (fix first — restore/complete behavior that's supposed
to already work) then **Features** (net-new capability, requested or
suggested). Within each phase, sorted by which Claude model fits the work —
Haiku = mechanical/local/low-risk, Sonnet = contained logic changes with one
clear approach, Opus = architectural, touches multiple files, or needs a
design decision before coding starts.

## Phase 1 — Bugs

### Haiku

- [ ] **Fix syntax error in `js/iconApp.js`** — the undo/redo edit deleted the
  `async init() {` method signature but left its body (`cacheDOM()`,
  `bindEvents()`, `loadInitialData()`, ...) sitting in the class body outside
  any method. Currently breaks the file — Vite 500s on it, so nothing in
  IconGrid runs. Re-wrap that body in `async init() {}` and call it from the
  constructor. Blocks the undo/redo and Topology features below and the
  seam-artifact repro, so do this one first.
- [ ] **Fix variant rename (dead code)** — in `js/iconApp.js`, `item.onclick`
  calls `refresh()` which does `innerHTML = ''` and rebuilds the variant list,
  detaching the node before the second click of a double-click can land. The
  `ondblclick` handler never fires. Needs a rename affordance that survives
  the rebuild (e.g. a dedicated "rename" icon/button per item, or check
  `e.detail === 2` inside a single click handler before the list re-renders).
  Pair with the popup-replacement feature below, since rename's `prompt()`
  needs replacing too.
- [ ] **Make `usage-preview` swatches show the mark, not the grid** — `drawInto`
  always draws grid guides when `interactive` is falsy
  ([js/renderer.js:30](js/renderer.js:30)). Add a `showGuides` option so
  `renderUsagePreview()` in `js/iconApp.js` can render just the shape at
  16/32/64px instead of a grey mesh.
- [ ] **Make `primaryColor` actually apply, or rename it** — it currently only
  affects SVG/PNG export fill; the live canvas always renders white
  (`fill="#fff"` hardcoded in `js/renderer.js`, `js/primitives.js`). Either
  apply it to on-canvas fills/strokes too, or relabel the field "Export Color"
  so the mismatch isn't surprising.
- [ ] **Guard `localStorage.setItem` calls** in `js/storage.js` — quota errors
  (private browsing, storage full) currently throw uncaught and silently kill
  autosave on every subsequent edit. Wrap in try/catch and surface a one-time
  warning.
- [ ] **Validate project file shape on load** — `loadFromFile`/`loadIconFromFile`
  in `js/storage.js` don't check that a loaded `.tgf`/`.igf` actually matches
  the expected shape, so loading the wrong file type (e.g. a `.tgf` into
  IconGrid) silently produces garbage variant names instead of a clear error.

### Sonnet

- [x] **Downloaded/exported SVG-PNG marks have visible seam artifacts** — *(Partially fixed: `ARC_STEPS` raised from 12→32 in `js/geometry.js`, confirmed via live repro that this smooths the faceted joint edge. The underlying stroke-identity issue described below is unchanged — revisit if artifacts still appear at extreme stroke weights.)* Originally
  reported against IconGrid (triangle grid, thick strokes, square caps):
  reported against IconGrid (triangle grid, thick strokes, square caps):
  a notch appears where a diagonal stroke meets a horizontal one, and a
  faint straight seam runs across an otherwise-smooth rounded corner in
  the exported PNG. Root cause is very likely in `collectShapes`
  ([js/geometry.js:213-233](js/geometry.js:213)): each line stroke is
  three independently-built ring pieces (a capless body rectangle + a
  start-cap ring + an end-cap ring) that get unioned via `polygon-clipping`
  and are expected to share exact edges at the joints, but `qV`
  ([js/geometry.js:186](js/geometry.js:186)) rounds each ring's vertices to
  2 decimals *independently*, so two rings meant to coincide can differ by
  a hair — enough for the boolean union to leave a sliver hole instead of a
  sealed seam. The same class of near-coincident-vertex issue likely
  affects adjacent fill quadrants on curvature/triangle grids too (the
  seam in the rounded-corner screenshot). Also worth confirming while in
  here: internal stroke joints are hardcoded to `'round'`
  ([js/geometry.js:229](js/geometry.js:229)), ignoring the Stroke Join
  dropdown (miter/bevel) entirely — may be related or may be a second,
  separate bug.
  **Not yet reproduced live** — `js/iconApp.js`'s parse error (see above)
  currently 500s the dev server, so this is a code-read diagnosis, not a
  confirmed root cause. Fix that first, then reproduce with a drawn
  diagonal+horizontal join before changing the union logic. Pairs
  naturally with the geometry regression tests below.
- [x] **Fix drag performance on large grids** — every `pointermove` during a
  fill/line drag calls `refresh()`, which rebuilds *all* glyph/variant
  thumbnails (measured: 15,212 DOM elements, ~1.1s per drag step at 15×15,
  vs 135ms at the 6×4 default — the PRD's own "no lag up to 15×15" bar).
  During an active drag, update only the active thumbnail; do the full
  thumbnail rebuild once on `pointerup`. Applies to both `main.js` and
  `js/iconApp.js`.
- [ ] **Vendor `opentype.js` and `polygon-clipping`** instead of loading them
  from jsdelivr/esm.sh CDNs at runtime (`index.html`). Contradicts the
  "zero-dependency, no build process" claim in `prd.md` §5 and means a CDN
  outage or offline use breaks the app entirely. Download both into
  `js/vendor/` and update the `<script>` tag / import map to reference them
  locally; check licenses allow vendoring (both are MIT, should be fine).
- [ ] **Add geometry regression tests** for `collectShapes`/`strokeRing` in
  `js/geometry.js` — e.g. assert every curvature quadrant arc's sampled
  points stay within its cell's bounding box. This is exactly the class of
  bug that shipped twice already (the br-arc hit zone and the swf=0 angle
  swap) and was invisible in the UI until exported. No test runner exists
  yet; a minimal one (`vitest`, since Vite is already the build tool) is
  enough.

### Opus

- [ ] **Unify the stroke identity model — the root cause behind three bugs.**
  Fills are addressed by grid topology (`f-t-1-4-t`, stable across grid
  changes). Strokes are addressed by absolute pixel coordinates
  (`s:0.0,200.0,100.0,300.0`) and by a literal SVG arc `d` string
  (`a:M 100 0 A 100 100 ...`). This asymmetry is why:
  - Flip/nudge on curvature grids parses arc ids with a regex that doesn't
    match the renderer's own arc-id format, so arcs are silently deleted
    instead of transformed.
  - Changing rows/cols orphans existing strokes — they still render but are
    no longer addressable by any hit zone, so they can't be erased or
    extended.
  - Two independent geometry bugs (malformed br-arc hit zone, swapped
    swf=0 angles in `collectShapes`) both stemmed from arc geometry being
    encoded as a rendering string instead of a stable topological id.

  Fix: give strokes a topology-based id (analogous to fills — cell + edge,
  e.g. `s-r-2-3-diag`) and derive pixel/arc geometry from grid config at
  render time, the same way fills already work. Touches `js/geometry.js`,
  `js/renderer.js`, `main.js`, and `js/iconApp.js` simultaneously, and needs
  a migration path for existing saved `.tgf`/`.igf` files using the old
  format. Requires a design decision on the id scheme before implementation.

- [ ] **Extract a shared editor base class for Typegrid and IconGrid.**
  `js/iconApp.js` duplicates ~350 lines of `main.js` (pointer handling,
  flip/nudge transforms, path-finding, DOM-binding boilerplate) because the
  two were built in parallel rather than one being refactored to serve both.
  Concretely costly today: the arc-transform bug and the undo/redo feature
  both need to be implemented/fixed twice. Extract the generic drawing/
  transform/persistence plumbing into a shared base (e.g. `js/gridEditor.js`)
  that both `Typegrid` and `IconGrid` extend, leaving only char-set/word-preview/
  font-export vs. variant-list/usage-preview/SVG-PNG-export as the actual
  differences. Best done together with the stroke-identity fix above, since
  both touch the same transform methods.

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
- [ ] **Wire the undo/redo buttons in `main.js`** — `#undoBtn`/`#redoBtn` exist
  in `index.html` and `iconApp.js` has a history/redo stack, but `main.js`
  (Typegrid) has no matching wiring at all. Port the same history/undo/redo
  pattern once iconApp's version is fixed and finalized, plus `Ctrl+Z` / `Ctrl+Y`
  keyboard bindings in both apps.

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
