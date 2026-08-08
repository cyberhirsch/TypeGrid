/**
 * SVG primitive helpers.
 * All functions take an SVG element as first argument and append to it.
 */

export const NS = 'http://www.w3.org/2000/svg';

export function mk(svg, tag) {
    const el = document.createElementNS(NS, tag);
    svg.appendChild(el);
    return el;
}

export function mkLine(svg, x1, y1, x2, y2, color, sw, cap = 'round') {
    const l = mk(svg, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', color);
    l.setAttribute('stroke-width', sw);
    l.setAttribute('stroke-linecap', cap === 'triangle' ? 'butt' : cap);
    l.style.pointerEvents = 'none';
}

export function mkHit(svg, x1, y1, x2, y2, id, active, onclick) {
    const l = mk(svg, 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('stroke', active ? 'rgba(68,255,68,0.3)' : 'rgba(255,255,255,0.01)');
    l.setAttribute('stroke-width', '12');
    l.setAttribute('data-id', id);
    l.style.cursor = 'crosshair';
    if (onclick) l.onclick = onclick;
}

export function mkArcHit(svg, d, id, active) {
    const p = mk(svg, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', active ? 'rgba(68,255,68,0.3)' : 'rgba(255,255,255,0.01)');
    p.setAttribute('stroke-width', '12');
    p.setAttribute('data-id', id);
    p.style.cursor = 'crosshair';
}

export function mkPoly(svg, pts, id, fills, canClick) {
    const p = mk(svg, 'polygon');
    p.setAttribute('points', pts.map(pt => pt.join(',')).join(' '));
    p.setAttribute('fill', fills.has(id) ? '#fff' : 'transparent');
    if (canClick) { p.setAttribute('data-id', id); }
    else { p.style.pointerEvents = 'none'; }
}

export function mkPath(svg, d, id, fills, canClick) {
    const p = mk(svg, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', fills.has(id) ? '#fff' : 'transparent');
    if (canClick) { p.setAttribute('data-id', id); }
    else { p.style.pointerEvents = 'none'; }
}
