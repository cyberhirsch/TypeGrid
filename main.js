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
            gridType: 'geometric',
            showGridLines: true,
            activeTool: 'fill',
            strokeWeight: 4,
            showTopo: false,
            fontName: 'Typegrid'
        };
        this.state = {
            activeChar: 'A',
            glyphs: {},
            charSets: generateCharSets()
        };
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadFromStorage();
        this.setupGlyphs();
        this.render();
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
        this.toggleGridBtn = document.getElementById('toggleGridLines');
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
        this.toggleGridBtn.onclick = () => { this.config.showGridLines = !this.config.showGridLines; this.render(); };

        this.btnFill.onclick = () => this.setTool('fill');
        this.btnLine.onclick = () => this.setTool('line');

        this.exportBtn.onclick = () => exportFont(this.state, this.config, 'ttf');
        document.getElementById('exportFontOTF').onclick = () => exportFont(this.state, this.config, 'otf');
        this.downloadSVGBtn.onclick = () => downloadSVG(this.canvas, this.state.activeChar, this.config.fontName);

        this.topoBtn.onclick = () => {
            this.config.showTopo = !this.config.showTopo;
            this.topoBtn.classList.toggle('active', this.config.showTopo);
            this.render();
        };

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
    refresh() { this.render(); this.setupGlyphs(); saveToStorage(this.config, this.state.glyphs); }

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
        this.updateSquare();
        this.setTool(this.config.activeTool);
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
            this.glyphGrid.appendChild(item);
        }
        this.currentCharDisp.textContent = this.state.activeChar;
    }
}

new Typegrid();
