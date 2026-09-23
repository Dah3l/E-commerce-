/**
 * GESTIÓN DE CATEGORÍAS
 * Fetch y renderizado de categorías desde Supabase
 */

import { supabase, getStorageUrl } from './supabase-client.js';
import { slugify } from './utils.js';

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
 * Obtiene una categoría por su slug
 * @param {string} slug - Slug de la categoría
 * @returns {Promise<Object|null>} Categoría o null
 */
export async function getCategoryBySlug(slug) {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('slug', slug)
      .eq('activa', true)
      .single();
    
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    return null;
  }
}

/**
 * Obtiene una categoría por su ID
 * @param {string} id - ID de la categoría
 * @returns {Promise<Object|null>} Categoría o null
 */
export async function getCategoryById(id) {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    return null;
  }
}

/**
 * Renderiza una categoría como botón/filtro
 * @param {Object} category - Categoría a renderizar
 * @param {boolean} isActive - Si está actualmente seleccionada
 * @returns {string} HTML del botón de categoría
 */
export function renderCategoryButton(category, isActive = false) {
  return `
    <button 
      class="category-btn ${isActive ? 'category-btn--active' : ''}"
      data-category-id="${category.id}"
      data-category-slug="${category.slug}"
    >
      ${category.nombre}
    </button>
  `;
}

/**
 * Renderiza una categoría como card
 * @param {Object} category - Categoría a renderizar
 * @returns {string} HTML de la card de categoría
 */
export function renderCategoryCard(category) {
  const imagenUrl = category.imagen_url ? getStorageUrl(category.imagen_url) : null;
  
  return `
    <a href="/categoria.html?slug=${category.slug}" class="category-card">
      <div class="category-card__image-container">
        <img 
          src="${imagenUrl || './assets/icons/placeholder.svg'}" 
          alt="${category.nombre}"
          loading="lazy"
          class="category-card__image"
          onerror="this.src='./assets/icons/placeholder.svg'"
        >
      </div>
      <div class="category-card__info">
        <h3 class="category-card__title">${category.nombre}</h3>
        ${category.descripcion ? `
          <p class="category-card__description">${category.descripcion.substring(0, 80)}...</p>
        ` : ''}
      </div>
    </a>
  `;
}

/**
 * Renderiza una lista de botones de categoría para filtrar
 * @param {Array} categories - Lista de categorías
 * @param {string} containerSelector - Selector del contenedor
 * @param {string} activeId - ID de la categoría activa
 */
export function renderCategoryButtons(categories, containerSelector, activeId = null) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  // Botón "Todos"
  let html = `
    <button 
      class="category-btn ${!activeId ? 'category-btn--active' : ''}"
      data-category-id=""
    >
      Todos
    </button>
  `;
  
  // Botones de categorías
  html += categories.map(cat => renderCategoryButton(cat, cat.id === activeId)).join('');
  
  container.innerHTML = html;
}

/**
 * Renderiza un grid de categorías como cards
 * @param {Array} categories - Lista de categorías
 * @param {string} containerSelector - Selector del contenedor
 */
export function renderCategoryCards(categories, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  const html = categories.map(cat => renderCategoryCard(cat)).join('');
  container.innerHTML = html;
}

/**
 * Inicializa los filtros de categoría en una página
 * @param {Function} onCategorySelect - Callback cuando se selecciona una categoría
 */
export async function initCategoryFilters(onCategorySelect) {
  const container = document.querySelector('.category-filters');
  if (!container) return;
  
  // Mostrar skeleton
  container.innerHTML = '<div class="skeleton skeleton--filters"></div>';
  
  // Obtener categorías
  const categories = await getCategories();
  
  // Renderizar botones
  renderCategoryButtons(categories, '.category-filters');
  
  // Añadir listeners
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;
    
    const categoryId = btn.dataset.categoryId;
    const categorySlug = btn.dataset.categorySlug;
    const categoryName = btn.textContent.trim();
    
    // Actualizar estado activo
    container.querySelectorAll('.category-btn').forEach(b => b.classList.remove('category-btn--active'));
    btn.classList.add('category-btn--active');
    
    // Llamar callback
    if (onCategorySelect) {
      onCategorySelect({
        id: categoryId || null,
        slug: categorySlug,
        nombre: categoryName
      });
    }
  });
}

/**
 * Limpia el caché de categorías
 */
export function clearCategoriesCache() {
  sessionStorage.removeItem(CATEGORIES_CACHE_KEY);
}
