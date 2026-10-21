---
id: FT-CIE-02
tipo: spec
titulo: "Arqueo ciego y cierre con historial"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-01, FT-CAJ-02, FT-INF-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, NEC-CAP-062, RN-CAP-078, RN-CAP-079, RN-CAP-080, RN-CAP-097]
tags: [cierre-caja, plt-03, ep-cap-005, ft-cie-02, debe-tener]
---

# FT-CIE-02 — Arqueo ciego y cierre con historial

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CAJA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CIE-02 | Arqueo ciego y cierre con historial | EP-CAP-005 Apertura y cierre de caja |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-062) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El cierre es **ciego** (DT-61, acta 03; reemplaza RN-CAP-078): el cajero **cuenta el efectivo por billetes y monedas** (200, 100, 50, 20, 10; 5, 2, 1, 0,50, 0,20, 0,10) y el sistema suma; para Yape, Plin y transferencia mira el celular de las billeteras **fuera del sistema** y anota lo que ve; para tarjeta, el total del terminal. **No ve los totales esperados** de ningún medio, para que nadie pueda «cuadrar» anulando una venta (el caso de la galleta de S/ 4 que contó Kevin). Al terminar solo ve **«Cuadra»** o **«No cuadra»**, y puede **volver a contar**; cada intento queda registrado. Si no cuadra, **la supervisora (rol administrador) entra con su PIN** y ve el detalle por medio y el historial de ventas para darle seguimiento; cerrar con «No cuadra» requiere su PIN. Plin usa el mismo número que Yape y casi siempre queda en cero. El sistema registra la **diferencia** de cada medio (cuadrado, sobrante o faltante), sin asignar culpables ni descontar a nadie (RN-CAP-080). No se cierra con pedidos sin cobrar o por confirmar (RN-CAP-079) ni con efectivo de repartidores sin liquidar (RN-CAP-097). Todo cierre queda en un **historial que no se pierde**: no se edita ni se elimina, y se puede imprimir o exportar.

**Beneficio esperado.** Un cierre del día que el cajero no puede acomodar, verificable por medio de pago, con un historial que el dueño puede revisar siempre. Hoy, en restaurant.pe, «sobra y falta a cada rato» y nunca cuadra en cero (acta 03). Hipótesis medible: **100 % de los días con cierre registrado**; **0 cierres editados o eliminados**; **porcentaje de cierres que cuadran al primer conteo medido desde el primer día**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (cuenta a ciegas y cierra) · ACT-CAP-001 Kevin Rosales, dueño y administrador (como supervisora, revisa un cierre que no cuadra con su PIN y el historial).

**Pantallas de referencia.** Administrativo ▸ Cierre de caja ▸ arqueo ciego por denominación, resultado «Cuadra / No cuadra», detalle con PIN de la supervisora, historial de cierres (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CIE-02-01 | El cajero cuenta el efectivo por billetes y monedas y el sistema suma el total. | Debe tener | NEC-CAP-062 | Dados 3 billetes de 100, 2 de 20 y 5 monedas de 1, cuando el cajero los anota, entonces el contado es S/ 345,00. | Propuesto |
| RQ-CIE-02-02 | Mientras cuenta, el cajero no ve lo esperado por el sistema ni las ventas por medio (cierre ciego). | Debe tener | DT-61 · Acta 03 | Dado el arqueo abierto, cuando el cajero cuenta, entonces solo ve lo que él anota; la pantalla y el servidor no le entregan el efectivo esperado, las ventas por medio ni la diferencia. | Propuesto |
| RQ-CIE-02-03 | Para Yape, Plin, transferencia y tarjeta, el cajero anota lo que ve fuera del sistema y el sistema lo compara con lo vendido sin mostrárselo. | Debe tener | RN-CAP-078 · NEC-CAP-062 · DT-61 | Dado Yape vendido S/ 210, cuando el cajero anota S/ 200 visto en el celular, entonces el sistema guarda el faltante de S/ 10,00 para la supervisora y al cajero no se le muestra el monto. | Propuesto |
| RQ-CIE-02-04 | Al terminar de anotar, el cajero solo ve «Cuadra» o «No cuadra» y puede volver a contar; cada intento queda registrado. | Debe tener | DT-61 · Acta 03 | Dado un conteo con S/ 4 de menos en efectivo, cuando el cajero toca «Revisar», entonces ve «No cuadra» sin decir en qué medio ni cuánto; al volver a contar, el intento anterior queda en el Historial de acciones. | Propuesto |
| RQ-CIE-02-05 | Si no cuadra, la supervisora ve con su PIN el detalle por medio y el historial de ventas del día, y cerrar así requiere su PIN. | Debe tener | DT-61 · Acta 03 | Dado un cierre que no cuadra, cuando la supervisora escribe su PIN de 6 dígitos, entonces ve «Efectivo: faltan S/ 4,00 · Yape: cuadra», las ventas del día y puede cerrar con la diferencia registrada; sin su PIN el cajero no puede cerrar. | Propuesto |
| RQ-CIE-02-06 | La diferencia de cada medio se clasifica como cuadrado, sobrante o faltante y se registra siempre; solo el administrador la ve. | Debe tener | RN-CAP-080 · DT-61 | Dado efectivo esperado S/ 355 y contado S/ 360, cuando se cierra, entonces queda «Sobrante S/ 5,00» en el historial que ve el administrador; no se pide justificar a nadie, solo una nota opcional. | Propuesto |
| RQ-CIE-02-07 | No se puede cerrar con pedidos sin cobrar o por confirmar. | Debe tener | RN-CAP-079 | Dado un pedido por confirmar, cuando el cajero intenta cerrar, entonces ve la lista de pendientes y el cierre no procede. | Propuesto |
| RQ-CIE-02-08 | No se puede cerrar con efectivo de repartidores sin liquidar. | Debe tener | RN-CAP-097 | Dado un repartidor con S/ 40 por liquidar, cuando el cajero intenta cerrar, entonces ve «Falta liquidar a …» y no puede. | Propuesto |
| RQ-CIE-02-09 | Cerrar pide confirmación Sí/No y deja el cierre en el historial con autor y hora. | Debe tener | RN-CAP-015 · NEC-CAP-062 | Dado un arqueo completo, cuando el cajero confirma el cierre, entonces queda en el historial con fecha, autor, apertura, ventas por medio, movimientos, contado y diferencias. | Propuesto |
| RQ-CIE-02-10 | Un cierre no se edita ni se elimina. | Debe tener | RN-CAP-080 | Dado un cierre del historial, cuando cualquier usuario lo abre, entonces solo puede verlo, imprimirlo o exportarlo. | Propuesto |
| RQ-CIE-02-11 | El historial de cierres se filtra por fechas y se exporta. | Debería tener | NEC-CAP-062 · NEC-CAP-050 | Dados cierres de octubre, cuando el administrador filtra del 1 al 15, entonces ve esos cierres con sus diferencias y los descarga como CSV. | Propuesto |

Prioridad por NEC-CAP-062 (E1) y por el acta 03 (DT-61), que vuelve ciego el arqueo. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-014 aplica porque un cierre nunca se borra ni se edita (RN-CAP-080); RNF-CAP-006 porque los montos esperados y el detalle solo los recibe el administrador.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-078 | Las billeteras se verifican fuera del sistema. Que el cajero vea lo esperado mientras cuenta queda **reemplazado por DT-61** (cierre ciego). | Reunión del 18/10 |
| DT-61 | Cierre ciego: el cajero solo ve «Cuadra» o «No cuadra»; el detalle lo ve la supervisora con su PIN. | Acta 03 · decisiones.md |
| RN-CAP-079 | No se cierra con pedidos sin cobrar o por confirmar. | Reunión del 18/10 |
| RN-CAP-080 | La diferencia se registra siempre; no se asignan culpables; los cierres no se editan ni eliminan. | Reunión del 18/10 |
| RN-CAP-097 | La caja no se cierra con efectivo de repartidores sin liquidar. | Caja |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CIE-02-01 | HU-CAP-044 | — | R-01 |
| RQ-CIE-02-02 | HU-CAP-044 | — | R-01 |
| RQ-CIE-02-03 | HU-CAP-044 | — | R-01 |
| RQ-CIE-02-04 | HU-CAP-044 | FT-USR-04 | R-01 |
| RQ-CIE-02-05 | HU-CAP-199 | FT-USR-02 | R-01 |
| RQ-CIE-02-06 | HU-CAP-044 | — | R-01 |
| RQ-CIE-02-07 | HU-CAP-045 | FT-CAJ-01 | R-01 |
| RQ-CIE-02-08 | HU-CAP-045 | FT-CIE-01 | R-01 |
| RQ-CIE-02-09 | HU-CAP-046 | — | R-01 |
| RQ-CIE-02-10 | HU-CAP-046 | — | R-01 |
| RQ-CIE-02-11 | HU-CAP-046 | FT-INF-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-044 Contar a ciegas el efectivo y las billeteras
- HU-CAP-045 Cerrar la caja con sus validaciones
- HU-CAP-046 Consultar e imprimir el historial de cierres
- HU-CAP-199 Revisar con mi PIN el detalle de un cierre que no cuadra

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.

**Fuera de alcance**

- Apertura, movimientos y liquidación: FT-CIE-01.
- Verificar los pagos en la cuenta de Yape o Plin desde el sistema (se hace fuera, RN-CAP-078).
- Informes de ventas: FT-INF-01.

**Preguntas abiertas**

1. **¿Se acepta una diferencia mínima como «Cuadra»?** Propuesta: S/ 0,00 por defecto, configurable (por ejemplo, S/ 0,50 por monedas).
2. **¿Qué hacer con un pedido por confirmar o con pago por coordinar al cierre?** Propuesta: anularlo con motivo y PIN o pasarlo al día siguiente; pendiente de Kevin.
3. **¿Se puede reabrir un cierre por error?** Propuesta: no; se corrige con un movimiento en la caja del día siguiente.

---

Generado por IA: BRD (NEC-CAP-050, 062; RN-CAP-015, 078 a 080, 097), `analisis/cierre-de-caja.md` y el mockup de Cierre de caja — Revisado por: *(pendiente)*
