import { describe, it, expect } from 'vitest';
import { collectShapes, strokeRing, sampleArc } from './geometry.js';
import { mkLineId, mkArcId } from './strokeId.js';

/**
 * Regression tests for the arc/stroke geometry bugs that shipped twice
 * (malformed br-arc hit zone, swapped swf=0 start/end angles): both bugs
 * caused sampled arc points to land far outside the cell they belonged to,
 * which was invisible in the UI and only showed up in exported SVG/PNG.
 */

const CONFIG = {
    rows: 4,
    cols: 4,
    aspectRatio: 1,
    strokeWeight: 8,
    strokeCap: 'round'
};

// A single cell at (0,0) is 150x150 for this config (600 / 4).
const CELL = { x: 0, y: 0, sx: 150, sy: 150 };

function emptyGlyph(strokeIds) {
    return { fills: new Set(), strokes: new Set(strokeIds) };
}

function assertPointsWithinCell(shapes, cell, radius) {
    const margin = radius + 0.5; // stroke half-width + float tolerance
    for (const ring of shapes) {
        for (const [px, py] of ring) {
            expect(px).toBeGreaterThanOrEqual(cell.x - margin);
            expect(px).toBeLessThanOrEqual(cell.x + cell.sx + margin);
            expect(py).toBeGreaterThanOrEqual(cell.y - margin);
            expect(py).toBeLessThanOrEqual(cell.y + cell.sy + margin);
        }
    }
}

describe('sampleArc — quadrant arcs stay within their own corner-to-corner box', () => {
    // Each case is a quadrant arc between two opposite corners of a 100x100 cell.
    // A correct arc bulges only within the rectangle spanned by its own start/end
    // points; a wrong center (e.g. from a swapped cx/cy branch) bulges into the
    // neighboring cell instead, which is exactly what the two historical bugs did.
    const cases = [
        { x1: 100, y1: 0, x2: 0, y2: 100, swf: 1 },
        { x1: 0, y1: 0, x2: 100, y2: 100, swf: 0 },
        { x1: 0, y1: 0, x2: 100, y2: 100, swf: 1 },
        { x1: 100, y1: 0, x2: 0, y2: 100, swf: 0 },
    ];

    for (const { x1, y1, x2, y2, swf } of cases) {
        it(`x1=${x1} y1=${y1} x2=${x2} y2=${y2} swf=${swf}`, () => {
            const pts = sampleArc(x1, y1, 100, 100, swf, x2, y2, 12);

            // Arc must start and end at the declared endpoints.
            expect(pts[0][0]).toBeCloseTo(x1, 5);
            expect(pts[0][1]).toBeCloseTo(y1, 5);
            expect(pts[pts.length - 1][0]).toBeCloseTo(x2, 5);
            expect(pts[pts.length - 1][1]).toBeCloseTo(y2, 5);

            // Every sampled point must stay within the box spanned by the two
            // endpoints (i.e. within its own cell, not bulging into a neighbor).
            const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
            for (const [px, py] of pts) {
                expect(px).toBeGreaterThanOrEqual(minX - 0.01);
                expect(px).toBeLessThanOrEqual(maxX + 0.01);
                expect(py).toBeGreaterThanOrEqual(minY - 0.01);
                expect(py).toBeLessThanOrEqual(maxY + 0.01);
            }
        });
    }
});

describe('collectShapes — curvature quadrant arcs stay within their cell', () => {
    const { x, y, sx, sy } = CELL;
    const r = CONFIG.strokeWeight / 2;

    const arcCases = {
        'centred tl': mkArcId(0, 0, 'tl'),
        'centred tr': mkArcId(0, 0, 'tr'),
        'centred bl': mkArcId(0, 0, 'bl'),
        'centred br': mkArcId(0, 0, 'br'),
    };

    for (const [label, arcId] of Object.entries(arcCases)) {
        it(`${label} produces points within the cell bounding box`, () => {
            const glyph = emptyGlyph([arcId]);
            const shapes = collectShapes(glyph, CONFIG);
            expect(shapes.length).toBeGreaterThan(0);
            assertPointsWithinCell(shapes, CELL, r);
        });
    }

    it('all four quadrant arcs together stay within the cell', () => {
        const glyph = emptyGlyph(Object.values(arcCases));
        const shapes = collectShapes(glyph, CONFIG);
        assertPointsWithinCell(shapes, CELL, r);
    });
});

describe('collectShapes — straight strokes stay within their segment bounding box', () => {
    it('a horizontal stroke stays within its span plus stroke radius', () => {
        const r = CONFIG.strokeWeight / 2;
        const id = mkLineId('h', 0, 1); // spans x 0→150 at y=150
        const glyph = emptyGlyph([id]);
        const shapes = collectShapes(glyph, CONFIG);
        expect(shapes.length).toBeGreaterThan(0);
        for (const ring of shapes) {
            for (const [px, py] of ring) {
                expect(px).toBeGreaterThanOrEqual(0 - r - 0.5);
                expect(px).toBeLessThanOrEqual(150 + r + 0.5);
                expect(py).toBeGreaterThanOrEqual(150 - r - 0.5);
                expect(py).toBeLessThanOrEqual(150 + r + 0.5);
            }
        }
    });
});

describe('strokeRing', () => {
    it('returns a closed ring (first point equals last point)', () => {
        const ring = strokeRing(0, 0, 100, 0, 5, 'round', true, true);
        expect(ring[0][0]).toBeCloseTo(ring[ring.length - 1][0]);
        expect(ring[0][1]).toBeCloseTo(ring[ring.length - 1][1]);
    });

    it('every point stays within radius of the segment for a round cap', () => {
        const x1 = 0, y1 = 0, x2 = 100, y2 = 0, r = 10;
        const ring = strokeRing(x1, y1, x2, y2, r, 'round', true, true);
        for (const [px, py] of ring) {
            // Distance to the nearest point on the segment [x1,x2] at y=0
            const clampedX = Math.max(x1, Math.min(x2, px));
            const dist = Math.hypot(px - clampedX, py - y1);
            expect(dist).toBeLessThanOrEqual(r + 0.01);
        }
    });

    it('handles a degenerate (zero-length) segment as a circle', () => {
        const ring = strokeRing(50, 50, 50, 50, 10, 'round', true, true);
        for (const [px, py] of ring) {
            const dist = Math.hypot(px - 50, py - 50);
            expect(dist).toBeCloseTo(10, 1);
        }
    });
});

describe('collectShapes — grid type drives arc geometry', () => {
    it('resolves the same arc id differently as the grid is resized', () => {
        // The point of topological ids: the id is stable, the geometry follows
        // the current grid rather than being frozen at draw time.
        const glyph = emptyGlyph([mkArcId(1, 1, 'tl')]);
        const wide = collectShapes(glyph, { ...CONFIG, cols: 2 });
        const narrow = collectShapes(glyph, { ...CONFIG, cols: 8 });
        const maxX = rings => Math.max(...rings.flat().map(([px]) => px));
        expect(maxX(wide)).toBeGreaterThan(maxX(narrow));
    });

    it('ignores legacy pixel ids that survived without migration', () => {
        const glyph = emptyGlyph(['s:0,150,150,150']);
        expect(collectShapes(glyph, CONFIG)).toEqual([]);
    });
});
