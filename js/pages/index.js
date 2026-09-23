    import { initMobileMenu, showToast, renderSiteFooter, renderSiteHeader, initScrollTopButton } from '../js/ui.js';
    import { getCategories } from '../js/categorias.js';
    import { getProducts, renderProductsGrid, showProductSkeletons } from '../js/productos.js';
    import { getCartCount, addToCart } from '../js/carrito.js';
    import { getBizConfig, getCurrency } from '../js/config-negocio.js';

    // Header inyectado por JS (mismo que carrito/producto/contacto): incluye la
    // hamburguesa funcional y el menú móvil sin Carrito/Categorías repetidos
    renderSiteHeader('inicio');
    initMobileMenu();
    initScrollTopButton();

    // Cache de productos cargados (para añadir al carrito sin otro fetch)
    let loadedProducts = [];
    let currentCurrency = 'USD';

    // Inicializar contador del carrito
    function updateCartCounter() {
      const count = getCartCount();
      const counterElement = document.querySelector('.cart-count');
      if (counterElement) {
        counterElement.textContent = count;
        counterElement.style.display = count > 0 ? 'flex' : 'none';
      }
    }
    updateCartCounter();
    window.addEventListener('cart-updated', updateCartCounter);

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
          window.location.href = `/producto.html?id=${card.dataset.productId}`;
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
      if (addToCart(product)) {
        showToast(`"${product.nombre}" añadido al carrito`, 'success');
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
          await loadAllProducts(categoryId || null);
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

    let currentSearch = '';

    // Cargar todos los productos (con filtro opcional de categoría y búsqueda)
    async function loadAllProducts(categoriaId = null) {
      showProductSkeletons('#all-products', 6);
      const { data: featured } = await getProducts({ destacados: true, limit: 6 });
      let { data: products } = await getProducts({ categoriaId, busqueda: currentSearch || undefined, limit: 24 });

      // Fallback: si la búsqueda tiene acentes y no trajo nada, reintentar sin acentos
      // (cubre productos guardados como "arroz" cuando el usuario escribe "aróz", etc.)
      if (currentSearch && products.length === 0) {
        const desaccented = currentSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (desaccented !== currentSearch) {
          const retry = await getProducts({ categoriaId, busqueda: desaccented, limit: 24 });
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

    // Aplica datos del negocio (nombre, moneda, contacto)
    async function applyBizConfig() {
      try {
        const config = await getBizConfig();
        currentCurrency = getCurrency(config);
        renderSiteFooter(config);
        if (config.nombre_negocio) {
          document.title = `${config.nombre_negocio} - Inicio`;
          document.querySelectorAll('.header__logo').forEach(el => { el.textContent = `🛒 ${config.nombre_negocio}`; });
        }
      } catch (_) { /* usar valores por defecto */ }
    }

    // Buscador del hero: filtra el grid de productos en la misma página
    function initSearch() {
      const form = document.getElementById('searchForm');
      if (!form) return;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="search"]');
        currentSearch = (input?.value || '').trim();
        if (!currentSearch) { showToast('Escribe algo para buscar', 'info'); return; }
        // desactivar filtro de categoría visualmente
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('category-btn--active'));
        document.querySelector('.category-btn[data-category-id=""]')?.classList.add('category-btn--active');
        await loadAllProducts(null);
        document.getElementById('all-products')?.scrollIntoView({ behavior: 'smooth' });
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

      await Promise.all([loadFeaturedProducts(), loadAllProducts(initialCategory)]);

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
  