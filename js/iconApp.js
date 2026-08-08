/**
 * ICONGRID – Logo/icon editor built on the shared grid editor.
 * Same drawing model as Typegrid, but the content is a small user-defined list
 * of named variants (e.g. "Primary", "Monochrome", "Favicon") rather than one
 * glyph per Unicode character, and it exports SVG/PNG instead of a font.
 */
import { GridEditor } from './gridEditor.js';
import { drawInto } from './renderer.js';
import { downloadSVG, exportPNG } from './export.js';
import { saveIconToStorage, loadIconFromStorage, saveIconToFile, loadIconFromFile } from './storage.js';
import { gridDims } from './strokeId.js';

const DEFAULT_VARIANTS = ['Primary', 'Monochrome', 'Favicon'];

class IconGrid extends GridEditor {
    constructor() {
        super({
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
        }, 'Primary');
        this.history = [];
        this.redoStack = [];
        this.pushHistory();
        this.init();
    }

    get label() { return 'IconGrid'; }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadInitialData();
        this.renderInventory();
        this.render();
        this.renderPreview();
    }

    /* ── HISTORY ─────────────────────────────────────────────────────────── */
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
        this.bindGridControls();
        this.bindDrawing();

        this.saveBtn.onclick = () => saveIconToFile(this.config, this.state.glyphs);
        this.loadBtn.onclick = () => {
            loadIconFromFile(saved => {
                this.state.glyphs = this.adoptGlyphs(saved.glyphs, saved.config || this.config);
                this.config = { ...this.config, ...saved.config };
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

        const markName = () => `${this.config.brandName}-${this.state.activeChar}`;
        const markColor = () => this.config.primaryColor || '#ffffff';
        this.downloadSVGBtn.onclick = () => downloadSVG(this.glyph(), this.config, markName(), markColor());
        this.exportPNGSmallBtn.onclick = () => exportPNG(this.glyph(), this.config, markName(), 64, markColor());
        this.exportPNGLargeBtn.onclick = () => exportPNG(this.glyph(), this.config, markName(), 512, markColor());

        this.clearSpaceToggle.onclick = () => { this.config.showClearSpace = this.clearSpaceToggle.checked; this.render(); };

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
            this.persist();
        };
        window.addEventListener('click', e => { if (e.target === this.metaModal) this.metaModal.classList.remove('active'); });

        this.brandNameInput.oninput = e => {
            this.config.brandName = e.target.value.trim() || 'IconGrid';
            this.persist();
        };
    }

    /* ── PERSISTENCE ─────────────────────────────────────────────────────── */
    persist() {
        saveIconToStorage(this.config, this.state.glyphs);
    }

    loadInitialData() {
        const saved = loadIconFromStorage();
        if (saved) {
            this.state.glyphs = this.adoptGlyphs(saved.glyphs, saved.config || this.config);
            this.config = { ...this.config, ...saved.config };
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
        this.clearSpaceToggle.checked = !!this.config.showClearSpace;
        this.brandNameInput.value = this.config.brandName || 'IconGrid';
        this.syncGridControls();
    }

    /* ── RENDER ──────────────────────────────────────────────────────────── */
    drawCanvas(W, H) {
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
    renderInventory() {
        this.variantGrid.innerHTML = '';
        const names = Object.keys(this.state.glyphs).length ? Object.keys(this.state.glyphs) : DEFAULT_VARIANTS;
        const H_ui = 120;
        const { W, H } = gridDims(this.config);
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

            // Rename on double-click. This has to be detected inside the single
            // click handler: the first click calls refresh(), which rebuilds this
            // list and detaches the node before an ondblclick could ever fire.
            item.onclick = e => {
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
    renderPreview() {
        if (!this.usagePreview) return;
        this.usagePreview.innerHTML = '';
        const { W, H } = gridDims(this.config);

        for (const size of [64, 32, 16]) {
            for (const theme of ['dark', 'light']) {
                const swatch = document.createElement('div');
                swatch.className = `usage-swatch ${theme}`;
                swatch.style.width = `${size}px`;
                swatch.style.height = `${size}px`;

                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
                svg.setAttribute('width', size);
                svg.setAttribute('height', size);
                svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                // showGuides=false: these swatches should show the mark, not the grid.
                drawInto(this, svg, this.state.activeChar, W, H, false, false);

                swatch.appendChild(svg);
                this.usagePreview.appendChild(swatch);
            }
        }
    }
}

new IconGrid();
