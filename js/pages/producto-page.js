import { getProductById, getProductBySlug, getRelatedProducts, renderProductsGrid, setCurrency } from '../productos.js';
import { addToCart, getCart } from '../carrito.js';
import { showToast, escapeHtml, renderSiteHeader, renderSiteFooter, initScrollTopButton, updateGlobalCartCount } from '../ui.js';
import { formatPrice, getUrlParam, formatPlainText } from '../utils.js';
import { getBizConfig, getCurrency, getWhatsAppNumber, getCupRate } from '../config-negocio.js';
import { setBaseCurrency, setCupRate, refreshPriceElements } from '../moneda.js';

// El header se inyecta en init() con el nombre real del negocio
initScrollTopButton();

let product = null;
let currency = 'USD';
let bizConfig = {};

function qty() {
const n = parseInt(document.getElementById('qtyInput').value, 10);
return Number.isFinite(n) && n > 0 ? n : 1;
}

async function loadProduct() {
const id = getUrlParam('id');
const slug = getUrlParam('slug');
const cat = getUrlParam('categoria');

if (id) {
product = await getProductById(id);
} else if (slug) {
product = await getProductBySlug(cat || null, slug);
}

document.getElementById('pdpLoading').style.display = 'none';

if (!product) {
document.getElementById('pdpError').style.display = 'block';
return;
}
render();
}

function render() {
const p = product;
document.title = `${p.nombre} - ${bizConfig.nombre_negocio || 'Mi Tienda'}`;

const img = document.getElementById('pdpImage');
img.src = p.imagen_url || './assets/icons/placeholder.svg';
img.alt = p.nombre;
img.onerror = () => { img.src = './assets/icons/placeholder.svg'; };

document.getElementById('pdpTitle').textContent = p.nombre;
// La descripción conserva su formato: saltos de línea y párrafos del texto escrito en el admin
const descEl = document.getElementById('pdpDescription');
const descHtml = formatPlainText(p.descripcion || '');
if (descHtml) {
  descEl.innerHTML = descHtml;
} else {
  descEl.textContent = '';
}

// Código (SKU) configurado en el panel de administración
const codeEl = document.getElementById('pdpCode');
if (p.codigo) {
  codeEl.textContent = `Código: ${p.codigo}`;
  codeEl.style.display = 'block';
} else {
  codeEl.textContent = '';
  codeEl.style.display = 'none';
}

const tieneOferta = p.precio_oferta && p.precio_oferta < p.precio;
const final = tieneOferta ? p.precio_oferta : p.precio;
const priceEl = document.getElementById('pdpPrice');
priceEl.textContent = formatPrice(final, currency);
// data-price-usd permite reconvertir el precio al cambiar USD/CUP sin recargar
priceEl.dataset.priceUsd = final;
const oldEl = document.getElementById('pdpOldPrice');
oldEl.textContent = tieneOferta ? formatPrice(p.precio, currency) : '';
if (tieneOferta) oldEl.dataset.priceUsd = p.precio; else delete oldEl.dataset.priceUsd;
oldEl.style.display = tieneOferta ? 'inline' : 'none';
document.getElementById('pdpOfferBadge').style.display = tieneOferta ? 'inline-block' : 'none';

updateStockAndQty();

if (p.categorias) {
document.getElementById('pdpCatName').textContent = p.categorias.nombre;
document.getElementById('pdpCatLink').href = `/?categoria=${p.categorias.slug}#all-products`;
}

document.getElementById('pdpContent').style.display = 'block';
loadRelated();
}

// Cantidad ya presente en el carrito para este producto
function qtyInCart() {
if (!product) return 0;
return getCart().reduce((sum, i) => String(i.producto_id) === String(product.id) ? sum + (parseInt(i.cantidad, 10) || 0) : sum, 0);
}

// Stock máximo que aún se puede añadir (null = sin control de stock)
function remainingStock() {
if (!product || product.stock === null) return null;
return Math.max(0, product.stock - qtyInCart());
}

// Refleja el estado del stock en la UI: etiqueta, cantidad y botón
function updateStockAndQty() {
const p = product;
const stockEl = document.getElementById('pdpStock');
const addBtn = document.getElementById('pdpAddToCart');
const qtyInput = document.getElementById('qtyInput');
const remaining = remainingStock();

if (p.stock === 0) {
stockEl.className = 'product-detail__stock product-detail__stock--out';
stockEl.textContent = '✕ Agotado';
} else if (remaining !== null && remaining === 0) {
stockEl.className = 'product-detail__stock product-detail__stock--low';
stockEl.textContent = `Sin unidades disponibles (ya tienes ${qtyInCart()} en el carrito, el máximo en stock)`;
} else if (p.stock !== null && p.stock <= 5) {
stockEl.className = 'product-detail__stock product-detail__stock--low';
stockEl.textContent = `En stock (${p.stock} ${p.stock === 1 ? 'disponible' : 'disponibles'})`;
} else if (p.stock !== null) {
stockEl.className = 'product-detail__stock';
stockEl.textContent = `En stock (${p.stock} disponibles)`;
} else {
stockEl.className = 'product-detail__stock';
stockEl.textContent = 'En stock';
}

// Limitar el selector de cantidad al stock real restante
const max = remaining !== null ? Math.max(1, remaining) : 999;
qtyInput.max = max;
if (qty() > max) qtyInput.value = max;
document.getElementById('qtyPlus').disabled = qty() >= max;

if (p.stock === 0) {
addBtn.disabled = true;
addBtn.textContent = 'Agotado';
} else if (remaining !== null && remaining === 0) {
addBtn.disabled = true;
addBtn.textContent = 'Sin stock disponible';
} else {
addBtn.disabled = false;
addBtn.textContent = 'Añadir al carrito';
}
}

async function loadRelated() {
if (!product.categorias?.id) return;
const { data } = await getRelatedProducts(product.id, product.categorias.id, 4);
if (!data || data.length === 0) return;
document.getElementById('relatedSection').style.display = 'block';
renderProductsGrid(data, '#relatedProducts');
}

// Click en cards relacionadas -> añadir al carrito o abrir detalle
document.addEventListener('click', (e) => {
const btn = e.target.closest('[data-add-to-cart]');
if (btn) {
if (btn.disabled) return;
e.preventDefault();
import('../productos.js').then(m => m.getProductById(btn.dataset.addToCart)).then(p => {
if (!p) return;
const res = addToCart(p, 1);
if (res.ok && res.partial) showToast(`Solo hay ${res.available} unidades de "${p.nombre}" en stock`, 'warning');
else if (res.ok) showToast(`"${p.nombre}" añadido al carrito`, 'success');
else if (res.reason === 'max_reached') showToast(`Ya tienes todas las unidades disponibles de "${p.nombre}" en el carrito`, 'warning');
else if (res.reason === 'out_of_stock') showToast(`"${p.nombre}" está agotado`, 'error');
});
return;
}
const card = e.target.closest('.product-card[data-product-id]');
if (card && String(card.dataset.productId) !== String(product?.id)) {
window.location.href = `./producto.html?id=${card.dataset.productId}`;
}
});

document.getElementById('qtyMinus').addEventListener('click', () => {
const input = document.getElementById('qtyInput');
input.value = Math.max(1, qty() - 1);
updateStockAndQty();
});
document.getElementById('qtyPlus').addEventListener('click', () => {
const input = document.getElementById('qtyInput');
const remaining = remainingStock();
const max = remaining !== null ? Math.max(1, remaining) : 999;
input.value = Math.min(max, qty() + 1);
updateStockAndQty();
});
document.getElementById('qtyInput').addEventListener('change', () => {
updateStockAndQty();
});

document.getElementById('pdpAddToCart').addEventListener('click', () => {
if (!product) return;
const requested = qty();
const res = addToCart(product, requested);
if (res.ok && res.partial) {
showToast(`Solo quedaban ${res.added} unidad${res.added === 1 ? '' : 'es'} en stock. Se añadieron ${res.added} de ${requested}.`, 'warning');
} else if (res.ok) {
showToast(`"${product.nombre}" × ${res.added} añadido al carrito`, 'success');
} else if (res.reason === 'max_reached') {
showToast(`Ya tienes todas las unidades disponibles (${res.available}) en el carrito`, 'warning');
} else if (res.reason === 'out_of_stock') {
showToast('Este producto está agotado', 'error');
} else {
showToast('No se pudo añadir al carrito', 'error');
}
updateStockAndQty();
});

document.getElementById('pdpBuyNow').addEventListener('click', async () => {
if (!product) return;
const phone = getWhatsAppNumber(bizConfig);
if (!phone) {
showToast('El número de WhatsApp no está configurado', 'error');
return;
}
const total = formatPrice((product.precio_oferta || product.precio) * qty(), currency);
const msg = [
`¡Hola${bizConfig.nombre_negocio ? ' ' + bizConfig.nombre_negocio : ''}! 👋`,
`Quiero comprar: *${qty()} x ${product.nombre}*`,
`Total: ${total}`,
'',
`${window.location.origin}${window.location.pathname.replace('[^/]*$','')}producto.html?id=${product.id}`
].join('\n');
window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
});

async function init() {
try {
bizConfig = await getBizConfig();
currency = getCurrency(bizConfig);
setCurrency(currency);
// Moneda base + tasa CUP definidas por el admin (los precios se guardan en USD)
setBaseCurrency(currency);
setCupRate(getCupRate(bizConfig));
refreshPriceElements();
} catch (_) { /* defaults */ }
// Header SIEMPRE visible (logo real + carrito + hamburguesa)
renderSiteHeader('', bizConfig);
try { renderSiteFooter(bizConfig); } catch (_) { /* defaults */ }
updateGlobalCartCount();
await loadProduct();
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', init);
} else {
init();
}
