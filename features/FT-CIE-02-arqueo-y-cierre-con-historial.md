---
id: FT-CIE-02
tipo: spec
titulo: "Arqueo y cierre con historial"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-01, FT-CAJ-02, FT-INF-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, NEC-CAP-062, RN-CAP-078, RN-CAP-079, RN-CAP-080, RN-CAP-097]
tags: [cierre-caja, plt-03, ep-cap-005, ft-cie-02, debe-tener]
---

# FT-CIE-02 — Arqueo y cierre con historial

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CAJA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CIE-02 | Arqueo y cierre con historial | EP-CAP-005 Apertura y cierre de caja |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-062) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Al cerrar, el cajero **cuenta el efectivo por billetes y monedas** (200, 100, 50, 20, 10; 5, 2, 1, 0,50, 0,20, 0,10) y el sistema suma. Ve lo que dice el sistema mientras cuenta: no es a ciegas (RN-CAP-078). Para Yape, Plin y transferencia, el cajero mira el celular de las billeteras **fuera del sistema** y anota lo que ve; para tarjeta, el total del terminal. El sistema compara cada medio con lo vendido y registra la **diferencia** (cuadrado, sobrante o faltante), sin asignar culpables ni descontar a nadie (RN-CAP-080). No se cierra con pedidos sin cobrar o por confirmar (RN-CAP-079) ni con efectivo de repartidores sin liquidar (RN-CAP-097). Todo cierre queda en un **historial que no se pierde**: no se edita ni se elimina, y se puede imprimir o exportar.

**Beneficio esperado.** Un cierre del día ordenado y verificable por medio de pago, con un historial que el dueño puede revisar siempre. Hipótesis medible: **100 % de los días con cierre registrado**; **0 cierres editados o eliminados**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (cuenta y cierra) · ACT-CAP-001 Kevin Rosales, dueño y administrador (revisa el historial).

**Pantallas de referencia.** Administrativo ▸ Cierre de caja ▸ arqueo por denominación, comparación por medio, historial de cierres (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CIE-02-01 | El cajero cuenta el efectivo por billetes y monedas y el sistema suma el total. | Debe tener | NEC-CAP-062 | Dados 3 billetes de 100, 2 de 20 y 5 monedas de 1, cuando el cajero los anota, entonces el contado es S/ 345,00. | Propuesto |
| RQ-CIE-02-02 | Mientras cuenta, el cajero ve lo esperado por el sistema. | Debe tener | RN-CAP-078 | Dado el arqueo abierto, cuando el cajero cuenta, entonces ve a la par el efectivo esperado y la diferencia que va quedando. | Propuesto |
| RQ-CIE-02-03 | Para Yape, Plin, transferencia y tarjeta, el cajero anota lo que ve fuera del sistema y se compara con lo vendido. | Debe tener | RN-CAP-078 · NEC-CAP-062 | Dado Yape vendido S/ 210, cuando el cajero anota S/ 200 visto en el celular, entonces el medio Yape queda con faltante S/ 10,00. | Propuesto |
| RQ-CIE-02-04 | La diferencia de cada medio se clasifica como cuadrado, sobrante o faltante y se registra siempre. | Debe tener | RN-CAP-080 | Dado efectivo esperado S/ 355 y contado S/ 360, cuando se cierra, entonces queda «Sobrante S/ 5,00»; no se pide justificar a nadie, solo una nota opcional. | Propuesto |
| RQ-CIE-02-05 | No se puede cerrar con pedidos sin cobrar o por confirmar. | Debe tener | RN-CAP-079 | Dado un pedido por confirmar, cuando el cajero intenta cerrar, entonces ve la lista de pendientes y el cierre no procede. | Propuesto |
| RQ-CIE-02-06 | No se puede cerrar con efectivo de repartidores sin liquidar. | Debe tener | RN-CAP-097 | Dado un repartidor con S/ 40 por liquidar, cuando el cajero intenta cerrar, entonces ve «Falta liquidar a …» y no puede. | Propuesto |
| RQ-CIE-02-07 | Cerrar pide confirmación Sí/No y deja el cierre en el historial con autor y hora. | Debe tener | RN-CAP-015 · NEC-CAP-062 | Dado un arqueo completo, cuando el cajero confirma el cierre, entonces queda en el historial con fecha, autor, apertura, ventas por medio, movimientos, contado y diferencias. | Propuesto |
| RQ-CIE-02-08 | Un cierre no se edita ni se elimina. | Debe tener | RN-CAP-080 | Dado un cierre del historial, cuando cualquier usuario lo abre, entonces solo puede verlo, imprimirlo o exportarlo. | Propuesto |
| RQ-CIE-02-09 | El historial de cierres se filtra por fechas y se exporta. | Debería tener | NEC-CAP-062 · NEC-CAP-050 | Dados cierres de octubre, cuando el administrador filtra del 1 al 15, entonces ve esos cierres con sus diferencias y los descarga como CSV. | Propuesto |

Prioridad por NEC-CAP-062 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-014 aplica porque un cierre nunca se borra ni se edita (RN-CAP-080).

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-078 | El cajero ve lo esperado mientras cuenta; las billeteras se verifican fuera del sistema. | Reunión del 18/10 |
| RN-CAP-079 | No se cierra con pedidos sin cobrar o por confirmar. | Reunión del 18/10 |
| RN-CAP-080 | La diferencia se registra siempre; no se asignan culpables; los cierres no se editan ni eliminan. | Reunión del 18/10 |
| RN-CAP-097 | La caja no se cierra con efectivo de repartidores sin liquidar. | Caja |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CIE-02-01 | HU-CAP-044 | — | R-01 |
| RQ-CIE-02-02 | HU-CAP-044 | — | R-01 |
| RQ-CIE-02-03 | HU-CAP-044 | — | R-01 |
| RQ-CIE-02-04 | HU-CAP-044 | — | R-01 |
| RQ-CIE-02-05 | HU-CAP-045 | FT-CAJ-01 | R-01 |
| RQ-CIE-02-06 | HU-CAP-045 | FT-CIE-01 | R-01 |
| RQ-CIE-02-07 | HU-CAP-046 | — | R-01 |
| RQ-CIE-02-08 | HU-CAP-046 | — | R-01 |
| RQ-CIE-02-09 | HU-CAP-046 | FT-INF-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-044 Contar el efectivo y comparar cada medio de pago
- HU-CAP-045 Cerrar la caja con sus validaciones
- HU-CAP-046 Consultar e imprimir el historial de cierres

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.

**Fuera de alcance**

- Apertura, movimientos y liquidación: FT-CIE-01.
- Verificar los pagos en la cuenta de Yape o Plin desde el sistema (se hace fuera, RN-CAP-078).
- Informes de ventas: FT-INF-01.

**Preguntas abiertas**

1. **¿Qué hacer con un pedido por confirmar al cierre?** Propuesta: rechazarlo con motivo o pasarlo al día siguiente; pendiente de Kevin.
2. **¿Se puede reabrir un cierre por error?** Propuesta: no; se corrige con un movimiento en la caja del día siguiente.

---

Generado por IA: BRD (NEC-CAP-050, 062; RN-CAP-015, 078 a 080, 097), `analisis/cierre-de-caja.md` y el mockup de Cierre de caja — Revisado por: *(pendiente)*
