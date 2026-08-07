/**
 * Rendering: drawInto, drawGuides, drawFills, drawStrokes, drawLineHitZones
 */
import { mk, mkLine, mkHit, mkArcHit, mkPoly, mkPath } from './primitives.js';
import { strokeRing, mkStrokeId } from './geometry.js';

export function drawInto(app, svg, ch, W, H, interactive) {
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

    if (config.showGridLines || !interactive)
        drawGuides(app, drawTarget, cw, rh, W, H, interactive ? '#333' : '#1a1a1a');

    if (interactive) {
        if (config.activeTool === 'line') drawLineHitZones(app, drawTarget, cw, rh, W, H);
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

        // 1. Build Adjacency Graph
        const graph = new Map();
        allStrokes.forEach(id => {
            let edge;
            if (id.startsWith('s:')) {
                const parts = id.substring(2).split(',').map(v => Number(v));
                const p1 = [parts[0], parts[1]], p2 = [parts[2], parts[3]];
                const n1 = `${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
                const n2 = `${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
                edge = { id, type: 'line', n1, n2, p1, p2 };
            } else if (id.startsWith('a:')) {
                const d = id.substring(2);
                const m = d.match(/M\s*([\d.-]+)\s+([\d.-]+)\s+A\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([01])\s+([01])\s+([\d.-]+)\s+([\d.-]+)/);
                if (m) {
                    const [_, x1, y1, rx, ry, rot, laf, swf, x2, y2] = m.map(Number);
                    const p1 = [x1, y1], p2 = [x2, y2];
                    const n1 = `${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
                    const n2 = `${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
                    edge = { id, type: 'arc', n1, n2, p1, p2, rx, ry, rot, laf, swf };
                }
            }
            if (edge) {
                if (!graph.has(edge.n1)) graph.set(edge.n1, []);
                if (!graph.has(edge.n2)) graph.set(edge.n2, []);
                graph.get(edge.n1).push(edge);
                graph.get(edge.n2).push(edge);
            }
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

function drawLineHitZones(app, svg, cw, rh, W, H) {
    const { config, state } = app;
    const canClick = config.activeTool === 'line';
    if (!canClick) return;

    // We still draw invisible hit zones for every grid segment to make selection easy
    const glyph = app.glyph(state.activeChar);
    const existing = new Set(glyph.strokes);

    // This part depends on the grid type
    const drawZone = (x1, y1, x2, y2, id) => {
        const active = existing.has(id);
        mkHit(svg, x1, y1, x2, y2, id, active);
    };

    if (config.gridType !== 'hexagonal') {
        for (let i = 0; i <= config.cols; i++) {
            for (let j = 0; j <= config.rows; j++) {
                const x = i * cw, y = j * rh;
                if (i < config.cols) drawZone(x, y, x + cw, y, mkStrokeId(x, y, x + cw, y));
                if (j < config.rows) drawZone(x, y, x, y + rh, mkStrokeId(x, y, x, y + rh));

                if (config.gridType === 'triangle' && i < config.cols && j < config.rows) {
                    drawZone(x, y, x + cw, y + rh, mkStrokeId(x, y, x + cw, y + rh));
                    drawZone(x + cw, y, x, y + rh, mkStrokeId(x + cw, y, x, y + rh));
                }
            }
        }

        if (config.gridType === 'curvature') {
            const sx = cw, sy = rh;
            for (let i = 0; i < config.cols; i++) {
                for (let j = 0; j < config.rows; j++) {
                    const x = i * cw, y = j * rh;
                    // TL, TR, BL, BR center quadrant arcs (elliptical to fit aspect ratio)
                    const arcs = [
                        `M ${x + sx} ${y} A ${sx} ${sy} 0 0 1 ${x} ${y + sy}`,
                        `M ${x} ${y} A ${sx} ${sy} 0 0 0 ${x + sx} ${y + sy}`,
                        `M ${x} ${y} A ${sx} ${sy} 0 0 1 ${x + sx} ${y + sy}`,
                        `M ${x + sx} ${y + sy} A ${sx} ${sy} 0 0 0 ${x} ${y + sy}`
                    ];
                    arcs.forEach(d => mkArcHit(svg, d, existing.has(`a:${d}`)));
                }
            }
        }
    } else if (config.gridType === 'hexagonal') {
        for (let j = 0; j <= config.rows; j++) {
            const dx = (j % 2) * 0.5 * cw;
            const dn = ((j + 1) % 2) * 0.5 * cw;
            const y = j * rh;
            const yBelow = (j + 1) * rh;

            for (let i = 0; i <= config.cols; i++) {
                const x = i * cw + dx;
                if (i < config.cols) drawZone(x, y, (i + 1) * cw + dx, y, mkStrokeId(x, y, (i + 1) * cw + dx, y));
                if (j < config.rows) {
                    const targetL = (i - (j % 2 ? 0 : 1)) * cw + dn;
                    const targetR = (i + (j % 2 ? 1 : 0)) * cw + dn;
                    if (targetL >= -cw && targetL <= config.cols * cw + cw) drawZone(x, y, targetL, yBelow, mkStrokeId(x, y, targetL, yBelow));
                    if (targetR >= -cw && targetR <= config.cols * cw + cw) drawZone(x, y, targetR, yBelow, mkStrokeId(x, y, targetR, yBelow));
                }
            }
        }
        // Last row horizontal hits
        const lastY = config.rows * rh, lastDx = (config.rows % 2) * 0.5 * cw;
        for (let i = 0; i < config.cols; i++) drawZone(i * cw + lastDx, lastY, (i + 1) * cw + lastDx, lastY, mkStrokeId(i * cw + lastDx, lastY, (i + 1) * cw + lastDx, lastY));
    }
}
