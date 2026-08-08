/**
 * Font and SVG export logic.
 * Uses boolean union to merge all glyph shapes into clean contours before export.
 */
import opentype from 'opentype.js';
import { collectShapes, unionShapes } from './geometry.js';

/** Boolean-union a glyph's shapes into clean outline rings. */
function unionedRings(glyph, config, opts) {
    const rings = collectShapes(glyph, config, opts);
    return rings.length === 0 ? [] : unionShapes(rings);
}

/** Convert unioned rings to an SVG path `d` string. */
function ringsToPathData(merged) {
    let d = '';
    merged.forEach(polygon => {
        polygon.forEach(ring => {
            if (ring.length < 3) return;
            d += `M ${ring[0][0].toFixed(2)} ${ring[0][1].toFixed(2)}`;
            for (let i = 1; i < ring.length; i++) d += ` L ${ring[i][0].toFixed(2)} ${ring[i][1].toFixed(2)}`;
            d += ' Z ';
        });
    });
    return d.trim();
}

/**
 * Build a standalone SVG containing only the glyph's merged outlines —
 * no grid guides, hit zones, or editor overlays. Uses the same padded
 * framing as the editor canvas so boundary strokes aren't clipped.
 */
export function buildCleanSVG(glyph, config, color) {
    const fill = color || '#fff';
    const H = 600, W = H * config.aspectRatio;
    const pad = config.strokeWeight + 2;
    const width = W + 2 * pad, height = H + 2 * pad;

    const d = ringsToPathData(unionedRings(glyph, config));
    const body = d ? `<path d="${d}" fill="${fill}" fill-rule="evenodd"/>` : '';

    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${width} ${height}" width="${width}" height="${height}">${body}</svg>`;
    return { markup, width, height };
}

const safeName = n => String(n).replace(/\s+/g, '-');

export function downloadSVG(glyph, config, baseName = 'typegrid', color) {
    const { markup } = buildCleanSVG(glyph, config, color);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName(baseName)}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPNG(glyph, config, baseName = 'icongrid', size = 512, color) {
    const { markup, width, height } = buildCleanSVG(glyph, config, color);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));

    const img = new Image();
    img.onload = () => {
        // Fit the longest edge to `size`, preserving aspect ratio
        const scale = size / Math.max(width, height);
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));

        const raster = document.createElement('canvas');
        raster.width = w;
        raster.height = h;
        raster.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);

        raster.toBlob(blob => {
            const objUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objUrl;
            a.download = `${safeName(baseName)}-${size}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
        });
    };
    img.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn('PNG export: failed to rasterize SVG');
    };
    img.src = url;
}

export function exportFont(state, config, format = 'ttf') {
    // Convert UI tracking to Em units (UPM = 1000. Preview H = 60. Tracking 10 = 1px spacing)
    // 1px at 60px H = 1/60 of height. 1/60 of 1000 UPM ≈ 16.67 units.
    const trackingUnits = Math.round((config.tracking || 0) * 1.667);
    const defaultWidth = Math.round(700 * (config.aspectRatio || 0.66) / 0.66) + trackingUnits;

    const glyphs = [
        new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: defaultWidth, path: new opentype.Path() })
    ];

    Object.keys(state.glyphs).forEach(ch => {
        const g = state.glyphs[ch];
        if (!g || (g.fills.size === 0 && g.strokes.size === 0)) return;

        glyphs.push(new opentype.Glyph({
            name: ch,
            unicode: ch.charCodeAt(0),
            advanceWidth: defaultWidth,
            path: buildUnionedPath(g, config)
        }));
    });

    const font = new opentype.Font({
        familyName: config.fontName || 'Typegrid',
        styleName: 'Regular',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        designer: config.designer,
        designerURL: config.designerURL,
        manufacturer: config.manufacturer,
        manufacturerURL: config.manufacturerURL,
        version: config.version,
        description: config.description,
        trademark: config.trademark,
        license: config.license,
        licenseURL: config.licenseURL,
        copyright: config.copyright,
        glyphs
    });

    const filename = (config.fontName || 'Typegrid').replace(/\s+/g, '-');
    font.download(`${filename}.${format}`);
}

/**
 * Build a clean opentype Path from the boolean union of all glyph shapes.
 * Coordinates are scaled to UPM (1000) and Y is flipped for font coordinate space.
 */
function buildUnionedPath(glyph, config) {
    const path = new opentype.Path();
    const upm = 1000, H = 600;
    const s = upm / H;

    // Collect shapes already in font coordinate space (scaled + Y-flipped)
    const merged = unionedRings(glyph, config, { scale: s, flipY: upm });

    if (merged.length === 0) return path;

    // Convert merged multi-polygon to opentype path commands
    merged.forEach(polygon => {
        polygon.forEach((ring, ringIndex) => {
            if (ring.length < 3) return;

            // Outer rings: counterclockwise in font space (opentype convention)
            // Hole rings: clockwise
            // polygon-clipping returns outer[0] + holes[1..n]
            const pts = ring;

            path.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) {
                path.lineTo(pts[i][0], pts[i][1]);
            }
            path.closePath();
        });
    });

    return path;
}
