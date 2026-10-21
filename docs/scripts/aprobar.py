#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Firma humana de un gate del paquete Caprichos (G0 a G4).

La IA no firma (DT-02): este script lo corre la persona que aprueba.
Uso:
  python3 scripts/aprobar.py G0 --rol "Product Owner" --nombre "José Ángel Espinoza"
  python3 scripts/aprobar.py G1 --rol Stakeholder --nombre "Kevin Rosales"
  python3 scripts/aprobar.py G1 --rol "Technical Lead" --nombre "José Ángel Espinoza" --decision "Con cambios" --nota "falta X"
  python3 scripts/aprobar.py --estado            # muestra qué firmas faltan
Opciones: --prueba (no escribe nada, solo muestra qué haría).

Reglas:
- Un gate se firma solo si el anterior ya está approved.
- Cada firma queda en la tabla «4 · Firmas» del gate con nombre, fecha y decisión.
- Cuando todos los roles requeridos firmaron «Aprobado», el gate y sus documentos
  de evidencia pasan a `estado: approved` y suman a los firmantes en `aprobadores`.
- El Stakeholder es el cliente (Kevin Rosales): no puede firmarlo el autor del paquete (DT-48).
- G4 exige que todas las tareas de backlog/tareas tengan estimacion_horas.
"""
import argparse, datetime, glob, json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TICKET = 'CAP-PENDIENTE'
AUTOR = 'José Ángel Espinoza'
ROLES = ['Stakeholder', 'Product Owner', 'UX/UI Designer', 'Technical Lead', 'QA Engineer', 'Data Chief / Directorio']
DECISIONES = ['Aprobado', 'Con cambios', 'Rechazado']

GATES = {
    'G0': dict(nombre='Intake', requiere=['Product Owner'],
               docs=['analisis/ficha-intake.md', 'analisis/iniciativas-acta-02.md']),
    'G1': dict(nombre='Discovery', requiere=['Product Owner', 'Stakeholder', 'Technical Lead'],
               docs=['analisis/BRD.md', 'analisis/decisiones.md', 'roadmap/PLT-01-roadmap.md', 'epicas/*.md', 'features/*.md']),
    'G2': dict(nombre='Design', requiere=['Product Owner', 'UX/UI Designer', 'Stakeholder'],
               docs=['analisis/registro-mockup.md', 'analisis/plano-del-local.md', 'analisis/modulos-y-roles.md']),
    'G3': dict(nombre='Architecture', requiere=['Technical Lead'],
               docs=['adr/*.md', 'arquitectura/*.md', 'datos/*.md']),
    'G4': dict(nombre='Definition of Ready', requiere=['Product Owner', 'Technical Lead', 'QA Engineer'],
               docs=['historias/*.md', 'dor/*.md', 'pruebas/test-plan.md']),
}
ORDEN = ['G0', 'G1', 'G2', 'G3', 'G4']


def ruta_gate(g):
    return os.path.join(RAIZ, 'gates', TICKET, g + '.md')


def leer(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def escribir(p, s, prueba):
    if prueba:
        return
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def estado_de(texto):
    m = re.search(r'^estado:\s*(\S+)', texto, re.M)
    return m.group(1) if m else '?'


def firmas(texto):
    """{rol: (nombre, fecha, decision)} de la tabla de firmas del gate."""
    out = {}
    for rol in ROLES:
        m = re.search(r'^\| %s \| (.*?) \| (.*?) \| (.*?) \|$' % re.escape(rol), texto, re.M)
        if m:
            out[rol] = tuple(x.strip() for x in m.groups())
    return out


def poner_fm(texto, estado=None, sumar=()):
    fin = texto.index('\n---', 4)
    cab, cuerpo = texto[:fin], texto[fin:]
    if estado:
        cab = re.sub(r'^estado:.*$', 'estado: ' + estado, cab, count=1, flags=re.M)
    if sumar:
        m = re.search(r'^aprobadores:\s*\[(.*)\]\s*$', cab, re.M)
        act = [x.strip().strip('"') for x in m.group(1).split(',') if x.strip()] if m else []
        for s in sumar:
            if s not in act:
                act.append(s)
        nuevo = 'aprobadores: [%s]' % ', '.join('"%s"' % x for x in act)
        cab = re.sub(r'^aprobadores:.*$', nuevo, cab, count=1, flags=re.M) if m else cab + '\n' + nuevo
    return cab + cuerpo


def docs_de(g):
    fs = []
    for patron in GATES[g]['docs']:
        fs += sorted(glob.glob(os.path.join(RAIZ, patron)))
    return fs


def mostrar_estado():
    for g in ORDEN:
        p = ruta_gate(g)
        if not os.path.exists(p):
            print('%s: sin documento' % g)
            continue
        t = leer(p)
        f = firmas(t)
        faltan = [r for r in GATES[g]['requiere'] if f.get(r, ('', '', ''))[2] != 'Aprobado']
        print('%s %-20s estado=%-9s faltan: %s' % (g, GATES[g]['nombre'], estado_de(t), ', '.join(faltan) or 'nada'))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('gate', nargs='?', choices=ORDEN)
    ap.add_argument('--rol', choices=ROLES)
    ap.add_argument('--nombre')
    ap.add_argument('--decision', choices=DECISIONES, default='Aprobado')
    ap.add_argument('--nota', default='')
    ap.add_argument('--estado', action='store_true')
    ap.add_argument('--prueba', action='store_true')
    a = ap.parse_args()
    if a.estado or not a.gate:
        mostrar_estado()
        return
    if not (a.rol and a.nombre):
        sys.exit('Falta --rol y --nombre.')
    g = a.gate
    i = ORDEN.index(g)
    if i and estado_de(leer(ruta_gate(ORDEN[i - 1]))) != 'approved':
        sys.exit('No se puede firmar %s: %s todavía no está approved.' % (g, ORDEN[i - 1]))
    if a.rol == 'Stakeholder' and a.nombre.strip().lower() == AUTOR.lower():
        sys.exit('El Stakeholder es el cliente (Kevin Rosales): el autor del paquete no puede firmarlo (DT-48, nadie se autoaprueba).')
    if a.rol not in GATES[g]['requiere']:
        print('Aviso: %s no es un rol requerido en %s (%s); la firma se registra igual.' % (a.rol, g, ', '.join(GATES[g]['requiere'])))
    if g == 'G4' and a.decision == 'Aprobado':
        sin = [t['id'] for f in glob.glob(os.path.join(RAIZ, 'backlog/tareas/*.json'))
               for h in json.load(open(f, encoding='utf-8'))['historias'] for t in h['tareas'] if t.get('estimacion_horas') is None]
        if sin:
            sys.exit('No se puede aprobar G4: %d tareas sin estimar (por ejemplo %s). Estímenlas en backlog/tareas/*.json.' % (len(sin), sin[0]))
    p = ruta_gate(g)
    t = leer(p)
    hoy = datetime.date.today().isoformat()
    dec = a.decision + (' — ' + a.nota if a.nota else '')
    t2, n = re.subn(r'^\| %s \| .*? \| .*? \| .*? \|$' % re.escape(a.rol), '| %s | %s | %s | %s |' % (a.rol, a.nombre, hoy, dec), t, count=1, flags=re.M)
    if not n:
        sys.exit('No encontré la fila de %s en la tabla de firmas de %s.' % (a.rol, p))
    f = firmas(t2)
    faltan = [r for r in GATES[g]['requiere'] if f.get(r, ('', '', ''))[2].split(' — ')[0] != 'Aprobado']
    print('%s: firma de %s (%s) registrada: %s.' % (g, a.nombre, a.rol, dec))
    if faltan:
        print('Faltan para cerrar %s: %s.' % (g, ', '.join(faltan)))
        escribir(p, t2, a.prueba)
    else:
        firmantes = ['%s (%s)' % (f[r][0], r) for r in GATES[g]['requiere']]
        t2 = t2.replace('| No (draft) |', '| Sí (approved %s) |' % hoy)
        escribir(p, poner_fm(t2, 'approved', firmantes), a.prueba)
        ds = docs_de(g)
        for d in ds:
            escribir(d, poner_fm(leer(d), 'approved', firmantes), a.prueba)
        print('%s cerrado: el gate y %d documentos pasan a approved, firmados por %s.' % (g, len(ds), ', '.join(firmantes)))
        print('Siguiente: python3 -I .claude/skills/aybar-siguiente-paso/scripts/estado.py .')
    if a.prueba:
        print('(--prueba: no se escribió nada)')


if __name__ == '__main__':
    main()
