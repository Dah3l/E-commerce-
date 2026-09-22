/**
 * CONFIGURACIÓN DE LA APLICACIÓN
 * 
 * IMPORTANTE: Reemplaza estos valores con los de tu proyecto Supabase
 */

// URL de tu proyecto Supabase (ej: https://xxxxx.supabase.co)
export const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';

// Anon Key pública de Supabase (la encuentras en Settings > API)
export const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';

// Nombre del bucket de Storage para imágenes de productos
export const STORAGE_BUCKET = 'productos';

// Tiempo de expiración de sesión admin en milisegundos (2 horas)
export const SESSION_EXPIRY = 2 * 60 * 60 * 1000;

// Intentos máximos de login antes de bloquear temporalmente
export const MAX_LOGIN_ATTEMPTS = 5;

// Tiempo de bloqueo por intentos fallidos en milisegundos (5 minutos)
export const LOGIN_BLOCK_TIME = 5 * 60 * 1000;

// Moneda por defecto para formatear precios
export const DEFAULT_CURRENCY = 'USD';

// Número de teléfono de WhatsApp para pedidos (sin + ni espacios)
// Se puede sobrescribir desde la configuración del negocio
export const WHATSAPP_NUMBER = '';

// Mensaje plantilla para pedidos de WhatsApp
export const WHATSAPP_MESSAGE_TEMPLATE = `¡Hola! Quiero realizar el siguiente pedido:

{pedido}

Total: {total}

Gracias.`;
