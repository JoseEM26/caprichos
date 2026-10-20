import os
import re
import json

bundle_path = '/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js'
with open(bundle_path, 'r', encoding='utf-8') as f:
    js_text = f.read()

# Let's search for controller definitions:
# .controller("Clientes", ...) or function Clientes(...)
controllers = {}
for c_name in ["Clientes", "debitoClientes", "importarClientes", "modalCreditoCliente"]:
    idx = js_text.find(f'.controller("{c_name}"')
    if idx == -1:
        idx = js_text.find(f".controller('{c_name}'")
    if idx != -1:
        # extract around 8000 chars of this controller
        controllers[c_name] = js_text[idx:idx+15000]
        print(f"Found controller: {c_name}")
    else:
        print(f"Controller {c_name} not found by .controller")

# Also look for services or factory related to cliente:
# .factory("Cliente", ...) or ClienteService or similar
services = {}
for s_name in ["Cliente", "Clientes", "Debito", "ClienteService"]:
    idx = js_text.find(f'.factory("{s_name}"')
    if idx == -1:
        idx = js_text.find(f".factory('{s_name}'")
    if idx == -1:
        idx = js_text.find(f'.service("{s_name}"')
    if idx != -1:
        services[s_name] = js_text[idx:idx+10000]
        print(f"Found factory/service: {s_name}")

out_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/clientes/controllers_extracted.txt"
with open(out_path, "w", encoding="utf-8") as f:
    for k, v in controllers.items():
        f.write(f"\n\n{'='*40}\nCONTROLLER: {k}\n{'='*40}\n{v}\n")
    for k, v in services.items():
        f.write(f"\n\n{'='*40}\nSERVICE: {k}\n{'='*40}\n{v}\n")

print(f"Saved controllers to {out_path}")
