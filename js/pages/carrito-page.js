import { getCartItems, addToCart, removeFromCart, updateQuantity, getCartSubtotal, clearCart } from '../carrito.js';

// Cache de productos (id -> producto) para conocer el stock al validar cantidades
let productStockCache = {};
function maxStockFor(productId) {
const p = productStockCache[String(productId)];
if (!p || p.stock === null || p.stock === undefined) return null;
return parseInt(p.stock, 10);
}
import { formatPrice, escapeHtml } from '../utils.js';
import { showToast, renderSiteHeader, renderSiteFooter, initScrollTopButton, updateGlobalCartCount } from '../ui.js';
import { getBizConfig, getWhatsAppNumber, getCurrency } from '../config-negocio.js';
import { getProducts, normalizeProduct, setCurrency, renderProductsGrid } from '../productos.js';

// El header se inyecta en init() con el nombre real del negocio
initScrollTopButton();
let currency = 'USD';
let suggestProducts = [];
const container = document.getElementById('cartContent');
const suggestEl = document.getElementById('cartSuggestSection');

// (El contador del carrito lo mantiene sincronizado ui.js: updateGlobalCartCount)

function renderCart() {
const items = getCartItems();
const subtotal = getCartSubtotal();

if (items.length === 0) {
container.innerHTML = '<div class="cart-empty"><div class="cart-empty__icon">🛒</div><h2 class="cart-empty__title">Tu carrito está vacío</h2><p class="cart-empty__text">Agrega productos para comenzar tu compra</p><a href="./" class="btn btn--primary">Ver Productos</a></div>';
return;
}

container.innerHTML = `<div class="cart-container">
<div class="cart-items">${items.map(item => {
const qtyNow = parseInt(item.cantidad, 10) || 1;
const maxS = maxStockFor(item.producto_id);
const atMax = maxS !== null && Number.isFinite(maxS) && qtyNow >= maxS;
const itemWarning = atMax ? `<p class="cart-item__stock-note">⚠ Máximo disponible en stock: ${maxS}</p>` : (maxS !== null ? `<p class="cart-item__stock-note">Máximo disponible: ${maxS}</p>` : '');
return `
<div class="cart-item">
<img src="${escapeHtml(item.imagen_url || './assets/icons/placeholder.svg')}" alt="${escapeHtml(item.nombre)}" class="cart-item__image" onerror="this.src='./assets/icons/placeholder.svg'">
<div class="cart-item__info">
<h3 class="cart-item__name">${escapeHtml(item.nombre)}</h3>
<p class="cart-item__price">${formatPrice(item.precio, currency)}</p>
<div class="cart-item__actions">
<div class="quantity-selector">
<button class="quantity-btn" data-dec="${escapeHtml(item.producto_id)}" aria-label="Restar uno">−</button>
<input type="text" class="quantity-input" data-qty="${escapeHtml(item.producto_id)}" value="${parseInt(item.cantidad, 10) || 1}" inputmode="numeric" aria-label="Cantidad de ${escapeHtml(item.nombre)}">
<button class="quantity-btn" data-inc="${escapeHtml(item.producto_id)}" aria-label="Sumar uno" ${atMax ? 'disabled title="Sin más stock disponible"' : ''}>+</button>
</div>
<button class="cart-item__remove" data-remove="${escapeHtml(item.producto_id)}" aria-label="Eliminar">🗑️</button>
</div>
${itemWarning}
</div>
</div>`;
}).join('')}</div>
<div class="cart-summary">
<h2 class="cart-summary__title">Resumen</h2>
<div class="cart-summary__row"><span>Subtotal</span><span>${formatPrice(subtotal, currency)}</span></div>
<div class="cart-summary__row cart-summary__row--total"><span>Total</span><span>${formatPrice(subtotal, currency)}</span></div>
<button class="btn btn--primary btn--lg cart-summary__btn" id="btnCheckout">✅ Finalizar por WhatsApp</button>
<button class="btn btn--secondary btn--block" id="btnClearCart">🗑️ Vaciar Carrito</button>
</div>
</div>`;
}

// Delegación de eventos: cantidades y eliminar
container.addEventListener('click', (e) => {
const inc = e.target.closest('[data-inc]');
const dec = e.target.closest('[data-dec]');
const rem = e.target.closest('[data-remove]');

if (inc) {
const item = getCartItems().find(i => String(i.producto_id) === inc.dataset.inc);
if (item) {
const current = parseInt(item.cantidad, 10) || 1;
const maxS = maxStockFor(item.producto_id);
const res = updateQuantity(item.producto_id, current + 1, maxS);
if (res.clamped) showToast(`Solo hay ${maxS} unidad${maxS === 1 ? '' : 'es'} de "${item.nombre}" en stock`, 'warning');
renderCart();
updateGlobalCartCount();
}
return;
}
if (dec) {
const item = getCartItems().find(i => String(i.producto_id) === dec.dataset.dec);
if (item) {
updateQuantity(item.producto_id, (parseInt(item.cantidad, 10) || 1) - 1);
renderCart();
updateGlobalCartCount();
}
return;
}
if (rem) {
removeFromCart(rem.dataset.remove);
showToast('Producto eliminado', 'info');
// renderCart + counter se actualizan vía evento cart-updated
}
});

container.addEventListener('change', (e) => {
const qty = e.target.closest('[data-qty]');
if (qty) {
const item = getCartItems().find(i => String(i.producto_id) === qty.dataset.qty);
const maxS = maxStockFor(qty.dataset.qty);
const res = updateQuantity(qty.dataset.qty, parseInt(qty.value, 10) || 1, maxS);
if (res.clamped && item) showToast(`"${item.nombre}": máximo disponible en stock es ${maxS}. Cantidad ajustada.`, 'warning');
// renderCart + contador se actualizan vía evento cart-updated
}
});

// Checkout por WhatsApp con número real del negocio
container.addEventListener('click', async (e) => {
if (!e.target.closest('#btnCheckout')) return;
const items = getCartItems();
if (items.length === 0) return;

const config = await getBizConfig();
const phone = getWhatsAppNumber(config);
if (!phone) {
showToast('El número de WhatsApp no está configurado en la tienda', 'error');
return;
}

const cur = getCurrency(config);
const lines = [
`¡Hola${config.nombre_negocio ? ' ' + config.nombre_negocio : ''}! 👋 Quiero hacer este pedido:`,
'',
...items.map(i => `• ${i.cantidad} x ${i.nombre} — ${formatPrice(Number(i.precio) * (parseInt(i.cantidad, 10) || 1), cur)}`),
'',
`*Total: ${formatPrice(getCartSubtotal(), cur)}*`
];
window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
});

container.addEventListener('click', (e) => {
if (!e.target.closest('#btnClearCart')) return;
clearCart();
showToast('Carrito vaciado', 'info');
});

// Clic en "Ver Productos" u otros enlaces de producto -> detalle (si hay id)
container.addEventListener('click', (e) => {
const card = e.target.closest('.product-card[data-product-id]');
if (card) {
e.preventDefault();
window.location.href = `./producto.html?id=${card.dataset.productId}`;
}
});

// Delegación global: sugerencias "Añadir más productos" + navegación a detalle
document.addEventListener('click', (e) => {
const addBtn = e.target.closest('#cartSuggest [data-add-to-cart]');
if (addBtn) {
if (addBtn.disabled) return;
e.preventDefault();
const p = suggestProducts.find(x => String(x.id) === String(addBtn.dataset.addToCart));
if (p) {
const res = addToCart(p, 1);
if (res.ok && res.partial) showToast(`Solo hay ${res.available} unidad${res.available === 1 ? '' : 'es'} de "${p.nombre}" en stock`, 'warning');
else if (res.ok) showToast(`"${p.nombre}" añadido al carrito`, 'success');
else if (res.reason === 'max_reached') showToast(`Ya tienes todas las unidades disponibles de "${p.nombre}" en el carrito`, 'warning');
else if (res.reason === 'out_of_stock') showToast(`"${p.nombre}" está agotado`, 'error');
}
return;
}
const card = e.target.closest('#cartSuggest .product-card[data-product-id]');
if (card) {
window.location.href = `./producto.html?id=${card.dataset.productId}`;
}
});

// El render se dispara SOLO cuando cambia el storage (una vez), no por cada
// addToCart/updateQuantity interno, para evitar renders dobles/parpadeo.
let lastCartJson = localStorage.getItem('shopping_cart') || '[]';
window.addEventListener('storage', (e) => {
if (e.key !== 'shopping_cart') return;
lastCartJson = e.newValue || '[]';
renderCart();
updateGlobalCartCount();
});
window.addEventListener('cart-updated', () => {
const nowJson = localStorage.getItem('shopping_cart') || '[]';
if (nowJson === lastCartJson) return; // ya renderizado o sin cambios reales
lastCartJson = nowJson;
renderCart();
updateGlobalCartCount();
});

async function loadSuggestions() {
try {
const { data } = await getProducts({ limit: 8 });
suggestProducts = data || [];
if (suggestProducts.length > 0) {
renderProductsGrid(suggestProducts, '#cartSuggest');
suggestEl.style.display = 'block';
}
} catch (_) { /* sin sugerencias */ }
}

// Cargar los productos reales del carrito para conocer su stock y validar cantidades
async function syncStockLimits() {
try {
const items = getCartItems();
if (items.length === 0) return;
const ids = [...new Set(items.map(i => String(i.producto_id)))];
const missing = ids.filter(id => !productStockCache[id]);
if (missing.length > 0) {
const { data } = await getProducts(); // catalogo completo (incluye paginacion interna)
(data || []).forEach(p => { productStockCache[String(p.id)] = p; });
}
// Sanear: recortar cantidades que superen el stock (p.ej. si bajó desde la última visita)
let changed = false;
items.forEach(item => {
const maxS = maxStockFor(item.producto_id);
const qtyNow = parseInt(item.cantidad, 10) || 1;
if (maxS !== null && Number.isFinite(maxS) && qtyNow > maxS) {
updateQuantity(item.producto_id, maxS);
changed = true;
showToast(`"${item.nombre}": solo hay ${maxS} en stock. Cantidad ajustada.`, 'warning');
}
});
if (changed) {
renderCart();
updateGlobalCartCount();
}
} catch (_) { /* si no se puede leer el stock, no bloquear el carrito */ }
}

async function init() {
let config = {};
try {
config = await getBizConfig();
currency = getCurrency(config);
setCurrency(currency);
} catch (_) { /* usar USD */ }
// Header SIEMPRE visible (logo real + carrito + hamburguesa)
renderSiteHeader('carrito', config);
renderSiteFooter(config);
renderCart();
updateGlobalCartCount();
loadSuggestions();
syncStockLimits();
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', init);
} else {
init();
}
