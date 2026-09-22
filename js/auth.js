/**
 * SISTEMA DE AUTENTICACIÓN PARA ADMINISTRADORES
 * Implementa login con SHA-256 + salt usando Web Crypto API
 */

import { supabase } from './supabase-client.js';
import { SESSION_EXPIRY, MAX_LOGIN_ATTEMPTS, LOGIN_BLOCK_TIME } from './config.js';

const ADMIN_SESSION_KEY = 'admin_session';
const LOGIN_ATTEMPTS_KEY = 'login_attempts';

/**
 * Genera un hash SHA-256 de un string usando Web Crypto API
 * @param {string} text - Texto a hashear
 * @returns {Promise<string>} Hash en hexadecimal
 */
export async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera un salt aleatorio
 * @returns {string} Salt en hexadecimal
 */
export function generateSalt() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Obtiene la configuración de admin desde Supabase
 * @returns {Promise<{password_hash: string, salt: string}>}
 */
export async function getAdminConfig() {
  try {
    const { data, error } = await supabase
      .from('config_admin')
      .select('password_hash, salt')
      .eq('id', 1)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error obteniendo config admin:', error);
    return null;
  }
}

/**
 * Verifica si hay intentos de login bloqueados
 * @returns {boolean} True si está bloqueado
 */
export function isLoginBlocked() {
  const attempts = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || 'null');
  
  if (!attempts) return false;
  
  const now = Date.now();
  if (attempts.count >= MAX_LOGIN_ATTEMPTS && now - attempts.lastAttempt < LOGIN_BLOCK_TIME) {
    return true;
  }
  
  return false;
}

/**
 * Registra un intento de login fallido
 */
export function recordFailedAttempt() {
  const attempts = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{ count: 0, lastAttempt: 0 }');
  const now = Date.now();
  
  // Resetear si pasó el tiempo de bloqueo
  if (now - attempts.lastAttempt > LOGIN_BLOCK_TIME) {
    attempts.count = 0;
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  
  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts));
}

/**
 * Resetea los intentos de login después de un éxito
 */
export function resetLoginAttempts() {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

/**
 * Intenta iniciar sesión con contraseña
 * @param {string} password - Contraseña ingresada
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function login(password) {
  // Verificar si está bloqueado
  if (isLoginBlocked()) {
    return { success: false, error: 'Demasiados intentos fallidos. Intente en 5 minutos.' };
  }
  
  try {
    // Obtener configuración de admin
    const config = await getAdminConfig();
    
    if (!config) {
      return { success: false, error: 'Error de configuración. Contacte al administrador.' };
    }
    
    // Calcular hash: SHA-256(password + salt)
    const hash = await sha256(password + config.salt);
    
    // Comparar hashes
    if (hash === config.password_hash) {
      // Login exitoso
      resetLoginAttempts();
      
      // Crear token de sesión
      const session = {
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + SESSION_EXPIRY
      };
      
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      return { success: true };
    } else {
      // Login fallido
      recordFailedAttempt();
      return { success: false, error: 'Contraseña incorrecta' };
    }
  } catch (error) {
    console.error('Error en login:', error);
    return { success: false, error: 'Error de conexión. Intente nuevamente.' };
  }
}

/**
 * Verifica si la sesión actual es válida
 * @returns {boolean} True si hay sesión activa
 */
export function isAuthenticated() {
  const session = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null');
  
  if (!session || !session.authenticated) return false;
  
  // Verificar expiración
  if (Date.now() > session.expiresAt) {
    logout();
    return false;
  }
  
  return true;
}

/**
 * Cierra la sesión del admin
 */
export function logout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  window.location.href = '/admin/login.html';
}

/**
 * Cambia la contraseña del admin
 * @param {string} currentPassword - Contraseña actual
 * @param {string} newPassword - Nueva contraseña
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function changePassword(currentPassword, newPassword) {
  try {
    // Verificar contraseña actual
    const config = await getAdminConfig();
    const currentHash = await sha256(currentPassword + config.salt);
    
    if (currentHash !== config.password_hash) {
      return { success: false, error: 'Contraseña actual incorrecta' };
    }
    
    // Generar nuevo salt y hash
    const newSalt = generateSalt();
    const newHash = await sha256(newPassword + newSalt);
    
    // Actualizar en Supabase
    const { error } = await supabase
      .from('config_admin')
      .update({
        password_hash: newHash,
        salt: newSalt,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
    
    if (error) throw error;
    
    // Cerrar sesión para forzar re-login
    logout();
    return { success: true };
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    return { success: false, error: 'Error al cambiar contraseña' };
  }
}

/**
 * Inicializa la contraseña por defecto (solo para primera vez)
 * Esto debería ejecutarse desde el script generate-hash.html
 * @param {string} password - Contraseña inicial
 * @returns {Promise<{success: boolean, hash?: string, salt?: string, error?: string}>}
 */
export async function initializeAdminPassword(password) {
  try {
    const salt = generateSalt();
    const hash = await sha256(password + salt);
    
    // Verificar si ya existe configuración
    const existing = await getAdminConfig();
    
    let error;
    if (existing) {
      const { error: updateError } = await supabase
        .from('config_admin')
        .update({
          password_hash: hash,
          salt: salt,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('config_admin')
        .insert([{
          id: 1,
          password_hash: hash,
          salt: salt
        }]);
      error = insertError;
    }
    
    if (error) throw error;
    
    return { success: true, hash, salt };
  } catch (error) {
    console.error('Error inicializando contraseña:', error);
    return { success: false, error: error.message };
  }
}
