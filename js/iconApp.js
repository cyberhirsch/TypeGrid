/**
 * ICONGRID – Logo/Icon design tool sharing Typegrid's grid engine.
 * Same interaction model as Typegrid (draw fills/strokes on a shared grid,
 * flip/rotate/nudge, boolean-union export) but the content model is a small
 * user-defined list of named variants (e.g. "Primary", "Monochrome",
 * "Favicon") instead of one glyph per Unicode character.
 */
import { drawInto } from './renderer.js';
import { downloadSVG, exportPNG } from './export.js';
import { saveIconToStorage, loadIconFromStorage, saveIconToFile, loadIconFromFile } from './storage.js';
import { mkStrokeId, quantize } from './geometry.js';

const DEFAULT_VARIANTS = ['Primary', 'Monochrome', 'Favicon'];

class IconGrid {
    constructor() {
        this.config = {
            rows: 6,
            cols: 6,
            aspectRatio: 1,
            lockSquare: true,
            gridType: 'triangle',
            showGridLines: true,
            activeTool: 'fill',
            strokeWeight: 4,
            strokeCap: 'round',
            strokeJoin: 'round',
            showClearSpace: false,
            brandName: 'IconGrid',
            primaryColor: '#ffffff',
            description: ''
        };
        this.state = {
            activeChar: 'Primary',
            glyphs: {}
        };
        this.history = [];
        this.redoStack = [];
        this.pushHistory();
        this.init();
    }

    pushHistory() {
        const snapshot = JSON.stringify({
            config: this.config,
            glyphs: Object.keys(this.state.glyphs).reduce((acc, key) => {
                acc[key] = {
                    fills: Array.from(this.state.glyphs[key].fills),
                    strokes: Array.from(this.state.glyphs[key].strokes)
                };
                return acc;
            }, {})
        });
        this.history.push(snapshot);
        if (this.history.length > 50) this.history.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.history.length <= 1) return;
        this.redoStack.push(this.history.pop());
        this.applySnapshot(this.history[this.history.length - 1]);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const snapshot = this.redoStack.pop();
        this.history.push(snapshot);
        this.applySnapshot(snapshot);
    }

    applySnapshot(snapshot) {
        const data = JSON.parse(snapshot);
        this.config = { ...this.config, ...data.config };
        this.state.glyphs = {};
        Object.keys(data.glyphs).forEach(key => {
            this.state.glyphs[key] = {
                fills: new Set(data.glyphs[key].fills),
                strokes: new Set(data.glyphs[key].strokes)
            };
        });
        if (Object.keys(this.state.glyphs).length > 0 && !this.state.glyphs[this.state.activeChar]) {
            this.state.activeChar = Object.keys(this.state.glyphs)[0];
        }
        this.syncUI();
        this.refresh();
    }

    /* ── DOM ─────────────────────────────────────────────────────────────── */
    async init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadInitialData();
        this.setupVariants();
        this.render();
        this.renderUsagePreview();
    }

    /* ── DOM ─────────────────────────────────────────────────────────────── */
    cacheDOM() {
        this.canvas = document.getElementById('iconCanvas');
        this.rowsSlider = document.getElementById('iconRowsSlider');
        this.colsSlider = document.getElementById('iconColsSlider');
        this.aspectSlider = document.getElementById('iconAspectSlider');
        this.rowsValue = document.getElementById('iconRowsValue');
        this.colsValue = document.getElementById('iconColsValue');
        this.aspectValue = document.getElementById('iconAspectValue');
        this.strokeSlider = document.getElementById('iconStrokeWeight');
        this.strokeValue = document.getElementById('iconStrokeWeightValue');
        this.strokeCapSelect = document.getElementById('iconStrokeCapSelect');
        this.strokeJoinSelect = document.getElementById('iconStrokeJoinSelect');
        this.strokeControl = document.getElementById('iconStrokeControl');
        this.gridTypeSelect = document.getElementById('iconGridTypeSelect');
        this.variantGrid = document.getElementById('iconVariantGrid');
        this.usagePreview = document.getElementById('iconUsagePreview');
        this.downloadSVGBtn = document.getElementById('iconDownloadSVG');
        this.exportPNGSmallBtn = document.getElementById('iconExportPNGSmall');
        this.exportPNGLargeBtn = document.getElementById('iconExportPNGLarge');
        this.clearBtn = document.getElementById('iconClearGlyph');
        this.saveBtn = document.getElementById('iconSaveProject');
        this.loadBtn = document.getElementById('iconLoadProject');
        this.newBtn = document.getElementById('iconNewProject');
        this.btnFill = document.getElementById('iconToolFill');
        this.btnLine = document.getElementById('iconToolLine');
        this.lockSquareCheck = document.getElementById('iconLockSquare');
        this.currentVariantDisp = document.getElementById('iconCurrentVariantDisplay');
        this.addVariantBtn = document.getElementById('iconAddVariant');
        this.brandNameInput = document.getElementById('iconBrandNameInput');
        this.clearSpaceToggle = document.getElementById('iconClearSpaceToggle');

        this.flipHBtn = document.getElementById('iconFlipH');
        this.flipVBtn = document.getElementById('iconFlipV');
        this.rotate180Btn = document.getElementById('iconRotate180');
        this.nudgeLBtn = document.getElementById('iconNudgeL');
        this.nudgeRBtn = document.getElementById('iconNudgeR');
        this.nudgeUBtn = document.getElementById('iconNudgeU');
        this.nudgeDBtn = document.getElementById('iconNudgeD');

        this.metaModal = document.getElementById('iconMetadataModal');
        this.editMetaBtn = document.getElementById('iconEditMetadata');
        this.closeMetaBtn = document.getElementById('iconCloseMetadata');
        this.saveMetaBtn = document.getElementById('iconSaveMetadata');
        this.metaFields = {
            brandName: document.getElementById('iconMetaBrand'),
            primaryColor: document.getElementById('iconMetaColor'),
            description: document.getElementById('iconMetaDescription')
        };
    }

    /* ── EVENTS ──────────────────────────────────────────────────────────── */
    bindEvents() {
        this.saveBtn.onclick = () => saveIconToFile(this.config, this.state.glyphs);
        this.loadBtn.onclick = () => {
            loadIconFromFile(saved => {
                this.config = { ...this.config, ...saved.config };
                this.state.glyphs = saved.glyphs;
                if (!this.state.glyphs[this.state.activeChar]) {
                    this.state.activeChar = Object.keys(this.state.glyphs)[0] || 'Primary';
                }
                this.syncUI();
                this.refresh();
            });
        };
        this.newBtn.onclick = () => {
            if (confirm('Clear all variants and start new?')) {
                this.state.glyphs = {};
                this.state.activeChar = 'Primary';
                this.refresh();
            }
        };

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

        const markName = () => `${this.config.brandName}-${this.state.activeChar}`;
        const markColor = () => this.config.primaryColor || '#ffffff';
        this.downloadSVGBtn.onclick = () => downloadSVG(this.glyph(), this.config, markName(), markColor());
        this.exportPNGSmallBtn.onclick = () => exportPNG(this.glyph(), this.config, markName(), 64, markColor());
        this.exportPNGLargeBtn.onclick = () => exportPNG(this.glyph(), this.config, markName(), 512, markColor());

        this.clearSpaceToggle.onclick = () => { this.config.showClearSpace = this.clearSpaceToggle.checked; this.render(); };

        this.flipHBtn.onclick = () => { this.flipGlyph('H'); this.refresh(); };
        this.flipVBtn.onclick = () => { this.flipGlyph('V'); this.refresh(); };
        this.rotate180Btn.onclick = () => { this.flipGlyph('H'); this.flipGlyph('V'); this.refresh(); };

        this.nudgeLBtn.onclick = () => { this.nudgeGlyph(-1, 0); this.refresh(); };
        this.nudgeRBtn.onclick = () => { this.nudgeGlyph(1, 0); this.refresh(); };
        this.nudgeUBtn.onclick = () => { this.nudgeGlyph(0, -1); this.refresh(); };
        this.nudgeDBtn.onclick = () => { this.nudgeGlyph(0, 1); this.refresh(); };

        this.addVariantBtn.onclick = () => {
            const name = prompt('Variant name (e.g. Monochrome, Favicon):');
            if (!name || !name.trim()) return;
            const trimmed = name.trim();
            this.glyph(trimmed); // creates it if missing
            this.state.activeChar = trimmed;
            this.refresh();
        };

        this.editMetaBtn.onclick = () => {
            Object.keys(this.metaFields).forEach(k => this.metaFields[k].value = this.config[k] || '');
            this.metaModal.classList.add('active');
        };
        this.closeMetaBtn.onclick = () => this.metaModal.classList.remove('active');
        this.saveMetaBtn.onclick = () => {
            Object.keys(this.metaFields).forEach(k => this.config[k] = this.metaFields[k].value);
            this.metaModal.classList.remove('active');
            this.brandNameInput.value = this.config.brandName || 'IconGrid';
            saveIconToStorage(this.config, this.state.glyphs);
        };
        window.addEventListener('click', e => { if (e.target === this.metaModal) this.metaModal.classList.remove('active'); });

        this.brandNameInput.oninput = e => {
            this.config.brandName = e.target.value.trim() || 'IconGrid';
            saveIconToStorage(this.config, this.state.glyphs);
        };

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
            } else if (id.startsWith('s:') || id.startsWith('a:')) {
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
            } else if ((id.startsWith('s:') || id.startsWith('a:')) && startEdgeId) {
                if (id !== startEdgeId) {
                    const path = this.findPath(startEdgeId, id);
                    this.state.previewPath = path ? path : [startEdgeId, id];
                } else {
                    this.state.previewPath = [startEdgeId];
                }
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

    /* ── STATE HELPERS ───────────────────────────────────────────────────── */
    refresh() {
        this.render();
        this.setupVariants();
        this.renderUsagePreview();
        saveIconToStorage(this.config, this.state.glyphs);
    }

    glyph(c) {
        c = c || this.state.activeChar;
        if (!this.state.glyphs[c]) this.state.glyphs[c] = { fills: new Set(), strokes: new Set() };
        return this.state.glyphs[c];
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

    getEdgeNodes(id) {
        if (id.startsWith('s:')) {
            const [x1, y1, x2, y2] = id.substring(2).split(',').map(Number);
            return [`${quantize(x1).toFixed(1)},${quantize(y1).toFixed(1)}`, `${quantize(x2).toFixed(1)},${quantize(y2).toFixed(1)}`];
        } else if (id.startsWith('a:')) {
            const parts = id.match(/M\s*([\d.-]+)\s+([\d.-]+)\s+A.*?\s+([\d.-]+)\s+([\d.-]+)$/);
            if (parts) return [`${quantize(Number(parts[1])).toFixed(1)},${quantize(Number(parts[2])).toFixed(1)}`, `${quantize(Number(parts[3])).toFixed(1)},${quantize(Number(parts[4])).toFixed(1)}`];
        }
        return null;
    }

    getGraph() {
        if (this._cachedGraph) return this._cachedGraph;
        const edges = document.querySelectorAll('#iconCanvas [data-id^="s:"], #iconCanvas [data-id^="a:"]');
        const graph = new Map();

        edges.forEach(el => {
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

    findPath(startEdgeId, endEdgeId) {
        if (startEdgeId === endEdgeId) return [startEdgeId];
        const graph = this.getGraph();

        const startNodes = this.getEdgeNodes(startEdgeId);
        if (!startNodes) return null;

        const q = [];
        const visitedNodes = new Set();
        q.push({ node: startNodes[0], path: [startEdgeId] });
        q.push({ node: startNodes[1], path: [startEdgeId] });
        visitedNodes.add(startNodes[0]);
        visitedNodes.add(startNodes[1]);

        while (q.length > 0) {
            const curr = q.shift();
            if (curr.path.length > 50) continue;

            const neighbors = graph.get(curr.node) || [];

            for (const neighbor of neighbors) {
                if (neighbor.edgeId === endEdgeId) {
                    return [...curr.path, neighbor.edgeId];
                }
                if (!visitedNodes.has(neighbor.toNode)) {
                    visitedNodes.add(neighbor.toNode);
                    q.push({ node: neighbor.toNode, path: [...curr.path, neighbor.edgeId] });
                }
            }
        }
        return null;
    }

    /* ── PERSISTENCE ─────────────────────────────────────────────────────── */
    loadInitialData() {
        const saved = loadIconFromStorage();
        if (saved) {
            this.config = { ...this.config, ...saved.config };
            this.state.glyphs = saved.glyphs;
            if (!this.state.glyphs[this.state.activeChar]) {
                this.state.activeChar = Object.keys(this.state.glyphs)[0] || 'Primary';
            }
            this.syncUI();
            return;
        }
        DEFAULT_VARIANTS.forEach(name => this.glyph(name));
        this.syncUI();
    }

    syncUI() {
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
        this.clearSpaceToggle.checked = !!this.config.showClearSpace;
        this.gridTypeSelect.value = this.config.gridType;
        this.brandNameInput.value = this.config.brandName || 'IconGrid';
        this.updateSquare();
        this.setTool(this.config.activeTool);
    }

    flipGlyph(axis) {
        const g = this.glyph();
        const H = 600, W = H * this.config.aspectRatio;
        const { cols, rows } = this.config;
        const newFills = new Set();
        const newStrokes = new Set();

        g.fills.forEach(id => {
            if (id.startsWith('f-r-')) {
                const parts = id.split('-');
                const i = +parts[2], j = +parts[3];
                if (axis === 'H') newFills.add(`f-r-${(cols - 1) - i}-${j}`);
                else newFills.add(`f-r-${i}-${(rows - 1) - j}`);
            } else if (id.startsWith('f-t-')) {
                const parts = id.split('-');
                const i = +parts[2], j = +parts[3], pos = parts[4];
                let ni = i, nj = j, npos = pos;
                if (axis === 'H') { ni = (cols - 1) - i; if (pos === 'r') npos = 'l'; else if (pos === 'l') npos = 'r'; }
                else { nj = (rows - 1) - j; if (pos === 't') npos = 'b'; else if (pos === 'b') npos = 't'; }
                newFills.add(`f-t-${ni}-${nj}-${npos}`);
            } else if (id.startsWith('f-c-')) {
                const parts = id.split('-');
                const i = +parts[2], j = +parts[3], pos = parts[4];
                let ni = i, nj = j, npos = pos;
                if (axis === 'H') {
                    ni = (cols - 1) - i;
                    if (pos === 'bl') npos = 'br'; else if (pos === 'br') npos = 'bl';
                    else if (pos === 'tl') npos = 'tr'; else if (pos === 'tr') npos = 'tl';
                } else {
                    nj = (rows - 1) - j;
                    if (pos === 'bl') npos = 'tl'; else if (pos === 'tl') npos = 'bl';
                    else if (pos === 'br') npos = 'tr'; else if (pos === 'tr') npos = 'br';
                }
                newFills.add(`f-c-${ni}-${nj}-${npos}`);
            } else { newFills.add(id); }
        });

        g.strokes.forEach(id => {
            if (id.startsWith('s:')) {
                const [x1, y1, x2, y2] = id.substring(2).split(',').map(Number);
                if (axis === 'H') newStrokes.add(mkStrokeId(W - x1, y1, W - x2, y2));
                else newStrokes.add(mkStrokeId(x1, H - y1, x2, H - y2));
            } else if (id.startsWith('a:')) {
                const m = id.match(/M([\d.-]+)\s+([\d.-]+)\s+A([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/);
                if (m) {
                    let [_, m1, m2, rx, ry, rot, laf, swf, x, y] = m.map(Number);
                    if (axis === 'H') { m1 = W - m1; x = W - x; swf = 1 - swf; }
                    else { m2 = H - m2; y = H - y; swf = 1 - swf; }
                    newStrokes.add(`a:M${m1.toFixed(1)} ${m2.toFixed(1)} A${rx.toFixed(1)} ${ry.toFixed(1)} ${rot} ${laf} ${swf} ${x.toFixed(1)} ${y.toFixed(1)}`);
                }
            } else { newStrokes.add(id); }
        });

        g.fills = newFills;
        g.strokes = newStrokes;
    }

    nudgeGlyph(dx, dy) {
        const g = this.glyph();
        const H = 600, W = H * this.config.aspectRatio;
        const { cols, rows } = this.config;
        const cw = W / cols, rh = H / rows;
        const newFills = new Set();
        const newStrokes = new Set();

        g.fills.forEach(id => {
            const parts = id.split('-');
            const type = parts[1];
            const i = +parts[2], j = +parts[3];
            const ni = i + dx, nj = j + dy;

            if (ni >= 0 && ni < (type === 'h' ? rows : cols) && nj >= 0 && nj < (type === 'h' ? cols : rows)) {
                const suffix = parts.slice(4).join('-');
                newFills.add(`f-${type}-${ni}-${nj}${suffix ? '-' + suffix : ''}`);
            }
        });

        g.strokes.forEach(id => {
            if (id.startsWith('s:')) {
                const [x1, y1, x2, y2] = id.substring(2).split(',').map(Number);
                newStrokes.add(`s:${(x1 + dx * cw).toFixed(1)},${(y1 + dy * rh).toFixed(1)},${(x2 + dx * cw).toFixed(1)},${(y2 + dy * rh).toFixed(1)}`);
            } else if (id.startsWith('a:')) {
                const m = id.match(/M([\d.-]+)\s+([\d.-]+)\s+A([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/);
                if (m) {
                    let [_, m1, m2, rx, ry, rot, laf, swf, x, y] = m.map(Number);
                    m1 += dx * cw; m2 += dy * rh;
                    x += dx * cw; y += dy * rh;
                    newStrokes.add(`a:M${m1.toFixed(1)} ${m2.toFixed(1)} A${rx.toFixed(1)} ${ry.toFixed(1)} ${rot} ${laf} ${swf} ${x.toFixed(1)} ${y.toFixed(1)}`);
                }
            } else { newStrokes.add(id); }
        });

        g.fills = newFills;
        g.strokes = newStrokes;
    }

    /* ── RENDER ──────────────────────────────────────────────────────────── */
    render() {
        this._cachedGraph = null;
        const H = 600, W = H * this.config.aspectRatio;
        const pad = this.config.strokeWeight + 2;
        this.canvas.setAttribute('viewBox', `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`);
        this.canvas.innerHTML = '';
        drawInto(this, this.canvas, this.state.activeChar, W, H, true);

        if (this.config.showClearSpace) {
            const margin = Math.min(W, H) * 0.1;
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', margin);
            rect.setAttribute('y', margin);
            rect.setAttribute('width', W - margin * 2);
            rect.setAttribute('height', H - margin * 2);
            rect.setAttribute('fill', 'none');
            rect.setAttribute('stroke', '#44ff44');
            rect.setAttribute('stroke-width', '1');
            rect.setAttribute('stroke-dasharray', '6 6');
            rect.style.pointerEvents = 'none';
            this.canvas.appendChild(rect);
        }
    }

    /* ── VARIANT OVERVIEW ────────────────────────────────────────────────── */
    setupVariants() {
        this.variantGrid.innerHTML = '';
        const names = Object.keys(this.state.glyphs).length ? Object.keys(this.state.glyphs) : DEFAULT_VARIANTS;
        const H_ui = 120, W_ui = H_ui * this.config.aspectRatio;
        const H = 600, W = H * this.config.aspectRatio;
        const pad = this.config.strokeWeight + 2;

        for (const name of names) {
            const item = document.createElement('div');
            item.className = 'glyph-item' + (name === this.state.activeChar ? ' active' : '');

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`);
            svg.style.width = '100%';
            svg.style.height = `${H_ui}px`;
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.classList.add('preview-svg');
            drawInto(this, svg, name, W, H, false);

            const lbl = document.createElement('span');
            lbl.className = 'char-label';
            lbl.textContent = name;

            item.appendChild(svg);
            item.appendChild(lbl);

            item.onclick = (e) => {
                if (e.detail === 2) {
                    const renamed = prompt('Rename variant:', name);
                    if (!renamed || !renamed.trim() || renamed === name) return;
                    const trimmed = renamed.trim();
                    this.state.glyphs[trimmed] = this.state.glyphs[name];
                    delete this.state.glyphs[name];
                    if (this.state.activeChar === name) this.state.activeChar = trimmed;
                }
                this.state.activeChar = name;
                this.refresh();
            };
            item.oncontextmenu = e => {
                e.preventDefault();
                if (Object.keys(this.state.glyphs).length <= 1) return;
                if (!confirm(`Delete variant "${name}"?`)) return;
                delete this.state.glyphs[name];
                if (this.state.activeChar === name) this.state.activeChar = Object.keys(this.state.glyphs)[0];
                this.refresh();
            };

            this.variantGrid.appendChild(item);
        }
        this.currentVariantDisp.textContent = this.state.activeChar;
    }

    /* ── USAGE PREVIEW ───────────────────────────────────────────────────── */
    renderUsagePreview() {
        if (!this.usagePreview) return;
        this.usagePreview.innerHTML = '';
        const H = 600, W = H * this.config.aspectRatio;
        const sizes = [64, 32, 16];

        sizes.forEach(size => {
            ['dark', 'light'].forEach(theme => {
                const swatch = document.createElement('div');
                swatch.className = `usage-swatch ${theme}`;
                swatch.style.width = `${size}px`;
                swatch.style.height = `${size}px`;

                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
                svg.setAttribute('width', size);
                svg.setAttribute('height', size);
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                drawInto(this, svg, this.state.activeChar, W, H, false, false);

                swatch.appendChild(svg);
                this.usagePreview.appendChild(swatch);
            });
        });
    }
}

new IconGrid();
