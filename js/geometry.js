/**
 * Geometry utilities — shared shape builders + boolean union.
 * Used by both export.js (for clean font outlines) and topology.js (for preview).
 */
import polygonClipping from 'polygon-clipping';

const ARC_STEPS = 32; // segments per semicircle cap

export const quantize = v => Math.round(v * 10) / 10;

export function mkStrokeId(x1, y1, x2, y2) {
    return `s:${[x1, y1, x2, y2].map(v => quantize(Number(v)).toFixed(1)).join(',')}`;
}

/**
 * Build a rectangle polygon as a ring of [x,y] pairs (clockwise).
 */
export function rectRing(x, y, w, h) {
    return [
        [x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]
    ];
}

/**
 * Build a stadium-shaped polygon for a stroke segment with rounded caps.
 * Returns an array of [x,y] pairs forming a closed ring.
 */
export function strokeRing(x1, y1, x2, y2, radius, cap = 'round', startCap = true, endCap = true) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const pts = [];

    if (len < 0.01) {
        // Degenerate: circle or point
        for (let i = 0; i <= ARC_STEPS * 2; i++) {
            const a = (2 * Math.PI * i) / (ARC_STEPS * 2);
            pts.push([x1 + radius * Math.cos(a), y1 + radius * Math.sin(a)]);
        }
        pts.push(pts[0].slice());
        return pts;
    }

    const nx = dx / len, ny = dy / len;
    const px = -ny * radius, py = nx * radius;

    if (cap === 'square') {
        const sx = nx * radius, sy = ny * radius;
        // Construct as a simple loop to handle optional extensions
        const x1s = startCap ? x1 - sx : x1;
        const y1s = startCap ? y1 - sy : y1;
        const x2e = endCap ? x2 + sx : x2;
        const y2e = endCap ? y2 + sy : y2;

        pts.push([x1s + px, y1s + py]);
        pts.push([x2e + px, y2e + py]);
        pts.push([x2e - px, y2e - py]);
        pts.push([x1s - px, y1s - py]);

    } else if (cap === 'triangle') {
        const sx = nx * radius, sy = ny * radius;
        if (startCap) pts.push([x1 - sx, y1 - sy]);
        pts.push([x1 + px, y1 + py]);
        pts.push([x2 + px, y2 + py]);
        if (endCap) pts.push([x2 + sx, y2 + sy]);
        pts.push([x2 - px, y2 - py]);
        pts.push([x1 - px, y1 - py]);

    } else { // 'round'
        pts.push([x1 + px, y1 + py]);
        pts.push([x2 + px, y2 + py]);

        if (endCap) {
            const endAngle = Math.atan2(py, px);
            for (let i = 1; i < ARC_STEPS; i++) {
                const a = endAngle - (Math.PI * i) / ARC_STEPS;
                pts.push([x2 + radius * Math.cos(a), y2 + radius * Math.sin(a)]);
            }
        }

        pts.push([x2 - px, y2 - py]);
        pts.push([x1 - px, y1 - py]);

        if (startCap) {
            const startAngle = Math.atan2(-py, -px);
            for (let i = 1; i < ARC_STEPS; i++) {
                const a = startAngle - (Math.PI * i) / ARC_STEPS;
                pts.push([x1 + radius * Math.cos(a), y1 + radius * Math.sin(a)]);
            }
        }
    }

    // Close ring
    pts.push(pts[0].slice());
    return pts;
}


/**
 * Collect all shape polygons from a glyph's fills and strokes.
 * Returns an array of rings (each ring is [[x,y], ...]).
 * If `scale` is provided, coordinates are multiplied by it.
 * If `flipY` is provided (e.g. upm value), y is flipped: y → flipY - y.
 */
export function collectShapes(glyph, config, opts = {}) {
    const { scale = 1, flipY = null } = opts;
    const cw = (600 * config.aspectRatio) / config.cols;
    const rh = 600 / config.rows;
    const r = config.strokeWeight / 2;
    const shapes = [];

    // Define quantize locally to ensure consistent coordinate precision for node matching
    const quantize = v => Math.round(v * 10) / 10;

    const tx = (x, y) => {
        const sx = x * scale, sy = y * scale;
        return flipY != null ? [sx, flipY - sy] : [sx, sy];
    };

    glyph.fills.forEach(id => {
        if (id.startsWith('f-r-')) {
            const [i, j] = id.substring(4).split('-').map(Number);
            const x = i * cw, y = j * rh;
            shapes.push(rectRing(x, y, cw, rh).map(([px, py]) => tx(px, py)));
        } else if (id.startsWith('f-t-')) {
            const [i, j, side] = id.substring(4).split('-');
            const I = Number(i), J = Number(j);
            const cx = I * cw + cw / 2, cy = J * rh + rh / 2;
            const tl = [I * cw, J * rh], tr = [(I + 1) * cw, J * rh];
            const bl = [I * cw, (J + 1) * rh], br = [(I + 1) * cw, (J + 1) * rh], ct = [cx, cy];
            let pts;
            if (side === 't') pts = [tl, tr, ct];
            else if (side === 'r') pts = [tr, br, ct];
            else if (side === 'b') pts = [br, bl, ct];
            else if (side === 'l') pts = [bl, tl, ct];
            if (pts) shapes.push(pts.map(([px, py]) => tx(px, py)));
        } else if (id.startsWith('f-c-')) {
            const [i, j, pos] = id.substring(4).split('-');
            const I = Number(i), J = Number(j), s = cw;
            const x = I * cw, y = J * rh;
            const pts = [];
            const step = 5;
            const rad = a => a * Math.PI / 180;

            if (pos === 'tl') {
                // SVG: M(x,y) L(x+s,y) Arc to (x,y+s) — center at (x,y)
                pts.push([x, y]);
                for (let a = 0; a <= 90; a += step)
                    pts.push([x + s * Math.cos(rad(a)), y + s * Math.sin(rad(a))]);
            } else if (pos === 'tr') {
                // SVG: M(x+s,y) L(x,y) Arc to (x+s,y+s) — center at (x+s,y)
                pts.push([x + s, y]);
                for (let a = 180; a >= 90; a -= step)
                    pts.push([x + s + s * Math.cos(rad(a)), y + s * Math.sin(rad(a))]);
            } else if (pos === 'bl') {
                // SVG: M(x,y+s) L(x,y) Arc to (x+s,y+s) — center at (x,y+s)
                pts.push([x, y + s]);
                for (let a = 270; a <= 360; a += step)
                    pts.push([x + s * Math.cos(rad(a)), y + s + s * Math.sin(rad(a))]);
            } else if (pos === 'br') {
                // SVG: M(x+s,y+s) L(x+s,y) Arc to (x,y+s) — center at (x+s,y+s)
                pts.push([x + s, y + s]);
                for (let a = 270; a >= 180; a -= step)
                    pts.push([x + s + s * Math.cos(rad(a)), y + s + s * Math.sin(rad(a))]);
            }
            if (pts.length) shapes.push(pts.map(([px, py]) => tx(px, py)));
        } else if (id.startsWith('f-h-')) {
            const parts = id.substring(4).split('-');
            const i = Number(parts[0]), j = Number(parts[1]), type = parts[2];
            const dx = (j % 2) * 0.5 * cw;
            const dn = ((j + 1) % 2) * 0.5 * cw;
            let pts;
            if (type === 'd') {
                // Down triangle: P(i,j), P(i+1,j), and the point between them below
                const targetIdx = i + (j % 2);
                pts = [[i * cw + dx, j * rh], [(i + 1) * cw + dx, j * rh], [targetIdx * cw + dn, (j + 1) * rh]];
            } else {
                // Up triangle: Q(i,j+1), Q(i+1,j+1), and the point between them above
                const targetIdx = i + (j % 2 ? 0 : 1);
                pts = [[i * cw + dn, (j + 1) * rh], [(i + 1) * cw + dn, (j + 1) * rh], [targetIdx * cw + dx, j * rh]];
            }
            shapes.push(pts.map(([px, py]) => tx(px, py)));
        }
    });

    // 0. Shared Quantize for vertices
    const qV = pt => [Math.round(pt[0] * 100) / 100, Math.round(pt[1] * 100) / 100];

    // 1. Analyze Connectivity and Group into Paths
    const graph = new Map();
    const allIds = new Set(glyph.strokes);

    // Group segments into Paths to build cleaner polygons
    glyph.strokes.forEach(id => {
        let n1, n2, pts;
        if (id.startsWith('s:')) {
            const coords = id.substring(2).split(',').map(v => Number(v));
            n1 = `${coords[0].toFixed(1)},${coords[1].toFixed(1)}`;
            n2 = `${coords[2].toFixed(1)},${coords[3].toFixed(1)}`;
            pts = coords;
        } else if (id.startsWith('a:')) {
            // Arcs are handled separately or as paths later
            return;
        }
        if (n1 && n2) {
            const edge = { id, n1, n2, pts };
            if (!graph.has(n1)) graph.set(n1, []);
            if (!graph.has(n2)) graph.set(n2, []);
            graph.get(n1).push(edge);
            graph.get(n2).push(edge);
        }
    });

    // 2. Build stadium shapes for each segment
    glyph.strokes.forEach(id => {
        if (id.startsWith('s:')) {
            const coords = id.substring(2).split(',').map(v => Number(v));
            const n1 = `${coords[0].toFixed(1)},${coords[1].toFixed(1)}`;
            const n2 = `${coords[2].toFixed(1)},${coords[3].toFixed(1)}`;

            const isN1Terminal = (graph.get(n1) || []).length <= 1;
            const isN2Terminal = (graph.get(n2) || []).length <= 1;
            const cap = config.strokeCap || 'round';

            // Body
            shapes.push(strokeRing(coords[0], coords[1], coords[2], coords[3], r, 'round', false, false).map(p => tx(...p)).map(qV));

            // Junction/Terminal
            if (isN1Terminal) shapes.push(strokeRing(coords[0], coords[1], coords[2], coords[3], r, cap, true, false).map(p => tx(...p)).map(qV));
            else shapes.push(strokeRing(coords[0], coords[1], coords[2], coords[3], r, 'round', true, false).map(p => tx(...p)).map(qV));

            if (isN2Terminal) shapes.push(strokeRing(coords[0], coords[1], coords[2], coords[3], r, cap, false, true).map(p => tx(...p)).map(qV));
            else shapes.push(strokeRing(coords[0], coords[1], coords[2], coords[3], r, 'round', false, true).map(p => tx(...p)).map(qV));
        }
    });

    // Arcs
    glyph.strokes.forEach(id => {
        if (id.startsWith('a:')) {
            const d = id.substring(2);
            const m = d.match(/M\s*([\d.-]+)\s+([\d.-]+)\s+A\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([01])\s+([01])\s+([\d.-]+)\s+([\d.-]+)/);
            if (!m) return;
            const [_, x1, y1, rx, ry, rot, laf, swf, x2, y2] = m.map(Number);

            // Generate points along the arc for the body
            const pts = [];
            const steps = 12;

            // To find the center of a quadrant arc:
            // For swf=1 (CW) and 90 deg, the center is either (x1, y2) or (x2, y1).
            // We'll use a simpler approach: Sample the ellipse.
            // This is complex math for a generic arc, but for our grid quadrants:
            let cx, cy, startAng, endAng;
            if (swf === 1) {
                if (x1 < x2 && y1 < y2) { cx = x1; cy = y2; startAng = -Math.PI / 2; endAng = 0; }
                else if (x1 > x2 && y1 < y2) { cx = x2; cy = y1; startAng = 0; endAng = Math.PI / 2; }
                else if (x1 > x2 && y1 > y2) { cx = x1; cy = y2; startAng = Math.PI / 2; endAng = Math.PI; }
                else { cx = x2; cy = y1; startAng = Math.PI; endAng = 3 * Math.PI / 2; }
            } else {
                if (x1 < x2 && y1 < y2) { cx = x2; cy = y1; startAng = Math.PI; endAng = Math.PI / 2; }
                else if (x1 > x2 && y1 < y2) { cx = x1; cy = y2; startAng = -Math.PI / 2; endAng = -Math.PI; }
                else if (x1 > x2 && y1 > y2) { cx = x2; cy = y1; startAng = 0; endAng = -Math.PI / 2; }
                else { cx = x1; cy = y2; startAng = Math.PI / 2; endAng = 0; }
            }

            for (let i = 0; i <= steps; i++) {
                const a = startAng + (endAng - startAng) * (i / steps);
                pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
            }

            const n1 = `${x1.toFixed(1)},${y1.toFixed(1)}`;
            const n2 = `${x2.toFixed(1)},${y2.toFixed(1)}`;
            const isN1Terminal = (graph.get(n1) || []).length <= 1;
            const isN2Terminal = (graph.get(n2) || []).length <= 1;
            const cap = config.strokeCap || 'round';

            // Create segment bodies between sampled points
            for (let i = 0; i < pts.length - 1; i++) {
                // Main body piece
                shapes.push(strokeRing(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, 'round', false, false).map(p => tx(...p)).map(qV));

                // Add round joins at all internal sampling points to ensure a solid fused tube
                if (i > 0) {
                    shapes.push(strokeRing(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, 'round', true, false).map(p => tx(...p)).map(qV));
                }
            }

            // Terminal/Junction caps at the ends of the whole arc
            const s1 = pts[0], s2 = pts[1];
            const e1 = pts[pts.length - 2], e2 = pts[pts.length - 1];

            if (isN1Terminal) shapes.push(strokeRing(s1[0], s1[1], s2[0], s2[1], r, cap, true, false).map(p => tx(...p)).map(qV));
            else shapes.push(strokeRing(s1[0], s1[1], s2[0], s2[1], r, 'round', true, false).map(p => tx(...p)).map(qV));

            if (isN2Terminal) shapes.push(strokeRing(e1[0], e1[1], e2[0], e2[1], r, cap, false, true).map(p => tx(...p)).map(qV));
            else shapes.push(strokeRing(e1[0], e1[1], e2[0], e2[1], r, 'round', false, true).map(p => tx(...p)).map(qV));
        }
    });

    return shapes;
}

/**
 * Perform a boolean union on an array of polygon rings.
 * Returns the unioned result as a MultiPolygon:
 *   [ Polygon1, Polygon2, ... ]
 *   where each Polygon = [ outerRing, ...holeRings ]
 *   and each ring = [ [x,y], ... ]
 */
export function unionShapes(rings) {
    if (rings.length === 0) return [];
    if (rings.length === 1) return [[rings[0]]]; // single polygon, no holes

    // polygon-clipping expects MultiPolygon format: [[[ring], ...], ...]
    // Each input is a single polygon with one ring (no holes)
    const polygons = rings.map(ring => [ring]);

    try {
        return polygonClipping.union(...polygons);
    } catch (e) {
        console.warn('Boolean union failed, falling back to raw shapes:', e);
        return polygons; // fallback: return un-merged
    }
}
