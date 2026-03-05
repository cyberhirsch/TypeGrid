/**
 * Geometry utilities — shared shape builders + boolean union.
 * Used by both export.js (for clean font outlines) and topology.js (for preview).
 */
import polygonClipping from 'polygon-clipping';

const ARC_STEPS = 12; // segments per semicircle cap

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
export function strokeRing(x1, y1, x2, y2, radius) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const pts = [];

    if (len < 0.01) {
        // Degenerate: circle
        for (let i = 0; i <= ARC_STEPS * 2; i++) {
            const a = (2 * Math.PI * i) / (ARC_STEPS * 2);
            pts.push([x1 + radius * Math.cos(a), y1 + radius * Math.sin(a)]);
        }
        pts.push(pts[0].slice()); // close
        return pts;
    }

    const nx = dx / len, ny = dy / len;
    const px = -ny * radius, py = nx * radius;

    // Left side: start → end
    pts.push([x1 + px, y1 + py]);
    pts.push([x2 + px, y2 + py]);

    // End cap (semicircle around x2, y2): from left-side to right-side
    const endAngle = Math.atan2(py, px);
    for (let i = 1; i < ARC_STEPS; i++) {
        const a = endAngle - (Math.PI * i) / ARC_STEPS;
        pts.push([x2 + radius * Math.cos(a), y2 + radius * Math.sin(a)]);
    }

    // Right side: end → start
    pts.push([x2 - px, y2 - py]);
    pts.push([x1 - px, y1 - py]);

    // Start cap (semicircle around x1, y1): from right-side to left-side
    const startAngle = Math.atan2(-py, -px);
    for (let i = 1; i < ARC_STEPS; i++) {
        const a = startAngle - (Math.PI * i) / ARC_STEPS;
        pts.push([x1 + radius * Math.cos(a), y1 + radius * Math.sin(a)]);
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

    const tx = (x, y) => {
        const sx = x * scale, sy = y * scale;
        return flipY != null ? [sx, flipY - sy] : [sx, sy];
    };

    glyph.fills.forEach(id => {
        if (id.startsWith('f-r-')) {
            const [i, j] = id.substring(4).split('-').map(Number);
            const x = i * cw, y = j * rh;
            shapes.push(
                rectRing(x, y, cw, rh).map(([px, py]) => tx(px, py))
            );
        }
    });

    glyph.strokes.forEach(id => {
        if (id.startsWith('s:')) {
            const [x1, y1, x2, y2] = id.substring(2).split(',').map(Number);
            shapes.push(
                strokeRing(x1, y1, x2, y2, r).map(([px, py]) => tx(px, py))
            );
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
