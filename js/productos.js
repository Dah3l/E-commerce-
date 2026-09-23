/**
 * GESTIÓN DE PRODUCTOS
 * Fetch y renderizado de productos desde Supabase
 */

import { supabase, getStorageUrl } from './supabase-client.js';
import { formatPrice, slugify } from './utils.js';

// Cache de categorías en sessionStorage
const CATEGORIES_CACHE_KEY = 'categories_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene todas las categorías activas
 * @param {boolean} useCache - Usar caché si está disponible
 * @returns {Promise<Array>} Lista de categorías
 */
export async function getCategories(useCache = true) {
  // Intentar obtener del caché
  if (useCache) {
    const cached = sessionStorage.getItem(CATEGORIES_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  }
  
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('activa', true)
      .order('orden', { ascending: true });
    
    if (error) throw error;
    
    // Guardar en caché
    sessionStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    
    return data || [];
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    return [];
  }
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
 * Obtiene productos con filtros opcionales
 * @param {Object} filters - Filtros a aplicar
 * @param {string} filters.categoriaId - Filtrar por categoría
 * @param {string} filters.busqueda - Buscar por nombre
 * @param {boolean} filters.destacados - Solo destacados
 * @param {number} filters.limit - Límite de resultados
 * @param {number} filters.offset - Offset para paginación
 * @returns {Promise<{data: Array, count: number}>}
 */
export async function getProducts(filters = {}) {
  let query = supabase
    .from('productos')
    .select(`
      *,
      categorias (
        id,
        nombre,
        slug
      )
    `, { count: 'exact' })
    .eq('activo', true);
  
  // Aplicar filtros
  if (filters.categoriaId) {
    query = query.eq('categoria_id', filters.categoriaId);
  }
  
  if (filters.destacados) {
    query = query.eq('destacado', true);
  }
  
  if (filters.busqueda) {
    const searchTerms = filters.busqueda.toLowerCase().split(' ');
    const conditions = searchTerms.map(term => `nombre.ilike(%${term}%)`);
    query = query.or(conditions.join(','));
  }
  
  // Ordenar: destacados primero, luego por creación
  query = query.order('destacado', { ascending: false })
               .order('created_at', { ascending: false });
  
  // Aplicar límite y offset
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit - 1));
  }
  
  try {
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    const products = (data || []).map(normalizeProduct);
    
    return { data: products, count: count || 0 };
  } catch (error) {
    console.error('Error obteniendo productos:', error);
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
  return {
    ...product,
    precio: Number(product.precio) || 0,
    precio_oferta: product.precio_oferta ? Number(product.precio_oferta) : null,
    stock: Number.isFinite(parsedStock) ? parsedStock : null,
    imagen_url: product.imagen_url ? (getStorageUrl(product.imagen_url) || product.imagen_url) : null
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
          src="${product.imagen_url || '/assets/icons/placeholder.svg'}" 
          alt="${escapeHtml(product.nombre)}"
          loading="lazy"
          class="product-card__image"
          onerror="this.src='/assets/icons/placeholder.svg'"
        >
        ${tieneOferta ? `
          <span class="product-card__badge product-card__badge--offer">
            OFERTA
          </span>
        ` : ''}
        ${product.destacado ? `
          <span class="product-card__badge product-card__badge--featured">
            ⭐
          </span>
        ` : ''}
        ${product.stock === 0 ? `
          <span class="product-card__overlay">
            Agotado
          </span>
        ` : ''}
      </div>
      
      <div class="product-card__info">
        <h3 class="product-card__title">${escapeHtml(product.nombre)}</h3>
        
        <div class="product-card__price">
          ${tieneOferta ? `
            <span class="product-card__price--old">${formatPrice(product.precio)}</span>
          ` : ''}
          <span class="product-card__price--current">${formatPrice(precioFinal)}</span>
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
