/**
 * ATRIBUCIÓN DE REFERIDOS (gestores de venta)
 *
 * Cómo funciona:
 * - El gestor comparte su enlace: <tienda>/?ref=<codigo>
 * - Al entrar por ese enlace, la tienda guarda el gestor y la hora del
 *   clic en localStorage.
 * - La atribución dura 24 horas desde el clic. Si el cliente entra de
 *   nuevo con otro código dentro de esas 24 horas, manda el más
 *   reciente y el conteo vuelve a empezar. Pasadas las 24 horas sin
 *   un clic nuevo, la venta ya no se atribuye a ningún gestor.
 * - El pedido por WhatsApp incluye la línea "Gestor: <nombre>" solo
 *   si la atribución sigue viva al momento de pedir.
 *
 * Este módulo se carga en cada página pública y captura el ?ref= al
 * cargar. También lo importa el carrito para resolver el gestor activo.
 */
import { resolveGestor } from './gestores.js';

const REF_STORAGE_KEY = 'referral_attribution';
const REF_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Lee la atribución guardada (o null si no hay o está corrupta)
 * @returns {{code: string, ts: number}|null}
 */
function readStored() {
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.code !== 'string' || typeof data.ts !== 'number') return null;
    return data;
  } catch (_) {
    return null;
  }
}

/**
 * Guarda (o reemplaza) la atribución con la hora actual
 * @param {string} code - Código del gestor
 */
function storeAttribution(code) {
  try {
    localStorage.setItem(REF_STORAGE_KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch (_) { /* sin storage: no se atribuye */ }
}

/**
 * Borra la atribución guardada
 */
function clearAttribution() {
  try { localStorage.removeItem(REF_STORAGE_KEY); } catch (_) { /* nada */ }
}

/**
 * Captura el ?ref= de la URL si trae un código de gestor válido.
 * Un código desconocido se ignora y NO pisa una atribución válida.
 */
export function captureReferral() {
  let code = null;
  try {
    code = new URLSearchParams(window.location.search).get('ref');
  } catch (_) {
    return;
  }
  if (!code) return;
  if (!resolveGestor(code)) return;
  storeAttribution(String(code).trim().toLowerCase());
}

/**
 * Gestor activo en este momento, o null si no hay atribución viva:
 * no hay nada guardado, el código ya no existe, o pasaron 24 horas.
 * @returns {{code: string, name: string}|null}
 */
export function getActiveGestor() {
  const stored = readStored();
  if (!stored) return null;
  if (Date.now() - stored.ts >= REF_TTL_MS) {
    clearAttribution();
    return null;
  }
  const name = resolveGestor(stored.code);
  if (!name) {
    clearAttribution();
    return null;
  }
  return { code: stored.code, name };
}

// Captura automática al cargar el módulo en cada página.
captureReferral();
