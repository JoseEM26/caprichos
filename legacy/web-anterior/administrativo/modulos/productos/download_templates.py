import os
import time
import urllib.request

base_url = "http://caprichos.restaurant.pe/restaurant/"
dest_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/productos/templates"

templates = [
    # Principal
    "scripts/restaurantpe/productos/productos.view.html",
    "scripts/restaurantpe/productos/selector.html",
    "scripts/restaurantpe/productos/breadcrumb-productos.html",
    # Categorias
    "scripts/restaurantpe/productos/categorias/arbol/categoria.arbol.view.html",
    "scripts/restaurantpe/productos/categorias/form/categoria.form.view.html",
    "scripts/restaurantpe/productos/categorias/form/categoria.view.html",
    "scripts/restaurantpe/productos/categorias/modals/modal-asignarimpuestos.html",
    "scripts/restaurantpe/productos/categorias/modals/modalNewCategoriaDelivery.view.html",
    # Platos / Productos
    "scripts/restaurantpe/productos/platos/lista/platos.lista.view.html",
    "scripts/restaurantpe/productos/platos/ver/platos.ver.html",
    "scripts/restaurantpe/productos/platos/ver/platos.ver.info.html",
    "scripts/restaurantpe/productos/platos/ver/platos.ver.presentaciones.html",
    "scripts/restaurantpe/productos/platos/editar/platos.editar.full.html",
    "scripts/restaurantpe/productos/platos/editar/platos.editar.full2.html",
    "scripts/restaurantpe/productos/platos/editar/platos.editar.rapido.html",
    # Presentaciones
    "scripts/restaurantpe/productos/platos/presentacion/presentacion.lista.view.html",
    "scripts/restaurantpe/productos/platos/presentacion/presentacion.tab.view.html",
    "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.view.html",
    "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.editar.view.html",
    "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.ingredientes.view.html",
    "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.no.transformado.ingredientes.view.html",
    "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.productos.llevar.view.html",
    # Modales de Platos y Presentacion
    "scripts/restaurantpe/productos/platos/presentacion/modals/modal-actualizaareaproduccionsucursales.html",
    "scripts/restaurantpe/productos/platos/presentacion/modals/modal-actualizapreciosucursales.html",
    "scripts/restaurantpe/productos/platos/presentacion/modals/modal-actualizaproductogeneralcategoria.html",
    "scripts/restaurantpe/productos/platos/presentacion/modals/modal-actualizarpropiedadesproducto.html",
    "scripts/restaurantpe/productos/platos/modals/modalAgregarModificadores.view.html",
    "scripts/restaurantpe/productos/platos/modals/modificador.view.html",
    "scripts/restaurantpe/productos/platos/modals/vinculacionmodificadorseleccion.view.html",
    # Modales Generales
    "scripts/restaurantpe/productos/modals/modalActualizacionRapida.html",
    "scripts/restaurantpe/productos/modals/modalFormatoActualizarPrecios.html",
    "scripts/restaurantpe/productos/modals/modalFormatoCartaImagen.html",
    "scripts/restaurantpe/productos/modals/modalImportarProductosBDMaster.html",
    "scripts/restaurantpe/productos/modals/modalSelectorModoProductoAgotado.html",
    "scripts/restaurantpe/productos/modals/modaRegistroRapido.html",
    "scripts/restaurantpe/productos/modals/listaalmacenescontrolstock.html",
    # Modificadores
    "scripts/restaurantpe/productos/modificadores/modificadores.view.html",
    "scripts/restaurantpe/productos/modificadores/lista/modificadores.lista.view.html",
    "scripts/restaurantpe/productos/modificadores/nuevo/agrupador-nuevo.html",
    "scripts/restaurantpe/productos/modificadores/nuevo/modificador-nuevo.html",
    "scripts/restaurantpe/productos/modificadores/modificadorseleccion/modificadores.gestion.html",
    "scripts/restaurantpe/productos/modificadores/modificadorseleccion/vinculacion-modificador.gestion.html",
    "scripts/restaurantpe/productos/modificadores/ver/insumosmodificador.lista.html",
    # Insumos y Recetas
    "scripts/restaurantpe/productos/insumos/insumos.view.html",
    "scripts/restaurantpe/productos/insumos/lista/insumos.lista.view.html",
    "scripts/restaurantpe/productos/insumos/normal/insumos-ver.html",
    "scripts/restaurantpe/productos/insumos/normal/insumos-editar.html",
    "scripts/restaurantpe/productos/insumos/nuevo/insumos-nuevo.html",
    "scripts/restaurantpe/productos/insumos/receta/recetas-detalle.html",
    "scripts/restaurantpe/productos/insumos/receta/recetas-nodo.html",
    "scripts/restaurantpe/productos/insumos/porcionable/porcion-detalle.html",
    "scripts/restaurantpe/productos/insumos/porcionable/porcion-nodo.html",
    # Combos
    "scripts/restaurantpe/productos/combos/combos.view.html",
    "scripts/restaurantpe/productos/combos/nuevo/combos.nuevo.view.html",
    "scripts/restaurantpe/productos/combos/editar/combos.editar.view.html",
    # Descartables
    "scripts/restaurantpe/productos/productodescartable/descartables.view.html",
    "scripts/restaurantpe/productos/productodescartable/lista/descartables.lista.view.html",
    # Menus
    "scripts/restaurantpe/productos/menus/programacion/programacion.html",
    "scripts/restaurantpe/productos/menus/programacion/dia/dia.html",
    # Productos Sugeridos
    "scripts/restaurantpe/productos/productosugerido/productosugerido.view.html",
    "scripts/restaurantpe/productos/productosugerido/components/porcategorias/vistaporcategorias.view.html",
    "scripts/restaurantpe/productos/productosugerido/components/porproducto/vistaporproducto.view.html"
]

os.makedirs(dest_dir, exist_ok=True)

for rel_path in templates:
    url = base_url + rel_path
    save_path = os.path.join(dest_dir, rel_path.replace("/", "_"))
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read()
            with open(save_path, "wb") as f:
                f.write(content)
        print(f"Downloaded: {rel_path} ({len(content)} bytes)")
    except Exception as e:
        print(f"Failed {rel_path}: {e}")
    time.sleep(0.5)

print("Done downloading templates!")
