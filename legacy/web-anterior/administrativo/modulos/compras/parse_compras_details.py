import json
import re

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/compras/cached_templates.json", "r", encoding="utf-8") as f:
    data = json.load(f)

templates = data.get("templates", {})

def analyze_html(title, key):
    content = templates.get(key, "")
    print(f"\n{'='*70}")
    print(f"PANTALLA / COMPONENTE: {title}")
    print(f"Template Key: {key}")
    print(f"{'='*70}")
    if not content:
        print("NO ENCONTRADO EN CACHE")
        return

    # Extract form fields / inputs
    # Look for form groups
    form_groups = re.findall(r'<div[^>]*class="[^"]*form-group[^"]*"[^>]*>(.*?)</div>\s*</div>', content, re.DOTALL | re.IGNORECASE)
    
    # Inputs, selects, textareas
    inputs = re.findall(r'<(input|select|textarea)[^>]+>', content, re.IGNORECASE)
    print(f"Total Controles Formulario: {len(inputs)}")

    # Extract all labels with input details
    labels = re.findall(r'<label[^>]*>(.*?)</label>', content, re.DOTALL | re.IGNORECASE)
    clean_labels = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', l)).strip() for l in labels]
    clean_labels = [l for l in clean_labels if l and l != '*']
    print(f"Labels ({len(clean_labels)}): {clean_labels}")

    # Extract table headers
    th_matches = re.findall(r'<th[^>]*>(.*?)</th>', content, re.DOTALL | re.IGNORECASE)
    clean_th = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', th)).strip() for th in th_matches]
    clean_th = [th for th in clean_th if th]
    print(f"Columnas Tabla ({len(clean_th)}): {clean_th}")

    # Extract buttons
    btn_matches = re.findall(r'<(button|a)[^>]*class="[^"]*btn[^"]*"[^>]*>(.*?)</\1>', content, re.DOTALL | re.IGNORECASE)
    clean_btns = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', b[1])).strip() for b in btn_matches]
    clean_btns = [b for b in clean_btns if b]
    print(f"Botones ({len(clean_btns)}): {list(dict.fromkeys(clean_btns))}")

    # Extract ng-models
    models = list(dict.fromkeys(re.findall(r'ng-model="([^"]+)"', content)))
    print(f"ng-models ({len(models)}): {models}")

    # Extract validation rules (required, ng-required, pattern, maxlength, minlength)
    validations = list(dict.fromkeys(re.findall(r'(required|ng-required="[^"]+"|ng-pattern="[^"]+"|maxlength="[^"]+"|min="[^"]+"|max="[^"]+")', content)))
    print(f"Reglas validacion: {validations}")

    # Directives / Actions (ng-click, ng-submit, ng-change)
    actions = list(dict.fromkeys(re.findall(r'(ng-click="[^"]+"|ng-submit="[^"]+"|ng-change="[^"]+")', content)))
    print(f"Acciones / Eventos ({len(actions)}): {actions[:10]}")

# List of all templates of interest
keys = [
    # 1. Proveedores
    ("PROVEEDORES - LISTA", "scripts/restaurantpe/compras/proveedor/proveedor-lista.html"),
    ("PROVEEDORES - FORMULARIO NUEVO / EDITAR", "scripts/restaurantpe/compras/proveedor/proveedor-editar.html"),
    ("PROVEEDORES - VISTA DETALLE", "scripts/restaurantpe/compras/proveedor/proveedor-ver.html"),

    # 2. Lotes
    ("LOTES - LISTA", "scripts/restaurantpe/compras/lotecompra/lotecompra-lista.html"),
    ("LOTES - FORMULARIO REGISTRAR / EDITAR", "scripts/restaurantpe/compras/lotecompra/lotecompra-editar.html"),
    ("LOTES - PAGAR LOTE", "scripts/restaurantpe/compras/lotecompra/lotecompra-pagar.html"),
    ("LOTES - VISTA DETALLE", "scripts/restaurantpe/compras/lotecompra/lotecompra-ver.html"),

    # 3. Ajustes de Compras
    ("AJUSTES - SELECTOR / TABS", "scripts/restaurantpe/compras/ajustes/ajustesselector.html"),
    ("AJUSTES - BANCOS LISTA", "scripts/restaurantpe/creditos/banco/index.html"),
    ("AJUSTES - BANCOS EDITAR", "scripts/restaurantpe/creditos/banco/editar.html"),
    ("AJUSTES - CUENTAS BANCARIAS LISTA", "scripts/restaurantpe/creditos/cuentabancaria/index.html"),
    ("AJUSTES - CUENTAS BANCARIAS EDITAR", "scripts/restaurantpe/creditos/cuentabancaria/editar.html"),
    ("AJUSTES - COMPROBANTES DE COMPRA LISTA", "scripts/restaurantpe/compras/comprobantecompra/index.html"),
    ("AJUSTES - COMPROBANTES DE COMPRA EDITAR", "scripts/restaurantpe/compras/comprobantecompra/editar.html"),
    ("AJUSTES - PERCEPCIONES LISTA", "scripts/restaurantpe/compras/percepcion/index.html"),
    ("AJUSTES - PERCEPCIONES EDITAR", "scripts/restaurantpe/compras/percepcion/editar.html"),
    ("AJUSTES - TRANSPORTISTAS LISTA", "scripts/restaurantpe/ajustes/transportistas/index.html"),
    ("AJUSTES - TRANSPORTISTAS EDITAR", "scripts/restaurantpe/ajustes/transportistas/editar.html"),
    ("AJUSTES - SERVICIOS COMPRA LISTA", "scripts/restaurantpe/compras/serviciocompra/index.html"),
    ("AJUSTES - SERVICIOS COMPRA EDITAR", "scripts/restaurantpe/compras/serviciocompra/editar.html"),
    ("AJUSTES - IMPUESTOS COMPRA LISTA", "scripts/restaurantpe/compras/impuestoscompra/index.html"),
    ("AJUSTES - IMPUESTOS COMPRA EDITAR", "scripts/restaurantpe/compras/impuestoscompra/editar.html"),

    # 4. Registro de compras / facturas de proveedor
    ("COMPRAS - LISTA", "scripts/restaurantpe/compras/compra/compra-lista.html"),
    ("COMPRAS - REGISTRO / EDITAR", "scripts/restaurantpe/compras/compra/compra-editar.html"),
    ("COMPRAS - VISTA DETALLE", "scripts/restaurantpe/compras/compra/compra-ver.html"),
    ("COMPRAS - ORDEN DE COMPRA LISTA", "scripts/restaurantpe/compras/ordencompra/ordencompra-lista.html"),
    ("COMPRAS - ORDEN DE COMPRA REGISTRAR", "scripts/restaurantpe/compras/ordencompra/ordencompra-nuevo.html"),
    ("COMPRAS - GUIA LISTA", "scripts/restaurantpe/compras/guia/guia-lista.html"),
    ("COMPRAS - GUIA NUEVA/EDITAR", "scripts/restaurantpe/compras/guia/guia-nuevo.html"),
    ("COMPRAS - NOTAS DE CREDITO", "scripts/restaurantpe/compras/notasdecredito/notasdecredito-lista.html"),
    ("CREDITOS - PAGO DE COMPRAS LISTA", "scripts/restaurantpe/creditos/compracredito/compracredito-lista.html"),
    ("CREDITOS - PAGO DE COMPRAS REGISTRAR", "scripts/restaurantpe/creditos/compracredito/compracredito-registrar.html")
]

for title, key in keys:
    analyze_html(title, key)
