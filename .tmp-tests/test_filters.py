products = [
    {'nombre': 'a', 'precio': 5, 'precio_oferta': None},
    {'nombre': 'b', 'precio': 10, 'precio_oferta': 4},
    {'nombre': 'c', 'precio': 3, 'precio_oferta': None},
]
def effective(p):
    return p['precio_oferta'] if (p['precio_oferta'] and p['precio_oferta'] < p['precio']) else p['precio']
asc = sorted(products, key=effective)
desc = sorted(products, key=effective, reverse=True)
assert [p['nombre'] for p in asc] == ['c', 'b', 'a'], asc
assert [p['nombre'] for p in desc] == ['a', 'c', 'b'], desc
print('Test 1 OK: orden por precio efectivo')

src = open('/workspace/js/pages/home.js').read()
assert 'initSortBar()' in src and '#product-sort' in src and '#only-offers' in src
assert 'activeFilters.orden' in src and 'enOferta: activeFilters.enOferta' in src
for bad in ['loadAllProducts(null', 'loadAllProducts(categoryId', 'loadAllProducts(initialCategory)']:
    assert bad not in src, bad
print('Test 2 OK: home.js cableado')

pj = open('/workspace/js/productos.js').read()
assert "filters.enOferta" in pj and ".lt('precio_oferta', 'precio')" in pj
assert "filters.orden" in pj and "'precio-asc'" in pj and "'precio-desc'" in pj
print('Test 3 OK: getProducts filtros')

ix = open('/workspace/index.html').read()
for needle in ['id="sort-bar"', 'value="precio-asc"', 'value="precio-desc"', 'id="only-offers"']:
    assert needle in ix, needle
print('Test 4 OK: index.html')

bc = open('/workspace/css/base.css').read()
assert 'flex-direction: column' in bc and 'flex: 1 0 auto' in bc
ui = open('/workspace/js/ui.js').read()
assert "mobile-nav-open" in ui and "body.style.overflow = 'hidden'" not in ui
print('Test 5 OK: sticky footer + scroll-lock')
