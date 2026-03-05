/**
 * TYPEGRID – Clean rewrite
 */
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
            strokeWeight: 4
        };
        this.state = {
            activeChar: 'A',
            glyphs: {},
            charSets: this.generateCharSets()
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
        this.currentCharDisplay = document.getElementById('currentCharDisplay');
    }

    bindEvents() {
        this.saveBtn.onclick = () => this.saveToStorage();
        this.loadBtn.onclick = () => { this.loadFromStorage(); this.setupGlyphs(); this.render(); };
        this.newBtn.onclick = () => { if (confirm("Clear all glyphs and start new?")) { this.state.glyphs = {}; this.refresh(); } };
        this.rowsSlider.oninput = e => { this.config.rows = +e.target.value; this.rowsValue.textContent = this.config.rows; this.updateSquare(); this.refresh(); };
        this.colsSlider.oninput = e => { this.config.cols = +e.target.value; this.colsValue.textContent = this.config.cols; this.updateSquare(); this.refresh(); };
        this.aspectSlider.oninput = e => { this.config.aspectRatio = +e.target.value; this.aspectValue.textContent = this.config.aspectRatio.toFixed(2); this.refresh(); };
        this.lockSquareCheck.onclick = () => { this.config.lockSquare = this.lockSquareCheck.checked; this.updateSquare(); this.refresh(); };
        this.strokeSlider.oninput = e => { this.config.strokeWeight = +e.target.value; this.strokeValue.textContent = this.config.strokeWeight; this.render(); };
        this.gridTypeSelect.onchange = e => { this.config.gridType = e.target.value; this.refresh(); };
        this.clearBtn.onclick = () => { const g = this.glyph(); g.fills.clear(); g.strokes.clear(); this.refresh(); };
        this.toggleGridBtn.onclick = () => { this.config.showGridLines = !this.config.showGridLines; this.render(); };
        this.btnFill.onclick = () => this.setTool('fill');
        this.btnLine.onclick = () => this.setTool('line');
        this.exportBtn.onclick = () => this.exportFont('ttf');
        document.getElementById('exportFontOTF').onclick = () => this.exportFont('otf');
        this.downloadSVGBtn.onclick = () => this.downloadSVG();
        this.charSetSelect.onchange = e => { this.config.charSet = e.target.value; this.refresh(); };
        this.canvas.addEventListener('mousedown', e => { this.onClick(e); this.refresh(); });
    }

    refresh() { this.render(); this.setupGlyphs(); }

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

    setTool(t) {
        this.config.activeTool = t;
        this.btnFill.classList.toggle('active', t === 'fill');
        this.btnLine.classList.toggle('active', t === 'line');
        this.strokeControl.style.display = t === 'line' ? 'block' : 'none';
        this.render();
    }

    glyph(c) {
        c = c || this.state.activeChar;
        if (!this.state.glyphs[c]) this.state.glyphs[c] = { fills: new Set(), strokes: new Set() };
        return this.state.glyphs[c];
    }

    /* ========== GLYPH OVERVIEW ========== */
    generateCharSets() {
        const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => String.fromCharCode(start + i)).join('');

        const minimal = range(33, 126); // Basic ASCII (no space)
        const latin1Supp = range(161, 255); // Latin-1 Supplement
        const latinExtA = range(256, 383); // Latin Extended-A
        const latinExtB = range(384, 591); // Latin Extended-B
        const greek = range(913, 937) + range(945, 969); // Basic Greek

        return {
            minimal: minimal,
            western: minimal + latin1Supp,
            extended: minimal + latin1Supp + latinExtA + latinExtB,
            pro: minimal + latin1Supp + latinExtA + latinExtB + greek + "ﬁﬂ" // Pro including ligatures
        };
    }

    setupGlyphs() {
        const charSet = this.state.charSets[this.config.charSet] || this.state.charSets.minimal;
        this.glyphGrid.innerHTML = '';
        const H = 120, W = H * this.config.aspectRatio;

        for (const ch of charSet) {
            const item = document.createElement('div');
            item.className = 'glyph-item' + (ch === this.state.activeChar ? ' active' : '');

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.classList.add('preview-svg');
            this.drawInto(svg, ch, W, H, false);

            const lbl = document.createElement('span');
            lbl.className = 'char-label';
            lbl.textContent = ch;

            item.appendChild(svg);
            item.appendChild(lbl);
            item.onclick = () => { this.state.activeChar = ch; this.refresh(); };
            this.glyphGrid.appendChild(item);
        }
        this.currentCharDisplay.textContent = this.state.activeChar;
    }

    setActiveChar(ch) { this.state.activeChar = ch; this.refresh(); }

    /* ========== MAIN RENDER ========== */
    render() {
        const H = 600, W = H * this.config.aspectRatio;
        this.canvas.setAttribute('viewBox', `0 0 ${W} ${H}`);
        this.canvas.innerHTML = '';
        this.drawInto(this.canvas, this.state.activeChar, W, H, true);
    }

    drawInto(svg, ch, W, H, interactive) {
        const cw = W / this.config.cols, ch2 = H / this.config.rows;
        const g = this.glyph(ch);

        // 1) Fill segments
        this.drawFills(svg, ch, cw, ch2, interactive);

        // 2) Strokes
        this.drawStrokes(svg, ch, cw, ch2);

        // 3) Grid guides
        if (this.config.showGridLines || !interactive) this.drawGuides(svg, cw, ch2, W, H, interactive ? '#333' : '#1a1a1a');

        // 4) Hit zones for tools - must be last to be on top
        if (interactive) {
            if (this.config.activeTool === 'fill') {
                // Fills are already interactive in drawFills via data-id
            } else if (this.config.activeTool === 'line') {
                this.drawLineHitZones(svg, cw, ch2, W, H);
            }
        }
    }

    /* ========== GUIDES ========== */
    drawGuides(svg, cw, ch, W, H, color) {
        for (let i = 0; i <= this.config.cols; i++) this.mkLine(svg, i * cw, 0, i * cw, H, color, 0.5);
        for (let j = 0; j <= this.config.rows; j++) this.mkLine(svg, 0, j * ch, W, j * ch, color, 0.5);

        if (this.config.gridType === 'triangle') {
            for (let i = 0; i < this.config.cols; i++) for (let j = 0; j < this.config.rows; j++) {
                this.mkLine(svg, i * cw, j * ch, (i + 1) * cw, (j + 1) * ch, color, 0.3);
                this.mkLine(svg, (i + 1) * cw, j * ch, i * cw, (j + 1) * ch, color, 0.3);
            }
        } else if (this.config.gridType === 'curvature') {
            for (let i = 0; i <= this.config.cols; i++) for (let j = 0; j <= this.config.rows; j++) {
                const c = this.mk(svg, 'circle');
                c.setAttribute('cx', i * cw); c.setAttribute('cy', j * ch); c.setAttribute('r', cw);
                c.setAttribute('fill', 'none'); c.setAttribute('stroke', color);
                c.setAttribute('stroke-width', '0.5'); c.setAttribute('stroke-dasharray', '2,2');
            }
        }
    }

    /* ========== FILLS ========== */
    drawFills(svg, ch, cw, rh, interactive) {
        const fills = this.glyph(ch).fills;
        const canClick = interactive && this.config.activeTool === 'fill';

        for (let i = 0; i < this.config.cols; i++) for (let j = 0; j < this.config.rows; j++) {
            const gt = this.config.gridType;

            if (gt === 'geometric') {
                const id = `f-r-${i}-${j}`;
                const r = this.mk(svg, 'rect');
                r.setAttribute('x', i * cw); r.setAttribute('y', j * rh);
                r.setAttribute('width', cw); r.setAttribute('height', rh);
                r.setAttribute('fill', fills.has(id) ? '#fff' : 'transparent');
                if (canClick) {
                    r.setAttribute('data-id', id);
                } else {
                    r.style.pointerEvents = 'none';
                }

            } else if (gt === 'triangle') {
                const cx = i * cw + cw / 2, cy = j * rh + rh / 2;
                const tl = [i * cw, j * rh], tr = [(i + 1) * cw, j * rh], bl = [i * cw, (j + 1) * rh], br = [(i + 1) * cw, (j + 1) * rh], ct = [cx, cy];
                this.mkPoly(svg, [tl, tr, ct], `f-t-${i}-${j}-t`, fills, canClick);
                this.mkPoly(svg, [tr, br, ct], `f-t-${i}-${j}-r`, fills, canClick);
                this.mkPoly(svg, [br, bl, ct], `f-t-${i}-${j}-b`, fills, canClick);
                this.mkPoly(svg, [bl, tl, ct], `f-t-${i}-${j}-l`, fills, canClick);

            } else if (gt === 'curvature') {
                const x = i * cw, y = j * rh, s = cw;
                this.mkPath(svg, `M${x} ${y}A${s} ${s} 0 0 0 ${x + s} ${y + rh}L${x} ${y + rh}Z`, `f-c-${i}-${j}-bl`, fills, canClick);
                this.mkPath(svg, `M${x + s} ${y}A${s} ${s} 0 0 1 ${x} ${y + rh}L${x + s} ${y + rh}Z`, `f-c-${i}-${j}-br`, fills, canClick);
                this.mkPath(svg, `M${x} ${y + rh}A${s} ${s} 0 0 0 ${x + s} ${y}L${x} ${y}Z`, `f-c-${i}-${j}-tl`, fills, canClick);
                this.mkPath(svg, `M${x + s} ${y + rh}A${s} ${s} 0 0 1 ${x} ${y}L${x + s} ${y}Z`, `f-c-${i}-${j}-tr`, fills, canClick);

            } else if (gt === 'hexagonal') {
                const hW = cw, hH = rh, vd = hH * 0.75, ox = (j % 2 === 0) ? 0 : hW / 2;
                const cx = i * hW + hW / 2 + ox, cy = j * vd + hH / 2;
                const pts = [];
                for (let a = 0; a < 6; a++) { const an = (Math.PI / 180) * (60 * a - 30); pts.push([cx + (hW / 2) * Math.cos(an), cy + (hH / 2) * Math.sin(an)]); }
                this.mkPoly(svg, pts, `f-h-${i}-${j}`, fills, canClick);
            }
        }
    }

    /* ========== STROKES ========== */
    drawStrokes(svg, ch, cw, rh) {
        this.glyph(ch).strokes.forEach(id => {
            if (id.startsWith('s:')) {
                const parts = id.substring(2).split(',').map(Number);
                this.mkLine(svg, parts[0], parts[1], parts[2], parts[3], '#fff', this.config.strokeWeight);
            } else if (id.startsWith('a:')) {
                const pathData = id.substring(2);
                const p = this.mk(svg, 'path');
                p.setAttribute('d', pathData);
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', '#fff');
                p.setAttribute('stroke-width', this.config.strokeWeight);
                p.setAttribute('stroke-linecap', 'round');
                p.style.pointerEvents = 'none';
            }
        });
    }

    /* ========== LINE HIT ZONES ========== */
    drawLineHitZones(svg, cw, rh, W, H) {
        // Vertical segments
        for (let i = 0; i <= this.config.cols; i++) {
            for (let j = 0; j < this.config.rows; j++) {
                this.mkHit(svg, i * cw, j * rh, i * cw, (j + 1) * rh);
            }
        }
        // Horizontal segments
        for (let j = 0; j <= this.config.rows; j++) {
            for (let i = 0; i < this.config.cols; i++) {
                this.mkHit(svg, i * cw, j * rh, (i + 1) * cw, j * rh);
            }
        }

        const gt = this.config.gridType;
        if (gt === 'triangle') {
            for (let i = 0; i < this.config.cols; i++) for (let j = 0; j < this.config.rows; j++) {
                this.mkHit(svg, i * cw, j * rh, (i + 1) * cw, (j + 1) * rh);
                this.mkHit(svg, (i + 1) * cw, j * rh, i * cw, (j + 1) * rh);
            }
        } else if (gt === 'curvature') {
            for (let i = 0; i <= this.config.cols; i++) for (let j = 0; j <= this.config.rows; j++) {
                const x = i * cw, y = j * rh, s = cw;
                this.mkArcHit(svg, `M${x} ${y} A${s} ${s} 0 0 0 ${x + s} ${y + rh}`);
                this.mkArcHit(svg, `M${x + s} ${y} A${s} ${s} 0 0 1 ${x} ${y + rh}`);
                this.mkArcHit(svg, `M${x} ${y + rh} A${s} ${s} 0 0 0 ${x + s} ${y}`);
                this.mkArcHit(svg, `M${x + s} ${y + rh} A${s} ${s} 0 0 1 ${x} ${y}`);
            }
        }
    }

    /* ========== SVG PRIMITIVES ========== */
    mk(svg, tag) { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); svg.appendChild(el); return el; }

    mkLine(svg, x1, y1, x2, y2, color, sw) {
        const l = this.mk(svg, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke', color); l.setAttribute('stroke-width', sw); l.setAttribute('stroke-linecap', 'round');
        l.style.pointerEvents = 'none';
    }

    mkHit(svg, x1, y1, x2, y2) {
        const l = this.mk(svg, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke', 'rgba(255,255,255,0.01)'); l.setAttribute('stroke-width', '12');
        l.setAttribute('data-id', `s:${x1},${y1},${x2},${y2}`);
        l.style.cursor = 'crosshair';
    }

    mkArcHit(svg, d) {
        const p = this.mk(svg, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'rgba(255,255,255,0.01)');
        p.setAttribute('stroke-width', '12');
        p.setAttribute('data-id', `a:${d}`);
        p.style.cursor = 'crosshair';
    }

    mkPoly(svg, pts, id, fills, canClick) {
        const p = this.mk(svg, 'polygon');
        p.setAttribute('points', pts.map(pt => pt.join(',')).join(' '));
        p.setAttribute('fill', fills.has(id) ? '#fff' : 'transparent');
        if (canClick) {
            p.setAttribute('data-id', id);
        } else {
            p.style.pointerEvents = 'none';
        }
    }

    mkPath(svg, d, id, fills, canClick) {
        const p = this.mk(svg, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', fills.has(id) ? '#fff' : 'transparent');
        if (canClick) {
            p.setAttribute('data-id', id);
        } else {
            p.style.pointerEvents = 'none';
        }
    }

    /* ========== INTERACTION ========== */
    onClick(e) {
        const id = e.target.getAttribute('data-id');
        if (!id) return;
        const g = this.glyph();
        if (id.startsWith('f-')) { if (g.fills.has(id)) g.fills.delete(id); else g.fills.add(id); }
        else if (id.startsWith('s:') || id.startsWith('a:')) { if (g.strokes.has(id)) g.strokes.delete(id); else g.strokes.add(id); }
    }

    /* ========== PERSISTENCE ========== */
    saveToStorage() {
        const data = { config: this.config, glyphs: {} };
        Object.entries(this.state.glyphs).forEach(([k, v]) => { data.glyphs[k] = { fills: [...v.fills], strokes: [...v.strokes] }; });
        localStorage.setItem('typegrid_v4', JSON.stringify(data));
    }

    loadFromStorage() {
        const raw = localStorage.getItem('typegrid_v4');
        if (!raw) return;
        const data = JSON.parse(raw);
        this.config = { ...this.config, ...data.config };
        Object.entries(data.glyphs).forEach(([k, v]) => { this.state.glyphs[k] = { fills: new Set(v.fills), strokes: new Set(v.strokes) }; });
        this.rowsSlider.value = this.config.rows; this.colsSlider.value = this.config.cols;
        this.aspectSlider.value = this.config.aspectRatio; this.strokeSlider.value = this.config.strokeWeight;
        this.rowsValue.textContent = this.config.rows; this.colsValue.textContent = this.config.cols;
        this.aspectValue.textContent = this.config.aspectRatio.toFixed(2);
        this.lockSquareCheck.checked = !!this.config.lockSquare;
        if (!this.state.charSets[this.config.charSet]) this.config.charSet = 'minimal';
        this.charSetSelect.value = this.config.charSet;
        this.gridTypeSelect.value = this.config.gridType;
        this.updateSquare();
        this.setTool(this.config.activeTool);
    }

    /* ========== EXPORT ========== */
    downloadSVG() {
        const svgData = new XMLSerializer().serializeToString(this.canvas);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
        a.download = `typegrid-${this.state.activeChar}.svg`; a.click();
    }

    exportFont(format = 'ttf') {
        const glyphs = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 650, path: new opentype.Path() })];
        Object.keys(this.state.glyphs).forEach(ch => {
            glyphs.push(new opentype.Glyph({ name: ch, unicode: ch.charCodeAt(0), advanceWidth: 700, path: this.buildGlyphPath(ch) }));
        });
        const font = new opentype.Font({ familyName: 'Typegrid', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs });
        font.download(`typegrid.${format}`);
    }

    buildGlyphPath(ch) {
        const path = new opentype.Path();
        const g = this.glyph(ch);
        const upm = 1000, H = 600, W = H * this.config.aspectRatio;
        const s = upm / H, cw = W / this.config.cols, rh = H / this.config.rows;

        g.fills.forEach(id => {
            if (id.startsWith('f-r-')) {
                const [i, j] = id.substring(4).split('-').map(Number);
                const x = i * cw * s, y = upm - (j * rh * s), w = cw * s, h = rh * s;
                path.moveTo(x, y); path.lineTo(x + w, y); path.lineTo(x + w, y - h); path.lineTo(x, y - h); path.closePath();
            }
        });

        g.strokes.forEach(id => {
            if (id.startsWith('s:')) {
                const c = id.substring(2).split(',').map(v => Number(v) * s);
                const sw = this.config.strokeWeight * s;
                const x1 = c[0], y1 = upm - c[1], x2 = c[2], y2 = upm - c[3];
                if (x1 === x2) { path.moveTo(x1 - sw / 2, y1); path.lineTo(x1 + sw / 2, y1); path.lineTo(x1 + sw / 2, y2); path.lineTo(x1 - sw / 2, y2); path.closePath(); }
                else if (y1 === y2) { path.moveTo(x1, y1 - sw / 2); path.lineTo(x1, y1 + sw / 2); path.lineTo(x2, y1 + sw / 2); path.lineTo(x2, y1 - sw / 2); path.closePath(); }
            }
        });

        return path;
    }
}

new Typegrid();
