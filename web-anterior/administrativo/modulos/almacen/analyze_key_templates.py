import os
import json
import re
from html.parser import HTMLParser

templates_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/extracted_templates"

files_to_inspect = [
    # Movimiento Interno
    ("movimiento_interno", "scripts__restaurantpe__almacen__movimientointerno__movimientointerno.html"),
    ("modal_plantilla_movimiento", "scripts__restaurantpe__almacen__movimientointerno__modal-plantilla-movimiento.view.html"),
    ("modal_canje_movimiento", "scripts__restaurantpe__almacen__movimientointerno__modal-canje-movimiento-interno.view.html"),
    
    # Requerimiento
    ("requerimiento_v2", "scripts__restaurantpe__almacen__requerimientov2__requerimientos.view.html"),
    ("modal_plantilla_requerimiento", "scripts__restaurantpe__almacen__requerimientov2__modal-registrar-plantilla.view.html"),
    ("modal_canje_requerimiento", "scripts__restaurantpe__almacen__requerimientov2__modal-canjear-requerimiento.view.html"),
    
    # Recepcion
    ("recepcion_v2", "scripts__restaurantpe__almacen__recepcion__recepcion.view.html"),
    ("modal_canje_guia_recepcion", "scripts__restaurantpe__almacen__recepcion__modal-canje-guia-remision-mov.view.html"),
    
    # Lista de Procesos
    ("lista_procesos", "scripts__restaurantpe__almacen__lista-procesos__lista-de-procesos.view.html"),
    ("tab_requerimiento", "scripts__restaurantpe__almacen__lista-procesos__tap-requerimiento.view.html"),
    ("tab_recepcion", "scripts__restaurantpe__almacen__lista-procesos__tab-recepcion.view.html"),
    ("tab_movimiento", "scripts__restaurantpe__almacen__lista-procesos__tab-movimiento.view.html"),
    ("proceso_detalle", "scripts__restaurantpe__almacen__lista-procesos__proceso-detalle.view.html"),
    ("recepcion_detalle", "scripts__restaurantpe__almacen__lista-procesos__recepcion-detalle.view.html"),
    ("movimiento_detalle", "scripts__restaurantpe__almacen__lista-procesos__movimiento-detalle.view.html"),
    ("filtro_requerimiento", "scripts__restaurantpe__almacen__lista-procesos__modal-filtro-requerimiento.view.html"),
    ("filtro_recepcion", "scripts__restaurantpe__almacen__lista-procesos__modal-filtro-recepcion.view.html"),
    ("filtro_movimiento", "scripts__restaurantpe__almacen__lista-procesos__modal-filtro-movimiento.view.html"),
    
    # Stock
    ("stock_principal", "scripts__restaurantpe__almacen__stock__stock.html"),
    
    # Preparacion Receta & Porcionamiento
    ("receta_lista", "scripts__restaurantpe__almacen__preparacionreceta__lista__receta.lista.view.html"),
    ("receta_detalle", "scripts__restaurantpe__almacen__preparacionreceta__registrar__recetas-detalle.html"),
    ("porcionamiento_detalle", "scripts__restaurantpe__almacen__porcionamientoinsumo__registrar__porcionamiento-detalle.html"),
    
    # Ajustes Almacenes
    ("ajustes_almacen_modal", "scripts__restaurantpe__ajustes__produccion__modals__almacen-modal.html")
]

class SimpleHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inputs = []
        self.buttons = []
        self.texts = []
        self.current_tag = None
        self.current_attrs = {}

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        self.current_tag = tag
        self.current_attrs = attr_dict
        if tag in ('input', 'select', 'textarea'):
            self.inputs.append({
                "tag": tag,
                "type": attr_dict.get("type", "text"),
                "placeholder": attr_dict.get("placeholder", ""),
                "model": attr_dict.get("ng-model", ""),
                "required": "required" in attr_dict
            })
        if tag in ('button', 'a') and ('ng-click' in attr_dict or 'btn' in attr_dict.get('class', '')):
            self.buttons.append({
                "tag": tag,
                "ng_click": attr_dict.get("ng-click", ""),
                "class": attr_dict.get("class", "")
            })

    def handle_data(self, data):
        txt = data.strip()
        if txt:
            self.texts.append(txt)

analysis = {}

for key, fname in files_to_inspect:
    fpath = os.path.join(templates_dir, fname)
    if not os.path.exists(fpath):
        analysis[key] = {"error": f"File not found: {fname}"}
        continue
    
    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()
    
    parser = SimpleHTMLParser()
    try:
        parser.feed(html)
    except Exception as e:
        pass

    # Extract distinct labels or text fragments
    clean_texts = [t for t in parser.texts if len(t) > 1 and not t.startswith("{{")]
    
    analysis[key] = {
        "file": fname,
        "inputs": parser.inputs,
        "buttons": parser.buttons,
        "clean_texts": clean_texts[:40],
        "raw_len": len(html)
    }

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/templates_detailed_analysis.json", "w", encoding="utf-8") as out:
    json.dump(analysis, out, indent=2, ensure_ascii=False)

print(f"Parsed {len(analysis)} templates successfully.")
