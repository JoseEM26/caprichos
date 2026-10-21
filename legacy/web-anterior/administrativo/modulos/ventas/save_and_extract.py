import urllib.request
import re
import json

url = "http://caprichos.restaurant.pe/restaurant/scripts/scripts.426a6ac0.js"
print(f"Descargando o leyendo JS...")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode('utf-8', errors='ignore')

# Guardar en archivo local
with open("frontend_bundle.js", "w", encoding="utf-8") as f:
    f.write(content)
print(f"Guardado bundle frontend ({len(content)} bytes).")

# Buscar states de ventas
states = {}
for state_name in [
    'ventas.hacerpedidos.salones', 
    'ventas.multimozo', 
    'ventas.verpedidos.porestado', 
    'ventas.verpedidos.porclientes', 
    'ventas.verpedidos.porpedidos',
    'ventas.verpedidos.poretapas',
    'ventas.verpedidos.porentregar',
    'ventas.hacerpedidos.salones.editarpedido',
    'ventas.hacerpedidos.ventarapida'
]:
    idx = content.find(f'"{state_name}"')
    if idx == -1:
        idx = content.find(f"'{state_name}'")
    if idx != -1:
        snippet = content[idx:idx+1500]
        states[state_name] = snippet
        print(f"\nEncontrado state: {state_name}")
        print(snippet[:500])

with open("states_extracted.json", "w", encoding="utf-8") as f:
    json.dump(states, f, indent=2)

