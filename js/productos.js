/**
 * GESTIÓN DE PRODUCTOS
 * Fetch y renderizado de productos desde Supabase
 */

import { supabase, getStorageUrl } from './supabase-client.js';
import { formatPrice, slugify } from './utils.js';

// Moneda actual (se puede cambiar con setCurrency, p.ej. desde config_negocio)
let currentCurrency = null;
export function setCurrency(currency) {
  if (currency) currentCurrency = currency;
}

/**
 * Obtiene un producto por su ID
 * @param {string} id - ID del producto
 * @returns {Promise<Object|null>} Producto o null
 */
export async function getProductById(id) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select(`
        *,
        categorias (
          id,
          nombre,
          slug
        )
      `)
      .eq('id', id)
      .eq('activo', true)
      .single();
    
    if (error) throw error;
    if (!data) return null;
    
    return normalizeProduct(data);
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    return null;
  }
}

/**
 * Busca un producto por el slug de su categoría + slug del nombre
 * (el slug del producto se genera con slugify(nombre) al crearlo en el admin)
 * @param {string} categoriaSlug - Slug de la categoría
 * @param {string} productoSlug - Slug del nombre del producto
 * @returns {Promise<Object|null>} Producto normalizado o null
 */
export async function getProductBySlug(categoriaSlug, productoSlug) {
  try {
    let query = supabase
      .from('productos')
      .select(`
        *,
        categorias (
          id,
          nombre,
          slug
        )
      `)
      .eq('activo', true);

    if (categoriaSlug) {
      query = query.eq('categorias.slug', categoriaSlug);
    }

    const { data, error } = await query;
    if (error) throw error;

    const found = (data || []).find(p => slugify(p.nombre) === productoSlug);
    return found ? normalizeProduct(found) : null;
  } catch (error) {
    console.error('Error obteniendo producto por slug:', error);
    return null;
  }
}

/**
 * Obtiene productos con filtros opcionales
 * @param {Object} filters - Filtros a aplicar
 * @param {string} filters.categoriaId - Filtrar por categoría
 * @param {string} filters.busqueda - Buscar por nombre
 * @param {boolean} filters.destacados - Solo destacados
 * @param {boolean} filters.enOferta - Solo productos con precio de oferta
 * @param {string} filters.orden - 'relevancia' | 'precio-asc' | 'precio-desc' | 'nuevos'
 * @param {number} filters.limit - Límite de resultados
 * @param {number} filters.offset - Offset para paginación
 * @returns {Promise<{data: Array, count: number}>}
 */
export async function getProducts(filtersParam = {}) {
  const filters = filtersParam;

  // Orden segun el filtro elegido (por defecto: destacados primero, luego recientes).
  // OJO con precio-asc/desc: el precio EFECTIVO es precio_oferta si existe y es
  // menor que precio; eso no se puede ordenar en PostgREST (no compara columnas),
  // por lo que al paginar por precio se carga el catalogo filtrado completo
  // (en bloques de PAGE_SIZE) y se corta la pagina pedida en memoria.
  const orden = filters.orden || 'relevancia';
  const byEffectivePrice = orden === 'precio-asc' || orden === 'precio-desc';

  // Busqueda saneada: quitar caracteres que rompen el parser de filtros de
  // PostgREST (comas, parentesis, %, comillas) y buscar por cada palabra,
  // tanto por nombre como por el codigo (SKU) del admin. La clausula se
  // reutiliza en las paginas siguientes del recorrido (ver buildFilteredQuery).
  let searchOrClause = null;      // nombre + codigo
  let searchOrClauseNameOnly = null; // solo nombre (fallback sin columna codigo)
  if (filters.busqueda) {
    const clean = String(filters.busqueda)
      .replace(/[(),"%\\]/g, ' ')
      .replace(/[^\p{L}\p{N}\s._-]/gu, '')
      .toLowerCase()
      .trim();
    if (clean) {
      const searchTerms = clean.split(/\s+/).filter(t => t.length > 0);
      // Entre comillas dobles para que los * se interpreten como comodin
      searchOrClause = searchTerms
        .flatMap(term => [`nombre.ilike."*${term}*"`, `codigo.ilike."*${term}*"`])
        .join(',');
      searchOrClauseNameOnly = searchTerms
        .map(term => `nombre.ilike."*${term}*"`)
        .join(',');
    }
  }

  // Paginacion / limites: los parametros fisicos (rango/limite reales de la
  // query) se resuelven ANTES de construir la peticion, porque con "solo
  // ofertas" el recorte oferta < precio se hace en memoria y habria que
  // ampliar/recorrer rangos para completar cada pagina logica. Reglas:
  //  - offset definido  -> pagina concreta (range). Con "en oferta" se usan
  //                        rangos ampliados de OFFER_CHUNK y el recorte en
  //                        memoria se aplica DESPUES de concatenar los bloques
  //                        necesarios, de modo que cada pagina logica devuelva
  //                        `limit` items validos sin duplicar ni omitir.
  //  - solo limit       -> traer esa cantidad (con "en oferta" se amplía).
  //  - sin limit/offset -> catalogo completo paginado de 500 en 500 hasta
  //                        cubrir `count` (PostgREST truncaria a 1000 por peto).
  const PAGE_SIZE = 500;
  const OFFER_CHUNK = 200; // tamano de bloque fisico al paginar con "solo ofertas"
  const pageLimit = filters.limit ?? 24;
  const isPagedOffers = filters.offset != null && filters.enOferta;
  // Paginas logicas (offset+limit) con orden por precio efectivo u ofertas:
  // exigen cargar el resultado filtrado completo y cortar en memoria.
  const needsFullLoad = filters.offset != null && (isPagedOffers || byEffectivePrice);

  let physRange = null;   // [from, to] o null
  let physLimit = null;   // numero o null
  if (needsFullLoad) {
    physRange = [0, PAGE_SIZE - 1]; // primera ventana del recorrido completo
  } else if (filters.offset != null) {
    physRange = [filters.offset, filters.offset + (pageLimit - 1)];
  } else if (filters.limit === 0) {
    physLimit = 0; // solo se quiere el conteo exacto, sin traer filas
  } else if (filters.limit && filters.enOferta) {
    physLimit = Math.max(pageLimit * 4, 100);
  } else if (filters.limit) {
    physLimit = filters.limit;
  }

  // Helper: construye una query con exactamente los mismos filtros/orden.
  // Se usa para la peticion principal, para recorrer rangos adicionales
  // (paginacion) y para reintentar sin la columna "codigo".
  const buildFilteredQuery = (useCodigo = true) => {
    const q = supabase
      .from('productos')
      .select(`
        *,
        categorias ( id, nombre, slug )
      `, { count: 'exact' })
      .eq('activo', true);
    if (filters.categoriaId) q.eq('categoria_id', filters.categoriaId);
    if (filters.destacados) q.eq('destacado', true);
    // Filtro "en oferta": aqui solo pedimos ofertas > 0. Antes usabamos
    // .lt('precio_oferta', 'precio'), pero PostgREST intenta parsear "precio"
    // como numero y devuelve error 22P02; la comprobacion final
    // (oferta < precio normal) se hace en memoria mas abajo.
    if (filters.enOferta) q.gt('precio_oferta', 0);
    const clause = useCodigo ? searchOrClause : searchOrClauseNameOnly;
    if (clause) q.or(clause);
    if (byEffectivePrice) {
      q.order('precio', { ascending: orden === 'precio-asc' });
    } else if (orden === 'nuevos') {
      q.order('created_at', { ascending: false });
    } else {
      q.order('destacado', { ascending: false })
       .order('created_at', { ascending: false });
    }
    return q;
  };

  // La peticion principal aplica los parametros fisicos resueltos arriba
  let query = buildFilteredQuery();
  if (physRange) {
    query = query.range(physRange[0], physRange[1]);
  } else if (physLimit != null) {
    query = query.limit(physLimit);
  }

  try {
    let { data, error, count } = await query;

    // Compatibilidad: si la columna "codigo" aun no existe en la BD (no se ha
    // ejecutado la migracion), PostgREST falla al filtrar por ella. Reintentamos
    // la misma peticion buscando solo por nombre.
    if (error && /codigo/i.test(error.message || '')) {
      console.warn('La columna "codigo" no existe en productos todavia. Ejecuta la migracion SQL. Reintentando sin codigo...');
      let q2 = buildFilteredQuery(false);
      if (physRange) q2 = q2.range(physRange[0], physRange[1]);
      else if (physLimit != null) q2 = q2.limit(physLimit);
      const r = await q2;
      data = r.data; error = r.error; count = r.count;
    }

    if (error) throw error;

    let products = (data || []).map(normalizeProduct);

    // Recorrido completo del resultado filtrado (pagina logica con "en oferta"
    // u orden por precio efectivo, o catalogo entero sin limit).
    if ((needsFullLoad || (!filters.limit && filters.offset == null)) && count > products.length) {
      for (let from = products.length; from < count; from += PAGE_SIZE) {
        const to = Math.min(from + PAGE_SIZE, count) - 1;
        const { data: moreData, error: moreError } = await buildFilteredQuery().range(from, to);
        if (moreError) throw moreError;
        const extra = (moreData || []).map(normalizeProduct);
        if (!extra.length) break; // seguridad contra bucles infinitos
        products = products.concat(extra);
      }
    }

    // Filtro "en oferta" (2a parte): la oferta solo cuenta si es menor al
    // precio normal. Se hace en memoria porque PostgREST no compara columnas.
    if (filters.enOferta) {
      products = products.filter(p => p.precio_oferta && p.precio_oferta < p.precio);
    }

    // Reordenar en memoria por precio efectivo (oferta si existe, si no precio
    // normal). Al haber cargado el resultado filtrado completo cuando se pide
    // una pagina, este orden es global y correcto entre paginas.
    if (byEffectivePrice) {
      const dir = orden === 'precio-asc' ? 1 : -1;
      const effective = (p) => (p.precio_oferta && p.precio_oferta < p.precio ? p.precio_oferta : p.precio);
      products.sort((a, b) => (effective(a) - effective(b)) * dir);
    }

    // Pagina logica: cortamos exactamente el rango [offset, offset+limit)
    // tras los filtros/orden aplicados en memoria.
    if (needsFullLoad) {
      products = products.slice(filters.offset, filters.offset + pageLimit);
    } else if (filters.enOferta && filters.limit && products.length > filters.limit) {
      // Si el filtro "en oferta" trajo una pagina ampliada, recortar al limite real
      products = products.slice(0, filters.limit);
    }

    return { data: products, count: count || 0 };
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    // Avisar en pantalla: antes fallaba en silencio y la tienda parecia vacia
    try {
      const { showToast } = await import('./ui.js');
      showToast('No se pudieron cargar los productos. Revisa tu conexión o recarga la página.', 'error', 6000);
    } catch (_) { /* si ui.js no carga, al menos queda el log */ }
    return { data: [], count: 0 };
  }
}

/**
 * Obtiene productos relacionados (misma categoría, excluyendo el actual)
 * @param {string} productId - ID del producto actual
 * @param {string} categoriaId - ID de la categoría
 * @param {number} limit - Cantidad de productos relacionados
 * @returns {Promise<Array>} Productos relacionados
 */
export async function getRelatedProducts(productId, categoriaId, limit = 4) {
  if (!categoriaId) return [];
  
  try {
    const { data, error } = await supabase
      .from('productos')
      .select(`
        *,
        categorias (
          id,
          nombre,
          slug
        )
      `)
      .eq('activo', true)
      .eq('categoria_id', categoriaId)
      .neq('id', productId)
      .limit(limit);
    
    if (error) throw error;
    
    return (data || []).map(normalizeProduct);
  } catch (error) {
    console.error('Error obteniendo productos relacionados:', error);
    return [];
  }
}

/**
 * Normaliza un registro de producto: imagen, stock y precio numéricos
 * @param {Object} product
 * @returns {Object}
 */
export function normalizeProduct(product) {
  if (!product) return product;
  const parsedStock = parseInt(product.stock, 10);
  // Evitar doble conversión: si ya es URL http(s), dejarla tal cual
  let imagen = product.imagen_url || null;
  if (imagen && !/^https?:\/\//i.test(imagen)) {
    imagen = getStorageUrl(imagen) || imagen;
  }
  return {
    ...product,
    // defensively copy the embedded category relation so an unexpected shape
    // (e.g. array instead of object) can never crash the card renderer
    categorias: (product.categorias && typeof product.categorias === 'object' && !Array.isArray(product.categorias))
      ? product.categorias
      : (Array.isArray(product.categorias) ? (product.categorias[0] || null) : null),
    precio: Number(product.precio) || 0,
    precio_oferta: product.precio_oferta ? Number(product.precio_oferta) : null,
    stock: Number.isFinite(parsedStock) ? parsedStock : null,
    imagen_url: imagen
  };
}

/**
 * Renderiza una card de producto en HTML
 * @param {Object} product - Producto a renderizar
 * @returns {string} HTML de la card
 */
export function renderProductCard(product) {
  const precioFinal = product.precio_oferta || product.precio;
  const tieneOferta = product.precio_oferta && product.precio_oferta < product.precio;
  
  return `
    <article class="product-card" data-product-id="${product.id}">
      <div class="product-card__image-container">
        <img 
          src="${product.imagen_url || './assets/icons/placeholder.svg'}" 
          alt="${escapeHtml(product.nombre)}"
          loading="lazy"
          class="product-card__image"
          onerror="this.onerror=null; this.src='./assets/icons/placeholder.svg'"
        >
        ${(tieneOferta || product.destacado) ? `
          <div class="product-card__badges">
            ${tieneOferta ? `<span class="product-card__badge product-card__badge--offer">OFERTA</span>` : ''}
            ${product.destacado ? `<span class="product-card__badge product-card__badge--featured">⭐ Destacado</span>` : ''}
          </div>
        ` : ''}
        ${product.stock === 0 ? `
          <span class="product-card__overlay">
            Agotado
          </span>
        ` : ''}
      </div>
      
      <div class="product-card__info">
        ${product.codigo ? `<div class="product-card__code">Código: ${escapeHtml(String(product.codigo))}</div>` : ''}
        <h3 class="product-card__title">${escapeHtml(product.nombre)}</h3>
        
        <div class="product-card__price">
          ${tieneOferta ? `
            <span class="product-card__price--old" data-price-usd="${product.precio}">${formatPrice(product.precio, currentCurrency || undefined)}</span>
          ` : ''}
          <span class="product-card__price--current" data-price-usd="${precioFinal}">${formatPrice(precioFinal, currentCurrency || undefined)}</span>
        </div>
        
        <button 
          class="product-card__btn btn btn--primary"
          ${product.stock === 0 ? 'disabled' : ''}
          data-add-to-cart="${product.id}"
        >
          ${product.stock === 0 ? 'Agotado' : 'Añadir al carrito'}
        </button>
      </div>
    </article>
  `;
}

/**
 * Renderiza un grid completo de productos
 * @param {Array} products - Lista de productos
 * @param {string} containerSelector - Selector del contenedor
 * @param {boolean} append - Añadir al final (false reemplaza)
 */
export function renderProductsGrid(products, containerSelector, append = false) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  const html = products.map(product => renderProductCard(product)).join('');
  
  if (append) {
    container.insertAdjacentHTML('beforeend', html);
  } else {
    container.innerHTML = html;
  }
}

/**
 * Muestra skeletons de carga en el grid de productos
 * @param {string} containerSelector - Selector del contenedor
 * @param {number} count - Cantidad de skeletons
 */
export function showProductSkeletons(containerSelector, count = 6) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  container.innerHTML = Array(count).fill(`
    <div class="product-card product-card--skeleton">
      <div class="product-card__image-container">
        <div class="skeleton skeleton--image"></div>
      </div>
      <div class="product-card__info">
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text skeleton--text-short"></div>
        <div class="skeleton skeleton--btn"></div>
      </div>
    </div>
  `).join('');
}

/**
 * Función helper para escapar HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Inicializa la carga de productos en una página
 * @param {Object} options - Opciones de configuración
 */
export async function initProducts(options = {}) {
  const {
    containerSelector = '.products-grid',
    categoriaId = null,
    busqueda = null,
    destacados = false,
    limit = 12
  } = options;
  
  // Mostrar skeletons
  showProductSkeletons(containerSelector, 6);
  
  // Obtener productos
  const { data: products } = await getProducts({
    categoriaId,
    busqueda,
    destacados,
    limit
  });
  
  // Renderizar
  renderProductsGrid(products, containerSelector);
  
  return products;
}
