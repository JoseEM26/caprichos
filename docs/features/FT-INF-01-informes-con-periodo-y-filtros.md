---
id: FT-INF-01
tipo: spec
titulo: "Informes con período y filtros"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-018, FT-INF-02, FT-CIE-02, FT-STK-02, ADR-001, ADR-011, ADR-014, ADR-006, ADR-012, NEC-CAP-041, NEC-CAP-050, OBJ-CAP-001, OBJ-CAP-003]
tags: [informes, plt-03, ep-cap-018, ft-inf-01, podria-tener]
---

# FT-INF-01 — Informes con período y filtros

**PLT-03 · Feature · Catálogo de requerimientos** · Frente INFORMES · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-INF-01 | Informes con período y filtros | EP-CAP-018 Informes, indicadores y notificaciones |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Podría tener** (NEC-CAP-041) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H3 · 22/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Informes con **gráficos y filtros** de período (hoy, semana, mes, año o fechas «de… a…»), canal, medio de pago y modalidad (NEC-CAP-041, NEC-CAP-050). Incluye ventas por día y hora, por categoría y producto, por canal y por medio de pago; ticket promedio; combos vendidos; tiempos de entrega frente a la meta (OBJ-CAP-001); márgenes por plato (OBJ-CAP-003); mermas por destino; descuentos y cupones canjeados; clientes nuevos y próximos cumpleaños. Cada informe se exporta a Excel y la exportación queda en el Historial de acciones (DT-67); Kevin la usa para indicadores propios que no están en los resúmenes (acta 03). Solo el administrador los ve (RN-CAP-013).

**Beneficio esperado.** Decidir con datos: qué se vende, cuándo, cuánto se gana y dónde se pierde. Hipótesis medible: **Los totales de ventas de un período coinciden al 100 % con los cierres de caja del mismo período**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (consulta y exporta).

**Pantallas de referencia.** Administrativo ▸ Informes (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-INF-01-01 | Los informes se filtran por período predefinido o fechas «de… a…» con calendario. | Podría tener | NEC-CAP-041 · NEC-CAP-050 | Dado el informe de ventas, cuando el administrador elige del 01/10 al 15/10, entonces todos los gráficos usan ese rango. | Propuesto |
| RQ-INF-01-02 | Se filtran además por canal, medio de pago y modalidad. | Podría tener | NEC-CAP-041 | Dado el rango, cuando filtra canal «Carta» y pago «Yape», entonces solo cuenta esos pedidos. | Propuesto |
| RQ-INF-01-03 | Hay ventas por día, hora, categoría, producto, canal y medio de pago, y ticket promedio. | Podría tener | NEC-CAP-041 | Dado octubre, cuando abre «Ventas», entonces ve los gráficos y el ticket promedio. | Propuesto |
| RQ-INF-01-04 | Hay tiempos de entrega frente a la meta. | Podría tener | OBJ-CAP-001 | Dado octubre, cuando abre «Tiempos», entonces ve el tiempo medio y el % de pedidos dentro de la meta por día. | Propuesto |
| RQ-INF-01-05 | Hay margen por plato y mermas por destino. | Podría tener | OBJ-CAP-003 · RN-CAP-124 | Dado octubre, cuando abre «Rentabilidad», entonces ve el margen de cada plato con receta y la merma por destino. | Propuesto |
| RQ-INF-01-06 | Hay combos, descuentos y cupones canjeados. | Podría tener | NEC-CAP-066 | Dado octubre, cuando abre «Ofertas», entonces ve cuántos combos se vendieron y cuánto se descontó por cupón. | Propuesto |
| RQ-INF-01-07 | Cada informe se exporta a Excel, solo el administrador, y la exportación queda registrada (DT-75). | Debería tener | Mockup · DT-67 · Acta 03 | Dado un informe filtrado, cuando toca «Exportar a Excel», entonces descarga un archivo con las filas del filtro y el Historial de acciones registra quién lo exportó y con qué filtro. | Propuesto |
| RQ-INF-01-08 | Los totales de ventas coinciden con los cierres de caja del período. | Debe tener | RNF-CAP-011 | Dados los cierres de octubre, cuando se compara con el informe de octubre, entonces la venta por medio de pago es igual. | Propuesto |

Prioridad *Podría tener* por la épica (fase Después). RQ-INF-01-08 es *Debe tener* porque un informe que no cuadra con caja no sirve. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-017 | Rendimiento | Los informes y gráficos de un mes cargan rápido. | ≤ 5 s para un mes de datos (umbral propuesto) | Podría tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Podría tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Podría tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-017 es el umbral clave.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-013 | Solo el administrador ve ventas e indicadores del negocio. | Prototipo |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-INF-01-01 | HU-CAP-161 | — | R-01 |
| RQ-INF-01-02 | HU-CAP-161 | — | R-01 |
| RQ-INF-01-03 | HU-CAP-162 | — | R-01 |
| RQ-INF-01-04 | HU-CAP-162 | FT-DEL-02 · FT-COC-01 | R-01 |
| RQ-INF-01-05 | HU-CAP-163 | FT-STK-02 · FT-ALM-03 | R-01 |
| RQ-INF-01-06 | HU-CAP-163 | FT-OFE-01 · FT-OFE-03 | R-01 |
| RQ-INF-01-07 | HU-CAP-161 | FT-USR-04 | R-01 |
| RQ-INF-01-08 | HU-CAP-162 | FT-CIE-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-161 Filtrar informes por período, canal, pago y modalidad
- HU-CAP-162 Ver ventas, tiempos y márgenes
- HU-CAP-163 Exportar un informe

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-012.

**Fuera de alcance**

- Indicadores del escritorio y mapa de entregas: FT-INF-02.
- Herramientas externas de BI (no pedido).

**Preguntas abiertas**

1. **Qué informes quiere Kevin primero** — propuesta: ventas, tiempos y margen.

---

Generado por IA: BRD (NEC-CAP-041, 050, 066; RN-CAP-013, 124), OBJ-CAP-001 y 003 y el mockup de Informes — Revisado por: *(pendiente)*
