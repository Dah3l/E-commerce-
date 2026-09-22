/**
 * GESTIÓN DEL CARRITO DE COMPRAS
 * Usa localStorage para persistencia entre páginas
 */

import { formatPrice } from './utils.js';

const CART_STORAGE_KEY = 'shopping_cart';

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
 * Añade un producto al carrito
 * @param {Object} product - Producto a añadir
 * @param {string} product.id - ID del producto
 * @param {string} product.nombre - Nombre del producto
 * @param {number} product.precio - Precio del producto
 * @param {string} product.imagen_url - URL de la imagen
 * @param {number} quantity - Cantidad a añadir (default: 1)
 * @returns {boolean} True si se añadió exitosamente
 */
export function addToCart(product, quantity = 1) {
  if (!product || !product.id) {
    console.error('Producto inválido');
    return false;
  }
  
  const cart = getCart();
  const existingIndex = cart.findIndex(item => item.producto_id === product.id);
  
  if (existingIndex >= 0) {
    // El producto ya existe, aumentar cantidad
    cart[existingIndex].cantidad += quantity;
  } else {
    // Producto nuevo en el carrito
    cart.push({
      producto_id: product.id,
      nombre: product.nombre,
      precio: product.precio_oferta || product.precio,
      cantidad: quantity,
      imagen_url: product.imagen_url
    });
  }
  
  saveCart(cart);
  return true;
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
 * Actualiza la cantidad de un producto en el carrito
 * @param {string} productId - ID del producto
 * @param {number} quantity - Nueva cantidad (0 o menos elimina el producto)
 * @returns {boolean} True si se actualizó
 */
export function updateQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find(item => item.producto_id === productId);
  
  if (!item) return false;
  
  if (quantity <= 0) {
    return removeFromCart(productId);
  }
  
  item.cantidad = quantity;
  saveCart(cart);
  return true;
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
 * Genera un mensaje formateado para WhatsApp con el pedido
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
    message += `   Cant: ${item.cantidad} x ${formatPrice(item.precio, currency)}\n`;
    message += `   Subtotal: ${formatPrice(item.subtotal, currency)}\n\n`;
  });
  
  message += '─────────────────\n';
  message += `*TOTAL: ${formatPrice(subtotal, currency)}*\n\n`;
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
