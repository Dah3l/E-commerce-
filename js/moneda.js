/**
 * GESTIÓN DE MONEDA (USD / CUP)
 *
 * Los precios se guardan SIEMPRE en USD en la base de datos. El comprador
 * puede elegir en el Home si quiere verlos en USD o en CUP; la conversión
 * usa la tasa que define el administrador (cuántos CUP equivalen a 1 USD,
 * p. ej. 1 USD = 700 CUP).
 *
 * Este módulo guarda la preferencia del usuario (localStorage), aplica la
 * conversión y dispara un evento 'currency-changed' para que las páginas
 * vuelvan a renderizar los precios visibles.
 */

import { DEFAULT_CURRENCY } from './config.js';

export const CURRENCIES = ['USD', 'CUP'];
const STORAGE_KEY = 'preferred_currency';

let selectedCurrency = null;   // 'USD' | 'CUP' (elección del comprador)
let baseCurrency = DEFAULT_CURRENCY; // moneda en que el admin guarda los precios (normalmente USD)
let cupRate = 0;               // cuántos CUP equivalen a 1 unidad de la moneda base

/**
 * Lee la preferencia de moneda guardada por el usuario (null si no ha elegido)
 * @returns {string|null}
 */
export function getStoredCurrency() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return CURRENCIES.includes(v) ? v : null;
  } catch (_) {
    return null;
  }
}

/**
 * Define la moneda base de los precios almacenados (desde config_negocio.moneda)
 * @param {string} currency - código ISO (USD...)
 */
export function setBaseCurrency(currency) {
  if (currency) baseCurrency = String(currency).toUpperCase();
}

/**
 * Define la tasa de cambio: cuántos CUP equivalen a 1 unidad de la moneda base
 * @param {number|string} rate - valor de config_negocio.tasa_cambio_cup
 */
export function setCupRate(rate) {
  const n = Number(rate);
  cupRate = Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * ¿La tasa está configurada? (si no, CUP no es seleccionable)
 */
export function hasCupRate() {
  return cupRate > 0;
}

/**
 * Moneda activa para mostrar precios al comprador
 * @returns {string} 'USD' (o moneda base) o 'CUP'
 */
export function getActiveCurrency() {
  if (!selectedCurrency) selectedCurrency = getStoredCurrency();
  // Si eligió CUP pero el admin quitó la tasa, volver a la moneda base
  if (selectedCurrency === 'CUP' && !hasCupRate()) return baseCurrency;
  return selectedCurrency || baseCurrency;
}

/**
 * Cambia la moneda de visualización y avisa a toda la página
 * @param {string} code - 'USD' | 'CUP'
 * @returns {boolean} true si hubo un cambio real
 */
export function setSelectedCurrency(code) {
  const next = CURRENCIES.includes(code) ? code : baseCurrency;
  if (next === selectedCurrency) return false;
  selectedCurrency = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (_) { /* almacenamiento no disponible */ }
  window.dispatchEvent(new CustomEvent('currency-changed', { detail: { currency: next } }));
  return true;
}

/**
 * Convierte un importe de la moneda base a la moneda activa
 * @param {number} amount - importe tal como se guarda en BD (USD)
 * @returns {number} importe ya convertido
 */
export function convertAmount(amount) {
  const value = Number(amount) || 0;
  if (getActiveCurrency() === 'CUP' && hasCupRate()) {
    // En CUP se muestran pesos enteros (sin decimales)
    return Math.round(value * cupRate);
  }
  return value;
}

/**
 * Importe convertido formateado como texto (para totales de WhatsApp etc.)
 * @param {number} amount - importe en moneda base
 * @param {Intl.NumberFormatOptions} opts - opciones extra de formato
 * @returns {string}
 */
export function formatConverted(amount, opts = {}) {
  const code = getActiveCurrency();
  const value = convertAmount(amount);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: code === 'CUP' ? 0 : 2,
      maximumFractionDigits: code === 'CUP' ? 0 : (opts.maximumFractionDigits ?? 2),
      ...opts
    }).format(value);
  } catch (_) {
    return `${value}`;
  }
}

/**
 * Aplica la selección de moneda a todos los elementos de precio ya renderizados
 * ([data-price-usd] contienen el importe en USD). Útil cuando la página no
 * necesita re-render completo (carrito, detalle de producto...).
 */
export function refreshPriceElements(root = document) {
  root.querySelectorAll('[data-price-usd]').forEach((el) => {
    const usd = Number(el.dataset.priceUsd);
    if (!Number.isFinite(usd)) return;
    el.textContent = formatConverted(usd);
  });
}

// Al cambiar la moneda desde cualquier parte, refrescar los precios marcados
window.addEventListener('currency-changed', () => refreshPriceElements());
