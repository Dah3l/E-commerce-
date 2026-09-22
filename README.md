# 🛒 Tienda Online - Comida y Aseo Personal

Aplicación web completa para una tienda online de productos de comida y aseo personal, con panel de administración integrado.

## ✨ Características

- **Diseño Mobile-First**: Optimizado para móviles, responsive para PC
- **Panel de Administración**: Gestión completa de productos, categorías y configuración
- **Carrito de Compras**: Persistente con localStorage
- **Checkout por WhatsApp**: Envío de pedidos directamente a WhatsApp
- **Autenticación Segura**: Login admin con SHA-256 + salt
- **Sin Frameworks Pesados**: HTML, CSS y JavaScript vanilla
- **Base de Datos**: Supabase (PostgreSQL)
- **Hosting**: Cloudflare Pages ready
## 📁 Estructura del Proyecto

```
/
├── index.html              # Página principal
├── producto.html           # Detalle de producto
├── carrito.html            # Carrito de compras
├── contacto.html           # Información de contacto
├── admin/                  # Panel de administración
│   ├── login.html
│   ├── dashboard.html
│   ├── productos.html
│   ├── categorias.html
│   └── configuracion.html
├── css/                    # Hojas de estilo
│   ├── base.css           # Variables y reset
│   ├── layout.css         # Header, footer, grid
│   ├── components.css     # Componentes UI
│   ├── pages.css          # Estilos por página
│   └── admin.css          # Estilos admin
├── js/                     # Módulos JavaScript
│   ├── config.js          # Configuración
│   ├── supabase-client.js # Cliente Supabase
│   ├── auth.js            # Autenticación
│   ├── carrito.js         # Lógica del carrito
│   ├── productos.js       # Gestión de productos
│   ├── categorias.js      # Gestión de categorías
│   ├── ui.js              # Utilidades UI
│   └── admin/             # Módulos admin
├── assets/                 # Recursos estáticos
├── supabase-schema.sql    # Esquema de BD
└── README.md              # Este archivo
```

## 🚀 Despliegue

### 1. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve al SQL Editor y ejecuta el contenido de `supabase-schema.sql`
3. Crea un bucket de Storage llamado `productos` y hazlo público
4. Configura las políticas RLS como se indica en el SQL

### 2. Configurar Credenciales

1. Copia `.env.example` a `js/config.js`
2. Edita `js/config.js` con tus credenciales:

```javascript
export const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
export const SUPABASE_ANON_KEY = 'tu-anon-key';
```

### 3. Configurar Contraseña de Admin

1. Abre `scripts/generate-hash.html` en tu navegador
2. Ingresa la contraseña que deseas usar
3. Haz clic en "Generar Hash"
4. Copia el hash y salt generados
5. Ejecuta este SQL en Supabase:

```sql
INSERT INTO config_admin (id, password_hash, salt) 
VALUES (1, 'HASH_COPIADO', 'SALT_COPIADO')
ON CONFLICT (id) DO UPDATE SET 
  password_hash = 'HASH_COPIADO',
  salt = 'SALT_COPIADO';
```

### 4. Desplegar en Cloudflare Pages

1. Sube tu código a GitHub/GitLab
2. Ve a [Cloudflare Pages](https://pages.cloudflare.com)
3. Conecta tu repositorio
4. Configura:
   - **Build command**: Déjalo vacío (sitio estático)
   - **Output directory**: `/`
5. En **Settings > Environment Variables**, añade:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. Haz deploy

### 5. Configurar Headers de Seguridad

Cloudflare Pages lee automáticamente los archivos `_headers` y `_redirects`.

## 🔐 Seguridad

### Autenticación Admin

- Contraseña hasheada con SHA-256 + salt único
- Web Crypto API para hashing en cliente
- Rate limiting: 5 intentos fallidos = bloqueo por 5 minutos
- Sesión con expiración (2 horas por defecto)

### Row Level Security (RLS)

Las tablas tienen políticas RLS configuradas:
- **Lectura pública**: Solo productos y categorías activos
- **Escritura**: Requiere autenticación (ver notas en SQL)

### Headers de Seguridad

El archivo `_headers` incluye:
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

## 🛠️ Desarrollo Local

### Opción 1: Servidor Simple

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve
```

### Opción 2: Vite (Recomendado)

```bash
npm create vite@latest . -- --template vanilla
npm install
npm run dev
```

## 📱 Uso del Carrito

El carrito se guarda en `localStorage` y persiste entre sesiones.

### Funciones Principales

```javascript
import { 
  addToCart, 
  removeFromCart, 
  updateQuantity,
  getCartCount,
  getCartSubtotal,
  checkoutViaWhatsApp
} from './js/carrito.js';

// Añadir producto
addToCart({
  id: 'uuid-del-producto',
  nombre: 'Producto Demo',
  precio: 10.00,
  imagen_url: 'https://...'
}, cantidad);

// Checkout por WhatsApp
checkoutViaWhatsApp('1234567890', 'USD');
```

## 🎨 Personalización

### Colores

Edita las variables CSS en `css/base.css`:

```css
:root {
  --color-primary: #6B8E23;    /* Verde oliva */
  --color-secondary: #20B2AA;  /* Azul menta */
  --color-accent: #FF7F50;     /* Naranja coral */
}
```

### WhatsApp

Configura el número en `js/config.js`:

```javascript
export const WHATSAPP_NUMBER = '1234567890';
```

## 📊 Panel de Administración

Accede en `/admin/login.html`

### Funcionalidades

- **Dashboard**: Métricas básicas
- **Productos**: CRUD completo, gestión de stock, ofertas
- **Categorías**: CRUD con ordenamiento
- **Configuración**: Datos del negocio, cambio de contraseña

## ⚠️ Notas Importantes

### Producción

1. **RLS Policies**: Las políticas de escritura en el SQL son permisivas para desarrollo. En producción, implementa:
   - Supabase Auth para administradores, o
   - Edge Functions con service_role key

2. **HTTPS**: Obligatorio para producción (Cloudflare Pages lo incluye)

3. **Imágenes**: Comprime imágenes antes de subir (máx 2MB)

4. **Backup**: Exporta regularmente tu base de datos desde Supabase

### Limitaciones

- Sin pasarela de pagos integrada (solo WhatsApp)
- Sin gestión de usuarios/clientes
- Sin sistema de envíos complejo

## 📄 Licencia

MIT License - Libre uso y modificación.

## 🤝 Soporte

Para issues o preguntas, abre un issue en el repositorio.

---

**Hecho con ❤️ usando Vanilla JS y Supabase**
