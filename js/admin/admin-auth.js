/**
 * GUARD DE RUTAS PARA PANEL ADMIN
 * Verifica autenticación en páginas del admin
 */

import { isAuthenticated } from '../auth.js';

// Lista de rutas públicas (no requieren auth)
const PUBLIC_ROUTES = ['/admin/login.html', '/admin/'];

/**
 * Verifica si la ruta actual requiere autenticación
 * @returns {boolean} True si requiere auth
 */
function requiresAuth() {
  const path = window.location.pathname;
  
  // Normalizar path
  const normalizedPath = path.endsWith('/') ? path + 'login.html' : path;
  
  // Verificar si es ruta pública
  return !PUBLIC_ROUTES.some(route => {
    if (route === '/admin/') {
      return normalizedPath.startsWith('/admin/');
    }
    return normalizedPath === route || normalizedPath.endsWith(route);
  });
}

/**
 * Redirige al login si no está autenticado
 */
export function guardAdminRoute() {
  if (!isAuthenticated()) {
    // Guardar URL actual para redirigir después del login
    sessionStorage.setItem('admin_redirect_url', window.location.pathname);
    window.location.href = '/admin/login.html';
    return false;
  }
  return true;
}

/**
 * Inicializa el guard en una página admin
 * Debe llamarse al cargar cada página del admin (excepto login)
 */
export function initAdminGuard() {
  // Si estamos en login, no aplicar guard
  if (window.location.pathname.includes('/admin/login.html')) {
    return;
  }
  
  // Verificar autenticación
  if (!guardAdminRoute()) {
    return;
  }
  
  // Añadir botón de logout al header si existe
  addLogoutButton();
}

/**
 * Añade un botón de logout al header del admin
 */
function addLogoutButton() {
  document.addEventListener('DOMContentLoaded', () => {
    const headerActions = document.querySelector('.admin-header__actions');
    
    if (headerActions && !headerActions.querySelector('.logout-btn')) {
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'btn btn--secondary logout-btn';
      logoutBtn.innerHTML = '🚪 Salir';
      logoutBtn.setAttribute('aria-label', 'Cerrar sesión');
      
      logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('admin_session');
        window.location.href = '/admin/login.html';
      });
      
      headerActions.appendChild(logoutBtn);
    }
  });
}

/**
 * Obtiene la URL a la que redirigir después del login
 * @returns {string} URL de redirección
 */
export function getRedirectUrl() {
  const url = sessionStorage.getItem('admin_redirect_url');
  sessionStorage.removeItem('admin_redirect_url');
  return url || '/admin/dashboard.html';
}

/**
 * Redirige a la URL guardada o al dashboard por defecto
 */
export function redirectAfterLogin() {
  const redirectUrl = getRedirectUrl();
  window.location.href = redirectUrl;
}
