-- Migración: agrega la columna "codigo" (SKU) a la tabla productos.
-- Ejecutar en Supabase > SQL Editor si el panel de admin no muestra los
-- productos o si la búsqueda por código no funciona (error 42703/PGRST202).
alter table productos add column if not exists codigo text unique;

-- Opcional: agregar también la tasa de cambio USD -> CUP si falta
-- (necesaria para el selector de moneda y precios en CUP):
alter table config_negocio add column if not exists tasa_cup numeric;
