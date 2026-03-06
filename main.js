/**
 * TYPEGRID – Main entry point
 * Imports modular subsystems; handles DOM, state, and event wiring.
 */
import { drawInto, drawGuidesOnly } from './js/renderer.js';
import { drawTopoOverlay } from './js/topology.js';
import { downloadSVG, exportFont } from './js/export.js';
import { generateCharSets, saveToStorage, loadFromStorage, saveToFile, loadFromFile } from './js/storage.js';

class Typegrid {
    constructor() {
        this.config = {
            rows: 6,
            cols: 4,
            aspectRatio: 0.66,
            lockSquare: false,
            charSet: 'minimal',
            gridType: 'triangle',
            showGridLines: true,
            activeTool: 'fill',
            strokeWeight: 4,
            showTopo: false,
            fontName: 'Typegrid',
            baseline: 5,
            meanLine: 2,
            tracking: 0,
            previewText: 'TYPEGRID',
            designer: '',
            designerURL: '',
            manufacturer: '',
            manufacturerURL: '',
            version: '1.000',
            description: '',
            trademark: '',
            license: '',
            licenseURL: '',
            copyright: ''
        };
        this.state = {
            activeChar: 'A',
            glyphs: {},
            charSets: generateCharSets()
        };
        this.init();
    }

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await this.loadInitialData();
        this.setupGlyphs();
        this.render();
        this.renderWordPreview();
    }

    /* ── DOM ─────────────────────────────────────────────────────────────── */
    cacheDOM() {
        this.canvas = document.getElementById('editorCanvas');
        this.rowsSlider = document.getElementById('rowsSlider');
        this.colsSlider = document.getElementById('colsSlider');
        this.aspectSlider = document.getElementById('aspectSlider');
        this.rowsValue = document.getElementById('rowsValue');
        this.colsValue = document.getElementById('colsValue');
        this.aspectValue = document.getElementById('aspectValue');
        this.strokeSlider = document.getElementById('strokeWeight');
        this.strokeValue = document.getElementById('strokeWeightValue');
        this.strokeControl = document.getElementById('strokeControl');
        this.gridTypeSelect = document.getElementById('gridTypeSelect');
        this.glyphGrid = document.getElementById('glyphGrid');
        this.exportBtn = document.getElementById('exportFont');
        this.downloadSVGBtn = document.getElementById('downloadSVG');
        this.clearBtn = document.getElementById('clearGlyph');
        this.saveBtn = document.getElementById('saveProject');
        this.loadBtn = document.getElementById('loadProject');
        this.newBtn = document.getElementById('newProject');
        this.btnFill = document.getElementById('toolFill');
        this.btnLine = document.getElementById('toolLine');
        this.lockSquareCheck = document.getElementById('lockSquare');
        this.charSetSelect = document.getElementById('charSetSelect');
        this.currentCharDisp = document.getElementById('currentCharDisplay');
        this.topoBtn = document.getElementById('vectorPreview');
        this.fontNameInput = document.getElementById('fontNameInput');
        this.meanLineSlider = document.getElementById('meanLineSlider');
        this.meanLineValue = document.getElementById('meanLineValue');
        this.baselineSlider = document.getElementById('baselineSlider');
        this.baselineValue = document.getElementById('baselineValue');
        this.flipHBtn = document.getElementById('flipH');
        this.flipVBtn = document.getElementById('flipV');
        this.rotate180Btn = document.getElementById('rotate180');
        this.nudgeLBtn = document.getElementById('nudgeL');
        this.nudgeRBtn = document.getElementById('nudgeR');
        this.nudgeUBtn = document.getElementById('nudgeU');
        this.nudgeDBtn = document.getElementById('nudgeD');

        this.previewInput = document.getElementById('previewInput');
        this.trackingSlider = document.getElementById('trackingSlider');
        this.trackingValue = document.getElementById('trackingValue');
        this.wordPreviewDisplay = document.getElementById('wordPreviewDisplay');

        this.metaModal = document.getElementById('metadataModal');
        this.editMetaBtn = document.getElementById('editMetadata');
        this.closeMetaBtn = document.getElementById('closeMetadata');
        this.saveMetaBtn = document.getElementById('saveMetadata');

        this.metaFields = {
            designer: document.getElementById('metaDesigner'),
            designerURL: document.getElementById('metaDesignerURL'),
            manufacturer: document.getElementById('metaManufacturer'),
            manufacturerURL: document.getElementById('metaManufacturerURL'),
            version: document.getElementById('metaVersion'),
            description: document.getElementById('metaDescription'),
            trademark: document.getElementById('metaTrademark'),
            license: document.getElementById('metaLicense'),
            licenseURL: document.getElementById('metaLicenseURL'),
            copyright: document.getElementById('metaCopyright')
        };
    }

    /* ── EVENTS ──────────────────────────────────────────────────────────── */
    bindEvents() {
        this.saveBtn.onclick = () => saveToFile(this.config, this.state.glyphs);
        this.loadBtn.onclick = () => {
            loadFromFile(saved => {
                this.config = { ...this.config, ...saved.config };
                this.state.glyphs = saved.glyphs;
                this.syncUI();
                this.refresh();
            });
        };
        this.newBtn.onclick = () => { if (confirm('Clear all glyphs and start new?')) { this.state.glyphs = {}; this.refresh(); } };

        this.rowsSlider.oninput = e => { this.config.rows = +e.target.value; this.rowsValue.textContent = this.config.rows; this.updateSquare(); this.refresh(); };
        this.colsSlider.oninput = e => { this.config.cols = +e.target.value; this.colsValue.textContent = this.config.cols; this.updateSquare(); this.refresh(); };
        this.aspectSlider.oninput = e => { this.config.aspectRatio = +e.target.value; this.aspectValue.textContent = this.config.aspectRatio.toFixed(2); this.refresh(); };
        this.strokeSlider.oninput = e => { this.config.strokeWeight = +e.target.value; this.strokeValue.textContent = this.config.strokeWeight; this.render(); };
        this.lockSquareCheck.onclick = () => { this.config.lockSquare = this.lockSquareCheck.checked; this.updateSquare(); this.refresh(); };

        this.gridTypeSelect.onchange = e => { this.config.gridType = e.target.value; this.refresh(); };
        this.charSetSelect.onchange = e => { this.config.charSet = e.target.value; this.refresh(); };

        this.clearBtn.onclick = () => { const g = this.glyph(); g.fills.clear(); g.strokes.clear(); this.refresh(); };

        this.btnFill.onclick = () => this.setTool('fill');
        this.btnLine.onclick = () => this.setTool('line');

        this.exportBtn.onclick = () => exportFont(this.state, this.config, 'ttf');
        document.getElementById('exportFontOTF').onclick = () => exportFont(this.state, this.config, 'otf');
        this.downloadSVGBtn.onclick = () => downloadSVG(this.canvas, this.state.activeChar, this.config.fontName);

        this.meanLineSlider.oninput = e => { this.config.meanLine = +e.target.value; this.meanLineValue.textContent = this.config.meanLine; this.render(); };
        this.baselineSlider.oninput = e => { this.config.baseline = +e.target.value; this.baselineValue.textContent = this.config.baseline; this.render(); };

        this.flipHBtn.onclick = () => { this.flipGlyph('H'); this.refresh(); };
        this.flipVBtn.onclick = () => { this.flipGlyph('V'); this.refresh(); };
        this.rotate180Btn.onclick = () => { this.flipGlyph('H'); this.flipGlyph('V'); this.refresh(); };

        this.nudgeLBtn.onclick = () => { this.nudgeGlyph(-1, 0); this.refresh(); };
        this.nudgeRBtn.onclick = () => { this.nudgeGlyph(1, 0); this.refresh(); };
        this.nudgeUBtn.onclick = () => { this.nudgeGlyph(0, -1); this.refresh(); };
        this.nudgeDBtn.onclick = () => { this.nudgeGlyph(0, 1); this.refresh(); };

        this.previewInput.oninput = e => { this.config.previewText = e.target.value; this.renderWordPreview(); };
        this.trackingSlider.oninput = e => {
            this.config.tracking = +e.target.value;
            this.trackingValue.textContent = this.config.tracking;
            this.renderWordPreview();
        };

        this.topoBtn.onclick = () => {
            this.config.showTopo = !this.config.showTopo;
            this.topoBtn.classList.toggle('active', this.config.showTopo);
            this.render();
        };

        this.editMetaBtn.onclick = () => {
            Object.keys(this.metaFields).forEach(k => this.metaFields[k].value = this.config[k] || '');
            this.metaModal.classList.add('active');
        };
        this.closeMetaBtn.onclick = () => this.metaModal.classList.remove('active');
        this.saveMetaBtn.onclick = () => {
            Object.keys(this.metaFields).forEach(k => this.config[k] = this.metaFields[k].value);
            this.metaModal.classList.remove('active');
            saveToStorage(this.config, this.state.glyphs);
        };
        window.onclick = e => { if (e.target === this.metaModal) this.metaModal.classList.remove('active'); };

        this.fontNameInput.oninput = e => {
            this.config.fontName = e.target.value.trim() || 'Typegrid';
            saveToStorage(this.config, this.state.glyphs);
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
            this.refresh();
        });

        this.canvas.addEventListener('pointermove', e => {
            if (!isDrawing) return;
            const id = e.target.getAttribute('data-id');
            if (!id) return;

            const g = this.glyph();

            if (id.startsWith('f-') && id !== lastFillId) {
                if (drawMode === 'draw') g.fills.add(id); else g.fills.delete(id);
                lastFillId = id;
                this.refresh();
            } else if ((id.startsWith('s:') || id.startsWith('a:')) && startEdgeId) {
                if (id !== startEdgeId) {
                    const path = this.findPath(startEdgeId, id);
                    this.state.previewPath = path ? path : [startEdgeId, id];
                } else {
                    this.state.previewPath = [startEdgeId];
                }
                this.refresh();
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
        this.setupGlyphs();
        this.renderWordPreview();
        saveToStorage(this.config, this.state.glyphs);
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
            return [`${x1.toFixed(1)},${y1.toFixed(1)}`, `${x2.toFixed(1)},${y2.toFixed(1)}`];
        } else if (id.startsWith('a:')) {
            const parts = id.match(/M([\d.-]+)\s+([\d.-]+)\s+A.*?\s+([\d.-]+)\s+([\d.-]+)$/);
            if (parts) return [`${Number(parts[1]).toFixed(1)},${Number(parts[2]).toFixed(1)}`, `${Number(parts[3]).toFixed(1)},${Number(parts[4]).toFixed(1)}`];
        }
        return null;
    }

    getGraph() {
        if (this._cachedGraph) return this._cachedGraph;
        const edges = document.querySelectorAll('#editorCanvas [data-id^="s:"], #editorCanvas [data-id^="a:"]');
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
            if (curr.path.length > 50) continue; // safety limit

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
    async loadInitialData() {
        // Try localStorage first
        const saved = loadFromStorage();
        if (saved) {
            this.config = { ...this.config, ...saved.config };
            this.state.glyphs = saved.glyphs;
            this.syncUI();
            return;
        }
        // Fall back to the bundled default font
        try {
            const res = await fetch('./vectoroid.tgf');
            if (!res.ok) throw new Error('not found');
            const data = await res.json();
            const glyphs = {};
            Object.entries(data.glyphs || {}).forEach(([k, v]) => {
                glyphs[k] = { fills: new Set(v.fills || []), strokes: new Set(v.strokes || []) };
            });
            this.config = { ...this.config, ...(data.config || {}) };
            this.state.glyphs = glyphs;
            this.syncUI();
        } catch (e) {
            console.warn('Could not load default font, starting fresh.', e);
        }
    }

    loadFromStorage() {
        const saved = loadFromStorage();
        if (!saved) return;
        this.config = { ...this.config, ...saved.config };
        this.state.glyphs = saved.glyphs;
        this.syncUI();
    }

    syncUI() {

        // Sync UI controls
        this.rowsSlider.value = this.config.rows;
        this.colsSlider.value = this.config.cols;
        this.aspectSlider.value = this.config.aspectRatio;
        this.strokeSlider.value = this.config.strokeWeight;
        this.rowsValue.textContent = this.config.rows;
        this.colsValue.textContent = this.config.cols;
        this.aspectValue.textContent = this.config.aspectRatio.toFixed(2);
        this.lockSquareCheck.checked = !!this.config.lockSquare;

        if (!this.state.charSets[this.config.charSet]) this.config.charSet = 'minimal';
        this.charSetSelect.value = this.config.charSet;
        this.gridTypeSelect.value = this.config.gridType;
        this.fontNameInput.value = this.config.fontName || 'Typegrid';
        this.meanLineSlider.value = this.config.meanLine || 2;
        this.meanLineValue.textContent = this.config.meanLine || 2;
        this.baselineSlider.value = this.config.baseline || 5;
        this.baselineValue.textContent = this.config.baseline || 5;
        this.trackingSlider.value = this.config.tracking || 0;
        this.trackingValue.textContent = this.config.tracking || 0;
        this.previewInput.value = this.config.previewText || 'TYPEGRID';
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
                if (axis === 'H') newStrokes.add(`s:${(W - x1).toFixed(1)},${y1.toFixed(1)},${(W - x2).toFixed(1)},${y2.toFixed(1)}`);
                else newStrokes.add(`s:${x1.toFixed(1)},${(H - y1).toFixed(1)},${x2.toFixed(1)},${(H - y2).toFixed(1)}`);
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
            const type = parts[1]; // r, t, c, h
            const i = +parts[2], j = +parts[3];
            const ni = i + dx, nj = j + dy;

            // Reconstruct ID if within bounds
            if (ni >= 0 && ni < (type === 'h' ? rows : cols) && nj >= 0 && nj < (type === 'h' ? cols : rows)) {
                // Keep the same suffix/prefix structure
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
        this._cachedGraph = null; // Clear graph cache when re-rendering
        const H = 600, W = H * this.config.aspectRatio;
        const pad = this.config.strokeWeight + 2;
        this.canvas.setAttribute('viewBox', `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`);
        this.canvas.innerHTML = '';
        if (this.config.showTopo) {
            drawGuidesOnly(this, this.canvas, W, H);
            drawTopoOverlay(this, this.canvas, W, H);
        } else {
            drawInto(this, this.canvas, this.state.activeChar, W, H, true);
        }
    }

    /* ── GLYPH OVERVIEW ──────────────────────────────────────────────────── */
    setupGlyphs() {
        const charSet = this.state.charSets[this.config.charSet] || this.state.charSets.minimal;
        this.glyphGrid.innerHTML = '';
        const H_ui = 120, W_ui = H_ui * this.config.aspectRatio;
        const H = 600, W = H * this.config.aspectRatio;
        const pad = this.config.strokeWeight + 2;

        for (const ch of charSet) {
            const item = document.createElement('div');
            item.className = 'glyph-item' + (ch === this.state.activeChar ? ' active' : '');
            item.setAttribute('draggable', 'true');
            item.setAttribute('data-char', ch);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            // Use local logical 600px space so strokes scale correctly
            svg.setAttribute('viewBox', `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`);
            svg.style.width = '100%';
            svg.style.height = `${H_ui}px`;
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.classList.add('preview-svg');
            drawInto(this, svg, ch, W, H, false);

            const lbl = document.createElement('span');
            lbl.className = 'char-label';
            lbl.textContent = ch;

            item.appendChild(svg);
            item.appendChild(lbl);

            item.onclick = () => { this.state.activeChar = ch; this.refresh(); };

            // Drag and Drop Letter Copy
            item.ondragstart = e => {
                e.dataTransfer.setData('text/plain', ch);
                item.classList.add('dragging');
            };
            item.ondragend = () => item.classList.remove('dragging');
            item.ondragover = e => e.preventDefault();
            item.ondrop = e => {
                e.preventDefault();
                const sourceChar = e.dataTransfer.getData('text/plain');
                if (sourceChar && sourceChar !== ch) {
                    const src = this.glyph(sourceChar);
                    const dest = this.glyph(ch);
                    dest.fills = new Set(src.fills);
                    dest.strokes = new Set(src.strokes);
                    this.refresh();
                }
            };

            this.glyphGrid.appendChild(item);
        }
        this.currentCharDisp.textContent = this.state.activeChar;
    }

    /* ── WORD PREVIEW ────────────────────────────────────────────────────── */
    renderWordPreview() {
        if (!this.wordPreviewDisplay) return;
        this.wordPreviewDisplay.innerHTML = '';
        const text = this.config.previewText || '';
        const H = 600, W = H * this.config.aspectRatio;
        const pad = this.config.strokeWeight + 2;
        const tracking = this.config.tracking || 0;

        for (const char of text) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`);
            svg.classList.add('word-preview-svg');

            // Calc actual width based on aspect ratio
            const displayWidth = 60 * this.config.aspectRatio;
            svg.style.width = `${displayWidth}px`;
            svg.style.marginRight = `${tracking / 10}px`;

            drawInto(this, svg, char, W, H, false);
            this.wordPreviewDisplay.appendChild(svg);
        }
    }
}

new Typegrid();
