/**
 * TYPEGRID – Font editor built on the shared grid editor.
 * Adds character-set management, typographic guides, word preview and font export.
 */
import { GridEditor } from './js/gridEditor.js';
import { drawInto, drawGuidesOnly } from './js/renderer.js';
import { drawTopoOverlay } from './js/topology.js';
import { downloadSVG, exportFont } from './js/export.js';
import { generateCharSets, saveToStorage, loadFromStorage, saveToFile, loadFromFile } from './js/storage.js';
import { gridDims } from './js/strokeId.js';

class Typegrid extends GridEditor {
    constructor() {
        super({
            rows: 6,
            cols: 4,
            aspectRatio: 0.66,
            lockSquare: false,
            charSet: 'minimal',
            gridType: 'triangle',
            showGridLines: true,
            activeTool: 'fill',
            strokeWeight: 4,
            strokeCap: 'round',
            strokeJoin: 'round',
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
        }, 'A');
        this.state.charSets = generateCharSets();
        this.init();
    }

    get label() { return 'Typegrid'; }

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await this.loadInitialData();
        this.renderInventory();
        this.render();
        this.renderPreview();
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
        this.strokeCapSelect = document.getElementById('strokeCapSelect');
        this.strokeJoinSelect = document.getElementById('strokeJoinSelect');
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
        this.bindGridControls();
        this.bindDrawing();

        this.saveBtn.onclick = () => saveToFile(this.config, this.state.glyphs);
        this.loadBtn.onclick = () => {
            loadFromFile(saved => {
                this.state.glyphs = this.adoptGlyphs(saved.glyphs, saved.config || this.config);
                this.config = { ...this.config, ...saved.config };
                this.syncUI();
                this.refresh();
            });
        };
        this.newBtn.onclick = () => { if (confirm('Clear all glyphs and start new?')) { this.state.glyphs = {}; this.refresh(); } };

        this.charSetSelect.onchange = e => { this.config.charSet = e.target.value; this.refresh(); };

        this.exportBtn.onclick = () => exportFont(this.state, this.config, 'ttf');
        document.getElementById('exportFontOTF').onclick = () => exportFont(this.state, this.config, 'otf');
        this.downloadSVGBtn.onclick = () => downloadSVG(this.glyph(), this.config, `${this.config.fontName}-${this.state.activeChar}`);

        this.meanLineSlider.oninput = e => { this.config.meanLine = +e.target.value; this.meanLineValue.textContent = this.config.meanLine; this.render(); };
        this.baselineSlider.oninput = e => { this.config.baseline = +e.target.value; this.baselineValue.textContent = this.config.baseline; this.render(); };

        this.previewInput.oninput = e => { this.config.previewText = e.target.value; this.renderPreview(); };
        this.trackingSlider.oninput = e => {
            this.config.tracking = +e.target.value;
            this.trackingValue.textContent = this.config.tracking;
            this.renderPreview();
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
            this.persist();
        };
        window.onclick = e => { if (e.target === this.metaModal) this.metaModal.classList.remove('active'); };

        this.fontNameInput.oninput = e => {
            this.config.fontName = e.target.value.trim() || 'Typegrid';
            this.persist();
        };
    }

    /* ── PERSISTENCE ─────────────────────────────────────────────────────── */
    persist() {
        saveToStorage(this.config, this.state.glyphs);
    }

    async loadInitialData() {
        const saved = loadFromStorage();
        if (saved) {
            this.state.glyphs = this.adoptGlyphs(saved.glyphs, saved.config || this.config);
            this.config = { ...this.config, ...saved.config };
            this.syncUI();
            return;
        }
        // Fall back to the bundled default font
        try {
            const res = await fetch('./vectoroid.tgf');
            if (!res.ok) throw new Error('not found');
            const data = await res.json();
            const cfg = { ...this.config, ...(data.config || {}) };
            this.state.glyphs = this.adoptGlyphs(data.glyphs || {}, cfg);
            this.config = cfg;
            this.syncUI();
        } catch (e) {
            console.warn('Could not load default font, starting fresh.', e);
        }
    }

    syncUI() {
        if (!this.state.charSets[this.config.charSet]) this.config.charSet = 'minimal';
        this.charSetSelect.value = this.config.charSet;
        this.fontNameInput.value = this.config.fontName || 'Typegrid';
        this.meanLineSlider.value = this.config.meanLine || 2;
        this.meanLineValue.textContent = this.config.meanLine || 2;
        this.baselineSlider.value = this.config.baseline || 5;
        this.baselineValue.textContent = this.config.baseline || 5;
        this.trackingSlider.value = this.config.tracking || 0;
        this.trackingValue.textContent = this.config.tracking || 0;
        this.previewInput.value = this.config.previewText || 'TYPEGRID';
        this.syncGridControls();
    }

    /* ── RENDER ──────────────────────────────────────────────────────────── */
    drawCanvas(W, H) {
        if (this.config.showTopo) {
            drawGuidesOnly(this, this.canvas, W, H);
            drawTopoOverlay(this, this.canvas, W, H);
        } else {
            drawInto(this, this.canvas, this.state.activeChar, W, H, true);
        }
    }

    /* ── GLYPH OVERVIEW ──────────────────────────────────────────────────── */
    renderInventory() {
        const charSet = this.state.charSets[this.config.charSet] || this.state.charSets.minimal;
        this.glyphGrid.innerHTML = '';
        const H_ui = 120;
        const { W, H } = gridDims(this.config);
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
    renderPreview() {
        if (!this.wordPreviewDisplay) return;
        this.wordPreviewDisplay.innerHTML = '';
        const text = this.config.previewText || '';
        const { W, H } = gridDims(this.config);
        const pad = this.config.strokeWeight + 2;
        const tracking = this.config.tracking || 0;

        for (const char of text) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`);
            svg.classList.add('word-preview-svg');

            // Calc actual width based on aspect ratio
            svg.style.width = `${60 * this.config.aspectRatio}px`;
            svg.style.marginRight = `${tracking / 10}px`;

            drawInto(this, svg, char, W, H, false);
            this.wordPreviewDisplay.appendChild(svg);
        }
    }
}

new Typegrid();
