-- ============================================
-- ESQUEMA DE BASE DE DATOS - SUPABASE
-- Tienda Online de Comida y Aseo Personal
-- ============================================

-- ============================================
-- 1. TABLA DE CATEGORÍAS
-- ============================================
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  slug text not null unique,
  descripcion text,
  imagen_url text,
  orden int default 0,
  activa boolean default true,
  created_at timestamptz default now()
);

-- ============================================
-- 2. TABLA DE PRODUCTOS
-- ============================================
create table productos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique, -- código/SKU interno configurable desde el panel de admin
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null check (precio >= 0),
  precio_oferta numeric(10,2),
  stock int default 0,
  categoria_id uuid references categorias(id) on delete set null,
  imagen_url text,
  imagenes_extra jsonb default '[]'::jsonb,
  destacado boolean default false,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger para actualizar updated_at automáticamente
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Migración para bases de datos existentes: agrega la columna codigo (SKU)
alter table productos add column if not exists codigo text unique;

create trigger update_productos_updated_at
  before update on productos
  for each row
  execute function update_updated_at_column();

-- ============================================
-- 3. TABLA DE CONFIGURACIÓN DEL NEGOCIO
-- ============================================
create table config_negocio (
  id int primary key default 1 check (id = 1),
  nombre_negocio text,
  descripcion text,
  telefono text,
  whatsapp text,
  email text,
  direccion text,
  horario text,
  facebook text,
  instagram text,
  moneda text default 'USD',
  updated_at timestamptz default now()
);

create trigger update_config_negocio_updated_at
  before update on config_negocio
  for each row
  execute function update_updated_at_column();

-- ============================================
-- 4. TABLA DE CONFIGURACIÓN DE ADMIN
-- ============================================
create table config_admin (
  id int primary key default 1 check (id = 1),
  password_hash text not null,
  salt text not null,
  updated_at timestamptz default now()
);

create trigger update_config_admin_updated_at
  before update on config_admin
  for each row
  execute function update_updated_at_column();

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================
alter table categorias enable row level security;
alter table productos enable row level security;
alter table config_negocio enable row level security;
alter table config_admin enable row level security;

-- Políticas de lectura pública para el catálogo
create policy "Lectura pública categorias" on categorias 
  for select using (activa = true);

create policy "Lectura pública productos" on productos 
  for select using (activo = true);

create policy "Lectura pública config" on config_negocio 
  for select using (true);

-- NOTA IMPORTANTE SOBRE ESCRITURA:
-- Para operaciones de escritura (INSERT, UPDATE, DELETE) desde el panel admin,
-- tienes DOS opciones:
--
-- OPCIÓN 1 (Recomendada): Usar Supabase Auth
--   - Implementar login con Supabase Auth para administradores
--   - Crear políticas RLS que permitan escritura solo a usuarios autenticados
--   - Ejemplo: create policy "Escritura admin" on productos for all using (auth.role() = 'authenticated');
--
-- OPCIÓN 2: Usar service_role key en funciones Edge
--   - Crear Supabase Edge Functions que reciban las peticiones del admin
--   - Las funciones usan la service_role key internamente (no expuesta al cliente)
--   - El frontend llama a las funciones edge, no directamente a las tablas
--
-- Para este proyecto, implementaremos la OPCIÓN 1 simplificada:
-- Usaremos un sistema de sesión basado en token almacenado en sessionStorage
-- y verificaremos la autenticación en el cliente antes de hacer llamadas.
-- Las políticas RLS se mantendrán restrictivas para producción.

-- Política temporal para desarrollo (REMOVER EN PRODUCCIÓN):
-- Esto permite todas las operaciones durante el desarrollo.
-- En producción, debes implementar auth proper o edge functions.
create policy "Acceso completo categorias" on categorias for all using (true);
create policy "Acceso completo productos" on productos for all using (true);
create policy "Acceso completo config_negocio" on config_negocio for all using (true);
create policy "Acceso completo config_admin" on config_admin for all using (true);

-- ============================================
-- 6. DATOS DE EJEMPLO
-- ============================================

-- Categorías demo
insert into categorias (nombre, slug, descripcion, orden, activa) values
('Comida', 'comida', 'Productos alimenticios frescos y envasados', 1, true),
('Bebidas', 'bebidas', 'Bebidas frías, calientes y refrescos', 2, true),
('Aseo Personal', 'aseo-personal', 'Productos de higiene y cuidado personal', 3, true);

-- Productos demo
-- Nota: Las imágenes son placeholders. Reemplazar con URLs reales de Supabase Storage.
do $$
declare
  cat_comida uuid;
  cat_bebidas uuid;
  cat_aseo uuid;
begin
  select id into cat_comida from categorias where slug = 'comida';
  select id into cat_bebidas from categorias where slug = 'bebidas';
  select id into cat_aseo from categorias where slug = 'aseo-personal';

  insert into productos (nombre, descripcion, precio, precio_oferta, stock, categoria_id, destacado, activo) values
  ('Arroz Premium 1kg', 'Arroz blanco de grano largo, ideal para todo tipo de preparaciones.', 2.50, null, 100, cat_comida, true, true),
  ('Aceite de Oliva 500ml', 'Aceite de oliva virgen extra, primera presión en frío.', 8.99, 7.99, 50, cat_comida, true, true),
  ('Galletas Integrales', 'Pack de galletas integrales con avena y miel. Sin conservantes.', 3.25, null, 75, cat_comida, false, true),
  ('Agua Mineral 1.5L', 'Agua mineral natural sin gas. Fuente pura de montaña.', 1.20, null, 200, cat_bebidas, false, true),
  ('Jugo Natural Naranja 1L', 'Jugo de naranja 100% natural, sin azúcar añadida.', 4.50, 3.99, 60, cat_bebidas, true, true),
  ('Shampoo Hidratante 400ml', 'Shampoo con keratina y vitamina E para todo tipo de cabello.', 6.75, null, 40, cat_aseo, false, true);
end $$;

-- Configuración inicial del negocio
insert into config_negocio (nombre_negocio, descripcion, telefono, whatsapp, email, direccion, horario, moneda) values
('Mi Tienda Online', 'Tu tienda de confianza para productos de comida y aseo personal', '+1234567890', '+1234567890', 'contacto@mitienda.com', 'Calle Principal 123, Ciudad', 'Lunes a Sábado: 9:00 AM - 8:00 PM', 'USD');

-- ============================================
-- 7. BUCKET DE STORAGE "productos" + POLICIES
-- ============================================
-- Opccion A (recomendada): ejecutar este SQL en Supabase > SQL Editor.
-- Crea el bucket publico y las policies necesarias para subir/editar/borrar.

insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

create policy "Productos: insert public"
  on storage.objects for insert to public
  with check (bucket_id = 'productos');

create policy "Productos: update public"
  on storage.objects for update to public
  using (bucket_id = 'productos')
  with check (bucket_id = 'productos');

create policy "Productos: delete public"
  on storage.objects for delete to public
  using (bucket_id = 'productos');

-- NOTA sobre SELECT: en un bucket PUBLICO no hace falta policy de select para
-- mostrar las imagenes via la URL publica (/storage/v1/object/public/...).
-- Si ademas quieres listar/leer objetos desde el cliente autenticado:
-- create policy "Productos: select public"
--   on storage.objects for select to public
--   using (bucket_id = 'productos');

-- IMPORTANTE: si tu panel admin usa login (supabase.auth), el upload se hace
-- con el token del usuario autenticado; la policy de arriba (to public) lo
-- permite porque "public" incluye a cualquier rol autenticado anon/authenticated.

-- Opccion B (manual): Dashboard > Storage > New bucket "productos" (public)
-- y anadir las policies anteriores desde la pestana "Policies".

-- ============================================
-- FIN DEL ESQUEMA
-- ============================================
