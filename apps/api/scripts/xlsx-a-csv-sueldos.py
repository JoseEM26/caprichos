#!/usr/bin/env python3 -I
"""Excel de pagos del dueño -> CSV para `cargar-sueldos` (corre en tu PC; el CSV NO va al repo).

Uso: python3 -I apps/api/scripts/xlsx-a-csv-sueldos.py <pagos.xlsx> <salida.csv>
Fuente de verdad: hoja «Hoja3» (NOMBRES, Acuerdo laboral, Remuneración, Número Documento).
Cruza con «PAGOS» (MIEMBRO, Rem. Mensual) por nombre normalizado. Imprime solo conteos y
nombres de pila de las filas con problema; nunca montos ni documentos.
"""
import csv, os, re, site, sys, unicodedata
sys.path.append(site.getusersitepackages())  # -I oculta el site del usuario donde vive openpyxl
import openpyxl


def clave(nombre):
    t = unicodedata.normalize("NFD", str(nombre or "")).encode("ascii", "ignore").decode().lower()
    return tuple(sorted(re.findall(r"[a-z]+", t)))


def pila(nombre):
    return (str(nombre or "").split() or ["?"])[0].capitalize()


def numero(v):
    if isinstance(v, (int, float)):
        return float(v)
    t = re.sub(r"s/\.?|\s", "", str(v or ""), flags=re.I)
    t = t.replace(",", "") if "," in t and "." in t else t.replace(",", ".")
    return float(t) if re.fullmatch(r"\d+(\.\d+)?", t) else None


def main(xlsx, salida):
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    h3 = wb["Hoja3"]
    cab = [str(c.value or "").strip() for c in h3[2]]
    ix = {n: cab.index(n) for n in ("NOMBRES", "Acuerdo laboral", "Remuneración", "Número Documento")}
    filas = []
    for r in h3.iter_rows(min_row=3, values_only=True):
        if r[ix["NOMBRES"]]:
            filas.append({k: r[i] for k, i in ix.items()})
    pagos = {}
    for r in wb["PAGOS"].iter_rows(min_row=5, values_only=True):
        if r[0] and numero(r[1]) is not None:
            pagos[clave(r[0])] = (r[0], numero(r[1]))

    sin_doc, sin_sueldo, difieren, sin_pagos, escritas = [], [], [], [], 0
    ya = set()
    os.umask(0o177)
    with open(salida, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["documento", "sueldo_mensual", "acuerdo_laboral"])
        for d in filas:
            nom = d["NOMBRES"]
            k = clave(nom)
            s = numero(d["Remuneración"])
            doc = re.sub(r"[\s.\-]", "", str(d["Número Documento"] or "")).upper()
            if k in pagos:
                ya.add(k)
                if s is not None and abs(pagos[k][1] - s) > 0.005:
                    difieren.append(pila(nom))
            else:
                sin_pagos.append(pila(nom))
            if not doc:
                sin_doc.append(pila(nom))
                continue
            if not s:
                sin_sueldo.append(pila(nom))
            w.writerow([doc, "" if not s else ("%g" % s), d["Acuerdo laboral"] or ""])
            escritas += 1
    os.chmod(salida, 0o600)
    solo_pagos = [pila(v[0]) for k, v in pagos.items() if k not in ya]
    print(f"Hoja3: {len(filas)} filas; PAGOS: {len(pagos)} miembros con sueldo")
    print(f"CSV: {escritas} filas escritas; coinciden por nombre {len(ya)}; sueldo distinto entre hojas {len(difieren)}")
    print(f"Hoja3 sin fila en PAGOS {len(sin_pagos)}: {', '.join(sin_pagos)}")
    print(f"PAGOS sin fila en Hoja3 {len(solo_pagos)}: {', '.join(solo_pagos)}")
    print(f"Sueldo distinto (CSV usa Hoja3; decide el dueño) {len(difieren)}: {', '.join(difieren)}")
    print(f"Sin documento en Hoja3 (no se pueden cruzar) {len(sin_doc)}: {', '.join(sin_doc)}")
    print(f"Sin sueldo en Hoja3 (se omitirán) {len(sin_sueldo)}: {', '.join(sin_sueldo)}")


if len(sys.argv) != 3:
    sys.exit(__doc__)
main(sys.argv[1], sys.argv[2])
