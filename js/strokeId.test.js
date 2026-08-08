import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    mkLineId, mkArcId, parseStrokeId, inBounds, strokeGeom, strokeNodes,
    flipStrokeId, nudgeStrokeId, migrateStrokeId, migrateGlyphs, gridDims,
    gridStrokeIds as allIds
} from './strokeId.js';

const RECT = { rows: 6, cols: 4, aspectRatio: 0.66, gridType: 'triangle' };
const SQUARE = { rows: 4, cols: 4, aspectRatio: 1, gridType: 'curvature' };
const HEX_EVEN = { rows: 6, cols: 5, aspectRatio: 1, gridType: 'hexagonal' };

describe('parseStrokeId', () => {
    it('round-trips line and arc ids', () => {
        expect(parseStrokeId('s-h-2-3')).toEqual({ kind: 'h', i: 2, j: 3, corner: null });
        expect(parseStrokeId('s-xr-0-1')).toEqual({ kind: 'xr', i: 0, j: 1, corner: null });
        expect(parseStrokeId('s-c-1-4-br')).toEqual({ kind: 'c', i: 1, j: 4, corner: 'br' });
    });

    it('rejects malformed, legacy and unknown ids', () => {
        ['s:0,0,99,0', 'a:M 0 0 A 1 1 0 0 1 1 1', 's-q-1-1', 's-h-1', 's-h-1-2-3',
            's-c-1-1-xx', 's-h-x-1', 's-h--1-2', 'f-r-1-1', '', null].forEach(id => {
                expect(parseStrokeId(id)).toBeNull();
            });
    });
});

describe('strokeGeom', () => {
    it('places rect-grid edges on the expected pixel coordinates', () => {
        const { cw, rh } = gridDims(RECT); // 99 x 100
        expect(strokeGeom('s-h-1-0', RECT)).toEqual({ type: 'line', p1: [cw, 0], p2: [2 * cw, 0] });
        expect(strokeGeom('s-v-4-1', RECT)).toEqual({ type: 'line', p1: [4 * cw, rh], p2: [4 * cw, 2 * rh] });
        expect(strokeGeom('s-d-3-0', RECT)).toEqual({ type: 'line', p1: [3 * cw, 0], p2: [4 * cw, rh] });
        expect(strokeGeom('s-a-0-0', RECT)).toEqual({ type: 'line', p1: [cw, 0], p2: [0, rh] });
    });

    it('centres each curvature quadrant arc on its named corner', () => {
        const { cw, rh } = gridDims(SQUARE);
        const at = corner => strokeGeom(mkArcId(0, 0, corner), SQUARE);
        expect(at('tl')).toMatchObject({ cx: 0, cy: 0, swf: 1 });
        expect(at('tr')).toMatchObject({ cx: cw, cy: 0, swf: 0 });
        expect(at('bl')).toMatchObject({ cx: 0, cy: rh, swf: 1 });
        expect(at('br')).toMatchObject({ cx: cw, cy: rh, swf: 0 });
    });

    it('keeps every arc within its own cell', () => {
        const { cw, rh } = gridDims(SQUARE);
        for (const id of allIds(SQUARE)) {
            const g = strokeGeom(id, SQUARE);
            const { i, j } = parseStrokeId(id);
            for (const [x, y] of [g.p1, g.p2]) {
                expect(x).toBeGreaterThanOrEqual(i * cw - 0.01);
                expect(x).toBeLessThanOrEqual((i + 1) * cw + 0.01);
                expect(y).toBeGreaterThanOrEqual(j * rh - 0.01);
                expect(y).toBeLessThanOrEqual((j + 1) * rh + 0.01);
            }
        }
    });

    it('offsets alternating hexagonal rows by half a cell', () => {
        const { cw } = gridDims(HEX_EVEN);
        expect(strokeGeom('s-xh-0-0', HEX_EVEN).p1[0]).toBe(0);
        expect(strokeGeom('s-xh-0-1', HEX_EVEN).p1[0]).toBe(0.5 * cw);
    });

    it('gives connected edges a shared node key', () => {
        // s-h-1-0 ends where s-h-2-0 begins.
        expect(strokeNodes('s-h-1-0', RECT)[1]).toBe(strokeNodes('s-h-2-0', RECT)[0]);
    });
});

describe('flipStrokeId', () => {
    // Rectangular grids are symmetric, so every edge has a mirrored counterpart.
    for (const [label, config] of Object.entries({ RECT, SQUARE })) {
        for (const axis of ['H', 'V']) {
            it(`${label} / flip ${axis} is a total involution`, () => {
                for (const id of allIds(config)) {
                    const once = flipStrokeId(id, axis, config);
                    expect(once, `${id} flipped to null`).not.toBeNull();
                    expect(inBounds(once, config), `${id} → ${once} out of bounds`).toBe(true);
                    expect(flipStrokeId(once, axis, config)).toBe(id);
                }
            });
        }
    }

    // Hexagonal rows overhang half a cell on alternating sides, so edges at that
    // boundary have no mirrored counterpart and are dropped rather than orphaned.
    for (const axis of ['H', 'V']) {
        it(`HEX / flip ${axis} never yields an unaddressable id`, () => {
            let survived = 0;
            for (const id of allIds(HEX_EVEN)) {
                const once = flipStrokeId(id, axis, HEX_EVEN);
                if (once === null) continue;
                survived++;
                expect(inBounds(once, HEX_EVEN), `${id} → ${once} out of bounds`).toBe(true);
                expect(flipStrokeId(once, axis, HEX_EVEN)).toBe(id);
            }
            // The overwhelming majority must survive; only the boundary drops out.
            expect(survived).toBeGreaterThan(allIds(HEX_EVEN).length * 0.8);
        });
    }

    it('mirrors geometry, not just the label (flip H)', () => {
        const { W } = gridDims(RECT);
        for (const id of allIds(RECT)) {
            const before = strokeGeom(id, RECT);
            const after = strokeGeom(flipStrokeId(id, 'H', RECT), RECT);
            const xs = g => [g.p1[0], g.p2[0]].sort((a, b) => a - b);
            const ys = g => [g.p1[1], g.p2[1]].sort((a, b) => a - b);
            expect(xs(after)).toEqual(xs(before).map(x => W - x).sort((a, b) => a - b));
            expect(ys(after)).toEqual(ys(before));
        }
    });

    it('mirrors geometry, not just the label (flip V)', () => {
        const { H } = gridDims(RECT);
        for (const id of allIds(RECT)) {
            const before = strokeGeom(id, RECT);
            const after = strokeGeom(flipStrokeId(id, 'V', RECT), RECT);
            const xs = g => [g.p1[0], g.p2[0]].sort((a, b) => a - b);
            const ys = g => [g.p1[1], g.p2[1]].sort((a, b) => a - b);
            expect(ys(after)).toEqual(ys(before).map(y => H - y).sort((a, b) => a - b));
            expect(xs(after)).toEqual(xs(before));
        }
    });

    it('swaps the two triangle diagonals', () => {
        expect(flipStrokeId('s-d-0-0', 'H', RECT)).toBe('s-a-3-0');
        expect(flipStrokeId('s-d-0-0', 'V', RECT)).toBe('s-a-0-5');
    });

    it('drops hexagonal vertical flips on an odd row count instead of corrupting them', () => {
        // Odd `rows` moves mirrored nodes half a cell off-grid — see strokeId.js.
        const odd = { ...HEX_EVEN, rows: 5 };
        expect(flipStrokeId('s-xh-1-0', 'V', odd)).toBeNull();
        expect(flipStrokeId('s-xh-1-0', 'H', odd)).not.toBeNull();
    });
});

describe('nudgeStrokeId', () => {
    it('moves a stroke by exactly one cell', () => {
        const { cw, rh } = gridDims(RECT);
        const before = strokeGeom('s-h-1-1', RECT);
        const after = strokeGeom(nudgeStrokeId('s-h-1-1', 1, 0, RECT), RECT);
        expect(after.p1).toEqual([before.p1[0] + cw, before.p1[1]]);
        const down = strokeGeom(nudgeStrokeId('s-h-1-1', 0, 1, RECT), RECT);
        expect(down.p1).toEqual([before.p1[0], before.p1[1] + rh]);
    });

    it('returns null rather than an unreachable orphan when pushed off-grid', () => {
        expect(nudgeStrokeId('s-h-0-0', -1, 0, RECT)).toBeNull();
        expect(nudgeStrokeId(`s-h-${RECT.cols - 1}-0`, 1, 0, RECT)).toBeNull();
        expect(nudgeStrokeId('s-c-0-0-tl', -1, 0, SQUARE)).toBeNull();
    });

    it('is reversible while it stays on the grid', () => {
        for (const id of allIds(RECT)) {
            const moved = nudgeStrokeId(id, 1, 1, RECT);
            if (moved) expect(nudgeStrokeId(moved, -1, -1, RECT)).toBe(id);
        }
    });
});

describe('legacy migration', () => {
    /** Encode geometry the way the old code did, so we can migrate it back. */
    const legacyLine = g => `s:${[g.p1[0], g.p1[1], g.p2[0], g.p2[1]].map(v => v.toFixed(1)).join(',')}`;
    const legacyArc = g => `a:M ${g.p1[0]} ${g.p1[1]} A ${g.rx} ${g.ry} 0 0 ${g.swf} ${g.p2[0]} ${g.p2[1]}`;

    for (const [label, config] of Object.entries({ RECT, SQUARE, 'HEX (even rows)': HEX_EVEN })) {
        it(`${label}: every legacy id round-trips back to its topological id`, () => {
            for (const id of allIds(config)) {
                const g = strokeGeom(id, config);
                const legacy = g.type === 'arc' ? legacyArc(g) : legacyLine(g);
                expect(migrateStrokeId(legacy, config), `${legacy} → ?`).toBe(id);
            }
        });
    }

    it('accepts the compact arc form the old flip/nudge code wrote back', () => {
        // `M99.0 0.0 A99.0 100.0 ...` — no space after M/A. The old flip regex only
        // matched this form, while the renderer only ever emitted the spaced form,
        // which is why arcs were silently dropped on flip.
        const g = strokeGeom('s-c-0-0-tl', SQUARE);
        const compact = `a:M${g.p1[0].toFixed(1)} ${g.p1[1].toFixed(1)} A${g.rx.toFixed(1)} ${g.ry.toFixed(1)} 0 0 ${g.swf} ${g.p2[0].toFixed(1)} ${g.p2[1].toFixed(1)}`;
        expect(migrateStrokeId(compact, SQUARE)).toBe('s-c-0-0-tl');
    });

    it('reads endpoints in either order', () => {
        expect(migrateStrokeId('s:99.0,0.0,0.0,0.0', RECT)).toBe('s-h-0-0');
        expect(migrateStrokeId('s:0.0,0.0,99.0,0.0', RECT)).toBe('s-h-0-0');
    });

    it('returns null for coordinates that are not on the grid', () => {
        expect(migrateStrokeId('s:12.3,45.6,78.9,10.1', RECT)).toBeNull();
        expect(migrateStrokeId('s:0,0,99', RECT)).toBeNull();
        expect(migrateStrokeId('not-a-stroke', RECT)).toBeNull();
    });

    it('passes already-migrated ids through untouched', () => {
        expect(migrateStrokeId('s-h-1-0', RECT)).toBe('s-h-1-0');
    });

    it('converts the bundled vectoroid.tgf without losing a single stroke', () => {
        const data = JSON.parse(readFileSync(new URL('../vectoroid.tgf', import.meta.url), 'utf8'));
        const total = Object.values(data.glyphs).reduce((n, g) => n + (g.strokes || []).length, 0);
        expect(total).toBeGreaterThan(1000); // guard against silently reading an empty file

        const { glyphs, converted, dropped } = migrateGlyphs(data.glyphs, data.config);
        expect(dropped).toBe(0);
        expect(converted).toBe(total);

        // And the migrated ids must resolve to the very same pixel geometry.
        Object.entries(data.glyphs).forEach(([ch, g]) => {
            const before = (g.strokes || []).map(id => id.substring(2).split(',').map(Number));
            const after = [...glyphs[ch].strokes].map(id => {
                const geom = strokeGeom(id, data.config);
                return [geom.p1[0], geom.p1[1], geom.p2[0], geom.p2[1]];
            });
            const norm = s => s.map(([a, b, c, d]) =>
                (a < c || (a === c && b <= d)) ? `${a},${b},${c},${d}` : `${c},${d},${a},${b}`).sort();
            expect(norm(after)).toEqual(norm(before));
        });
    });
});
