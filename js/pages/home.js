import { showToast, renderSiteFooter, renderSiteHeader, initScrollTopButton } from '../ui.js';
import { getCategories } from '../categorias.js';
import { getProducts, renderProductsGrid, showProductSkeletons } from '../productos.js';
import { addToCart } from '../carrito.js';
import { getBizConfig, getCurrency } from '../config-negocio.js';

// El header se inyecta tras cargar la config del negocio (ver init() al
// final): asi muestra el nombre real + contador del carrito siempre visible.
initScrollTopButton();

// Cache de productos cargados (para añadir al carrito sin otro fetch)
let loadedProducts = [];
let currentCurrency = 'USD';

// Estado de filtros activos de "Todos los Productos"
const activeFilters = {
  categoriaId: null,   // null = todas
  orden: 'relevancia', // relevancia | precio-asc | precio-desc
  enOferta: false,     // solo productos con oferta
};

// Delegación de eventos: botones "Añadir al carrito" + navegación a detalle
document.addEventListener('click', (e) => {
const btn = e.target.closest('[data-add-to-cart]');
if (btn) {
if (btn.disabled) return;
e.preventDefault();
} else {
// Clic en la card (imagen/título) -> abrir página de producto
const card = e.target.closest('.product-card[data-product-id]');
if (card) {
window.location.href = `./producto.html?id=${card.dataset.productId}`;
return;
}
return;
}

const id = btn.dataset.addToCart;
const product = loadedProducts.find(p => String(p.id) === String(id));
if (!product) {
showToast('No se pudo encontrar el producto', 'error');
return;
}
const res = addToCart(product, 1);
if (res.ok && res.partial) {
showToast(`Solo hay ${res.available} unidad${res.available === 1 ? '' : 'es'} de "${product.nombre}" en stock`, 'warning');
} else if (res.ok) {
showToast(`"${product.nombre}" añadido al carrito`, 'success');
} else if (res.reason === 'max_reached') {
showToast(`Ya tienes todas las unidades disponibles de "${product.nombre}" en el carrito`, 'warning');
} else if (res.reason === 'out_of_stock') {
showToast(`"${product.nombre}" está agotado`, 'error');
}
});

// Cargar categorías y montar filtros
async function loadCategories() {
const categories = await getCategories();

const filtersContainer = document.querySelector('.category-filters');
if (filtersContainer) {
let html = `<button class="category-btn category-btn--active" data-category-id="">Todos</button>`;
html += categories.map(cat => `
<button class="category-btn" data-category-id="${cat.id}" data-category-slug="${cat.slug}">
${cat.nombre}
</button>
`).join('');
filtersContainer.innerHTML = html;

filtersContainer.addEventListener('click', async (e) => {
const btn = e.target.closest('.category-btn');
if (!btn) return;

filtersContainer.querySelectorAll('.category-btn').forEach(b => b.classList.remove('category-btn--active'));
btn.classList.add('category-btn--active');

const categoryId = btn.dataset.categoryId;
activeFilters.categoriaId = categoryId || null;
await loadAllProducts();
});
}

// Grid de categorías (tarjetas) si la página tiene el contenedor
const cardsContainer = document.getElementById('categories-grid');
if (cardsContainer) {
cardsContainer.innerHTML = categories.map(cat => `
<div class="category-card" role="button" tabindex="0" data-category-id="${cat.id}">
<div class="category-card__info">
<h3 class="category-card__title">${cat.nombre}</h3>
${cat.descripcion ? `<p class="category-card__description">${cat.descripcion}</p>` : ''}
</div>
</div>
`).join('') || '<p>No hay categorías disponibles.</p>';

cardsContainer.addEventListener('click', (e) => {
const card = e.target.closest('.category-card');
if (!card) return;
const filterBtn = document.querySelector(`.category-btn[data-category-id="${card.dataset.categoryId}"]`);
filterBtn?.click();
document.querySelector('#all-products')?.scrollIntoView({ behavior: 'smooth' });
});
}
}

// Cargar productos destacados (carrusel horizontal, sin duplicar el grid)
async function loadFeaturedProducts() {
showProductSkeletons('#featured-products', 3);
const { data: products } = await getProducts({ destacados: true, limit: 6 });
const featuredOnly = products.filter(p => !loadedProducts.some(x => x.id === p.id));
loadedProducts.push(...featuredOnly);
renderProductsGrid(products, '#featured-products');
const grid = document.getElementById('featured-products');
grid.classList.add('products-grid--scroll');
}

// Muestra u oculta la seccion de productos destacados segun haya busqueda activa
function setFeaturedVisible(visible) {
const section = document.getElementById('featured-section');
if (section) {
section.classList.toggle('home-featured--hidden', !visible);
section.setAttribute('aria-hidden', String(!visible));
}
}

let currentSearch = '';

// Cargar todos los productos (respeta categoria, busqueda y filtros de orden/oferta)
async function loadAllProducts() {
const categoriaId = activeFilters.categoriaId;
showProductSkeletons('#all-products', 6);
const { data: featured } = await getProducts({ destacados: true, limit: 6 });
let { data: products } = await getProducts({
categoriaId,
busqueda: currentSearch || undefined,
orden: activeFilters.orden,
enOferta: activeFilters.enOferta || undefined,
limit: 24
});

// Fallback: si la búsqueda tiene acentes y no trajo nada, reintentar sin acentos
// (cubre productos guardados como "arroz" cuando el usuario escribe "aróz", etc.)
if (currentSearch && products.length === 0) {
const desaccented = currentSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
if (desaccented !== currentSearch) {
const retry = await getProducts({
categoriaId,
busqueda: desaccented,
orden: activeFilters.orden,
enOferta: activeFilters.enOferta || undefined,
limit: 24
});
products = retry.data;
}
}

// Combinar sin duplicados para que el botón de cualquier card funcione
const merged = [...featured];
for (const p of products) {
if (!merged.some(x => x.id === p.id)) merged.push(p);
}
loadedProducts = merged;
renderProductsGrid(products, '#all-products');
if (products.length === 0) {
document.getElementById('all-products').innerHTML = `<p style="grid-column: 1 / -1; text-align:center; color:#6B7280; padding: 24px;">${currentSearch ? `No encontramos productos para "${currentSearch}".` : 'No hay productos en esta categoría.'}</p>`;
}
}

// Aplica datos del negocio (nombre, moneda, contacto) e inyecta el header
async function applyBizConfig() {
let config = {};
try {
config = await getBizConfig() || {};
} catch (_) { /* usar valores por defecto */ }
currentCurrency = getCurrency(config);
// Header SIEMPRE visible con carrito + hamburguesa, con el nombre real
renderSiteHeader('inicio', config);
renderSiteFooter(config);
if (config.nombre_negocio) {
document.title = `${config.nombre_negocio} - Inicio`;
}
}

// Buscador del hero: al pulsar buscar, va directamente a los productos y
// oculta la seccion de destacados mientras haya una busqueda activa.
function initSearch() {
const form = document.getElementById('searchForm');
if (!form) return;
const input = form.querySelector('input[type="search"]');

const runSearch = async (rawTerm) => {
currentSearch = (rawTerm || '').trim();
if (!currentSearch) {
// Busqueda vacia: restaurar vista normal con destacados visibles
setFeaturedVisible(true);
activeFilters.categoriaId = null;
await loadAllProducts();
return;
}
showToast(`Resultados para "${currentSearch}"`, 'info');
// Ocultar destacados durante la busqueda
setFeaturedVisible(false);
// desactivar filtro de categoria visualmente
document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('category-btn--active'));
document.querySelector('.category-btn[data-category-id=""]')?.classList.add('category-btn--active');
activeFilters.categoriaId = null;
await loadAllProducts();
// Ir directamente a los productos (sin pasar por destacados)
document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

form.addEventListener('submit', async (e) => {
e.preventDefault();
await runSearch(input?.value);
});

// Si el usuario borra el termino, volver a mostrar los destacados
input?.addEventListener('input', () => {
if (!input.value.trim() && currentSearch) {
currentSearch = '';
setFeaturedVisible(true);
loadAllProducts();
}
});
}

// Barra de orden + filtro de ofertas sobre "Todos los Productos"
function initSortBar() {
const bar = document.getElementById('sort-bar');
if (!bar) return;

// Orden por precio (select nativo para accesibilidad y UX movil)
const sortSelect = bar.querySelector('#product-sort');
sortSelect?.addEventListener('change', () => {
activeFilters.orden = sortSelect.value || 'relevancia';
loadAllProducts();
});

// Toggle "Solo en oferta"
const offerToggle = bar.querySelector('#only-offers');
offerToggle?.addEventListener('change', () => {
activeFilters.enOferta = offerToggle.checked;
bar.classList.toggle('sort-bar--offers-active', offerToggle.checked);
loadAllProducts();
});
}

// Muestra un error visible en ambos grids (para que la tienda nunca parezca
// "vacia" sin explicacion si algo falla al cargar)
function showLoadError(msg) {
['#featured-products', '#all-products'].forEach(sel => {
const el = document.querySelector(sel);
if (el && !el.children.length) {
el.innerHTML = `<p style="grid-column: 1 / -1; text-align:center; color:#B91C1C; padding: 24px;">${msg}</p>`;
}
});
}

// Inicializar página
async function init() {
try {
await applyBizConfig();
initSearch();
initSortBar();
await loadCategories();

// Soporte para /?categoria=slug (enlaces desde breadcrumb del detalle de producto)
const params = new URLSearchParams(window.location.search);
const catSlug = params.get('categoria');
let initialCategory = null;
if (catSlug) {
const btn = document.querySelector(`.category-btn[data-category-slug="${catSlug}"]`);
if (btn) {
document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('category-btn--active'));
btn.classList.add('category-btn--active');
initialCategory = btn.dataset.categoryId || null;
}
}
activeFilters.categoriaId = initialCategory;

await Promise.all([loadFeaturedProducts(), loadAllProducts()]);

if (catSlug) {
document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' });
}
} catch (err) {
console.error('Error al inicializar la tienda:', err);
showToast('Hubo un problema al cargar la tienda. Recarga la página.', 'error', 6000);
showLoadError('No se pudieron cargar los productos. <br><button class="btn btn--primary" onclick="location.reload()" style="margin-top:12px;">Reintentar</button>');
}
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', init);
} else {
init();
}
