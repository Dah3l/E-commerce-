/**
 * UTILIDADES DE UI
 * Toasts, modales, loaders y otros componentes de interfaz
 */

/**
 * Muestra un toast/notificación temporal
 * @param {string} message - Mensaje a mostrar
 * @param {'success'|'error'|'info'|'warning'} type - Tipo de toast
 * @param {number} duration - Duración en milisegundos
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Crear contenedor si no existe
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Crear toast
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  
  // Icono según tipo
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
    <button class="toast__close" aria-label="Cerrar">×</button>
  `;
  
  // Añadir al contenedor
  container.appendChild(toast);
  
  // Animación de entrada
  requestAnimationFrame(() => {
    toast.classList.add('toast--show');
  });
  
  // Cerrar automáticamente
  const timeoutId = setTimeout(() => {
    closeToast(toast);
  }, duration);
  
  // Listener para botón de cerrar
  toast.querySelector('.toast__close').addEventListener('click', () => {
    clearTimeout(timeoutId);
    closeToast(toast);
  });
  
  return toast;
}

/**
 * Cierra un toast con animación
 * @param {HTMLElement} toast - Elemento toast a cerrar
 */
function closeToast(toast) {
  toast.classList.remove('toast--show');
  toast.classList.add('toast--hide');
  
  toast.addEventListener('transitionend', () => {
    toast.remove();
    
    // Eliminar contenedor si está vacío
    const container = document.querySelector('.toast-container');
    if (container && container.children.length === 0) {
      container.remove();
    }
  }, { once: true });
}

/**
 * Muestra un loader/modal de carga
 * @param {string} message - Mensaje opcional
 * @returns {HTMLElement} Elemento loader
 */
export function showLoader(message = 'Cargando...') {
  // Eliminar loaders existentes
  hideLoader();
  
  const loader = document.createElement('div');
  loader.className = 'loader-overlay';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-live', 'polite');
  
  loader.innerHTML = `
    <div class="loader">
      <div class="loader__spinner"></div>
      ${message ? `<p class="loader__message">${escapeHtml(message)}</p>` : ''}
    </div>
  `;
  
  document.body.appendChild(loader);
  
  // Prevenir scroll
  document.body.style.overflow = 'hidden';
  
  return loader;
}

/**
 * Oculta el loader
 */
export function hideLoader() {
  const loader = document.querySelector('.loader-overlay');
  if (loader) {
    loader.remove();
    document.body.style.overflow = '';
  }
}

/**
 * Muestra un modal de confirmación
 * @param {Object} options - Opciones del modal
 * @param {string} options.title - Título del modal
 * @param {string} options.message - Mensaje de confirmación
 * @param {string} options.confirmText - Texto del botón confirmar
 * @param {string} options.cancelText - Texto del botón cancelar
 * @param {'danger'|'warning'|'info'} options.type - Tipo de modal
 * @returns {Promise<boolean>} True si confirmó, false si canceló
 */
export function showConfirmModal(options = {}) {
  return new Promise((resolve) => {
    const {
      title = 'Confirmar',
      message = '¿Está seguro?',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      type = 'info'
    } = options;
    
    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');
    
    modal.innerHTML = `
      <div class="modal modal--${type}">
        <div class="modal__header">
          <h2 id="modal-title" class="modal__title">${escapeHtml(title)}</h2>
          <button class="modal__close" aria-label="Cerrar">×</button>
        </div>
        <div class="modal__body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary modal__cancel">${escapeHtml(cancelText)}</button>
          <button class="btn btn--${type === 'danger' ? 'danger' : 'primary'} modal__confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Prevenir scroll
    document.body.style.overflow = 'hidden';
    
    // Animación de entrada
    requestAnimationFrame(() => {
      modal.classList.add('modal-overlay--show');
    });
    
    // Función para cerrar
    const closeModal = () => {
      modal.classList.remove('modal-overlay--show');
      modal.classList.add('modal-overlay--hide');
      
      modal.addEventListener('transitionend', () => {
        modal.remove();
        document.body.style.overflow = '';
      }, { once: true });
    };
    
    // Listeners
    modal.querySelector('.modal__close').addEventListener('click', () => {
      resolve(false);
      closeModal();
    });
    
    modal.querySelector('.modal__cancel').addEventListener('click', () => {
      resolve(false);
      closeModal();
    });
    
    modal.querySelector('.modal__confirm').addEventListener('click', () => {
      resolve(true);
      closeModal();
    });
    
    // Cerrar al hacer click fuera
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        resolve(false);
        closeModal();
      }
    });
    
    // Cerrar con ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        resolve(false);
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

/**
 * Muestra un modal genérico con contenido HTML
 * @param {Object} options - Opciones del modal
 * @param {string} options.title - Título del modal
 * @param {string} options.content - Contenido HTML
 * @param {string} options.footerContent - Contenido HTML para el footer
 * @returns {Promise<{close: Function}>} Objeto con método close
 */
export function showModal(options = {}) {
  const {
    title = '',
    content = '',
    footerContent = ''
  } = options;
  
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    
    modal.innerHTML = `
      <div class="modal">
        ${title ? `
          <div class="modal__header">
            <h2 class="modal__title">${escapeHtml(title)}</h2>
            <button class="modal__close" aria-label="Cerrar">×</button>
          </div>
        ` : ''}
        <div class="modal__body">
          ${content}
        </div>
        ${footerContent ? `
          <div class="modal__footer">
            ${footerContent}
          </div>
        ` : ''}
      </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    requestAnimationFrame(() => {
      modal.classList.add('modal-overlay--show');
    });
    
    const closeModal = () => {
      modal.classList.remove('modal-overlay--show');
      modal.classList.add('modal-overlay--hide');
      
      modal.addEventListener('transitionend', () => {
        modal.remove();
        document.body.style.overflow = '';
      }, { once: true });
    };
    
    // Listeners
    const closeBtn = modal.querySelector('.modal__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        resolve({ action: 'close' });
        closeModal();
      });
    }
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        resolve({ action: 'backdrop' });
        closeModal();
      }
    });
    
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        resolve({ action: 'esc' });
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    resolve({
      close: closeModal,
      element: modal
    });
  });
}

/**
 * Muestra un modal de formulario (crear/editar) con guardado y borrado
 * Resuelve con 'saved' | 'deleted' | null (cerrado sin guardar)
 * @param {Object} options
 * @param {string} options.title - Título del modal
 * @param {Array<Object>} options.fields - [{id, label, type, value, required, ...}]
 *   types soportados: text, textarea, number, select, checkbox, file, hidden
 * @param {Function} options.onSave - async (values) => { error?: string }
 * @param {Function} [options.onDelete] - async () => { error?: string } (si existe muestra botón Eliminar)
 * @returns {Promise<string|null>}
 */
export function showFormModal(options = {}) {
  const {
    title = '',
    fields = [],
    onSave = async () => ({}),
    onDelete = null,
    saveText = 'Guardar',
    deleteText = 'Eliminar'
  } = options;

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', handleEsc);
      closeModal();
      resolve(result);
    };

    const fieldHtml = fields.map(f => {
      const id = `fm_${f.id}`;
      const req = f.required ? 'required' : '';
      switch (f.type) {
        case 'hidden':
          return `<input type="hidden" id="${id}" value="${escapeHtml(String(f.value ?? ''))}">`;
        case 'textarea':
          return `
            <div class="form-group">
              <label class="form-label ${f.required ? 'form-label--required' : ''}" for="${id}">${escapeHtml(f.label)}</label>
              <textarea class="form-textarea" id="${id}" ${req}>${escapeHtml(String(f.value ?? ''))}</textarea>
            </div>`;
        case 'select':
          return `
            <div class="form-group">
              <label class="form-label ${f.required ? 'form-label--required' : ''}" for="${id}">${escapeHtml(f.label)}</label>
              <select class="form-select" id="${id}" ${req}>
                ${(f.options || []).map(o => `<option value="${escapeHtml(String(o.value))}" ${String(o.value) === String(f.value ?? '') ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
              </select>
            </div>`;
        case 'checkbox':
          return `
            <div class="form-check">
              <input type="checkbox" class="form-check__input" id="${id}" ${f.value ? 'checked' : ''}>
              <label class="form-check__label" for="${id}">${escapeHtml(f.label)}</label>
            </div>`;
        case 'file':
          return `
            <div class="form-group">
              <label class="form-label" for="${id}">${escapeHtml(f.label)}</label>
              <input type="file" class="form-input" id="${id}" accept="${f.accept || 'image/*'}">
              ${f.value ? `<small style="color:#6B7280;">Ya tiene imagen actual. Selecciona un archivo solo si quieres reemplazarla.</small>` : ''}
            </div>`;
        default:
          return `
            <div class="form-group">
              <label class="form-label ${f.required ? 'form-label--required' : ''}" for="${id}">${escapeHtml(f.label)}</label>
              <input type="${f.type || 'text'}" class="form-input" id="${id}"
                ${f.step !== undefined ? `step="${f.step}"` : ''}
                ${f.min !== undefined ? `min="${f.min}"` : ''}
                ${f.placeholder ? `placeholder="${escapeHtml(f.placeholder)}"` : ''}
                value="${escapeHtml(String(f.value ?? ''))}" ${req}>
            </div>`;
      }
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="modal" style="max-width: 640px; max-height: 90vh; overflow-y: auto;">
        <div class="modal__header">
          <h2 class="modal__title">${escapeHtml(title)}</h2>
          <button class="modal__close" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal__body">
          <form class="form-modal__form" novalidate>${fieldHtml}</form>
        </div>
        <div class="modal__footer" style="display:flex; gap: var(--spacing-3, 12px); justify-content: flex-end; align-items:center;">
          ${onDelete ? `<button type="button" class="btn btn--danger form-modal__delete" style="margin-right:auto;">🗑️ ${escapeHtml(deleteText)}</button>` : ''}
          <button type="button" class="btn btn--secondary form-modal__cancel">Cancelar</button>
          <button type="button" class="btn btn--primary form-modal__save">${escapeHtml(saveText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    // Forzar visibilidad (el CSS base usa opacity/visibility)
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    document.body.style.overflow = 'hidden';

    const getValues = () => {
      const values = {};
      fields.forEach(f => {
        const el = modal.querySelector(`#fm_${f.id}`);
        if (!el) return;
        if (f.type === 'checkbox') values[f.id] = el.checked;
        else if (f.type === 'number') values[f.id] = el.value;
        else if (f.type === 'file') values[f.id] = el.files && el.files[0] ? el.files[0] : null;
        else values[f.id] = el.value;
      });
      return values;
    };

    const validate = () => {
      for (const f of fields) {
        if (!f.required) continue;
        const el = modal.querySelector(`#fm_${f.id}`);
        if (!el) continue;
        if (f.type === 'checkbox') continue;
        if (f.type === 'file') continue;
        if (!String(el.value).trim()) {
          showToast(`El campo "${f.label}" es obligatorio`, 'warning');
          el.focus();
          return false;
        }
      }
      return true;
    };

    const saveBtn = modal.querySelector('.form-modal__save');
    const deleteBtn = modal.querySelector('.form-modal__delete');

    saveBtn.addEventListener('click', async () => {
      if (!validate()) return;
      saveBtn.disabled = true;
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Guardando...';
      try {
        const result = await onSave(getValues()) || {};
        if (result.error) {
          showToast(result.error, 'error');
        } else {
          finish('saved');
        }
      } catch (err) {
        console.error('Error guardando:', err);
        showToast('Ocurrió un error al guardar', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    });

    deleteBtn?.addEventListener('click', async () => {
      deleteBtn.disabled = true;
      try {
        const result = await onDelete() || {};
        if (result.error) {
          showToast(result.error, 'error');
          deleteBtn.disabled = false;
        } else {
          finish('deleted');
        }
      } catch (err) {
        console.error('Error eliminando:', err);
        showToast('Ocurrió un error al eliminar', 'error');
        deleteBtn.disabled = false;
      }
    });

    const closeModal = () => {
      modal.remove();
      document.body.style.overflow = '';
    };

    modal.querySelector('.modal__close').addEventListener('click', () => finish(null));
    modal.querySelector('.form-modal__cancel').addEventListener('click', () => finish(null));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) finish(null);
    });

    const handleEsc = (e) => {
      if (e.key === 'Escape') finish(null);
    };
    document.addEventListener('keydown', handleEsc);
  });
}

/**
 * Función helper para escapar HTML
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Muestra/oculta el menú móvil
 * @param {boolean} show - Mostrar u ocultar
 */
export function toggleMobileMenu(show) {
  const menu = document.querySelector('.mobile-nav');
  const overlay = document.querySelector('.nav-overlay');
  const body = document.body;
  
  if (show) {
    menu?.classList.add('mobile-nav--open');
    overlay?.classList.add('nav-overlay--show');
    body.style.overflow = 'hidden';
  } else {
    menu?.classList.remove('mobile-nav--open');
    overlay?.classList.remove('nav-overlay--show');
    body.style.overflow = '';
  }
}

/**
 * Inicializa los listeners para el menú móvil
 */
export function initMobileMenu() {
  // Delegación sobre document: funciona con headers inyectados dinámicamente
  // y nunca duplica listeners aunque se llame varias veces.
  if (window.__mobileMenuInit) return;
  window.__mobileMenuInit = true;

  document.addEventListener('click', (e) => {
    const hamburger = e.target.closest('.hamburger-btn');
    if (hamburger) {
      const mobileNav = document.querySelector('.mobile-nav');
      if (!mobileNav) return;
      const willOpen = !mobileNav.classList.contains('mobile-nav--open');
      toggleMobileMenu(willOpen);
      hamburger.setAttribute('aria-expanded', String(willOpen));
      return;
    }
    if (e.target.closest('.nav-overlay')) {
      toggleMobileMenu(false);
      document.querySelectorAll('.hamburger-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
      return;
    }
    if (e.target.closest('.mobile-nav__item')) {
      toggleMobileMenu(false);
      return;
    }
    // Clic fuera del menú (p. ej. en desktop, donde la barra queda visible): cierra
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav && mobileNav.classList.contains('mobile-nav--open')
        && !e.target.closest('.mobile-nav')) {
      toggleMobileMenu(false);
      document.querySelectorAll('.hamburger-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav && mobileNav.classList.contains('mobile-nav--open')) {
      toggleMobileMenu(false);
      document.querySelectorAll('.hamburger-btn').forEach(b => b.setAttribute('aria-expanded', 'false'));
    }
  });
}

/**
 * Inyecta (una sola vez) el botón flotante "volver arriba" en la esquina
 * inferior derecha. Visible tras hacer scroll; sube suavemente al inicio.
 */
export function initScrollTopButton() {
  if (document.getElementById('scrollTopBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'scrollTopBtn';
  btn.type = 'button';
  btn.className = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Volver arriba');
  btn.textContent = '↑';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      btn.classList.toggle('scroll-top-btn--visible', window.scrollY > 400);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Tambien cierra el menu movil si alguien pulsa "Volver arriba" dentro del desplegable
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-scroll-top]')) {
      toggleMobileMenu(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

/**
 * Smooth scroll a un elemento
 * @param {string} selector - Selector del elemento
 */
export function scrollToElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Header estandar para todas las paginas publicas (inyectado por JS)
 */
export function renderSiteHeader(active = '') {
  let mount = document.getElementById('site-header-mount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'site-header-mount';
    document.body.insertBefore(mount, document.body.firstChild);
  }
  if (mount.dataset.rendered) return;
  mount.dataset.rendered = '1';
  const link = (href, label, key) =>
    `<li><a href="${href}" class="desktop-nav__link${key === active ? ' active' : ''}">${label}</a></li>`;
  // El menú desplegable NO incluye Carrito (siempre visible en el header)
  // ni Categorías (lleva al mismo sitio que ya estás mirando).
  const mLink = (href, icon, label, key) =>
    `<a href="${href}" class="mobile-nav__item${key === active ? ' active' : ''}"><span class="mobile-nav__icon">${icon}</span><span>${label}</span></a>`;
  mount.innerHTML = `
    <header class="site-header" role="banner">
      <div class="container">
        <div class="header-main">
          <a href="/" class="header__logo">🛒 Mi Tienda</a>
          <button class="hamburger-btn" aria-label="Menú" aria-expanded="false" aria-controls="mobile-nav">
            <span></span><span></span><span></span>
          </button>
          <nav class="desktop-nav" aria-label="Navegación principal">
            <ul class="desktop-nav__list">
              ${link('/', 'Inicio', 'inicio')}
              ${link('/#categorias', 'Categorías', 'categorias')}
              ${link('/contacto.html', 'Contacto', 'contacto')}
            </ul>
          </nav>
          <a href="/carrito.html" class="header__cart" aria-label="Ver carrito">
            <span class="cart-icon">🛒</span>
            <span class="cart-count" style="display: none;">0</span>
          </a>
        </div>
      </div>
    </header>
    <nav class="mobile-nav" id="mobile-nav" aria-label="Navegación móvil">
      ${mLink('/', '🏠', 'Inicio', 'inicio')}
      ${mLink('/contacto.html', '📞', 'Contacto', 'contacto')}
      <button type="button" class="mobile-nav__item mobile-nav__item--top" data-scroll-top aria-label="Volver arriba"><span class="mobile-nav__icon">⬆️</span><span>Volver arriba</span></button>
    </nav>`;
  // Asegurar que exista un overlay (útil en páginas con header estático como index)
  if (!document.querySelector('.nav-overlay')) {
    const ov = document.createElement('div');
    ov.className = 'nav-overlay';
    document.body.insertBefore(ov, mount.nextSibling);
  }
  // Inicializar el menú hamburguesa sobre los elementos recién inyectados
  initMobileMenu();
}

/**
 * Footer estandar para todas las paginas publicas (inyectado por JS).
 * Version ligera: una sola linea con nombre + enlaces utiles + copyright.
 * (Las versiones multicolumna se veian demasiado cargadas.)
 */
export async function renderSiteFooter(bizConfig = {}) {
  // Aceptar tanto un objeto config como un string (nombre del negocio)
  if (typeof bizConfig === 'string') bizConfig = { nombre_negocio: bizConfig };
  let mount = document.getElementById('site-footer-mount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'site-footer-mount';
    document.body.appendChild(mount);
  }
  if (mount.dataset.rendered) return;
  mount.dataset.rendered = '1';

  const name = bizConfig.nombre_negocio || 'Mi Tienda Online';
  const year = new Date().getFullYear();

  mount.innerHTML = `
    <footer class="site-footer site-footer--simple" role="contentinfo">
      <div class="container">
        <div class="footer-simple">
          <span class="footer-simple__brand">🛒 ${escapeHtml(name)}</span>
          <nav class="footer-simple__links" aria-label="Enlaces del pie de página">
            <a href="/">Inicio</a>
            <a href="/carrito.html">Carrito</a>
            <a href="/contacto.html">Contacto</a>
          </nav>
          <span class="footer-simple__copy">&copy; ${year}</span>
        </div>
      </div>
    </footer>`;
}

function getWhatsAppNumberSafe(config) {
  try {
    const raw = config && (config.whatsapp || config.telefono_whatsapp || config.telefono);
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    return digits.length >= 8 ? digits : '';
  } catch (_) { return ''; }
}
