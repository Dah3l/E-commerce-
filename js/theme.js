/**
 * THEME.JS - Modo claro / oscuro
 * ---------------------------------------------
 * Estrategia:
 *  - El tema se guarda en localStorage ('theme': 'light' | 'dark').
 *  - Si el usuario NUNCA eligió, se sigue la preferencia del sistema
 *    (prefers-color-scheme) y se reacciona a sus cambios.
 *  - applyStoredTheme() se llama desde un <script> inline en cada <head>
 *    ANTES de pintar, para evitar el "flash" de tema incorrecto (FOUC).
 *  - initThemeToggle() inyecta el botón 🌙/☀️ en el header y lo sincroniza.
 */

const STORAGE_KEY = 'theme';
const DARK_ATTR = 'data-theme';

function systemPrefersDark() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Tema efectivo actual: elección guardada o preferencia del sistema. */
export function getEffectiveTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) { /* almacenamiento bloqueado: usar sistema */ }
  return systemPrefersDark() ? 'dark' : 'light';
}

/**
 * Aplica el tema al <html> sin animaciones. Llamar lo antes posible
 * (inline en <head>) para evitar parpadeos.
 */
export function applyStoredTheme() {
  const theme = getEffectiveTheme();
  document.documentElement.setAttribute(DARK_ATTR, theme);
  syncThemeColorMeta(theme);
  return theme;
}

function syncThemeColorMeta(theme) {
  // El color de la barra de estado del móvil sigue al fondo de página.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#131712' : '#F7F8F4');
}

/** Cambia el tema, lo persiste y notifica (evento 'theme-change'). */
export function setTheme(theme, { animate = true } = {}) {
  const root = document.documentElement;
  if (animate) root.classList.add('theme-animations');
  root.setAttribute(DARK_ATTR, theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  syncThemeColorMeta(theme);
  if (animate) {
    // Quitar la clase tras la transición para no afectar otros hovers.
    setTimeout(() => root.classList.remove('theme-animations'), 400);
  }
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }));
}

export function toggleTheme() {
  setTheme(getEffectiveTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * Inyecta el botón de tema en el header inyectado por ui.js
 * (renderSiteHeader) y lo mantiene sincronizado. Es idempotente: puede
 * llamarse varias veces; si el header aún no existe, reintenta al cambiar
 * de idioma/render porque el mount solo se rellena una vez.
 */
export function initThemeToggle() {
  const headerMain = document.querySelector('.site-header .header-main');
  if (!headerMain) return;
  if (headerMain.querySelector('.theme-toggle')) {
    updateThemeToggleLabel();
    return;
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';
  btn.addEventListener('click', () => {
    toggleTheme();
    updateThemeToggleLabel();
  });
  // Colocarlo junto al carrito (antes del enlace del carrito).
  const cart = headerMain.querySelector('.header__cart');
  headerMain.insertBefore(btn, cart || null);

  updateThemeToggleLabel();
  window.addEventListener('theme-change', updateThemeToggleLabel);
}

function updateThemeToggleLabel() {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const isDark = getEffectiveTheme() === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
  btn.setAttribute('title', isDark ? 'Modo claro' : 'Modo oscuro');
}

// Reaccionar a cambios del sistema SOLO si el usuario no eligió explícitamente.
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (stored !== 'light' && stored !== 'dark') {
      setTheme(e.matches ? 'dark' : 'light', { animate: true });
      updateThemeToggleLabel();
    }
  });
}
