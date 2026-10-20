---
id: FT-DEL-01
tipo: spec
titulo: "Zonas de reparto y tarifas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-PED-02, FT-CAJ-01, FT-CAJ-03, FT-INF-02, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, NEC-CAP-076, NEC-CAP-096, NEC-CAP-100, RN-CAP-103, RN-CAP-109, RN-CAP-122]
tags: [delivery, plt-03, ep-cap-008, ft-del-01, debe-tener]
---

# FT-DEL-01 — Zonas de reparto y tarifas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente DELIVERY · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-DEL-01 | Zonas de reparto y tarifas | EP-CAP-008 Delivery y entregas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-076 · NEC-CAP-100) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El costo de envío sale de la **zona de reparto** donde cae el punto de entrega: Z2, Z3, Z4, Z5 y Z7, con tarifas de S/ 2 a S/ 7 (V9, NEC-CAP-076). El administrador edita cada zona como una lista de puntos (latitud y longitud) con validación, puede apagarla y define su tarifa; **no se crean zonas nuevas** desde el administrativo (NEC-CAP-100, RN-CAP-122). Si los datos de una zona no son válidos, se usa la zona original. Una zona apagada no se ofrece ni se detecta. Hay envío gratis cuando los productos pasan del monto configurado (más de S/ 70 por defecto, RN-CAP-095) y **tarifa especial por cliente**: monto fijo o porcentaje de descuento, donde el monto fijo prevalece sobre el porcentaje y el envío gratis sobre ambos; solo el administrador la edita (RN-CAP-109). Fuera de cobertura no se registra delivery y se ofrece recojo.

**Beneficio esperado.** Un envío cobrado igual en todos los canales, calculado solo con el punto, sin que el cliente tenga que conocer las zonas. Hipótesis medible: **0 diferencias de envío entre carta, chatbot y Nuevo pedido para el mismo punto**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (edita zonas, tarifas y tarifas especiales) · ACT-CAP-006 Clientes (ven solo el costo).

**Pantallas de referencia.** Administrativo ▸ Configuración del local ▸ Entrega y zonas; Clientes ▸ tarifa especial (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-DEL-01-01 | El sistema detecta la zona por el punto de entrega y aplica su tarifa. | Debe tener | RN-CAP-103 · NEC-CAP-076 | Dado un punto dentro de Z4 (S/ 5), cuando se calcula el envío desde cualquier canal, entonces es S/ 5,00. | Propuesto |
| RQ-DEL-01-02 | El administrador edita los puntos de una zona con validación; si no son válidos, se mantiene la zona original. | Debe tener | NEC-CAP-100 · RN-CAP-122 | Dada la zona Z3, cuando el administrador pega puntos con una latitud mal escrita, entonces ve el error y la zona sigue con sus puntos anteriores. | Propuesto |
| RQ-DEL-01-03 | El administrador cambia la tarifa de una zona. | Debe tener | NEC-CAP-100 | Dada Z5 en S/ 6, cuando el administrador la cambia a S/ 6,50 con Sí/No, entonces los pedidos nuevos en Z5 cobran S/ 6,50 y los anteriores no cambian. | Propuesto |
| RQ-DEL-01-04 | Una zona apagada no se ofrece ni se detecta. | Debe tener | RN-CAP-122 | Dada Z7 apagada, cuando un punto cae en Z7, entonces se trata como fuera de cobertura. | Propuesto |
| RQ-DEL-01-05 | No se crean zonas nuevas desde el administrativo. | Debe tener | NEC-CAP-100 · RN-CAP-122 | Dada la pantalla de zonas, cuando el administrador la revisa, entonces no hay botón para crear zonas. | Propuesto |
| RQ-DEL-01-06 | El envío es gratis cuando los productos pasan del monto configurado. | Debe tener | RN-CAP-095 · NEC-CAP-096 | Dado «más de S/ 70», cuando los productos suman S/ 70,10, entonces el envío es S/ 0; el administrador puede cambiar a «desde S/ 70». | Propuesto |
| RQ-DEL-01-07 | El administrador asigna a un cliente una tarifa especial de monto fijo o porcentaje. | Debería tener | RN-CAP-109 · NEC-CAP-096 | Dado un cliente con envío fijo de S/ 2 y otro con 50 %, cuando cada uno pide a Z5 (S/ 6), entonces pagan S/ 2 y S/ 3; si sus productos pasan de S/ 70, ambos pagan S/ 0. | Propuesto |
| RQ-DEL-01-08 | Fuera de cobertura no se registra delivery y se ofrece recojo. | Debe tener | RN-CAP-087 · RN-CAP-103 | Dado un punto fuera de todas las zonas activas, cuando se intenta guardar el delivery, entonces se avisa y se ofrece «Para recoger»; el intento se registra para el mapa de entregas. | Propuesto |

Prioridad por NEC-CAP-076 y NEC-CAP-100 (E1). RQ-DEL-01-07 es *Debería tener*. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-006 aplica porque solo el administrador edita zonas y tarifas especiales.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-095 | Envío gratis «más de 70» por defecto, configurable. | Delivery |
| RN-CAP-103 | La zona y su costo salen solos del punto; un punto fuera de cobertura no se guarda. | Delivery |
| RN-CAP-109 | Tarifa especial: el fijo prevalece sobre el porcentaje y el gratis sobre ambos; solo el administrador la edita. | Delivery |
| RN-CAP-122 | Las zonas se editan como lista de puntos; datos inválidos usan la original; una apagada no se detecta; no se crean zonas. | Delivery |
| V9 | Zonas Z2, Z3, Z4, Z5 y Z7, de S/ 2 a S/ 7. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-DEL-01-01 | HU-CAP-068 | DEP-07 (D-03) | R-03 |
| RQ-DEL-01-02 | HU-CAP-069 | — | R-01 |
| RQ-DEL-01-03 | HU-CAP-069 | — | R-01 |
| RQ-DEL-01-04 | HU-CAP-069 | — | R-01 |
| RQ-DEL-01-05 | HU-CAP-069 | — | R-01 |
| RQ-DEL-01-06 | HU-CAP-070 | D-02 | R-01 |
| RQ-DEL-01-07 | HU-CAP-070 | — | R-01 |
| RQ-DEL-01-08 | HU-CAP-068 | FT-INF-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-068 Calcular el envío por la zona del punto
- HU-CAP-069 Editar, apagar y tarifar las zonas
- HU-CAP-070 Asignar una tarifa especial de envío a un cliente

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.

**Fuera de alcance**

- Cómo el cliente da su ubicación: FT-PED-02.
- Mapa de calor de entregas: FT-INF-02.
- Crear zonas nuevas (excluido por NEC-CAP-100).

**Preguntas abiertas**

1. **Zonas y tarifas vigentes** — D-03, DEP-07.
2. **¿Por qué no se pueden crear zonas?** NEC-CAP-100 lo excluye; si Kevin amplía el reparto, se crea en el sistema por desarrollo.

---

Generado por IA: BRD (NEC-CAP-076, 096, 100; RN-CAP-087, 095, 103, 109, 122), V9 y el mockup de Configuración del local — Revisado por: *(pendiente)*
