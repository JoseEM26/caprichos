import json
import re

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/compras/compras_exact_templates.json", "r", encoding="utf-8") as f:
    tpls = json.load(f)

def extract_form_fields(html):
    # Extracts input, select, textarea along with nearest label
    fields = []
    # Find form-group divs
    groups = re.findall(r'<div[^>]*class=\"[^\"]*form-group[^\"]*\"[^>]*>(.*?)</div>\s*(?:</div>|<div)', html, re.DOTALL)
    for g in groups:
        lbl_m = re.search(r'<label[^>]*>(.*?)</label>', g, re.DOTALL)
        lbl = re.sub(r'<[^>]+>', '', lbl_m.group(1)).strip() if lbl_m else ""
        lbl = re.sub(r'\s+', ' ', lbl).replace('*', '').strip()
        
        # Check inputs
        inps = re.findall(r'<(input|select|textarea|ui-select)[^>]*>', g)
        models = re.findall(r'ng-model=\"([^\"]+)\"', g)
        req = 'required' in g or 'ng-required' in g
        types = re.findall(r'type=\"([^\"]+)\"', g)
        
        # Options if select
        opts = re.findall(r'<option[^>]*>(.*?)</option>', g)
        clean_opts = [re.sub(r'<[^>]+>', '', o).strip() for o in opts if o.strip()]
        
        # UI select choices
        ui_choices = re.findall(r'repeat=\"([^\"]+)\"', g)
        
        if lbl or models:
            fields.append({
                "label": lbl,
                "controls": inps,
                "models": models,
                "required": req,
                "types": types,
                "options": clean_opts,
                "ui_repeat": ui_choices
            })
    return fields

# Let's inspect Lote compra form
print("=== LOTE COMPRA FORM ===")
lote_fields = extract_form_fields(tpls['scripts/restaurantpe/compras/lotecompra/lotecompra-form.html'])
for f in lote_fields:
    print(f)

print("\n=== COMPRA FORM (HEADER & DETALLE) ===")
compra_fields = extract_form_fields(tpls['scripts/restaurantpe/compras/compra/compra-form.html'])
for f in compra_fields[:30]:
    print(f)

print("\n=== BANCO EDITAR ===")
banco_fields = extract_form_fields(tpls['scripts/restaurantpe/creditos/banco/editar.html'])
for f in banco_fields:
    print(f)

print("\n=== CUENTA BANCARIA EDITAR ===")
cta_fields = extract_form_fields(tpls['scripts/restaurantpe/creditos/cuentabancaria/editar.html'])
for f in cta_fields:
    print(f)

print("\n=== COMPROBANTE COMPRA EDITAR ===")
comp_fields = extract_form_fields(tpls['scripts/restaurantpe/compras/comprobantecompra/editar.html'])
for f in comp_fields:
    print(f)

print("\n=== PERCEPCION EDITAR ===")
perc_fields = extract_form_fields(tpls['scripts/restaurantpe/compras/percepcion/editar.html'])
for f in perc_fields:
    print(f)

print("\n=== TRANSPORTISTAS EDITAR ===")
transp_fields = extract_form_fields(tpls['scripts/restaurantpe/ajustes/transportistas/editar.html'])
for f in transp_fields:
    print(f)

print("\n=== SERVICIO COMPRA EDITAR ===")
serv_fields = extract_form_fields(tpls['scripts/restaurantpe/compras/serviciocompra/editar.html'])
for f in serv_fields:
    print(f)
