-- ============================================
-- SCRIPT DE PRUEBA: 20 PRODUCTOS DEMO
-- Ejecutar en Supabase > SQL Editor
-- (después de supabase-schema.sql)
-- ============================================

-- Asegurar que existen las categorías base
insert into categorias (nombre, slug, descripcion, orden, activa) values
('Comida', 'comida', 'Productos alimenticios frescos y envasados', 1, true),
('Bebidas', 'bebidas', 'Bebidas frías, calientes y refrescos', 2, true),
('Aseo Personal', 'aseo-personal', 'Productos de higiene y cuidado personal', 3, true),
('Juguetes', 'juguetes', 'Juguetes y juegos para todas las edades', 4, true)
on conflict (slug) do nothing;

-- Insertar 20 productos demo (se evita duplicar por nombre)
do $$
declare
  cat_comida uuid;
  cat_bebidas uuid;
  cat_aseo uuid;
  cat_juguetes uuid;
begin
  select id into cat_comida   from categorias where slug = 'comida';
  select id into cat_bebidas  from categorias where slug = 'bebidas';
  select id into cat_aseo     from categorias where slug = 'aseo-personal';
  select id into cat_juguetes from categorias where slug = 'juguetes';

  insert into productos (codigo, nombre, descripcion, precio, precio_oferta, stock, categoria_id, destacado, activo)
  select p.codigo, p.nombre, p.descripcion, p.precio, p.precio_oferta, p.stock, p.categoria_id, p.destacado, true
  from (values
    -- ===== COMIDA =====
    ('COM-FRI-001', 'Frijoles Negros 1kg',        'Frijoles negros seleccionados, ideales para sopas y guisos.', 2.80, null, 90,  cat_comida, false),
    ('COM-PAS-002', 'Pasta Espagueti 500g',       'Pasta de trigo duro, cocción al dente perfecta.', 1.90, 1.50, 120, cat_comida, false),
    ('COM-ATT-003', 'Atún en Agua 170g',          'Lata de atún claro en agua, alta fuente de proteína.', 2.20, null, 80,  cat_comida, true),
    ('COM-CAF-004', 'Café Molido Premium 250g',   'Café 100% arábica de tueste medio, aroma intenso.', 6.50, 5.99, 45,  cat_comida, true),
    ('COM-AZU-005', 'Azúcar Morena 1kg',          'Azúcar morena sin refinar, ideal para repostería.', 2.10, null, 100, cat_comida, false),
    ('COM-LEC-006', 'Leche en Polvo 800g',        'Leche entera en polvo instantánea, rica en calcio.', 7.80, null, 35,  cat_comida, false),
    ('COM-SAL-007', 'Salsa de Tomate 700g',       'Salsa natural de tomate con albahaca, lista para usar.', 3.40, 2.99, 60, cat_comida, false),
    -- ===== BEBIDAS =====
    ('BEB-COL-001', 'Gaseosa Cola 2L',            'Bebida gaseificada sabor cola, botella familiar.', 2.50, null, 150, cat_bebidas, false),
    ('BEB-AGG-002', 'Agua con Gas 500ml',         'Agua mineral con gas, refrescante y ligera.', 0.90, null, 200, cat_bebidas, false),
    ('BEB-JUG-003', 'Jugo de Manzana 1L',         'Jugo de manzana 100% natural, sin azúcar añadida.', 4.20, 3.75, 55,  cat_bebidas, false),
    ('BEB-TVE-004', 'Té Verde en Bolsitas x25',   'Té verde aromático, antioxidantes naturales.', 3.80, null, 70,  cat_bebidas, true),
    ('BEB-CER-005', 'Cerveza Artesanal 355ml',    'Cerveza artesanal rubia, notas cítricas y lupuladas.', 3.50, null, 48,  cat_bebidas, false),
    ('BEB-ENE-006', 'Bebida Energética 250ml',    'Bebida energética con vitaminas del grupo B.', 2.90, null, 65,  cat_bebidas, false),
    -- ===== ASEO PERSONAL =====
    ('ASE-JAB-001', 'Jabón Antibacterial x3',     'Pack de tres jabones antibacteriales con aloe vera.', 3.60, null, 85,  cat_aseo, false),
    ('ASE-DEN-002', 'Pasta Dental 100ml',         'Pasta dental con flúor y protección extra contra caries.', 2.75, 2.40, 95, cat_aseo, false),
    ('ASE-ALO-003', 'Gel de Aloe Vera 300ml',     'Gel hidratante de aloe vera puro para piel y cabello.', 5.90, null, 40,  cat_aseo, true),
    ('ASE-DES-004', 'Desodorante Roll-on 50ml',   'Desodorante con 48 horas de protección y fragancia fresca.', 4.30, null, 60,  cat_aseo, false),
    ('ASE-PAP-005', 'Papel Higiénico x12',        'Paquete de 12 rollos de papel higiénico doble hoja.', 8.50, 7.99, 30,  cat_aseo, false),
    -- ===== JUGUETES =====
    ('JUG-LEG-001', 'Set de LEGOS de astronautas','Un set de juguetes LEGO con temática de astronautas rusos.', 2.99, null, 3,   cat_juguetes, true),
    ('JUG-PEL-002', 'Pelota de Fútbol Tamaño 5',  'Pelota de fútbol profesional, costuras reforzadas.', 12.99, 10.99, 25, cat_juguetes, false)
  ) as p(codigo, nombre, descripcion, precio, precio_oferta, stock, categoria_id, destacado)
  where not exists (select 1 from productos pr where pr.nombre = p.nombre);
end $$;

-- Verificación rápida
select c.nombre as categoria, count(*) as productos
from productos p
left join categorias c on c.id = p.categoria_id
where p.activo = true
group by c.nombre
order by c.nombre;

-- ============================================================
-- Config: tasa de cambio USD -> CUP (editable luego desde el panel)
-- 1 USD = 700 CUP. Con un valor > 0 aparece el selector USD/CUP en la tienda.
-- ============================================================
update config_negocio set tasa_cup = 700 where id = 1;
