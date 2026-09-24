import { showToast, renderSiteFooter, renderSiteHeader, initScrollTopButton } from '../ui.js';
import { getCategories } from '../categorias.js';
import { getProducts, renderProductsGrid, showProductSkeletons, setCurrency } from '../productos.js';
import { addToCart } from '../carrito.js';
import { getBizConfig, getCurrency, getCupRate, getRateLabel } from '../config-negocio.js';
import { setBaseCurrency, setCupRate, setSelectedCurrency, getActiveCurrency } from '../moneda.js';

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

// ---- Paginación de "Todos los Productos" ----
// Se cargan solo PAGE_SIZE (20) productos por página: nada de scroll infinito.
const PAGE_SIZE = 20;
const paginationState = {
  page: 1,        // página actual (1-based)
  totalPages: 1,  // total de páginas del resultado filtrado
  total: 0,       // total de productos que coinciden con búsqueda/filtros
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

// Marca un chip de categoria como activo (verde) de forma inmediata e
// identica desde cualquier disparador (clic, tarjetas, busqueda, ?categoria=).
// No hay estado intermedio gris: el verde se aplica sincronamente en el mismo
// toque, tanto en modo claro como en oscuro.
function setCategoryActive(btn) {
document.querySelectorAll('.category-btn').forEach(b => {
b.classList.remove('category-btn--active', 'category-btn--pressed', 'category-btn--pending');
b.removeAttribute('aria-pressed');
});
if (btn) {
btn.classList.add('category-btn--active');
btn.setAttribute('aria-pressed', 'true');
}
}

// Feedback verdoso instantaneo ANTES incluso del evento click: en tactil el
// navegador puede demorar (o no aplicar) :active/:hover, asi que al bajar el
// dedo/puntero pintamos el chip con la misma clase verde que usa --active.
// Se enlaza una sola vez por delegacion sobre el contenedor de filtros.
function bindCategoryPressFeedback() {
const container = document.querySelector('.category-filters');
if (!container || container.dataset.pressBound) return;
container.dataset.pressBound = '1';

const markPressed = (target) => {
const btn = target.closest?.('.category-btn');
if (!btn || btn.classList.contains('category-btn--active')) return;
btn.classList.add('category-btn--pressed');
};
const clearPressed = () => {
container.querySelectorAll('.category-btn--pressed').forEach(b => b.classList.remove('category-btn--pressed'));
};

// pointerdown cubre raton, tactil y lapiz; pointercancel/leave limpian si el
// gesto no llega a convertirse en clic.
container.addEventListener('pointerdown', (e) => markPressed(e.target));
container.addEventListener('pointerup', () => {
// El click (que llama a setCategoryActive) todavia no se disparo: quitamos la
// clase temporal en el siguiente tick para evitar parpadeos/doble pintado.
setTimeout(clearPressed, 0);
});
container.addEventListener('pointercancel', clearPressed);
container.addEventListener('pointerleave', clearPressed);
}

// Cargar categorías y montar filtros
async function loadCategories() {
const categories = await getCategories();

const filtersContainer = document.querySelector('.category-filters');
if (filtersContainer) {
let html = `<button class="category-btn category-btn--active" data-category-id="" aria-pressed="true">Todos</button>`;
html += categories.map(cat => `
<button class="category-btn" data-category-id="${cat.id}" data-category-slug="${cat.slug}">
${cat.nombre}
</button>
`).join('');
filtersContainer.innerHTML = html;

// Verde en el mismo instante del toque (pointerdown), no solo al soltar/click.
bindCategoryPressFeedback();

filtersContainer.addEventListener('click', async (e) => {
const btn = e.target.closest('.category-btn');
if (!btn) return;

// Marcar SIEMPRE al instante: el toque se registra visualmente en el momento
// (antes de esperar los datos), no cuando se entra o sale de otra pagina.
setCategoryActive(btn);

const categoryId = btn.dataset.categoryId;
activeFilters.categoriaId = categoryId || null;
paginationState.page = 1; // al cambiar de categoria, volver a la primera pagina
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

// Contador de resultados: refleja lo que se esta mostrando segun busqueda/filtros
function updateResultsCount(shown, total, hasFilters) {
const el = document.getElementById('results-count');
if (!el) return;
if (!total) {
el.textContent = '';
return;
}
const plural = (n) => n === 1 ? 'producto' : 'productos';
if (currentSearch) {
// Busqueda activa: cantidad de coincidencias (ahora paginadas)
el.innerHTML = `<strong>${shown}</strong> ${plural(shown)} para "${currentSearch}"`;
} else if (hasFilters) {
// Filtros activos (ofertas y/o categoria): mostrados vs. total del catalogo
el.innerHTML = `<strong>${shown}</strong> ${plural(shown)}${shown !== total ? ` de ${total}` : ''} filtrado${shown === 1 ? '' : 's'}`;
} else {
el.innerHTML = `Mostrando <strong>${shown}</strong> ${plural(shown)}${paginationState.totalPages > 1 ? ` de ${total}` : ''}`;
}
// Rango visible actual, util con paginacion (ej. "Pagina 2 de 5")
if (paginationState.totalPages > 1) {
el.innerHTML += ` &middot; P&aacute;gina <strong>${paginationState.page}</strong> de ${paginationState.totalPages}`;
}
}

// Renderiza los botones de paginacion debajo del grid. Se oculta si solo hay
// una pagina (no tiene sentido mostrar controles cuando caben los 20).
function renderPagination() {
const nav = document.getElementById('pagination');
if (!nav) return;

const { page, totalPages } = paginationState;
if (totalPages <= 1) {
nav.hidden = true;
nav.innerHTML = '';
return;
}
nav.hidden = false;

const btn = (label, target, opts = {}) => {
const disabled = opts.disabled ? ' disabled' : '';
const currentClass = opts.current ? ' pagination__btn--current' : '';
const ariaCurrent = opts.current ? ' aria-current="page"' : '';
const extraClass = opts.className ? ` ${opts.className}` : '';
const aria = opts.aria ? ` aria-label="${opts.aria}"` : '';
return `<button type="button" class="pagination__btn${extraClass}${currentClass}" data-page="${target}"${disabled}${ariaCurrent}${aria}>${label}</button>`;
};

// Ventana de numeros alrededor de la pagina actual (1 ... 4 5 6 ... 12)
const pages = [];
const add = (p) => { if (!pages.includes(p) && p >= 1 && p <= totalPages) pages.push(p); };
add(1); add(2);
for (let p = page - 1; p <= page + 1; p++) add(p);
add(totalPages - 1); add(totalPages);
pages.sort((a, b) => a - b);

let html = btn('&laquo;', page - 1, { disabled: page <= 1, className: 'pagination__btn--prev', aria: 'Página anterior' });
let prevNum = 0;
for (const p of pages) {
if (prevNum && p - prevNum > 1) html += `<span class="pagination__ellipsis" aria-hidden="true">&hellip;</span>`;
html += btn(String(p), p, { current: p === page, aria: `Ir a la página ${p}` });
prevNum = p;
}
html += btn('&raquo;', page + 1, { disabled: page >= totalPages, className: 'pagination__btn--next', aria: 'Página siguiente' });
nav.innerHTML = html;
}

// Delegacion de clics de la paginacion (una sola vez, el nav persiste en el DOM)
function initPagination() {
const nav = document.getElementById('pagination');
if (!nav || nav.dataset.bound) return;
nav.dataset.bound = '1';
nav.addEventListener('click', async (e) => {
const btn = e.target.closest('.pagination__btn[data-page]');
if (!btn || btn.disabled) return;
const target = parseInt(btn.dataset.page, 10);
if (!Number.isFinite(target) || target < 1 || target > paginationState.totalPages || target === paginationState.page) return;
paginationState.page = target;
await loadAllProducts();
document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
}

// Cargar una pagina de "Todos los Productos" (respeta categoria, busqueda,
// filtros de orden/oferta y la pagina actual). Solo PAGE_SIZE (20) por carga.
async function loadAllProducts(options = {}) {
const categoriaId = activeFilters.categoriaId;
showProductSkeletons('#all-products', Math.min(PAGE_SIZE, 8));
const { data: featured } = await getProducts({ destacados: true, limit: 6 });

// Pagina concreta: offset + limit (paginacion real en la BD, sin scroll infinito)
let { data: products, count: filteredCount } = await getProducts({
categoriaId,
busqueda: currentSearch || undefined,
orden: activeFilters.orden,
enOferta: activeFilters.enOferta || undefined,
limit: PAGE_SIZE,
offset: (paginationState.page - 1) * PAGE_SIZE
});

// Fallback: si la búsqueda tiene acentes y no trajo nada, reintentar sin acentos
// (cubre productos guardados como "arroz" cuando el usuario escribe "aróz", etc.)
if (currentSearch && products.length === 0 && paginationState.page === 1) {
const desaccented = currentSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
if (desaccented !== currentSearch) {
const retry = await getProducts({
categoriaId,
busqueda: desaccented,
orden: activeFilters.orden,
enOferta: activeFilters.enOferta || undefined,
limit: PAGE_SIZE,
offset: 0
});
products = retry.data;
filteredCount = retry.count;
}
}

// Total del catalogo activo (sin filtros) para mensajes tipo "X de Y".
// Se pide solo el conteo (limit:0 + count exacto) para no bajar productos.
let totalCount = filteredCount || products.length;
if (currentSearch || activeFilters.enOferta || categoriaId) {
const { count } = await getProducts({ limit: 0 });
if (count) totalCount = count;
}

// Total filtrado -> cantidad de paginas. El count de PostgREST es exacto
// salvo con "solo ofertas" (el recorte oferta < precio se hace en memoria y
// sobreestima): en ese caso aproximamos con lo traido + una fila extra si la
// pagina venia llena, para seguir ofreciendo el boton "siguiente".
let effectiveTotal = filteredCount || products.length;
if (activeFilters.enOferta) {
effectiveTotal = (paginationState.page - 1) * PAGE_SIZE + products.length;
if (products.length === PAGE_SIZE) effectiveTotal += 1;
}

paginationState.totalPages = Math.max(1, Math.ceil(effectiveTotal / PAGE_SIZE));
if (paginationState.page > paginationState.totalPages) {
// Si la pagina pedida quedo fuera (p.ej. cambiaron los filtros), ir a la ultima valida
paginationState.page = paginationState.totalPages;
await loadAllProducts(options);
return;
}

// Mostrar la pagina cargada
const shownFrom = products.length ? (paginationState.page - 1) * PAGE_SIZE + 1 : 0;
const shownTo = (paginationState.page - 1) * PAGE_SIZE + products.length;
updateResultsCount(products.length ? `${shownFrom}\u2013${shownTo}` : 0, totalCount, Boolean(activeFilters.enOferta || categoriaId));

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
renderPagination();
}

// Aplica datos del negocio (nombre, moneda, contacto) e inyecta el header
async function applyBizConfig() {
let config = {};
try {
config = await getBizConfig() || {};
} catch (_) { /* usar valores por defecto */ }
currentCurrency = getCurrency(config);
setCurrency(currentCurrency); // que las cards usen la moneda del admin
// Moneda base (USD) y tasa CUP definidas por el admin: a partir de aqui los
// precios se muestran en la moneda que el comprador tenga seleccionada
setBaseCurrency(currentCurrency);
setCupRate(getCupRate(config));
initCurrencySelector(config);
// Header SIEMPRE visible con carrito + hamburguesa, con el nombre real
renderSiteHeader('inicio', config);
renderSiteFooter(config);
if (config.nombre_negocio) {
document.title = `${config.nombre_negocio} - Inicio`;
}
applyHeroText(config);
}

/**
 * El texto del hero ("Bienvenido a ...") y su subtítulo salen de la
 * configuración del negocio (panel de admin): nombre_negocio y descripcion.
 * Si el admin aún no los define, se mantiene el texto estático del HTML.
 */
function applyHeroText(config) {
const titleEl = document.getElementById('hero-title');
const subtitleEl = document.querySelector('.hero__subtitle');
const name = (config?.nombre_negocio || '').trim();
const description = (config?.descripcion || '').trim();

if (titleEl && name) {
titleEl.textContent = `Bienvenido a ${name}`;
}
if (subtitleEl && description) {
subtitleEl.textContent = description;
}
// Meta description coherente con lo que muestra el hero (setAttribute no
// interpreta HTML, así que basta con normalizar saltos de línea).
const meta = document.querySelector('meta[name="description"]');
if (meta && description) {
meta.setAttribute('content', description.replace(/\s+/g, ' ').trim());
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
paginationState.page = 1; // toda busqueda nueva empieza en la pagina 1
if (!currentSearch) {
// Busqueda vacia: restaurar vista normal con destacados visibles
setFeaturedVisible(true);
activeFilters.categoriaId = null;
setCategoryActive(document.querySelector('.category-btn[data-category-id=""]'));
await loadAllProducts();
return;
}
showToast(`Resultados para "${currentSearch}"`, 'info');
// Ocultar destacados durante la busqueda
setFeaturedVisible(false);
// desactivar filtro de categoria visualmente (mismo helper: verde inmediato en "Todos")
setCategoryActive(document.querySelector('.category-btn[data-category-id=""]'));
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

/**
 * Selector de moneda del Home (USD / CUP).
 * El admin define cuántos CUP equivalen a 1 USD; el comprador elige en qué
 * moneda quiere ver los precios y su elección se recuerda (localStorage).
 */
function initCurrencySelector(config) {
const bar = document.getElementById('currency-bar');
if (!bar) return;

const rate = getCupRate(config);
const rateEl = document.getElementById('currency-rate');
if (rateEl) rateEl.textContent = rate ? getRateLabel(config, currentCurrency) : '';

const buttons = bar.querySelectorAll('.currency-switch__btn');
const cupBtn = bar.querySelector('[data-currency="CUP"]');
if (cupBtn) {
cupBtn.disabled = !rate;
cupBtn.title = rate ? 'Ver precios en pesos cubanos' : 'El administrador aún no configura la tasa de cambio';
}

const paint = () => {
const active = getActiveCurrency();
buttons.forEach(b => {
const on = b.dataset.currency === active;
b.classList.toggle('currency-switch__btn--active', on);
b.setAttribute('aria-pressed', String(on));
});
};

bar.addEventListener('click', (e) => {
const btn = e.target.closest('.currency-switch__btn');
if (!btn || btn.disabled) return;
const code = btn.dataset.currency;
if (code === 'CUP' && !rate) {
showToast('La tasa de cambio USD → CUP aún no está configurada', 'warning');
return;
}
setSelectedCurrency(code);
paint();
// Volver a renderizar los grids para mostrar los precios convertidos
loadFeaturedProducts();
loadAllProducts();
showToast(`Precios mostrados en ${getActiveCurrency()}`, 'info');
});

paint();
}

// Barra de orden + filtro de ofertas sobre "Todos los Productos"
function initSortBar() {
const bar = document.getElementById('sort-bar');
if (!bar) return;

// Orden por precio (select nativo para accesibilidad y UX movil)
const sortSelect = bar.querySelector('#product-sort');
sortSelect?.addEventListener('change', () => {
activeFilters.orden = sortSelect.value || 'relevancia';
paginationState.page = 1; // cambiar el orden reinicia la paginacion
loadAllProducts();
});

// Toggle "Solo en oferta"
const offerToggle = bar.querySelector('#only-offers');
offerToggle?.addEventListener('change', () => {
activeFilters.enOferta = offerToggle.checked;
bar.classList.toggle('sort-bar--offers-active', offerToggle.checked);
paginationState.page = 1; // cambiar filtros reinicia la paginacion
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
initPagination();
await loadCategories();

// Soporte para /?categoria=slug (enlaces desde breadcrumb del detalle de producto)
const params = new URLSearchParams(window.location.search);
const catSlug = params.get('categoria');
let initialCategory = null;
if (catSlug) {
const btn = document.querySelector(`.category-btn[data-category-slug="${catSlug}"]`);
if (btn) {
setCategoryActive(btn);
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
