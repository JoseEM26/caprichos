#!/usr/bin/env python3
"""Trazabilidad del paquete Aybar: de la necesidad a la prueba y a la tarea.

Solo lectura. Uso:  python3 -I trazabilidad.py <ruta-del-paquete>
Termina con codigo 1 si hay incumplimientos de trazabilidad (A a F); G a I solo informan.
"""
import json
import re
import sys
from pathlib import Path

CARPETAS = ["analisis", "roadmap", "epicas", "features", "adr", "historias", "dor", "pruebas", "arquitectura", "datos", "gates"]
DOM = r"[A-Z]{2,6}"
FAM = {
    "EP": rf"\bEP-{DOM}-\d{{3}}\b", "FT": rf"\bFT-{DOM}-\d{{2,3}}\b", "HU": rf"\bHU-{DOM}-\d{{3}}\b", "ADR": r"\bADR-\d{3}\b",
    "RQ": rf"\bRQ-{DOM}-\d{{2}}-\d{{2}}\b", "RN": rf"\bRN-{DOM}-\d{{3}}\b", "RNF": rf"\bRNF-{DOM}-\d{{2,3}}\b",
    "NEC": rf"\bNEC-{DOM}-\d{{3}}\b", "OBJ": rf"\bOBJ-{DOM}-\d{{3}}\b", "DEP": rf"\bDEP-{DOM}-\d{{2}}\b",
    "RIESGO": rf"\bR-{DOM}-\d{{2}}\b", "D": rf"\bD-{DOM}-\d{{2}}\b", "TC": rf"\bTC-{DOM}-\d{{3}}-\d{{2}}\b",
}
POR_FRONTMATTER = ("EP", "FT", "HU", "ADR")
POR_FILA = ("RQ", "RN", "RNF", "NEC", "OBJ", "DEP", "RIESGO", "TC")


def leer_docs(raiz):
    docs = []
    for c in CARPETAS:
        for p in sorted((raiz / c).rglob("*.md")) if (raiz / c).is_dir() else []:
            if p.name.lower() == "readme.md":
                continue
            t = p.read_text(encoding="utf-8", errors="replace")
            fm = re.match(r"^---\n(.*?)\n---", t, re.S)
            meta = {}
            if fm:
                for l in fm.group(1).splitlines():
                    m = re.match(r"^(\w+):\s*(.*)$", l)
                    if m:
                        meta[m.group(1)] = m.group(2).strip().strip('"')
            docs.append({"ruta": p.relative_to(raiz).as_posix(), "carpeta": c, "texto": t, "meta": meta, "id": meta.get("id", "")})
    return docs


def main():
    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    docs = leer_docs(raiz)
    if not docs:
        print("No encontre documentos en", raiz, "(carpetas esperadas:", ", ".join(CARPETAS) + ")")
        return 2
    alltxt = "\n".join(d["texto"] for d in docs)
    definidos = {k: set() for k in FAM}
    for d in docs:
        if d["id"]:
            for k in POR_FRONTMATTER:
                if re.fullmatch(FAM[k].replace(r"\b", ""), d["id"]):
                    definidos[k].add(d["id"])
        for l in d["texto"].splitlines():
            m = re.match(r"^\|\s*(\S+?)\s*\|", l)
            if m:
                for k in POR_FILA:
                    if re.fullmatch(FAM[k].replace(r"\b", ""), m.group(1)):
                        definidos[k].add(m.group(1))
            for m in re.finditer(rf"\*\*({FAM['D'][2:-2]})\b", l):
                definidos["D"].add(m.group(1))
    citados = {k: set(re.findall(FAM[k], alltxt)) for k in FAM}
    problemas = []

    def seccion(titulo, items, grave=True):
        print(f"\n[{'x' if items else 'ok'}] {titulo}" + (f" ({len(items)})" if items else ""))
        for i in items[:40]:
            print("    -", i)
        if len(items) > 40:
            print(f"    ... y {len(items) - 40} mas")
        if items and grave:
            problemas.extend(items)

    print(f"PAQUETE: {raiz}\nDocumentos leidos: {len(docs)}")
    for k in ("EP", "FT", "HU", "ADR", "RQ", "RN", "RNF", "TC"):
        print(f"  {k}: {len(definidos[k])} definidos, {len(citados[k])} citados")

    # A. ids citados sin definicion (solo familias con al menos una definicion)
    a = []
    for k in FAM:
        if definidos[k]:
            for i in sorted(citados[k] - definidos[k]):
                a.append(f"{i} se cita pero no esta definido ({k})")
    seccion("A. Ids citados que no existen", a)

    # B. requisitos sin historia
    hus_txt = "\n".join(d["texto"] for d in docs if d["carpeta"] == "historias")
    b = [f"{r} no aparece en ninguna historia" for r in sorted(definidos["RQ"]) if r not in hus_txt]
    seccion("B. Requisitos funcionales sin historia de usuario", b)

    # C. criterios de la HU vs casos del plan de pruebas
    plan_txt = "\n".join(d["texto"] for d in docs if d["carpeta"] == "pruebas")
    c = []
    for d in docs:
        if d["carpeta"] == "historias" and re.fullmatch(r"HU-[A-Z]+-\d{3}", d["id"]):
            n_ca = len(re.findall(r"^\|\s*CA-\d+\s*\|", d["texto"], re.M))
            dom, num = d["id"].split("-")[1:]
            n_tc = len(re.findall(rf"^\|\s*TC-{dom}-{num}-\d{{2}}\s*\|", plan_txt, re.M))
            if n_ca == 0:
                c.append(f"{d['id']} no tiene criterios CA-n")
            elif n_ca != n_tc:
                c.append(f"{d['id']}: {n_ca} criterios y {n_tc} casos de prueba")
    seccion("C. Criterios de aceptacion sin su caso de prueba (1 a 1)", c)

    # D. tareas
    tareas, deps, huj = {}, {}, set()
    ep_json = {}
    for p in sorted((raiz / "backlog" / "tareas").glob("*.json")) if (raiz / "backlog" / "tareas").is_dir() else []:
        try:
            dj = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            ep_json[p.stem] = None
            continue
        ep_json[dj.get("epica", p.stem)] = p.name
        for h in dj.get("historias", []):
            huj.add(h["hu"])
            for t in h.get("tareas", []):
                tareas[t["id"]] = t
                deps[t["id"]] = t.get("depende_de", [])
    d_ = [f"{h} no tiene tareas en backlog/tareas" for h in sorted(definidos["HU"]) if h not in huj]
    d_ += [f"{t} depende de {x}, que no existe" for t, ds in deps.items() for x in ds if x not in tareas]
    estado, ciclo = {}, []

    def visita(n, pila):
        if estado.get(n) == 2:
            return
        if n in pila:
            ciclo.append(" -> ".join(pila[pila.index(n):] + [n]))
            return
        for x in deps.get(n, []):
            if x in deps:
                visita(x, pila + [n])
        estado[n] = 2

    for t in deps:
        visita(t, [])
    d_ += [f"ciclo de dependencias: {c_}" for c_ in sorted(set(ciclo))[:5]]
    d_ += [f"{h} esta en el JSON pero no existe como historia" for h in sorted(huj - definidos["HU"])]
    seccion("D. Tareas: cobertura, dependencias rotas y ciclos", d_)
    if tareas:
        sin_est = sum(1 for t in tareas.values() if t.get("estimacion_horas") is None)
        sin_resp = sum(1 for t in tareas.values() if not t.get("responsable"))
        print(f"    (informativo: {len(tareas)} tareas, {sin_est} sin estimar, {sin_resp} sin responsable)")

    # E. cadena de documentos
    e = []
    for f in sorted(definidos["FT"]):
        if "DOR-" + f not in {d["id"] for d in docs}:
            e.append(f"{f} no tiene su DoR (DOR-{f})")
    epicas_txt = "\n".join(d["texto"] for d in docs if d["carpeta"] == "epicas")
    for f in sorted(definidos["FT"]):
        if f not in epicas_txt:
            e.append(f"{f} no aparece en ninguna epica")
    for ep in sorted(definidos["EP"]):
        if ep not in ep_json:
            e.append(f"{ep} no tiene su JSON de tareas")
    seccion("E. Cadena epica - feature - DoR - tareas", e)

    # F. ADR citados por features, historias o DoR
    cit = "\n".join(d["texto"] for d in docs if d["carpeta"] in ("features", "historias", "dor"))
    f_ = [f"{a} no la cita ninguna feature, historia ni DoR" for a in sorted(definidos["ADR"]) if a not in cit]
    seccion("F. Decisiones (ADR) sin uso en features, historias o DoR", f_)

    # G. estados (informativo)
    g = [f"{d['ruta']}: estado '{d['meta'].get('estado','?')}'" for d in docs if d["meta"].get("estado") not in ("draft", None)]
    g += [f"{d['ruta']}: approved sin aprobadores" for d in docs if d["meta"].get("estado") == "approved" and d["meta"].get("aprobadores", "[]") in ("[]", "")]
    seccion("G. Documentos que ya no estan en draft (informativo)", g, grave=False)

    # H. decisiones abiertas (informativo)
    cerradas, vistas = set(), set()
    for d in docs:
        for l in d["texto"].splitlines():
            for m in re.finditer(rf"\*\*({FAM['D'][2:-2]})\b", l):
                vistas.add(m.group(1))
                if re.search(r"Decidid", l):
                    cerradas.add(m.group(1))
    h_ = [f"{x} sigue abierta" for x in sorted(vistas - cerradas)]
    seccion(f"H. Decisiones D-xx abiertas ({len(cerradas)} cerradas) (informativo)", h_, grave=False)

    # I. pendientes por documento (informativo)
    cuenta = sorted(((len(re.findall(r"pendiente", d["texto"], re.I)), d["ruta"]) for d in docs), reverse=True)[:8]
    seccion("I. Documentos con mas marcas de pendiente (informativo)", [f"{n} marcas: {r}" for n, r in cuenta if n], grave=False)

    print("\nRESULTADO:", "hay incumplimientos de trazabilidad (A a F)" if problemas else "sin incumplimientos de trazabilidad (A a F)")
    print("No mide si el contenido es correcto ni si las firmas son reales; eso es de la revision adversarial y de las personas.")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
