/**
 * Persistence: localStorage save/load and character set generation.
 */

const STORAGE_KEY = 'typegrid_v4';

export function generateCharSets() {
    const range = (start, end) =>
        Array.from({ length: end - start + 1 }, (_, i) => String.fromCharCode(start + i)).join('');

    const minimal = range(33, 126);
    const latin1Supp = range(161, 255);
    const latinExtA = range(256, 383);
    const latinExtB = range(384, 591);
    const greek = range(913, 937) + range(945, 969);

    return {
        minimal,
        western: minimal + latin1Supp,
        extended: minimal + latin1Supp + latinExtA + latinExtB,
        pro: minimal + latin1Supp + latinExtA + latinExtB + greek + '\uFB01\uFB02'
    };
}

export function saveToStorage(config, glyphs) {
    const data = { config, glyphs: {} };
    Object.entries(glyphs).forEach(([k, v]) => {
        data.glyphs[k] = { fills: [...v.fills], strokes: [...v.strokes] };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        const glyphs = {};
        Object.entries(data.glyphs).forEach(([k, v]) => {
            glyphs[k] = { fills: new Set(v.fills), strokes: new Set(v.strokes) };
        });
        return { config: data.config, glyphs };
    } catch (e) {
        console.warn('Failed to load project from storage:', e);
        return null;
    }
}

export function saveToFile(config, glyphs) {
    const data = { config, glyphs: {} };
    Object.entries(glyphs).forEach(([k, v]) => {
        data.glyphs[k] = { fills: [...v.fills], strokes: [...v.strokes] };
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const name = (config.fontName || 'typegrid').toLowerCase().replace(/\s+/g, '-');
    a.download = `${name}-project.json`;
    a.click();
}

export function loadFromFile(onLoad) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
                const glyphs = {};
                Object.entries(data.glyphs || {}).forEach(([k, v]) => {
                    glyphs[k] = { fills: new Set(v.fills || []), strokes: new Set(v.strokes || []) };
                });
                onLoad({ config: data.config, glyphs });
            } catch (err) {
                console.warn('Failed to parse project file:', err);
                alert('Invalid project file.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}
