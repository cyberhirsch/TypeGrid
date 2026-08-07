/**
 * Toggles which tool (Typegrid font editor vs Icon/Logo Grid) owns the visible UI.
 * Both apps mount at load and stay in the DOM; this just shows/hides the shells.
 */
export function switchApp(name) {
    document.getElementById('app').style.display = name === 'icon' ? 'none' : '';
    document.getElementById('iconApp').style.display = name === 'icon' ? '' : 'none';
    document.querySelectorAll('.app-switch-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.app === name);
    });
}

window.switchApp = switchApp;
