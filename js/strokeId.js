/**
 * Topological stroke identity.
 *
 * Fills have always been addressed by grid topology (`f-t-1-4-t` — cell + part),
 * so they survive a grid resize and can be flipped/nudged by integer arithmetic.
 * Strokes were not: they were keyed by absolute pixel coordinates
 * (`s:0.0,200.0,100.0,300.0`) and, for curvature arcs, by a literal SVG path
 * string (`a:M 100 0 A 100 100 0 0 1 0 100`). That asymmetry caused three bugs:
 *
 *   1. Flip/nudge parsed arc ids with a regex (`/M([\d.-]+)\s+.../`) that does not
 *      match the renderer's own emitted format (`M 100 0 A ...`, with spaces after
 *      M and A), so every arc silently failed to match and was dropped.
 *   2. Changing rows/cols left old pixel-keyed strokes rendering but unaddressable
 *      by any hit zone — impossible to erase or extend.
 *   3. Arc geometry encoded as a rendering string meant geometry bugs (a malformed
 *      br-arc endpoint, swapped swf=0 angles) were invisible until export.
 *
 * This module makes strokes topological too. Pixel geometry is derived from the
 * grid config at render time, exactly the way fills already work.
 *
 * ── ID SCHEME ────────────────────────────────────────────────────────────────
 *   s-h-{i}-{j}            horizontal edge, node (i,j) → (i+1,j)     [rect grids]
 *   s-v-{i}-{j}            vertical edge,   node (i,j) → (i,j+1)     [rect grids]
 *   s-d-{i}-{j}            main diagonal    TL→BR of cell (i,j)      [triangle]
 *   s-a-{i}-{j}            anti-diagonal    TR→BL of cell (i,j)      [triangle]
 *   s-c-{i}-{j}-{corner}   quadrant arc in cell (i,j), centered on   [curvature]
 *                          corner ∈ tl|tr|bl|br
 *   s-xh-{i}-{j}           horizontal edge                           [hexagonal]
 *   s-xl-{i}-{j}           down-left diagonal from node (i,j)        [hexagonal]
 *   s-xr-{i}-{j}           down-right diagonal from node (i,j)       [hexagonal]
 *
 * All indices are non-negative integers, so `-` is safe as a separator.
 */

const LINE_KINDS = ['h', 'v', 'd', 'a', 'xh', 'xl', 'xr'];
const CORNERS = ['tl', 'tr', 'bl', 'br'];

/** Logical drawing surface — 600px tall, width follows the aspect ratio. */
export function gridDims(config) {
    const H = 600;
    const W = H * config.aspectRatio;
    return { W, H, cw: W / config.cols, rh: H / config.rows };
}

export function mkLineId(kind, i, j) {
    return `s-${kind}-${i}-${j}`;
}

export function mkArcId(i, j, corner) {
    return `s-c-${i}-${j}-${corner}`;
}

export function isStrokeId(id) {
    return typeof id === 'string' && id.startsWith('s-');
}

/** True for the old pixel-coordinate / SVG-path formats. */
export function isLegacyStrokeId(id) {
    return typeof id === 'string' && (id.startsWith('s:') || id.startsWith('a:'));
}

export function parseStrokeId(id) {
    if (!isStrokeId(id)) return null;
    const parts = id.split('-');
    const kind = parts[1];
    const i = Number(parts[2]);
    const j = Number(parts[3]);
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0) return null;

    if (kind === 'c') {
        const corner = parts[4];
        if (parts.length !== 5 || !CORNERS.includes(corner)) return null;
        return { kind, i, j, corner };
    }
    if (parts.length !== 4 || !LINE_KINDS.includes(kind)) return null;
    return { kind, i, j, corner: null };
}

/**
 * Is this id addressable on the current grid? Out-of-range ids are dropped by
 * the transforms rather than kept as unreachable orphans.
 */
export function inBounds(id, config) {
    const p = parseStrokeId(id);
    if (!p) return false;
    const { cols, rows } = config;
    const { kind, i, j } = p;
    switch (kind) {
        case 'h': case 'xh': return i >= 0 && i < cols && j >= 0 && j <= rows;
        case 'v': return i >= 0 && i <= cols && j >= 0 && j < rows;
        case 'd': case 'a': case 'c': return i >= 0 && i < cols && j >= 0 && j < rows;
        case 'xl': case 'xr': return i >= 0 && i <= cols && j >= 0 && j < rows;
        default: return false;
    }
}

/**
 * Resolve an id to concrete pixel geometry for the given grid config.
 * Lines return {type:'line', p1, p2}; arcs additionally carry the ellipse radii,
 * sweep flag and centre so renderer and exporter agree on the same curve.
 */
export function strokeGeom(id, config) {
    const p = parseStrokeId(id);
    if (!p) return null;
    const { cw, rh } = gridDims(config);
    const { kind, i, j, corner } = p;
    const line = (x1, y1, x2, y2) => ({ type: 'line', p1: [x1, y1], p2: [x2, y2] });

    switch (kind) {
        case 'h': return line(i * cw, j * rh, (i + 1) * cw, j * rh);
        case 'v': return line(i * cw, j * rh, i * cw, (j + 1) * rh);
        case 'd': return line(i * cw, j * rh, (i + 1) * cw, (j + 1) * rh);
        case 'a': return line((i + 1) * cw, j * rh, i * cw, (j + 1) * rh);
        case 'c': {
            const x = i * cw, y = j * rh, sx = cw, sy = rh;
            // Each quadrant arc is a quarter ellipse centred on one cell corner.
            const spec = {
                tl: { p1: [x + sx, y], p2: [x, y + sy], swf: 1, c: [x, y] },
                tr: { p1: [x, y], p2: [x + sx, y + sy], swf: 0, c: [x + sx, y] },
                bl: { p1: [x, y], p2: [x + sx, y + sy], swf: 1, c: [x, y + sy] },
                br: { p1: [x + sx, y], p2: [x, y + sy], swf: 0, c: [x + sx, y + sy] }
            }[corner];
            return {
                type: 'arc', p1: spec.p1, p2: spec.p2,
                rx: sx, ry: sy, rot: 0, laf: 0, swf: spec.swf,
                cx: spec.c[0], cy: spec.c[1]
            };
        }
        default: {
            // Hexagonal: odd rows are offset half a cell, so each row's nodes and
            // the row below it use different x offsets.
            const dx = (j % 2) * 0.5 * cw;
            const dn = ((j + 1) % 2) * 0.5 * cw;
            const x = i * cw + dx, y = j * rh;
            if (kind === 'xh') return line(x, y, (i + 1) * cw + dx, y);
            if (kind === 'xl') return line(x, y, (i - (j % 2 ? 0 : 1)) * cw + dn, (j + 1) * rh);
            if (kind === 'xr') return line(x, y, (i + (j % 2 ? 1 : 0)) * cw + dn, (j + 1) * rh);
            return null;
        }
    }
}

/** SVG path data for an arc geometry, used for both hit zones and rendering. */
export function arcPathD(geom) {
    const { p1, p2, rx, ry, rot, laf, swf } = geom;
    return `M ${p1[0]} ${p1[1]} A ${rx} ${ry} ${rot} ${laf} ${swf} ${p2[0]} ${p2[1]}`;
}

/**
 * Every stroke id addressable on this grid, in hit-zone draw order.
 * Single source of truth: the renderer draws exactly these, so an id that
 * survives a transform is guaranteed to have a hit zone.
 */
export function gridStrokeIds(config) {
    const { cols, rows, gridType } = config;
    const ids = [];

    if (gridType === 'hexagonal') {
        for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
            if (i < cols) ids.push(mkLineId('xh', i, j));
            if (j < rows) { ids.push(mkLineId('xl', i, j)); ids.push(mkLineId('xr', i, j)); }
        }
        return ids;
    }

    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
        if (i < cols) ids.push(mkLineId('h', i, j));
        if (j < rows) ids.push(mkLineId('v', i, j));
        if (gridType === 'triangle' && i < cols && j < rows) {
            ids.push(mkLineId('d', i, j));
            ids.push(mkLineId('a', i, j));
        }
        if (gridType === 'curvature' && i < cols && j < rows) {
            for (const c of CORNERS) ids.push(mkArcId(i, j, c));
        }
    }
    return ids;
}

/** Endpoint keys used to build the connectivity graph for path-finding. */
export function strokeNodes(id, config) {
    const g = strokeGeom(id, config);
    if (!g) return null;
    const key = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
    return [key(g.p1), key(g.p2)];
}

const MIRROR_H = { tl: 'tr', tr: 'tl', bl: 'br', br: 'bl' };
const MIRROR_V = { tl: 'bl', bl: 'tl', tr: 'br', br: 'tr' };

/**
 * Mirror a stroke across the glyph's horizontal or vertical centre line.
 *
 * Returns null when the mirrored edge does not land on an addressable grid node.
 * Rectangular grids are symmetric, so nothing is ever dropped there. Hexagonal
 * grids are not: alternating rows are offset half a cell, so rows overhang on one
 * side and fall short on the other, and edges near that boundary have no mirrored
 * counterpart. Dropping them keeps the invariant that every stored id is
 * addressable by a hit zone — the alternative is the orphaned-stroke bug this
 * module exists to remove.
 */
export function flipStrokeId(id, axis, config) {
    const flipped = flipStrokeIdRaw(id, axis, config);
    return flipped && inBounds(flipped, config) ? flipped : null;
}

function flipStrokeIdRaw(id, axis, config) {
    const p = parseStrokeId(id);
    if (!p) return null;
    const { cols, rows } = config;
    const { kind, i, j, corner } = p;

    if (axis === 'H') {
        switch (kind) {
            // A horizontal edge spans [i, i+1], so its mirrored span starts at cols-1-i.
            case 'h': return mkLineId('h', cols - 1 - i, j);
            // A vertical edge sits *on* column line i, which mirrors to cols-i.
            case 'v': return mkLineId('v', cols - i, j);
            // Mirroring a cell turns its main diagonal into the anti-diagonal.
            case 'd': return mkLineId('a', cols - 1 - i, j);
            case 'a': return mkLineId('d', cols - 1 - i, j);
            case 'c': return mkArcId(cols - 1 - i, j, MIRROR_H[corner]);
            case 'xh': return mkLineId('xh', cols - 1 - i - (j % 2), j);
            case 'xl': return mkLineId('xr', cols - i - (j % 2), j);
            case 'xr': return mkLineId('xl', cols - i - (j % 2), j);
            default: return null;
        }
    }

    switch (kind) {
        case 'h': return mkLineId('h', i, rows - j);
        case 'v': return mkLineId('v', i, rows - 1 - j);
        case 'd': return mkLineId('a', i, rows - 1 - j);
        case 'a': return mkLineId('d', i, rows - 1 - j);
        case 'c': return mkArcId(i, rows - 1 - j, MIRROR_V[corner]);
        // Hexagonal rows alternate their half-cell offset. Mirroring vertically
        // maps row j to row rows-j, which only preserves that parity — and so only
        // lands on real nodes — when `rows` is even. With an odd row count the
        // mirrored node falls half a cell off-grid and the stroke is dropped.
        case 'xh': return rows % 2 === 0 ? mkLineId('xh', i, rows - j) : null;
        case 'xl': return rows % 2 === 0 ? mkLineId('xr', i - (j % 2 ? 0 : 1), rows - j - 1) : null;
        case 'xr': return rows % 2 === 0 ? mkLineId('xl', i + (j % 2 ? 1 : 0), rows - j - 1) : null;
        default: return null;
    }
}

/** Shift a stroke by whole cells. Returns null if it would leave the grid. */
export function nudgeStrokeId(id, dx, dy, config) {
    const p = parseStrokeId(id);
    if (!p) return null;
    const { kind, i, j, corner } = p;
    const ni = i + dx, nj = j + dy;
    if (ni < 0 || nj < 0) return null;
    const moved = kind === 'c' ? mkArcId(ni, nj, corner) : mkLineId(kind, ni, nj);
    return inBounds(moved, config) ? moved : null;
}

/* ── LEGACY MIGRATION ─────────────────────────────────────────────────────────
 * Saved .tgf/.igf projects (including the bundled vectoroid.tgf) store the old
 * pixel-keyed ids. They are converted on load using the config they were saved
 * with, so existing work keeps rendering identically.
 */

const NEAR = (a, b) => Math.abs(a - b) < 0.35;

function toIndex(v, step) {
    const n = v / step;
    const r = Math.round(n);
    return NEAR(n, r) ? r : null;
}

function migrateLine(x1, y1, x2, y2, config) {
    const { cw, rh } = gridDims(config);
    const hex = config.gridType === 'hexagonal';

    if (!hex) {
        let i1 = toIndex(x1, cw), j1 = toIndex(y1, rh);
        let i2 = toIndex(x2, cw), j2 = toIndex(y2, rh);
        if (i1 == null || j1 == null || i2 == null || j2 == null) return null;
        // Normalise direction: always describe the edge top-to-bottom, left-to-right.
        if (j2 < j1 || (j1 === j2 && i2 < i1)) { [i1, i2] = [i2, i1];[j1, j2] = [j2, j1]; }

        if (j1 === j2 && i2 === i1 + 1) return mkLineId('h', i1, j1);
        if (i1 === i2 && j2 === j1 + 1) return mkLineId('v', i1, j1);
        if (i2 === i1 + 1 && j2 === j1 + 1) return mkLineId('d', i1, j1);
        if (i2 === i1 - 1 && j2 === j1 + 1) return mkLineId('a', i2, j1);
        return null;
    }

    // Hexagonal: recover the node index by removing the row's half-cell offset.
    const rowIndex = y => toIndex(y, rh);
    const nodeIndex = (x, j) => toIndex(x - (j % 2) * 0.5 * cw, cw);
    let j1 = rowIndex(y1), j2 = rowIndex(y2);
    if (j1 == null || j2 == null) return null;
    if (j2 < j1) { [x1, x2] = [x2, x1];[y1, y2] = [y2, y1];[j1, j2] = [j2, j1]; }
    const i1 = nodeIndex(x1, j1), i2 = nodeIndex(x2, j2);
    if (i1 == null || i2 == null) return null;

    if (j1 === j2) {
        const lo = Math.min(i1, i2);
        return Math.abs(i2 - i1) === 1 ? mkLineId('xh', lo, j1) : null;
    }
    if (j2 !== j1 + 1) return null;
    if (i2 === i1 - (j1 % 2 ? 0 : 1)) return mkLineId('xl', i1, j1);
    if (i2 === i1 + (j1 % 2 ? 1 : 0)) return mkLineId('xr', i1, j1);
    return null;
}

// Matches both the renderer's spaced form (`M 99 0 A 99 100 0 0 1 0 100`) and the
// compact form the old flip/nudge code wrote back (`M99.0 0.0 A99.0 100.0 ...`).
const ARC_RE = /M\s*([\d.-]+)\s+([\d.-]+)\s+A\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([01])\s+([01])\s+([\d.-]+)\s+([\d.-]+)/;

function migrateArc(d, config) {
    const m = d.match(ARC_RE);
    if (!m) return null;
    const [, x1, y1, , , , , swf, x2, y2] = m.map(Number);
    const { cw, rh } = gridDims(config);
    const i = toIndex(Math.min(x1, x2), cw);
    const j = toIndex(Math.min(y1, y2), rh);
    if (i == null || j == null) return null;

    // Identify the quadrant by which corner the quarter ellipse is centred on.
    const leftToRight = x1 < x2;
    let corner;
    if (swf === 1) corner = leftToRight ? 'bl' : 'tl';
    else corner = leftToRight ? 'tr' : 'br';
    return mkArcId(i, j, corner);
}

/** Convert one legacy id, or return null if it cannot be placed on the grid. */
export function migrateStrokeId(id, config) {
    if (isStrokeId(id)) return id;
    if (typeof id !== 'string') return null;
    if (id.startsWith('s:')) {
        const c = id.substring(2).split(',').map(Number);
        if (c.length !== 4 || c.some(v => !Number.isFinite(v))) return null;
        return migrateLine(c[0], c[1], c[2], c[3], config);
    }
    if (id.startsWith('a:')) return migrateArc(id.substring(2), config);
    return null;
}

/**
 * Migrate a whole glyph map in place-safe fashion. Returns the converted map
 * plus a count of ids that could not be placed, so callers can warn instead of
 * losing work silently.
 */
export function migrateGlyphs(glyphs, config) {
    let converted = 0, dropped = 0;
    const out = {};
    Object.entries(glyphs || {}).forEach(([key, g]) => {
        const strokes = new Set();
        (g.strokes instanceof Set ? [...g.strokes] : (g.strokes || [])).forEach(id => {
            if (isStrokeId(id)) { strokes.add(id); return; }
            const next = migrateStrokeId(id, config);
            if (next) { strokes.add(next); converted++; }
            else dropped++;
        });
        out[key] = {
            fills: g.fills instanceof Set ? g.fills : new Set(g.fills || []),
            strokes
        };
    });
    return { glyphs: out, converted, dropped };
}
