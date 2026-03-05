/**
 * Vector topology overlay — draws the boolean-unioned merged contour
 * of all fills and strokes as clean outlines with vertex dots.
 *
 * Cyan outlines, green vertices.
 */
import { NS } from './primitives.js';
import { collectShapes, unionShapes } from './geometry.js';

function mkEl(svg, tag) {
    const el = document.createElementNS(NS, tag);
    el.style.pointerEvents = 'none';
    svg.appendChild(el);
    return el;
}

export function drawTopoOverlay(app, svg, W, H) {
    const { config } = app;
    const g = app.glyph();

    // Collect shapes in screen space (no scaling, no Y-flip)
    const rings = collectShapes(g, config);
    if (rings.length === 0) return;

    // Perform boolean union
    const merged = unionShapes(rings);

    // Draw each merged polygon
    const allVertices = [];

    merged.forEach(polygon => {
        polygon.forEach((ring, ringIndex) => {
            if (ring.length < 3) return;

            // Build SVG path
            const d = ring.map((p, i) =>
                `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`
            ).join(' ') + ' Z';

            const path = mkEl(svg, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', ringIndex === 0 ? 'rgba(0,229,204,0.04)' : 'rgba(0,0,0,0.8)'); // holes get dark fill
            path.setAttribute('stroke', '#00e5cc');
            path.setAttribute('stroke-width', '1');
            path.setAttribute('stroke-linejoin', 'round');

            // Collect vertices from ring
            ring.forEach(p => allVertices.push(p));
        });
    });

    // Draw vertex dots (green), deduplicated
    const seen = new Set();
    allVertices.forEach(([x, y]) => {
        const key = `${Math.round(x * 10)},${Math.round(y * 10)}`; // sub-pixel dedup
        if (seen.has(key)) return;
        seen.add(key);

        const bg = mkEl(svg, 'circle');
        bg.setAttribute('cx', x); bg.setAttribute('cy', y);
        bg.setAttribute('r', 3.5); bg.setAttribute('fill', '#000');

        const dot = mkEl(svg, 'circle');
        dot.setAttribute('cx', x); dot.setAttribute('cy', y);
        dot.setAttribute('r', 2.5); dot.setAttribute('fill', '#44ff44');
    });

    // Status HUD
    const polyCount = merged.length;
    const vertCount = seen.size;
    const txt = mkEl(svg, 'text');
    txt.setAttribute('x', 4); txt.setAttribute('y', 14);
    txt.setAttribute('fill', '#44ff88');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('font-family', 'monospace');
    txt.textContent = `${polyCount} contour(s) · ${vertCount} vertices`;
}
