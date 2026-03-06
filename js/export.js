/**
 * Font and SVG export logic.
 * Uses boolean union to merge all glyph shapes into clean contours before export.
 * Depends on opentype.js being available as a global (loaded via CDN script tag).
 */
import { collectShapes, unionShapes } from './geometry.js';

export function downloadSVG(canvas, activeChar, fontName = 'typegrid') {
    const svgData = new XMLSerializer().serializeToString(canvas);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml' }));
    const name = fontName.replace(/\s+/g, '-');
    a.download = `${name}-${activeChar}.svg`;
    a.click();
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
    const rings = collectShapes(glyph, config, { scale: s, flipY: upm });

    if (rings.length === 0) return path;

    // Perform boolean union
    const merged = unionShapes(rings);

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
