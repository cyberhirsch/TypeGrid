/**
 * Rendering: drawInto, drawGuides, drawFills, drawStrokes, drawLineHitZones
 */
import { mk, mkLine, mkHit, mkArcHit, mkPoly, mkPath } from './primitives.js';
import { gridStrokeIds, strokeGeom, arcPathD } from './strokeId.js';

export function drawInto(app, svg, ch, W, H, interactive, showGuides) {
    const { config } = app;
    const cw = W / config.cols, rh = H / config.rows;

    // For hexagonal grid, clip content to the canvas bounds
    let drawTarget = svg;
    if (config.gridType === 'hexagonal') {
        const defs = mk(svg, 'defs');
        const cp = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        cp.setAttribute('id', 'canvasClip');
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', 0); r.setAttribute('y', 0);
        r.setAttribute('width', W); r.setAttribute('height', H);
        cp.appendChild(r);
        defs.appendChild(cp);
        const g = mk(svg, 'g');
        g.setAttribute('clip-path', 'url(#canvasClip)');
        drawTarget = g;
    }

    drawFills(app, drawTarget, ch, cw, rh, interactive);
    drawStrokes(app, drawTarget, ch, cw, rh);

    if (showGuides === undefined) showGuides = config.showGridLines || !interactive;
    if (showGuides)
        drawGuides(app, drawTarget, cw, rh, W, H, interactive ? '#333' : '#1a1a1a');

    if (interactive) {
        if (config.activeTool === 'line') drawLineHitZones(app, drawTarget);
    }
}

/** Draw only the grid guides — used in topo mode so the glyph is hidden */
export function drawGuidesOnly(app, svg, W, H) {
    const { config } = app;
    const cw = W / config.cols, rh = H / config.rows;
    drawGuides(app, svg, cw, rh, W, H, '#2a2a2a');
}

function drawGuides(app, svg, cw, rh, W, H, color) {
    const { config } = app;
    if (config.gridType !== 'hexagonal') {
        for (let i = 0; i <= config.cols; i++) mkLine(svg, i * cw, 0, i * cw, H, color, 0.5);
    }
    for (let j = 0; j <= config.rows; j++) mkLine(svg, 0, j * rh, W, j * rh, color, 0.5);

    // Baseline and Mean line (x-height)
    if (config.baseline !== undefined) {
        mkLine(svg, 0, config.baseline * rh, W, config.baseline * rh, '#ff4444', 1.0);
    }
    if (config.meanLine !== undefined) {
        mkLine(svg, 0, config.meanLine * rh, W, config.meanLine * rh, '#4488ff', 1.0);
    }

    if (config.gridType === 'triangle') {
        for (let i = 0; i < config.cols; i++) for (let j = 0; j < config.rows; j++) {
            mkLine(svg, i * cw, j * rh, (i + 1) * cw, (j + 1) * rh, color, 0.5);
            mkLine(svg, (i + 1) * cw, j * rh, i * cw, (j + 1) * rh, color, 0.5);
        }
    } else if (config.gridType === 'hexagonal') {
        for (let j = 0; j <= config.rows; j++) {
            const dx = (j % 2) * 0.5 * cw;
            const dn = ((j + 1) % 2) * 0.5 * cw;
            for (let i = -1; i <= config.cols + 1; i++) {
                const x = i * cw + dx;
                const y = j * rh;

                // Diagonals (Symmetrical)
                if (j < config.rows) {
                    // Each point connects to normalized relative -0.5 and +0.5 positions below
                    const targetL = (i - (j % 2 ? 0 : 1)) * cw + dn;
                    const targetR = (i + (j % 2 ? 1 : 0)) * cw + dn;
                    mkLine(svg, x, y, targetL, (j + 1) * rh, color, 0.4);
                    mkLine(svg, x, y, targetR, (j + 1) * rh, color, 0.4);
                }
            }
        }
    } else if (config.gridType === 'curvature') {
        for (let i = 0; i <= config.cols; i++) for (let j = 0; j <= config.rows; j++) {
            const c = mk(svg, 'ellipse');
            c.setAttribute('cx', i * cw); c.setAttribute('cy', j * rh);
            c.setAttribute('rx', cw); c.setAttribute('ry', rh);
            c.setAttribute('fill', 'none'); c.setAttribute('stroke', color);
            c.setAttribute('stroke-width', '0.5');
        }
    }
}

function drawFills(app, svg, ch, cw, rh, interactive) {
    const { config } = app;
    const fills = app.glyph(ch).fills;
    const canClick = interactive && config.activeTool === 'fill';

    const hexExtra = config.gridType === 'hexagonal' ? 1 : 0;
    for (let i = -hexExtra; i < config.cols + hexExtra; i++) for (let j = 0; j < config.rows; j++) {
        const gt = config.gridType;

        if (gt === 'geometric' && i >= 0 && i < config.cols) {
            const id = `f-r-${i}-${j}`;
            const r = mk(svg, 'rect');
            r.setAttribute('x', i * cw); r.setAttribute('y', j * rh);
            r.setAttribute('width', cw); r.setAttribute('height', rh);
            r.setAttribute('fill', fills.has(id) ? '#fff' : 'transparent');
            if (canClick) { r.setAttribute('data-id', id); }
            else { r.style.pointerEvents = 'none'; }

        } else if (gt === 'triangle' && i >= 0 && i < config.cols) {
            const cx = i * cw + cw / 2, cy = j * rh + rh / 2;
            const tl = [i * cw, j * rh], tr = [(i + 1) * cw, j * rh];
            const bl = [i * cw, (j + 1) * rh], br = [(i + 1) * cw, (j + 1) * rh], ct = [cx, cy];
            mkPoly(svg, [tl, tr, ct], `f-t-${i}-${j}-t`, fills, canClick);
            mkPoly(svg, [tr, br, ct], `f-t-${i}-${j}-r`, fills, canClick);
            mkPoly(svg, [br, bl, ct], `f-t-${i}-${j}-b`, fills, canClick);
            mkPoly(svg, [bl, tl, ct], `f-t-${i}-${j}-l`, fills, canClick);

        } else if (gt === 'curvature' && i >= 0 && i < config.cols) {
            const x = i * cw, y = j * rh, s = cw;
            const h = s / 2;

            // Interaction Zones (4 Quadrants) - Drawing these first so they are behind/selectable
            const quadrants = [
                { id: `f-c-${i}-${j}-tl`, x: x, y: y },
                { id: `f-c-${i}-${j}-tr`, x: x + h, y: y },
                { id: `f-c-${i}-${j}-bl`, x: x, y: y + h },
                { id: `f-c-${i}-${j}-br`, x: x + h, y: y + h }
            ];

            quadrants.forEach(q => {
                const r = mk(svg, 'rect');
                r.setAttribute('x', q.x); r.setAttribute('y', q.y);
                r.setAttribute('width', h); r.setAttribute('height', h);
                r.setAttribute('fill', 'transparent'); // Invisible interaction zone
                if (canClick) r.setAttribute('data-id', q.id);
            });

            // Visual Fills (4 Overlapping Elliptical Quarter Circles)
            const sx = cw, sy = rh;
            // tl: center(x,y), arc from (x+sx,y) to (x,y+sy)
            if (fills.has(`f-c-${i}-${j}-tl`)) { const p = mk(svg, 'path'); p.setAttribute('d', `M${x} ${y} L${x + sx} ${y} A${sx} ${sy} 0 0 1 ${x} ${y + sy} Z`); p.setAttribute('fill', '#fff'); p.style.pointerEvents = 'none'; }
            // tr: center(x+sx,y), arc from (x,y) to (x+sx,y+sy)
            if (fills.has(`f-c-${i}-${j}-tr`)) { const p = mk(svg, 'path'); p.setAttribute('d', `M${x + sx} ${y} L${x} ${y} A${sx} ${sy} 0 0 0 ${x + sx} ${y + sy} Z`); p.setAttribute('fill', '#fff'); p.style.pointerEvents = 'none'; }
            // bl: center(x,y+sy), arc from (x,y) to (x+sx,y+sy)
            if (fills.has(`f-c-${i}-${j}-bl`)) { const p = mk(svg, 'path'); p.setAttribute('d', `M${x} ${y + sy} L${x} ${y} A${sx} ${sy} 0 0 1 ${x + sx} ${y + sy} Z`); p.setAttribute('fill', '#fff'); p.style.pointerEvents = 'none'; }
            // br: center(x+sx,y+sy), arc from (x+sx,y) to (x,y+sy)
            if (fills.has(`f-c-${i}-${j}-br`)) { const p = mk(svg, 'path'); p.setAttribute('d', `M${x + sx} ${y + sy} L${x + sx} ${y} A${sx} ${sy} 0 0 0 ${x} ${y + sy} Z`); p.setAttribute('fill', '#fff'); p.style.pointerEvents = 'none'; }

        } else if (gt === 'hexagonal') {
            // Use the same vertex math as drawGuides
            const dx = (j % 2) * 0.5 * cw;
            const dn = ((j + 1) % 2) * 0.5 * cw;
            const x = i * cw + dx, y = j * rh;
            // The two points this vertex connects to below
            const targetL = (i - (j % 2 ? 0 : 1)) * cw + dn;
            const targetR = (i + (j % 2 ? 1 : 0)) * cw + dn;
            const yBelow = (j + 1) * rh;
            // Down triangle: current point, next point on same row, left-target below
            mkPoly(svg, [[x, y], [(i + 1) * cw + dx, y], [targetR, yBelow]], `f-h-${i}-${j}-d`, fills, canClick);
            // Up triangle: two adjacent targets below, next point on same row
            mkPoly(svg, [[targetR, yBelow], [(i + 1 - (j % 2 ? 0 : 1)) * cw + dn + cw, yBelow], [(i + 1) * cw + dx, y]], `f-h-${i}-${j}-u`, fills, canClick);
        }
    }
}

function drawStrokes(app, svg, ch) {
    try {
        const { config, state } = app;
        const glyph = app.glyph(ch);
        const strokes = glyph.strokes;
        const previewStrokes = (ch === state.activeChar && state.previewPath) ? state.previewPath : [];
        const allStrokes = [...strokes, ...previewStrokes];
        const ID_TO_PREVIEW = new Set(previewStrokes);

        // 1. Build Adjacency Graph — geometry comes from the grid config, so an
        //    id means the same edge regardless of how the glyph was saved.
        const graph = new Map();
        allStrokes.forEach(id => {
            const g = strokeGeom(id, config);
            if (!g) return;
            const n1 = `${g.p1[0].toFixed(1)},${g.p1[1].toFixed(1)}`;
            const n2 = `${g.p2[0].toFixed(1)},${g.p2[1].toFixed(1)}`;
            const edge = { ...g, id, n1, n2 };
            if (!graph.has(n1)) graph.set(n1, []);
            if (!graph.has(n2)) graph.set(n2, []);
            graph.get(n1).push(edge);
            graph.get(n2).push(edge);
        });

        // 2. Extract Paths (Chains)
        const visited = new Set();
        const paths = [];

        const getPath = (startNode, startEdge) => {
            const path = { segments: [], nodes: [startNode] };
            let currNode = startNode;
            let currEdge = startEdge;

            while (currEdge && !visited.has(currEdge.id)) {
                visited.add(currEdge.id);
                const isForward = (currEdge.n1 === currNode);
                const nextNode = isForward ? currEdge.n2 : currEdge.n1;

                path.segments.push({ ...currEdge, isForward });
                path.nodes.push(nextNode);

                currNode = nextNode;
                const neighbors = (graph.get(currNode) || []).filter(e => !visited.has(e.id));
                currEdge = neighbors.length > 0 ? neighbors[0] : null;
            }
            return path;
        };

        // Pass 1: Terminals
        graph.forEach((nodeEdges, node) => {
            if (nodeEdges.length === 1) {
                const unvisited = nodeEdges.filter(e => !visited.has(e.id));
                if (unvisited.length > 0) paths.push(getPath(node, unvisited[0]));
            }
        });
        // Pass 2: Branching
        graph.forEach((nodeEdges, node) => {
            if (nodeEdges.length > 2) {
                const unvisited = nodeEdges.filter(e => !visited.has(e.id));
                unvisited.forEach(edge => paths.push(getPath(node, edge)));
            }
        });
        // Pass 3: Loops
        graph.forEach((nodeEdges, node) => {
            const unvisited = nodeEdges.filter(e => !visited.has(e.id));
            unvisited.forEach(edge => paths.push(getPath(node, edge)));
        });

        // 3. Render Paths
        paths.forEach(path => {
            if (path.segments.length === 0) return;
            const isPreview = path.segments.some(seg => ID_TO_PREVIEW.has(seg.id));
            const color = isPreview ? (state.previewMode === 'erase' ? '#ff3333' : '#44ff44') : '#fff';

            const p = mk(svg, 'path');
            const startSeg = path.segments[0];
            const startPt = startSeg.isForward ? startSeg.p1 : startSeg.p2;
            let d = `M ${startPt[0]} ${startPt[1]}`;

            path.segments.forEach(seg => {
                const endPt = seg.isForward ? seg.p2 : seg.p1;
                if (seg.type === 'line') {
                    d += ` L ${endPt[0]} ${endPt[1]}`;
                } else {
                    const swf = seg.isForward ? seg.swf : (1 - seg.swf);
                    d += ` A ${seg.rx} ${seg.ry} ${seg.rot} ${seg.laf} ${swf} ${endPt[0]} ${endPt[1]}`;
                }
            });

            p.setAttribute('d', d);
            p.setAttribute('fill', 'none');
            p.setAttribute('stroke', color);
            p.setAttribute('stroke-width', config.strokeWeight);
            p.setAttribute('stroke-linejoin', config.strokeJoin || 'round');
            p.setAttribute('stroke-linecap', 'butt');
            p.style.pointerEvents = 'none';

            // 4. Terminal Capping
            const capStyle = config.strokeCap || 'round';
            const r = config.strokeWeight / 2;
            const ends = [
                { node: path.nodes[0], seg: path.segments[0], side: 'start' },
                { node: path.nodes[path.nodes.length - 1], seg: path.segments[path.segments.length - 1], side: 'end' }
            ];

            ends.forEach(end => {
                if ((graph.get(end.node) || []).length > 1) return;

                // Simple tangent calculation for caps
                const p1 = end.seg.isForward ? end.seg.p1 : end.seg.p2;
                const p2 = end.seg.isForward ? end.seg.p2 : end.seg.p1;

                // For arcs, the terminal tangent is approx from the neighbor point on the chord
                // but since we usually use square/triangle caps on stems, this is good enough.
                const pt = end.side === 'start' ? p1 : p2;
                const adj = end.side === 'start' ? p2 : p1;

                const dx = pt[0] - adj[0], dy = pt[1] - adj[1];
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len < 0.1) return;
                const nx = dx / len, ny = dy / len;
                const px = -ny * r, py = nx * r;

                if (capStyle === 'round') {
                    const c = mk(svg, 'circle');
                    c.setAttribute('cx', pt[0]); c.setAttribute('cy', pt[1]);
                    c.setAttribute('r', r); c.setAttribute('fill', color); c.style.pointerEvents = 'none';
                } else if (capStyle === 'square') {
                    const sx = nx * r, sy = ny * r;
                    const poly = mk(svg, 'polygon');
                    poly.setAttribute('points', `${pt[0] + px},${pt[1] + py} ${pt[0] + px + sx},${pt[1] + py + sy} ${pt[0] - px + sx},${pt[1] - py + sy} ${pt[0] - px},${pt[1] - py}`);
                    poly.setAttribute('fill', color); poly.style.pointerEvents = 'none';
                } else if (capStyle === 'triangle') {
                    const sx = nx * r, sy = ny * r;
                    const poly = mk(svg, 'polygon');
                    poly.setAttribute('points', `${pt[0] + px},${pt[1] + py} ${pt[0] + sx},${pt[1] + sy} ${pt[0] - px},${pt[1] - py}`);
                    poly.setAttribute('fill', color); poly.style.pointerEvents = 'none';
                }
            });
        });
    } catch (e) {
        console.error('drawStrokes failed:', e);
    }
}

function drawLineHitZones(app, svg) {
    const { config, state } = app;
    if (config.activeTool !== 'line') return;

    // One invisible hit zone per addressable stroke id. `gridStrokeIds` is the
    // single source of truth for what exists on this grid, so anything a
    // transform produces is guaranteed to be selectable here.
    const existing = new Set(app.glyph(state.activeChar).strokes);

    for (const id of gridStrokeIds(config)) {
        const g = strokeGeom(id, config);
        if (!g) continue;
        if (g.type === 'arc') mkArcHit(svg, arcPathD(g), id, existing.has(id));
        else mkHit(svg, g.p1[0], g.p1[1], g.p2[0], g.p2[1], id, existing.has(id));
    }
}
