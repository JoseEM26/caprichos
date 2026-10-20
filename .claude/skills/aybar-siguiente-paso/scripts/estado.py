#!/usr/bin/env python3
"""Estado de un paquete de analisis/diseno Aybar (G0-G4) y su siguiente paso.

Uso: estado.py [RUTA_DEL_PAQUETE]   (por defecto el directorio actual)
Solo lectura. Salida en texto; el codigo de salida es 1 si hay incumplimientos.
"""
import json, re, sys
from collections import Counter
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
OBLIG = ["id", "tipo", "titulo", "estado", "producto", "version", "owner",
         "aprobadores", "fecha", "relacionados", "tags"]
CARPETAS = {"adr": "ADR", "epicas": "EP", "features": "FT", "historias": "HU", "dor": "DOR"}
ID_RE = re.compile(r"\b(ADR-\d{3}|HU-[A-Z]+-\d{3}b?|FT-[A-Z]+-\d{2,3}b?|EP-[A-Z]+-\d{3})\b")


def frontmatter(texto):
    m = re.match(r"---\n(.*?)\n---", texto, re.S)
    if not m:
        return None
    fm, clave = {}, None
    for ln in m.group(1).splitlines():
        kv = re.match(r"^([A-Za-z_]+):\s*(.*)$", ln)
        if kv:
            clave = kv.group(1)
            fm[clave] = kv.group(2).strip()
        elif clave and ln.strip().startswith("- "):
            fm[clave] += " " + ln.strip()[2:]
    return fm


docs, problemas = {}, []
for carpeta in list(CARPETAS) + ["analisis", "roadmap", "arquitectura", "datos", "pruebas", "gates", "operacion"]:
    for f in sorted((ROOT / carpeta).rglob("*.md")):
        t = f.read_text(encoding="utf-8")
        fm = frontmatter(t)
        rel = f.relative_to(ROOT).as_posix()
        if fm is None and rel == "analisis/decisiones.md":
            continue  # el registro de decisiones no lleva frontmatter por diseno
        if fm is None:
            problemas.append(f"{rel}: sin frontmatter")
            continue
        falta = [c for c in OBLIG if c not in fm]
        if falta:
            problemas.append(f"{rel}: frontmatter sin {', '.join(falta)}")
        docs[rel] = {"fm": fm, "texto": t, "carpeta": carpeta}

estados = Counter(d["fm"].get("estado", "?").split()[0].strip("`") for d in docs.values())
ids_existentes = {d["fm"].get("id") for d in docs.values()}
todo_texto = "\n".join(d["texto"] for d in docs.values())

# 1. ids citados que no existen (solo ADR/HU/FT/EP, que deben tener archivo)
for rel, d in docs.items():
    for i in sorted(set(ID_RE.findall(d["fm"].get("relacionados", "")))):
        if i not in ids_existentes:
            problemas.append(f"{rel}: cita {i}, que no existe como documento")

# 2. trazabilidad vertical
def ids_de(carpeta):
    return sorted(d["fm"]["id"] for d in docs.values() if d["carpeta"] == carpeta and "id" in d["fm"])

hu, ft, ep, adr = ids_de("historias"), ids_de("features"), ids_de("epicas"), ids_de("adr")
for rel, d in docs.items():
    if d["carpeta"] == "historias":
        cab = d["texto"][:d["texto"].find("## 01")]
        if not re.search(r"\bEP-[A-Z]+-\d{3}\b", cab): problemas.append(f"{rel}: HU sin epica en la cabecera")
        if not re.search(r"\bFT-[A-Z]+-\d{2,3}b?\b", cab): problemas.append(f"{rel}: HU sin feature en la cabecera")
for f in ft:
    if not any(k.startswith("dor/DOR-" + f) for k in docs):
        problemas.append(f"{f}: feature sin DoR")
tareas, hu_con_tareas = {}, set()
for j in (ROOT / "backlog/tareas").glob("*.json"):
    data = json.loads(j.read_text(encoding="utf-8"))
    tareas[data["epica"]] = data
    hu_con_tareas |= {h["hu"] for h in data["historias"]}
for e in ep:
    if e not in tareas: problemas.append(f"{e}: epica sin backlog/tareas/{e}.json")
for h in hu:
    if h not in hu_con_tareas: problemas.append(f"{h}: historia sin tareas en el backlog")
sin_estimar = sum(1 for t in tareas.values() for h in t["historias"] for x in h["tareas"] if x.get("estimacion_horas") is None)
total_tareas = sum(len(h["tareas"]) for t in tareas.values() for h in t["historias"])
for a in adr:
    citantes = [k for k, d in docs.items() if d["carpeta"] in ("historias", "features", "dor") and a in d["fm"].get("relacionados", "")]
    if not citantes: problemas.append(f"{a}: ningun HU/FT/DoR lo cita en `relacionados`")

# 3. gates
gates = {}
for g in ("G0", "G1", "G2", "G3", "G4"):
    d = docs.get(f"gates/AYB-1042/{g}.md") or next((v for k, v in docs.items() if k.endswith(f"/{g}.md")), None)
    gates[g] = d["fm"].get("estado", "?").split()[0].strip("`") if d else "sin documento"

print(f"PAQUETE: {ROOT}")
print(f"Documentos: {len(docs)} · estados: {dict(estados)}")
print(f"ADR {len(adr)} · EP {len(ep)} · FT {len(ft)} · HU {len(hu)} · tareas {total_tareas} ({sin_estimar} sin estimar)")
print("Gates: " + " · ".join(f"{g} {s}" for g, s in gates.items()))
print(f"\nINCUMPLIMIENTOS ({len(problemas)}):")
for p in problemas[:60]: print("  -", p)
if len(problemas) > 60: print(f"  ... y {len(problemas) - 60} mas")

# 4. siguiente paso: el primer gate sin aprobar manda
ORDEN = [("G0", "Ficha de intake (analisis/ficha-intake.md) aprobada por el PO"),
         ("G1", "BRD, roadmap y epicas aprobados (PO + Stakeholder)"),
         ("G2", "Mockup en Figma enlazado en cada HU con pantalla (lo hace UX)"),
         ("G3", "ADR aprobados, con 'Compatibilidad con M0', costo cloud y arquitectura/OpenAPI/datos"),
         ("G4", "HU en formato Aybar, DoR por feature, tareas estimadas, plan de pruebas")]
print("\nSIGUIENTE PASO:")
pendiente = next(((g, q) for g, q in ORDEN if gates.get(g) != "approved"), None)
if not pendiente:
    print("  Todos los gates G0-G4 aprobados: se puede empezar a construir (G5).")
else:
    g, q = pendiente
    print(f"  Cerrar {g}: {q}.")
    print(f"  Estado de {g}: {gates[g]}. Solo 'approved' es evidencia; la IA no firma ni cierra gates.")
    if estados.get("approved", 0) == 0:
        print("  Ningun documento esta approved: la firma humana es lo que falta, no mas documentos.")
    if sin_estimar and g in ("G3", "G4"): print(f"  Estimar {sin_estimar} tareas (estimacion_horas null) antes de planificar el sprint.")
    if any("ADR" in p for p in problemas): print("  Enlazar los ADR que ningun HU/FT/DoR cita.")
sys.exit(1 if problemas else 0)
