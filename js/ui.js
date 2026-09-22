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
 * Función helper para escapar HTML
 */
function escapeHtml(text) {
  if (!text) return '';
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
  const hamburger = document.querySelector('.hamburger-btn');
  const overlay = document.querySelector('.nav-overlay');
  const mobileNav = document.querySelector('.mobile-nav');
  
  if (!hamburger || !mobileNav) return;
  
  // Toggle menú
  hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.contains('mobile-nav--open');
    toggleMobileMenu(!isOpen);
  });
  
  // Cerrar al hacer click en overlay
  overlay?.addEventListener('click', () => {
    toggleMobileMenu(false);
  });
  
  // Cerrar con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav.classList.contains('mobile-nav--open')) {
      toggleMobileMenu(false);
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
