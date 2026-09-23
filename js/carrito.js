/**
 * GESTIÓN DEL CARRITO DE COMPRAS
 * Usa localStorage para persistencia entre páginas
 */

import { formatPrice } from './utils.js';
import { formatUsd, formatCup } from './moneda.js';

const CART_STORAGE_KEY = 'shopping_cart';

/**
 * Resultado de una operación sobre el carrito que puede ser rechazada
 * @typedef {{ok: boolean, reason?: string, added?: number, quantity?: number}} CartResult
 */

/**
 * Devuelve la cantidad actual de un producto en el carrito (0 si no está)
 * @param {Array} cart - Carrito
 * @param {string} productId - ID del producto
 * @returns {number}
 */
function getQtyInCart(cart, productId) {
  const item = cart.find(i => String(i.producto_id) === String(productId));
  return item ? (parseInt(item.cantidad, 10) || 0) : 0;
}

/**
 * Obtiene el carrito actual desde localStorage
 * @returns {Array<{producto_id: string, nombre: string, precio: number, cantidad: number, imagen_url: string}>}
 */
export function getCart() {
  const cart = localStorage.getItem(CART_STORAGE_KEY);
  return cart ? JSON.parse(cart) : [];
}

/**
 * Guarda el carrito en localStorage
 * @param {Array} cart - Carrito a guardar
 */
function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  // Dispatch event para actualizar UI en otras páginas
  window.dispatchEvent(new Event('cart-updated'));
}

/**
 * Añade un producto al carrito, respetando el stock disponible.
 * Nunca permite superar la cantidad en stock: si se pide más de lo que
 * queda, añade solo lo disponible y lo indica como "parcial".
 * @param {Object} product - Producto a añadir (con `stock`: número o null)
 * @param {string} product.id - ID del producto
 * @param {string} product.nombre - Nombre del producto
 * @param {number} product.precio - Precio del producto
 * @param {string} product.imagen_url - URL de la imagen
 * @param {number} quantity - Cantidad a añadir (default: 1)
 * @returns {{ok: boolean, reason?: string, added?: number, partial?: boolean, available?: number}}
 *   ok=true: añadido (added = cantidad añadida; partial=true si se recortó por stock).
 *   ok=false: no se añadió nada. reason: 'invalid' | 'out_of_stock' | 'max_reached'.
 */
export function addToCart(product, quantity = 1) {
  if (!product || !product.id) {
    console.error('Producto inválido');
    return { ok: false, reason: 'invalid' };
  }

  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const cart = getCart();
  const currentQty = getQtyInCart(cart, product.id);

  // stock es un número cuando hay control de stock, o null/undefined si no se gestiona
  const hasStockControl = product.stock !== null && product.stock !== undefined && Number.isFinite(Number(product.stock));

  if (hasStockControl) {
    const stock = Math.max(0, parseInt(product.stock, 10));
    if (stock <= 0) {
      return { ok: false, reason: 'out_of_stock', available: 0 };
    }
    const remaining = stock - currentQty;
    if (remaining <= 0) {
      return { ok: false, reason: 'max_reached', available: stock };
    }
    if (qty > remaining) {
      // Añadir solo lo que queda disponible en lugar de rechazar todo
      const existingIndex = cart.findIndex(item => String(item.producto_id) === String(product.id));
      cart[existingIndex].cantidad += remaining;
      saveCart(cart);
      return { ok: true, partial: true, added: remaining, available: stock };
    }
  }

  const existingIndex = cart.findIndex(item => String(item.producto_id) === String(product.id));

  if (existingIndex >= 0) {
    // El producto ya existe, aumentar cantidad
    cart[existingIndex].cantidad += qty;
  } else {
    // Producto nuevo en el carrito
    cart.push({
      producto_id: product.id,
      nombre: product.nombre,
      precio: product.precio_oferta || product.precio,
      cantidad: qty,
      imagen_url: product.imagen_url
    });
  }

  saveCart(cart);
  return { ok: true, added: qty, available: hasStockControl ? parseInt(product.stock, 10) : null };
}

/**
 * Elimina un producto del carrito
 * @param {string} productId - ID del producto a eliminar
 * @returns {boolean} True si se eliminó
 */
export function removeFromCart(productId) {
  const cart = getCart();
  const newCart = cart.filter(item => item.producto_id !== productId);
  
  if (newCart.length !== cart.length) {
    saveCart(newCart);
    return true;
  }
  
  return false;
}

/**
 * Actualiza la cantidad de un producto en el carrito.
 * Si se pasa `maxStock` (número), la cantidad se limita a ese máximo
 * para no permitir superar el stock disponible.
 * @param {string} productId - ID del producto
 * @param {number} quantity - Nueva cantidad (0 o menos elimina el producto)
 * @param {number|null} maxStock - Stock máximo permitido (opcional)
 * @returns {{ok: boolean, clamped?: boolean, quantity?: number}} Resultado
 */
export function updateQuantity(productId, quantity, maxStock = null) {
  const cart = getCart();
  const item = cart.find(i => String(i.producto_id) === String(productId));

  if (!item) return { ok: false };

  let qty = parseInt(quantity, 10);
  if (!Number.isFinite(qty)) qty = 1;

  if (qty <= 0) {
    removeFromCart(productId);
    return { ok: true, quantity: 0 };
  }

  let clamped = false;
  const rawMax = Number(maxStock);
  if (maxStock !== null && maxStock !== undefined && Number.isFinite(rawMax)) {
    const max = Math.max(1, parseInt(rawMax, 10));
    if (qty > max) {
      qty = max;
      clamped = true;
    }
  }

  item.cantidad = qty;
  saveCart(cart);
  return { ok: true, clamped, quantity: qty };
}

/**
 * Vacía completamente el carrito
 */
export function clearCart() {
  saveCart([]);
}

/**
 * Obtiene el número total de items en el carrito
 * @returns {number} Cantidad total de productos
 */
export function getCartCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + item.cantidad, 0);
}

/**
 * Calcula el subtotal del carrito
 * @returns {number} Subtotal
 */
export function getCartSubtotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.precio * item.cantidad), 0);
}

/**
 * Formatea el subtotal para mostrar
 * @param {string} currency - Código de moneda (opcional)
 * @returns {string} Subtotal formateado
 */
export function getFormattedSubtotal(currency) {
  return formatPrice(getCartSubtotal(), currency);
}

/**
 * Obtiene los productos del carrito con formato detallado
 * @returns {Array<Object>} Lista de productos con totales individuales
 */
export function getCartItems() {
  const cart = getCart();
  return cart.map(item => ({
    ...item,
    subtotal: item.precio * item.cantidad
  }));
}

/**
 * Precio en ambas monedas para los mensajes de WhatsApp (ej: "$5.00 USD ≈ 3,500 CUP").
 * Si el admin no configuro la tasa CUP, se muestra solo el precio en USD.
 * @param {number} amount - importe en la moneda base (USD)
 * @returns {string}
 */
function dualPrice(amount) {
  const usd = formatUsd(amount);
  const cup = formatCup(amount);
  return cup ? `${usd} ≈ ${cup}` : usd;
}

/**
 * Genera un mensaje formateado para WhatsApp con el pedido
 * (los precios se muestran tanto en USD como en CUP)
 * @param {string} whatsappNumber - Número de WhatsApp
 * @param {string} currency - Código de moneda
 * @returns {string} Mensaje formateado
 */
export function generateWhatsAppMessage(whatsappNumber, currency) {
  const items = getCartItems();
  const subtotal = getCartSubtotal();
  
  if (items.length === 0) return '';
  
  let message = '¡Hola! Quiero realizar el siguiente pedido:\n\n';
  message += '*PEDIDO:*\n';
  message += '─────────────────\n';
  
  items.forEach((item, index) => {
    message += `${index + 1}. ${item.nombre}\n`;
    message += `   Cant: ${item.cantidad} x ${dualPrice(item.precio)}\n`;
    message += `   Subtotal: ${dualPrice(item.subtotal)}\n\n`;
  });
  
  message += '─────────────────\n';
  message += `*TOTAL: ${dualPrice(subtotal)}*\n\n`;
  message += 'Gracias.';
  
  return message;
}

/**
 * Abre WhatsApp con el pedido prellenado
 * @param {string} whatsappNumber - Número de WhatsApp (sin + ni espacios)
 * @param {string} currency - Código de moneda
 */
export function checkoutViaWhatsApp(whatsappNumber, currency) {
  const message = generateWhatsAppMessage(whatsappNumber, currency);
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
  
  window.open(url, '_blank');
}

/**
 * Escucha cambios en el carrito para actualizar UI
 * @param {Function} callback - Función a ejecutar cuando cambia el carrito
 * @returns {Function} Función para remover el listener
 */
export function onCartUpdate(callback) {
  const handler = () => callback(getCart());
  window.addEventListener('cart-updated', handler);
  
  // Llamar inmediatamente con el estado actual
  callback(getCart());
  
  return () => window.removeEventListener('cart-updated', handler);
}

/**
 * Inicializa el contador del carrito en el header (si existe)
 */
export function initCartCounter() {
  const counterElement = document.querySelector('.cart-count');
  
  if (counterElement) {
    const updateCounter = () => {
      const count = getCartCount();
      counterElement.textContent = count;
      counterElement.style.display = count > 0 ? 'flex' : 'none';
    };
    
    onCartUpdate(updateCounter);
  }
}
