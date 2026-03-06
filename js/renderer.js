/**
 * Rendering: drawInto, drawGuides, drawFills, drawStrokes, drawLineHitZones
 */
import { mk, mkLine, mkHit, mkArcHit, mkPoly, mkPath } from './primitives.js';

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
            const c = mk(svg, 'circle');
            c.setAttribute('cx', i * cw); c.setAttribute('cy', j * rh); c.setAttribute('r', cw);
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

            // Visual Fills (4 Overlapping Quarter Circles)
            // tl: center(x,y), arc from (x+s,y) to (x,y+s)
            if (fills.has(`f-c-${i}-${j}-tl`)) { const p = mk(svg, 'path'); p.setAttribute('d', `M${x} ${y} L${x + s} ${y} A${s} ${s} 0 0 1 ${x} ${y + s} Z`); p.setAttribute('fill', '#fff'); p.style.pointerEvents = 'none'; }
            // tr: center(x+s,y), arc from (x,y) to (x+s,y+s)
            if (fills.has(`f-c-${i}-${j}-tr`)) { const p = mk(svg, 'path'); p.setAttribute('d', `M${x + s} ${y} L${x} ${y} A${s} ${s} 0 0 0 ${x + s} ${y + s} Z`); p.setAttribute('fill', '#fff'); p.style.pointerEvents = 'none'; }
            // bl: center(x,y+s), arc from (x,y) to (x+s,y+s)
            if (fills.has(`f-c-${i}-${j}-bl`)) { const p = mk(svg, 'path'); p.setAttribute('d', `M${x} ${y + s} L${x} ${y} A${s} ${s} 0 0 1 ${x + s} ${y + s} Z`); p.setAttribute('fill', '#fff'); p.style.pointerEvents = 'none'; }
            // br: center(x+s,y+s), arc from (x+s,y) to (x,y+s)
            if (fills.has(`f-c-${i}-${j}-br`)) { const p = mk(svg, 'path'); p.setAttribute('d', `M${x + s} ${y + s} L${x + s} ${y} A${s} ${s} 0 0 0 ${x} ${y + s} Z`); p.setAttribute('fill', '#fff'); p.style.pointerEvents = 'none'; }

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
    const { config, state } = app;

    const renderStroke = (id, color) => {
        if (id.startsWith('s:')) {
            const parts = id.substring(2).split(',').map(Number);
            mkLine(svg, parts[0], parts[1], parts[2], parts[3], color, config.strokeWeight);
        } else if (id.startsWith('a:')) {
            const pathData = id.substring(2);
            const p = mk(svg, 'path');
            p.setAttribute('d', pathData);
            p.setAttribute('fill', 'none');
            p.setAttribute('stroke', color);
            p.setAttribute('stroke-width', config.strokeWeight);
            p.setAttribute('stroke-linecap', 'round');
            p.style.pointerEvents = 'none';
        }
    };

    // Draw committed strokes
    app.glyph(ch).strokes.forEach(id => renderStroke(id, '#fff'));

    // Draw preview strokes (if any) superimposed
    if (state.previewPath && ch === state.activeChar) {
        const pColor = state.previewMode === 'erase' ? '#ff3333' : '#44ff44';
        state.previewPath.forEach(id => renderStroke(id, pColor));
    }
}

function drawLineHitZones(app, svg, cw, rh, W, H) {
    const { config } = app;
    for (let i = 0; i <= config.cols; i++)
        for (let j = 0; j < config.rows; j++)
            mkHit(svg, i * cw, j * rh, i * cw, (j + 1) * rh);

    for (let j = 0; j <= config.rows; j++)
        for (let i = 0; i < config.cols; i++)
            mkHit(svg, i * cw, j * rh, (i + 1) * cw, j * rh);

    if (config.gridType === 'triangle') {
        for (let i = 0; i < config.cols; i++) for (let j = 0; j < config.rows; j++) {
            mkHit(svg, i * cw, j * rh, (i + 1) * cw, (j + 1) * rh);
            mkHit(svg, (i + 1) * cw, j * rh, i * cw, (j + 1) * rh);
        }
    } else if (config.gridType === 'curvature') {
        for (let i = 0; i <= config.cols; i++) for (let j = 0; j <= config.rows; j++) {
            const x = i * cw, y = j * rh, s = cw;
            mkArcHit(svg, `M${x} ${y} A${s} ${s} 0 0 0 ${x + s} ${y + rh}`);
            mkArcHit(svg, `M${x + s} ${y} A${s} ${s} 0 0 1 ${x} ${y + rh}`);
            mkArcHit(svg, `M${x} ${y + rh} A${s} ${s} 0 0 0 ${x + s} ${y}`);
            mkArcHit(svg, `M${x + s} ${y + rh} A${s} ${s} 0 0 1 ${x} ${y}`);
        }
    } else if (config.gridType === 'hexagonal') {
        for (let j = 0; j < config.rows; j++) {
            const dx = (j % 2) * 0.5 * cw;
            const dn = ((j + 1) % 2) * 0.5 * cw;
            for (let i = -1; i <= config.cols + 1; i++) {
                const x = i * cw + dx, y = j * rh;
                const targetL = (i - (j % 2 ? 0 : 1)) * cw + dn;
                const targetR = (i + (j % 2 ? 1 : 0)) * cw + dn;
                mkHit(svg, x, y, targetL, (j + 1) * rh);
                mkHit(svg, x, y, targetR, (j + 1) * rh);
                if (i < config.cols) mkHit(svg, x, y, (i + 1) * cw + dx, y);
            }
        }
        // Last row horizontal hits
        const lastY = config.rows * rh, lastDx = (config.rows % 2) * 0.5 * cw;
        for (let i = 0; i < config.cols; i++) mkHit(svg, i * cw + lastDx, lastY, (i + 1) * cw + lastDx, lastY);
    }
}
