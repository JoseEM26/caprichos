#!/usr/bin/env python3
"""
Aplica a proyecto.json las diferencias entre el texto de las HU y el backlog de tareas
(la lista "revision" que deja extraer_aybar.py), después de que el usuario las aprobó.

    python3 aplicar_revision.py <proyecto.json> [--solo HU-X,HU-Y] [--como-base]

Para cada diferencia aprobada:
  - agrega la dependencia en "dependeDeTexto" de la HU que va después (el gráfico la dibuja
    o, si se necesitan mutuamente, la explica en el panel);
  - escribe una nota "No coincidía en la documentación" en las dos HU involucradas;
  - arma la lista que aparece en "Cómo leer el gráfico".
Sin --solo aplica todas. No modifica la documentación del proyecto, solo proyecto.json.

--como-base: para proyectos SIN backlog de tareas. Las relaciones leídas del texto pasan a ser
las dependencias principales ("dependeDe"), sin notas de diferencias (no hay backlog con qué comparar).
"""
import json, sys
from collections import defaultdict

if len(sys.argv) < 2:
    sys.exit("Uso: python3 aplicar_revision.py <proyecto.json> [--solo HU-X,HU-Y]")
path = sys.argv[1]
solo = None
como_base = '--como-base' in sys.argv
if '--solo' in sys.argv:
    solo = set(sys.argv[sys.argv.index('--solo') + 1].split(','))
P = json.load(open(path, encoding='utf-8'))
H = {h['id']: h for h in P['hus']}
short = lambda i: i.replace(P['proyecto'].get('prefijoId') or '\0', '-')

rev = [r for r in P.get('revision', []) if not solo or r['hu'] in solo]
grupos = defaultdict(list)   # (hu que recibe la nota, tipo de frase, estado) -> otras HU
items = []
for r in rev:
    a, b = r['antes'], r['despues']
    if a not in H or b not in H: continue
    if como_base:
        if a not in H[b]['dependeDe']: H[b]['dependeDe'].append(a)
        continue
    if a not in H[b]['dependeDe'] and a not in H[b].setdefault('dependeDeTexto', []):
        H[b]['dependeDeTexto'].append(a)
    autor, otra = r['hu'], (a if r['hu'] == b else b)
    rel = 'antes' if otra == a else 'después'            # cómo dice el autor que va la otra
    grupos[(autor, 'propia', rel, r['estado'])].append(otra)
    grupos[(otra, 'ajena:' + autor, rel, r['estado'])].append(otra)          # la otra HU va «rel» respecto del autor
    if r['estado'] == 'falta en el backlog':
        items.append(f'<li><b>{short(a)}</b> va antes de <b>{short(b)}</b>. El backlog no lo tenía.</li>')
    else:
        items.append(f'<li><b>{short(a)}</b> va antes de una parte de <b>{short(b)}</b>. El backlog lo tenía al revés; se necesitan mutuamente.</li>')

def lista(xs):
    xs = [short(x) for x in dict.fromkeys(xs)]
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' y ' + xs[-1]
cierre = {'falta en el backlog': 'el backlog de tareas no lo tenía. El gráfico sigue al texto.',
          'al revés en el backlog': 'el backlog de tareas lo tenía al revés. Se necesitan mutuamente.'}
notas = defaultdict(list)
for (hu, tipo, rel, estado), otras in grupos.items():
    if tipo == 'propia':
        verbo = 'va' if len(set(otras)) == 1 else 'van'
        notas[hu].append(f'Su texto dice que {lista(otras)} {verbo} {rel}; {cierre[estado]}')
    else:
        autor = tipo.split(':', 1)[1]
        notas[hu].append(f'El texto de {short(autor)} dice que esta HU va {rel} de ella; {cierre[estado]}')
if como_base:
    json.dump(P, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'Listo: {len(rev)} relaciones del texto quedaron como dependencias principales (sin notas).'); sys.exit(0)
P['notas'] = {k: ' '.join(dict.fromkeys(v)) for k, v in notas.items()}
if items:
    P['notasDocumentacionHtml'] = ('<b>Diferencias en la documentación:</b> en ' + str(len(items)) +
        ' casos el texto de la HU y el backlog de tareas no coincidían. El gráfico incluye lo que dice el texto '
        'y lo indica en el panel de cada HU afectada:<ul>' + ''.join(dict.fromkeys(items)) + '</ul>')
json.dump(P, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'Aplicadas {len(rev)} diferencias. HU con nota: {", ".join(sorted(P["notas"])) or "ninguna"}.')
