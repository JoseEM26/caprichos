#!/usr/bin/env python3
"""
Extrae épicas, features, HU y dependencias de la documentación estándar de AybarCorp
y genera proyecto.json para construir.js.

    python3 extraer_aybar.py <carpeta_del_proyecto> <salida/proyecto.json>

Busca (en cualquier subcarpeta, hasta 3 niveles):
  epicas/*.md            épicas      (frontmatter id + titulo)
  features/*.md          features    (frontmatter id + titulo; la épica se toma de sus HU)
  historias/*.md         HU          (fila "Épica / Módulo", tabla de prioridad, DEP-xx citadas)
  backlog/tareas/*.json  dependencias entre HU (campo depende_de de cada tarea)
  roadmap/*roadmap*.md   bloqueos externos (tabla DEP-xx)
  dor/*.md               Definition of Ready por feature (opcional)

Al final imprime lo que NO encontró, para que Claude pregunte al usuario.
También deja en "revision" las frases de las HU ("X va antes / después / es precondición")
que no coinciden con el backlog de tareas, para mostrarlas al usuario antes de construir.
"""
import json, re, sys, glob, os
from collections import defaultdict

if len(sys.argv) < 3:
    sys.exit("Uso: python3 extraer_aybar.py <carpeta_del_proyecto> <salida/proyecto.json>")
ROOT, OUT = sys.argv[1], sys.argv[2]
faltantes, avisos = [], []

def find_dir(name):
    """Primera carpeta llamada `name` dentro de ROOT (hasta 3 niveles)."""
    for depth in range(0, 4):
        hits = sorted(glob.glob(os.path.join(ROOT, *(['*'] * depth), name)))
        hits = [h for h in hits if os.path.isdir(h) and 'node_modules' not in h]
        if hits:
            return hits[0]
    return None

def front(t, key):
    m = re.search(rf'^{key}:\s*"?(.*?)"?\s*$', t, re.M)
    return m.group(1).strip() if m else ''

ID = r'[A-Z]{2,4}-[A-Z]{2,4}-\d{2,4}b?'
rel = lambda p: os.path.relpath(p, ROOT)
fuentes = {}          # código -> "ruta/corta.md · código"
def limpiar(s):
    s = re.sub(r'`|\*\*|\*', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s
def bloque(t, titulo, n=700):
    """Texto de un párrafo que empieza con **titulo** (hasta el siguiente párrafo en negrita o sección)."""
    m = re.search(r'\*\*' + titulo + r'\.?\*\*\.?\s*(.*?)(?=\n\s*\n\*\*|\n#|\n\|)', t, re.S)
    return limpiar(m.group(1))[:n] if m else ''
EP_RE, FT_RE, HU_RE = r'EP-[A-Z]{2,4}-\d{2,4}', r'FT-[A-Z]{2,4}-\d{2,4}b?', r'HU-[A-Z]{2,4}-\d{2,4}'

# ---------- Épicas ----------
epicas = {}
crudo = {}           # textos originales para que Claude redacte el resumen simple
d = find_dir('epicas')
if d:
    for p in sorted(glob.glob(os.path.join(d, '*.md'))):
        t = open(p, encoding='utf-8').read()
        i = front(t, 'id') or (re.search(EP_RE, os.path.basename(p)) or [None])[0]
        if not i: continue
        titulo = re.sub(rf'^{re.escape(i)}\s*[—-]?\s*', '', front(t, 'titulo'))
        epicas[i] = titulo or i
        fuentes[i] = rel(p)
        crudo[i] = {'problema': bloque(t, 'Problema u oportunidad'), 'objetivoNegocio': bloque(t, 'Objetivo de negocio'),
                    'objetivoUsuario': bloque(t, 'Objetivo del usuario')}
else:
    faltantes.append('epicas: no se encontró la carpeta epicas/ (títulos de las épicas).')

# ---------- Features ----------
features = {}
d = find_dir('features')
if d:
    for p in sorted(glob.glob(os.path.join(d, '*.md'))):
        t = open(p, encoding='utf-8').read()
        i = front(t, 'id') or (re.search(FT_RE, os.path.basename(p)) or [None])[0]
        if i:
            features[i] = {'titulo': front(t, 'titulo') or i, 'epica': None, 'texto': t}
            fuentes[i] = rel(p)
            crudo[i] = {'descripcion': bloque(t, 'Descripción', 900), 'beneficio': bloque(t, 'Beneficio esperado')}
else:
    faltantes.append('features: no se encontró la carpeta features/ (títulos de las features).')

# ---------- HU ----------
def prioridad(txt):
    s = txt.lower()
    if 'no esta vez' in s or 'no está vez' in s or "won't" in s: return 'NO'
    if s.startswith('alta') or 'debe tener' in s or 'must' in s: return 'DEBE'
    if s.startswith('media') or 'debería' in s or 'deberia' in s or 'should' in s: return 'DEBERIA'
    if s.startswith('baja') or 'podría' in s or 'podria' in s or 'could' in s: return 'PODRIA'
    return None

hus, textos = {}, {}
d = find_dir('historias')
if not d:
    faltantes.append('historias: no se encontró la carpeta historias/ (las HU).')
else:
    for p in sorted(glob.glob(os.path.join(d, '*.md'))):
        t = open(p, encoding='utf-8').read()
        i = front(t, 'id') or (re.search(HU_RE, os.path.basename(p)) or [None])[0]
        if not i: continue
        mod = re.search(r'\*\*Épica / Módulo\*\*\s*\|\s*(.*?)\s*\|', t)
        mod = mod.group(1) if mod else ''
        ep = (re.findall(EP_RE, mod) or re.findall(EP_RE, front(t, 'relacionados')) or [None])[0]
        ft = (re.findall(FT_RE, mod) or re.findall(FT_RE, front(t, 'relacionados')) or [None])[0]
        pr = re.search(r'\|\s*Prioridad\s*\|.*?\n\|.*?\n\|\s*(.*?)\s*\|', t, re.S)
        p_ = prioridad(pr.group(1)) if pr else None
        if not ep: avisos.append(f'{i}: no se encontró su épica.')
        if not ft: avisos.append(f'{i}: no se encontró su feature.')
        if not p_: avisos.append(f'{i}: no se reconoció la prioridad ({pr.group(1)[:40] if pr else "sin tabla"}).')
        hus[i] = {'id': i, 'titulo': front(t, 'titulo') or i, 'epica': ep, 'feature': ft,
                  'prioridad': p_ or 'DEBE', 'dependeDe': [], 'dependeDeTexto': [],
                  'externos': sorted(set(re.findall(r'DEP-\d{2}', t))), 'tareas': 0}
        textos[i] = t
        fuentes[i] = rel(p)
        cqp = {k: limpiar(re.sub(r'^ACT-\d+\s*', '', m.group(1))) for k in ('COMO', 'QUIERO', 'PARA')
               for m in [re.search(r'^\*\*' + k + r'\*\*\s*(.+)$', t, re.M)] if m}
        if not cqp:   # variante en tabla: | COMO | QUIERO | PARA | / |---| / | actor | quiero | para |
            m = re.search(r'^\|\s*COMO\s*\|\s*QUIERO\s*\|\s*PARA\s*\|\s*\n\|[-| ]+\|\s*\n\|(.*?)\|(.*?)\|(.*?)\|', t, re.M)
            if m: cqp = {'COMO': limpiar(re.sub(r'\*\*ACT-\d+\*\*\s*|ACT-\d+\s*', '', m.group(1))), 'QUIERO': limpiar(m.group(2)), 'PARA': limpiar(m.group(3))}
        if cqp: hus[i]['historia'] = {'como': cqp.get('COMO', ''), 'quiero': cqp.get('QUIERO', ''), 'para': cqp.get('PARA', '')}
        if ft and ft in features and ep: features[ft]['epica'] = features[ft]['epica'] or ep

# ---------- Dependencias (backlog de tareas) ----------
d = find_dir('tareas') or (find_dir('backlog') and os.path.join(find_dir('backlog'), 'tareas'))
tdeps = defaultdict(set)
hay_backlog = False
if d and glob.glob(os.path.join(d, '*.json')):
    hay_backlog = True
    for f in sorted(glob.glob(os.path.join(d, '*.json'))):
        try:
            data = json.load(open(f, encoding='utf-8'))
        except Exception as e:
            avisos.append(f'{os.path.basename(f)}: no se pudo leer ({e}).'); continue
        for h in data.get('historias', []):
            hu = h.get('hu')
            for tk in h.get('tareas', []):
                if hu in hus: hus[hu]['tareas'] += 1
                for dep in tk.get('depende_de', []) or []:
                    m = re.match(HU_RE, dep)
                    if m and m.group(0) != hu: tdeps[hu].add(m.group(0))
    for hu, ds in tdeps.items():
        if hu in hus: hus[hu]['dependeDe'] = sorted(x for x in ds if x in hus)
else:
    faltantes.append('dependencias: no se encontró backlog/tareas/*.json. Sin esto no hay flechas entre HU.')

# ---------- Revisión: lo que dice el texto de cada HU vs el backlog ----------
def ancestros(i, seen=None):
    s, q = set(), list(hus[i]['dependeDe'])
    while q:
        x = q.pop()
        if x not in s and x in hus: s.add(x); q += hus[x]['dependeDe']
    return s
revision = []
for i, t in textos.items():
    pat = r'((?:\*\*' + HU_RE + r'\*\*[, y]*)+)[^.;<]{0,40}?(va(?:n)? \*{0,2}(antes|despu[eé]s)|es precondici[oó]n)'
    for m in re.finditer(pat, t):
        kind = m.group(3) or 'antes'
        for o in re.findall(HU_RE, m.group(1)):
            if o == i or o not in hus: continue
            antes = kind.startswith('antes')
            a, b = (o, i) if antes else (i, o)          # a debe ir antes que b
            if a in ancestros(b): continue
            estado = ('sin backlog' if not hay_backlog else
                      'al revés en el backlog' if b in ancestros(a) else 'falta en el backlog')
            revision.append({'hu': i, 'dice': f'{o} va {"antes" if antes else "después"}', 'antes': a, 'despues': b,
                             'estado': estado, 'cita': re.sub(r'\s+', ' ', t[max(0, m.start()-20):m.end()+80])[:220]})

# ---------- Bloqueos externos (roadmap) ----------
externos = {}
codigos = {}
rm = [p for p in glob.glob(os.path.join(ROOT, '**', '*roadmap*.md'), recursive=True)]
for p in rm:
    for m in re.finditer(r'^\|\s*(DEP-\d{2})\s*\|(.*)$', open(p, encoding='utf-8').read(), re.M):
        cols = [limpiar(c) for c in m.group(2).split('|')]
        externos[m.group(1)] = cols[0]
        codigos[m.group(1)] = {'tipo': 'DEP', 'texto': cols[0], 'responsable': cols[3] if len(cols) > 3 else '',
                               'fecha': cols[4] if len(cols) > 4 else '', 'fuente': f'{rel(p)} · {m.group(1)}'}
if not externos:
    faltantes.append('bloqueos externos: no se encontró la tabla DEP-xx del roadmap (se mostrarán solo los códigos).')

# ---------- Definition of Ready (opcional) ----------
preparacion = {}
d = find_dir('dor')
if d:
    for p in sorted(glob.glob(os.path.join(d, '*.md'))):
        t = open(p, encoding='utf-8').read()
        m = re.search(r'—\s*(' + FT_RE + ')', t) or re.search(FT_RE, os.path.basename(p))
        if not m: continue
        ft = m.group(1) if m.lastindex else m.group(0)
        v = re.search(r'propuesta IA:\s*([A-Z ]*[A-Z])', t)
        v = v.group(1) if v else ''
        sec2 = t.split('## 2 DIAGRAMA')[1].split('## 3')[0] if '## 2 DIAGRAMA' in t else ''
        sec6 = (t.split('## 6 DECISI')[1] if '## 6 DECISI' in t else '').split('| Rol |')[0]
        bl = re.findall(r'\w+\["(.*?)"\]:::(?:bloqueante|externa|bloq\w*|ext\w*)', sec2)
        txt = ' '.join(bl) + ' ' + sec6
        uniq = lambda pat: sorted(set(re.findall(pat, txt)), key=lambda s: (len(s), s))
        preparacion[ft] = {
            'status': 'READY_COND' if 'CONDICIONES' in v else ('NO' if 'NO' in v else ('READY' if v else 'NO')),
            'externals': uniq(r'DEP-\d+'), 'approvals': uniq(r'\bG[0-8]\b'),
            'decisions': uniq(r'\bD-\d+\b'), 'questions': uniq(r'\bO\d+\b'),
            'other': ['Espera la aprobación del fragmento 24'] if 'fragmento 24' in txt.lower() else [],
            'estimation': 'estima' in txt.lower()}
else:
    faltantes.append('Definition of Ready: no se encontró dor/ (la sección "Lo que falta resolver" no se mostrará).')

# ---------- Decisiones (D-##), observaciones (O##) y puertas (G#) ----------
dec = [p for p in glob.glob(os.path.join(ROOT, '**', 'decisiones*.md'), recursive=True)]
for p in dec:
    for m in re.finditer(r'^\|\s*(D-\d+|O\d+)\s*\|(.*)$', open(p, encoding='utf-8').read(), re.M):
        cols = [limpiar(c) for c in m.group(2).split('|')]
        c = m.group(1)
        if c.startswith('D-'):
            codigos[c] = {'tipo': 'D', 'texto': cols[0][:600], 'propuesta': cols[1][:600] if len(cols) > 1 else '',
                          'responsable': 'TL', 'fuente': f'{rel(p)} · {c}'}
        else:
            codigos[c] = {'tipo': 'O', 'texto': cols[0][:600], 'responsable': '', 'fuente': f'{rel(p)} · {c}'}
if not dec:
    faltantes.append('decisiones: no se encontró analisis/decisiones.md (los códigos D-## y O## se mostrarán sin explicación).')
for p in glob.glob(os.path.join(ROOT, '**', 'G[0-8].md'), recursive=True):
    t = open(p, encoding='utf-8').read(); g = os.path.basename(p)[:2]
    ap = re.search(r'Aprueba \*\*(.*?)\*\*', t); pe = re.search(r'^\|\s*Pedido\s*\|\s*(.*?)\s*\|', t, re.M)
    codigos[g] = {'tipo': 'G', 'texto': limpiar(pe.group(1)) if pe else front(t, 'titulo'),
                  'responsable': limpiar(ap.group(1)) if ap else '', 'fuente': rel(p)}
for f, v in preparacion.items():
    pr = glob.glob(os.path.join(ROOT, '**', 'dor', f'DOR-{f}*.md'), recursive=True)
    if pr: fuentes['DOR:' + f] = rel(pr[0])

# ---------- Salida ----------
for f, v in features.items():
    if not v['epica']:
        m = re.findall(EP_RE, v['texto'])
        v['epica'] = m[0] if m else None
        if not v['epica']: avisos.append(f'{f}: no se encontró su épica.')
codigo = re.search(r'-([A-Z]{2,4})-\d', next(iter(hus), 'HU-XXX-0'))
salida = {
    'proyecto': {'nombre': os.path.basename(os.path.abspath(ROOT)), 'empresa': 'AybarCorp',
                 'prefijoId': f'-{codigo.group(1)}-' if codigo else ''},
    'epicas': [{'id': k, 'titulo': v} for k, v in sorted(epicas.items())],
    'features': [{'id': k, 'titulo': v['titulo'], 'epica': v['epica']} for k, v in sorted(features.items())],
    'hus': [hus[k] for k in sorted(hus)],
    'externos': externos,
    'fueraDeAlcance': 'fuera de alcance por ahora',
    'notas': {}, 'notasDocumentacionHtml': '',
    'preparacion': preparacion,
    'logros': {},          # Claude escribe aquí el resumen simple de cada épica y feature (ver SKILL.md)
    'codigos': codigos,    # Claude agrega "simple" a cada código (ver SKILL.md)
    'fuentes': fuentes,
    'crudo': crudo,        # textos originales, solo para redactar los resúmenes
    'revision': revision,
}
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
json.dump(salida, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

cuenta = lambda p: sum(1 for h in hus.values() if h['prioridad'] == p)
print(f'Guardado: {OUT}')
print(f'{len(epicas)} épicas · {len(features)} features · {len(hus)} HU · {sum(len(h["dependeDe"]) for h in hus.values())} dependencias del backlog')
print(f'Prioridad: Debe {cuenta("DEBE")} · Debería {cuenta("DEBERIA")} · Podría {cuenta("PODRIA")} · No esta vez {cuenta("NO")}')
print(f'Definition of Ready: {len(preparacion)} features · Bloqueos externos: {len(externos)}')
print(f'Códigos con explicación en la documentación: {sum(1 for c in codigos.values() if c["tipo"]=="D")} decisiones · {sum(1 for c in codigos.values() if c["tipo"]=="O")} preguntas · {sum(1 for c in codigos.values() if c["tipo"]=="G")} puertas · {sum(1 for c in codigos.values() if c["tipo"]=="DEP")} bloqueos')
if hay_backlog:
    print(f'Diferencias texto vs backlog para revisar: {len(revision)}')
else:
    print(f'Sin backlog: el texto de las HU menciona {len(revision)} relaciones "va antes / después". '
          'Si el usuario elige usarlas como dependencias: aplicar_revision.py <proyecto.json> --como-base')
for r in revision: print(f'  - {r["hu"]}: dice "{r["dice"]}" → {r["estado"]}')
if faltantes: print('\nNO ENCONTRADO (preguntar al usuario):\n- ' + '\n- '.join(faltantes))
if avisos: print('\nAvisos:\n- ' + '\n- '.join(avisos[:40]) + (f'\n- … y {len(avisos)-40} más' if len(avisos) > 40 else ''))
