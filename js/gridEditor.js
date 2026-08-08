/**
 * Shared grid-editor base for Typegrid and IconGrid.
 *
 * Both tools draw fills and strokes on the same grid engine and differ only in
 * what a "glyph" means (a Unicode character vs a named brand variant) and how
 * the result is previewed and exported. They were built in parallel, so the
 * pointer state machine, transforms, path-finding and persistence plumbing
 * existed twice — which meant every fix and feature had to be written twice.
 *
 * Everything grid-related lives here. Subclasses supply the parts that genuinely
 * differ via the hooks below.
 *
 * ── SUBCLASS CONTRACT ────────────────────────────────────────────────────────
 * Required properties, set during cacheDOM():
 *   canvas, aspectSlider, aspectValue, btnFill, btnLine, strokeControl
 * Required overrides:
 *   label            short name used in migration log messages
 *   drawCanvas(W, H) paint the editing surface (render() handles viewBox/clear)
 *   renderInventory() rebuild the glyph grid / variant list
 *   persist()        write config + glyphs to storage
 * Optional overrides:
 *   renderPreview()  word preview / usage preview; no-op by default
 */
import { gridDims, flipStrokeId, nudgeStrokeId, strokeNodes, isStrokeId, migrateGlyphs } from './strokeId.js';

export class GridEditor {
    constructor(config, activeChar) {
        this.config = config;
        this.state = { activeChar, glyphs: {} };
    }

    /* ── SUBCLASS HOOKS ──────────────────────────────────────────────────── */
    get label() { return 'Editor'; }
    drawCanvas() { throw new Error(`${this.constructor.name} must implement drawCanvas()`); }
    renderInventory() { throw new Error(`${this.constructor.name} must implement renderInventory()`); }
    persist() { throw new Error(`${this.constructor.name} must implement persist()`); }
    renderPreview() { }

    /* ── STATE ───────────────────────────────────────────────────────────── */
    glyph(c) {
        c = c || this.state.activeChar;
        if (!this.state.glyphs[c]) this.state.glyphs[c] = { fills: new Set(), strokes: new Set() };
        return this.state.glyphs[c];
    }

    refresh() {
        this.render();
        this.renderInventory();
        this.renderPreview();
        this.persist();
    }

    setTool(t) {
        this.config.activeTool = t;
        this.btnFill.classList.toggle('active', t === 'fill');
        this.btnLine.classList.toggle('active', t === 'line');
        this.strokeControl.style.display = t === 'line' ? 'block' : 'none';
        this.render();
    }

    updateSquare() {
        if (this.config.lockSquare) {
            this.config.aspectRatio = this.config.cols / this.config.rows;
            this.aspectValue.textContent = this.config.aspectRatio.toFixed(2);
            this.aspectSlider.value = this.config.aspectRatio;
            this.aspectSlider.disabled = true;
            this.aspectSlider.style.opacity = '0.3';
        } else {
            this.aspectSlider.disabled = false;
            this.aspectSlider.style.opacity = '1';
        }
    }

    /* ── RENDER ──────────────────────────────────────────────────────────── */
    render() {
        this._cachedGraph = null; // hit zones are rebuilt below
        const { W, H } = gridDims(this.config);
        const pad = this.config.strokeWeight + 2;
        this.canvas.setAttribute('viewBox', `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`);
        this.canvas.innerHTML = '';
        this.drawCanvas(W, H);
    }

    /* ── CONNECTIVITY ────────────────────────────────────────────────────── */
    getEdgeNodes(id) {
        return strokeNodes(id, this.config);
    }

    getGraph() {
        if (this._cachedGraph) return this._cachedGraph;
        const graph = new Map();
        this.canvas.querySelectorAll('[data-id^="s-"]').forEach(el => {
            const id = el.getAttribute('data-id');
            const nodes = this.getEdgeNodes(id);
            if (!nodes) return;
            const [n1, n2] = nodes;
            if (!graph.has(n1)) graph.set(n1, []);
            if (!graph.has(n2)) graph.set(n2, []);
            graph.get(n1).push({ edgeId: id, toNode: n2 });
            graph.get(n2).push({ edgeId: id, toNode: n1 });
        });
        this._cachedGraph = graph;
        return graph;
    }

    /** Shortest chain of edges between two hit zones, for drag-to-draw. */
    findPath(startEdgeId, endEdgeId) {
        if (startEdgeId === endEdgeId) return [startEdgeId];
        const graph = this.getGraph();
        const startNodes = this.getEdgeNodes(startEdgeId);
        if (!startNodes) return null;

        const q = [];
        const visitedNodes = new Set();
        for (const n of startNodes) {
            q.push({ node: n, path: [startEdgeId] });
            visitedNodes.add(n);
        }

        while (q.length > 0) {
            const curr = q.shift();
            if (curr.path.length > 50) continue; // safety limit
            for (const neighbor of graph.get(curr.node) || []) {
                if (neighbor.edgeId === endEdgeId) return [...curr.path, neighbor.edgeId];
                if (!visitedNodes.has(neighbor.toNode)) {
                    visitedNodes.add(neighbor.toNode);
                    q.push({ node: neighbor.toNode, path: [...curr.path, neighbor.edgeId] });
                }
            }
        }
        return null;
    }

    /* ── TRANSFORMS ──────────────────────────────────────────────────────── */
    flipGlyph(axis) {
        const g = this.glyph();
        const { cols, rows } = this.config;
        const newFills = new Set();

        g.fills.forEach(id => {
            if (id.startsWith('f-r-')) {
                const [, , i, j] = id.split('-');
                if (axis === 'H') newFills.add(`f-r-${(cols - 1) - +i}-${j}`);
                else newFills.add(`f-r-${i}-${(rows - 1) - +j}`);
            } else if (id.startsWith('f-t-')) {
                const [, , i, j, pos] = id.split('-');
                let ni = +i, nj = +j, npos = pos;
                if (axis === 'H') { ni = (cols - 1) - +i; if (pos === 'r') npos = 'l'; else if (pos === 'l') npos = 'r'; }
                else { nj = (rows - 1) - +j; if (pos === 't') npos = 'b'; else if (pos === 'b') npos = 't'; }
                newFills.add(`f-t-${ni}-${nj}-${npos}`);
            } else if (id.startsWith('f-c-')) {
                const [, , i, j, pos] = id.split('-');
                let ni = +i, nj = +j, npos = pos;
                if (axis === 'H') {
                    ni = (cols - 1) - +i;
                    npos = { bl: 'br', br: 'bl', tl: 'tr', tr: 'tl' }[pos] || pos;
                } else {
                    nj = (rows - 1) - +j;
                    npos = { bl: 'tl', tl: 'bl', br: 'tr', tr: 'br' }[pos] || pos;
                }
                newFills.add(`f-c-${ni}-${nj}-${npos}`);
            } else { newFills.add(id); }
        });

        const newStrokes = new Set();
        g.strokes.forEach(id => {
            const flipped = flipStrokeId(id, axis, this.config);
            if (flipped) newStrokes.add(flipped);
        });

        g.fills = newFills;
        g.strokes = newStrokes;
    }

    nudgeGlyph(dx, dy) {
        const g = this.glyph();
        const { cols, rows } = this.config;
        const newFills = new Set();

        g.fills.forEach(id => {
            const parts = id.split('-');
            const type = parts[1]; // r, t, c, h
            const ni = +parts[2] + dx, nj = +parts[3] + dy;
            // Hexagonal fills index (row, col) rather than (col, row).
            const iMax = type === 'h' ? rows : cols;
            const jMax = type === 'h' ? cols : rows;
            if (ni >= 0 && ni < iMax && nj >= 0 && nj < jMax) {
                const suffix = parts.slice(4).join('-');
                newFills.add(`f-${type}-${ni}-${nj}${suffix ? '-' + suffix : ''}`);
            }
        });

        const newStrokes = new Set();
        g.strokes.forEach(id => {
            const moved = nudgeStrokeId(id, dx, dy, this.config);
            if (moved) newStrokes.add(moved);
        });

        g.fills = newFills;
        g.strokes = newStrokes;
    }

    /* ── PERSISTENCE ─────────────────────────────────────────────────────── */

    /**
     * Convert a loaded project's strokes to topological ids. Projects saved
     * before that change store pixel coordinates, which only resolve correctly
     * against the grid they were saved with — so migrate using the incoming
     * config, before merging it into the live one.
     */
    adoptGlyphs(glyphs, cfg) {
        const res = migrateGlyphs(glyphs, cfg);
        if (res.converted) console.info(`${this.label}: migrated ${res.converted} stroke(s) to topological ids.`);
        if (res.dropped) console.warn(`${this.label}: ${res.dropped} stroke(s) did not sit on the saved grid and were dropped.`);
        return res.glyphs;
    }

    /* ── DRAWING ─────────────────────────────────────────────────────────── */

    /**
     * Pointer-driven fill/line drawing. During a drag only render() runs, so the
     * canvas stays responsive; the full refresh (thumbnails, preview, autosave)
     * happens once on pointerup.
     */
    bindDrawing() {
        let isDrawing = false;
        let drawMode = 'draw';
        let startEdgeId = null;
        let lastFillId = null;

        this.canvas.addEventListener('pointerdown', e => {
            const id = e.target.getAttribute('data-id');
            if (!id) return;
            isDrawing = true;
            e.preventDefault();

            const g = this.glyph();
            if (id.startsWith('f-')) {
                drawMode = g.fills.has(id) ? 'erase' : 'draw';
                if (drawMode === 'draw') g.fills.add(id); else g.fills.delete(id);
                lastFillId = id;
            } else if (isStrokeId(id)) {
                drawMode = g.strokes.has(id) ? 'erase' : 'draw';
                startEdgeId = id;
                this.state.previewMode = drawMode;
                this.state.previewPath = [id];
            }
            this.render();
        });

        this.canvas.addEventListener('pointermove', e => {
            if (!isDrawing) return;
            const id = e.target.getAttribute('data-id');
            if (!id) return;
            const g = this.glyph();

            if (id.startsWith('f-') && id !== lastFillId) {
                if (drawMode === 'draw') g.fills.add(id); else g.fills.delete(id);
                lastFillId = id;
                this.render();
            } else if (isStrokeId(id) && startEdgeId) {
                this.state.previewPath = id === startEdgeId
                    ? [startEdgeId]
                    : (this.findPath(startEdgeId, id) || [startEdgeId, id]);
                this.render();
            }
        });

        window.addEventListener('pointerup', () => {
            if (!isDrawing) return;
            if (this.state.previewPath) {
                const g = this.glyph();
                this.state.previewPath.forEach(edge => {
                    if (this.state.previewMode === 'draw') g.strokes.add(edge);
                    else g.strokes.delete(edge);
                });
            }
            isDrawing = false;
            startEdgeId = null;
            lastFillId = null;
            this.state.previewPath = null;
            this.refresh();
        });
    }

    /**
     * Controls both tools share: grid dimensions, stroke styling, tool choice,
     * clear, and the flip/rotate/nudge transforms.
     */
    bindGridControls() {
        this.rowsSlider.oninput = e => { this.config.rows = +e.target.value; this.rowsValue.textContent = this.config.rows; this.updateSquare(); this.refresh(); };
        this.colsSlider.oninput = e => { this.config.cols = +e.target.value; this.colsValue.textContent = this.config.cols; this.updateSquare(); this.refresh(); };
        this.aspectSlider.oninput = e => { this.config.aspectRatio = +e.target.value; this.aspectValue.textContent = this.config.aspectRatio.toFixed(2); this.refresh(); };
        this.strokeSlider.oninput = e => { this.config.strokeWeight = +e.target.value; this.strokeValue.textContent = this.config.strokeWeight; this.render(); };
        this.strokeCapSelect.onchange = e => { this.config.strokeCap = e.target.value; this.render(); };
        this.strokeJoinSelect.onchange = e => { this.config.strokeJoin = e.target.value; this.render(); };
        this.lockSquareCheck.onclick = () => { this.config.lockSquare = this.lockSquareCheck.checked; this.updateSquare(); this.refresh(); };
        this.gridTypeSelect.onchange = e => { this.config.gridType = e.target.value; this.refresh(); };

        this.clearBtn.onclick = () => { const g = this.glyph(); g.fills.clear(); g.strokes.clear(); this.refresh(); };
        this.btnFill.onclick = () => this.setTool('fill');
        this.btnLine.onclick = () => this.setTool('line');

        this.flipHBtn.onclick = () => { this.flipGlyph('H'); this.refresh(); };
        this.flipVBtn.onclick = () => { this.flipGlyph('V'); this.refresh(); };
        this.rotate180Btn.onclick = () => { this.flipGlyph('H'); this.flipGlyph('V'); this.refresh(); };

        this.nudgeLBtn.onclick = () => { this.nudgeGlyph(-1, 0); this.refresh(); };
        this.nudgeRBtn.onclick = () => { this.nudgeGlyph(1, 0); this.refresh(); };
        this.nudgeUBtn.onclick = () => { this.nudgeGlyph(0, -1); this.refresh(); };
        this.nudgeDBtn.onclick = () => { this.nudgeGlyph(0, 1); this.refresh(); };
    }

    /** Sync the controls that both tools share from the current config. */
    syncGridControls() {
        this.rowsSlider.value = this.config.rows;
        this.colsSlider.value = this.config.cols;
        this.aspectSlider.value = this.config.aspectRatio;
        this.strokeSlider.value = this.config.strokeWeight;
        this.rowsValue.textContent = this.config.rows;
        this.colsValue.textContent = this.config.cols;
        this.aspectValue.textContent = this.config.aspectRatio.toFixed(2);
        this.strokeCapSelect.value = this.config.strokeCap || 'round';
        this.strokeJoinSelect.value = this.config.strokeJoin || 'round';
        this.lockSquareCheck.checked = !!this.config.lockSquare;
        this.gridTypeSelect.value = this.config.gridType;
        this.updateSquare();
        this.setTool(this.config.activeTool);
    }
}
