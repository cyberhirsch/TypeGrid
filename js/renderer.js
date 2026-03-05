/**
 * Rendering: drawInto, drawGuides, drawFills, drawStrokes, drawLineHitZones
 */
import { mk, mkLine, mkHit, mkArcHit, mkPoly, mkPath } from './primitives.js';

export function drawInto(app, svg, ch, W, H, interactive) {
    const { config } = app;
    const cw = W / config.cols, rh = H / config.rows;

    drawFills(app, svg, ch, cw, rh, interactive);
    drawStrokes(app, svg, ch, cw, rh);

    if (config.showGridLines || !interactive)
        drawGuides(app, svg, cw, rh, W, H, interactive ? '#333' : '#1a1a1a');

    if (interactive) {
        if (config.activeTool === 'line') drawLineHitZones(app, svg, cw, rh, W, H);
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
    for (let i = 0; i <= config.cols; i++) mkLine(svg, i * cw, 0, i * cw, H, color, 0.5);
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
            mkLine(svg, i * cw, j * rh, (i + 1) * cw, (j + 1) * rh, color, 0.3);
            mkLine(svg, (i + 1) * cw, j * rh, i * cw, (j + 1) * rh, color, 0.3);
        }
    } else if (config.gridType === 'curvature') {
        for (let i = 0; i <= config.cols; i++) for (let j = 0; j <= config.rows; j++) {
            const c = mk(svg, 'circle');
            c.setAttribute('cx', i * cw); c.setAttribute('cy', j * rh); c.setAttribute('r', cw);
            c.setAttribute('fill', 'none'); c.setAttribute('stroke', color);
            c.setAttribute('stroke-width', '0.5'); c.setAttribute('stroke-dasharray', '2,2');
        }
    }
}

function drawFills(app, svg, ch, cw, rh, interactive) {
    const { config } = app;
    const fills = app.glyph(ch).fills;
    const canClick = interactive && config.activeTool === 'fill';

    for (let i = 0; i < config.cols; i++) for (let j = 0; j < config.rows; j++) {
        const gt = config.gridType;

        if (gt === 'geometric') {
            const id = `f-r-${i}-${j}`;
            const r = mk(svg, 'rect');
            r.setAttribute('x', i * cw); r.setAttribute('y', j * rh);
            r.setAttribute('width', cw); r.setAttribute('height', rh);
            r.setAttribute('fill', fills.has(id) ? '#fff' : 'transparent');
            if (canClick) { r.setAttribute('data-id', id); }
            else { r.style.pointerEvents = 'none'; }

        } else if (gt === 'triangle') {
            const cx = i * cw + cw / 2, cy = j * rh + rh / 2;
            const tl = [i * cw, j * rh], tr = [(i + 1) * cw, j * rh];
            const bl = [i * cw, (j + 1) * rh], br = [(i + 1) * cw, (j + 1) * rh], ct = [cx, cy];
            mkPoly(svg, [tl, tr, ct], `f-t-${i}-${j}-t`, fills, canClick);
            mkPoly(svg, [tr, br, ct], `f-t-${i}-${j}-r`, fills, canClick);
            mkPoly(svg, [br, bl, ct], `f-t-${i}-${j}-b`, fills, canClick);
            mkPoly(svg, [bl, tl, ct], `f-t-${i}-${j}-l`, fills, canClick);

        } else if (gt === 'curvature') {
            const x = i * cw, y = j * rh, s = cw;
            mkPath(svg, `M${x} ${y}A${s} ${s} 0 0 0 ${x + s} ${y + rh}L${x} ${y + rh}Z`, `f-c-${i}-${j}-bl`, fills, canClick);
            mkPath(svg, `M${x + s} ${y}A${s} ${s} 0 0 1 ${x} ${y + rh}L${x + s} ${y + rh}Z`, `f-c-${i}-${j}-br`, fills, canClick);
            mkPath(svg, `M${x} ${y + rh}A${s} ${s} 0 0 0 ${x + s} ${y}L${x} ${y}Z`, `f-c-${i}-${j}-tl`, fills, canClick);
            mkPath(svg, `M${x + s} ${y + rh}A${s} ${s} 0 0 1 ${x} ${y}L${x + s} ${y}Z`, `f-c-${i}-${j}-tr`, fills, canClick);

        } else if (gt === 'hexagonal') {
            const hW = cw, hH = rh, vd = hH * 0.75, ox = (j % 2 === 0) ? 0 : hW / 2;
            const hx = i * hW + hW / 2 + ox, hy = j * vd + hH / 2;
            const pts = [];
            for (let a = 0; a < 6; a++) {
                const an = (Math.PI / 180) * (60 * a - 30);
                pts.push([hx + (hW / 2) * Math.cos(an), hy + (hH / 2) * Math.sin(an)]);
            }
            mkPoly(svg, pts, `f-h-${i}-${j}`, fills, canClick);
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
    }
}
