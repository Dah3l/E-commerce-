/**
 * REGISTRO DE GESTORES DE VENTA
 * Cada gestor tiene un código único (el que va en su enlace de referido:
 * <tienda>/?ref=<codigo>) y un nombre (el que aparece en el mensaje de
 * WhatsApp del pedido como "Gestor: <nombre>").
 *
 * Para dar de alta un gestor: añadir una línea con su código y nombre.
 * Para darlo de baja: borrar su línea (los enlaces viejos dejan de
 * atribuir y las atribuciones guardadas con ese código se ignoran).
 * El código debe ser único, en minúsculas, sin espacios ni caracteres
 * raros. El % de cada gestor lo cuadra el dueño en persona: la tienda
 * solo atribuye la venta, no calcula comisiones.
 */
export const GESTORES = {
  dahel: 'Dahel',
  kelvin: 'Kelvin'
};

/**
 * Nombre del gestor para un código, o null si el código no existe.
 * @param {string} code - Código de referido (sin importar mayúsculas)
 * @returns {string|null}
 */
export function resolveGestor(code) {
  if (!code) return null;
  const key = String(code).trim().toLowerCase();
  return GESTORES[key] || null;
}
