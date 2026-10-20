---
id: FT-USR-04
tipo: spec
titulo: "Historial de acciones (auditoría)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-01, FT-USR-02, FT-CAJ-02, FT-CFG-02, FT-LEG-02, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, RNF-CAP-009, RN-CAP-094, DT-49]
tags: [usuarios, plt-03, ep-cap-013, ft-usr-04, debe-tener]
---

# FT-USR-04 — Historial de acciones (auditoría)

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PERSONAL · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-USR-04 | Historial de acciones (auditoría) | EP-CAP-013 Personal, usuarios y roles |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (RNF-CAP-009 · DT-49) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El administrador revisa **quién hizo qué y cuándo** en una pantalla «Historial de acciones». Se registran tres tipos de acción (DT-49, ADR-014): **cambios sensibles** (precios, productos, ofertas, cupones, parámetros, horarios, zonas, permisos, usuarios, anulaciones y uso del PIN), **accesos** (ingresos, intentos fallidos de contraseña y PIN, cierre de sesiones, restablecer contraseña) y **lecturas sensibles** (ver el DNI completo, abrir un comprobante de pago, exportar o anonimizar datos de una persona). Cada registro guarda quién, cuándo, desde qué dispositivo e IP, el antes y el después con los datos personales enmascarados, y el motivo. Desde cada ficha (pedido, producto, usuario, cliente, parámetro) un botón «Ver historial» muestra lo suyo. El historial no se puede editar ni borrar y una verificación diaria detecta cualquier alteración.

**Inmutable y verificable.** La tabla solo admite inserciones y cada fila lleva una huella encadenada con la anterior; la verificación diaria avisa si la cadena se rompió (ADR-014).

**Beneficio esperado.** Que el dueño pueda revisar cambios de precios, anulaciones, permisos y accesos sin depender de nadie, y responder ante un reclamo o una pérdida. Hipótesis medible: **100 % de las acciones de la lista con su registro**; **0 eslabones rotos** en la verificación diaria.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (consulta el historial) · El propio sistema (tareas automáticas) (registra y verifica).

**Pantallas de referencia.** Administrativo ▸ Configuración ▸ Historial de acciones, mockup v205 (el botón «Ver historial» de cada ficha aún no está en el mockup) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-USR-04-01 | Cada cambio sensible queda registrado con quién, cuándo, módulo, acción, antes, después y motivo. | Debe tener | DT-49 · RNF-CAP-009 | Dado un administrador que cambia el precio del capuchino de S/ 9 a S/ 10, cuando guarda, entonces el historial muestra «carta · PRECIO · capuchino», S/ 9 → S/ 10, su nombre, la hora y el dispositivo. | Propuesto |
| RQ-USR-04-02 | Una anulación y cada uso del PIN del administrador quedan registrados. | Debe tener | RN-CAP-094 · DT-49 | Dado un cajero que anula un cobro con el PIN, cuando se confirma, entonces el historial registra la anulación con el motivo, el cajero y «con PIN del administrador». | Propuesto |
| RQ-USR-04-03 | Los ingresos y los intentos fallidos de contraseña y de PIN quedan registrados. | Debe tener | DT-49 | Dados 3 intentos fallidos con el DNI 00000012, cuando el administrador filtra «Accesos», entonces ve los 3 intentos con resultado «Rechazado», la hora y la IP. | Propuesto |
| RQ-USR-04-04 | Ver el DNI completo, abrir un comprobante de pago o exportar datos de una persona queda registrado. | Debe tener | DT-49 · ADR-005 | Dado un administrador que abre el DNI completo de un cliente, cuando lo ve, entonces el historial registra «LECTURA_SENSIBLE · VER_DNI» con el cliente y quién lo vio. | Propuesto |
| RQ-USR-04-05 | En el historial los DNI y teléfonos aparecen enmascarados y nunca se guardan contraseñas, PIN ni tokens. | Debe tener | ADR-005 · ADR-014 | Dado un cambio en los datos de un cliente, cuando se revisa su registro, entonces el DNI se ve como «4567****» y no hay ninguna contraseña ni PIN. | Propuesto |
| RQ-USR-04-06 | Solo el administrador ve la pantalla Historial de acciones. | Debe tener | RN-CAP-013 · RNF-CAP-006 | Dado un cajero, cuando abre la dirección del historial, entonces ve «No tienes acceso» y el servidor no entrega datos. | Propuesto |
| RQ-USR-04-07 | El historial se filtra por persona, módulo, acción, resultado y fechas, y se exporta a CSV. | Debe tener | NEC-CAP-047 · NEC-CAP-050 | Dados registros de un mes, cuando el administrador filtra «Ana · caja · ANULAR» del 1 al 15, entonces ve solo esos y puede exportarlos; la exportación también queda registrada. | Propuesto |
| RQ-USR-04-08 | El antes y el después se muestran lado a lado, resaltando lo que cambió. | Debería tener | DT-49 | Dado un cambio de parámetros, cuando el administrador abre el registro, entonces ve los dos valores lado a lado y el campo cambiado resaltado. | Propuesto |
| RQ-USR-04-09 | Cada ficha tiene «Ver historial» con solo sus registros. | Debería tener | DT-49 | Dado el producto capuchino, cuando el administrador toca «Ver historial», entonces ve sus cambios de precio, foto y estado en orden. | Propuesto |
| RQ-USR-04-10 | El historial no se puede editar ni borrar, ni desde la aplicación ni desde la base con el usuario de la API. | Debe tener | ADR-014 | Dado un registro, cuando alguien intenta editarlo o borrarlo, entonces la base lo rechaza con «La auditoría no se edita ni se borra». | Propuesto |
| RQ-USR-04-11 | Una verificación diaria comprueba la huella encadenada y avisa si se rompió. | Debe tener | ADR-014 | Dada una fila alterada por fuera, cuando corre la verificación de las 03:30, entonces el administrador recibe «Historial alterado desde el registro N» y Uptime Kuma marca la alerta. | Propuesto |
| RQ-USR-04-12 | Los registros de más de 2 años pasan a un archivo cifrado y salen de la base, conservando la cadena. | Debería tener | DT-49 · D-18 | Dado un registro de hace 25 meses, cuando corre el archivado mensual, entonces queda en el archivo cifrado de copias y ya no aparece en la pantalla; la cadena sigue verificando. | Propuesto |

Prioridad *Debe tener*: sin historial, las anulaciones con PIN y los cambios de precio no se pueden revisar (RNF-CAP-009). Entra en el piloto (H1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-017 | Rendimiento | Los informes y gráficos de un mes cargan rápido. | ≤ 5 s para un mes de datos (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-009 es el requisito central; RNF-CAP-008 aplica porque el historial guarda quién vio datos personales.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-094 | Anular por otro rol exige el PIN del administrador. | Permisos |
| RN-CAP-013 | Solo el administrador ve los datos del negocio. | Prototipo |
| DT-49 | Alcance, pantalla, inmutabilidad con huella y conservación de 2 años. | decisiones.md |
| RN-CAP-014 | Los registros no se eliminan. | Diseño |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-USR-04-01 | HU-CAP-176 | — | R-01 |
| RQ-USR-04-02 | HU-CAP-176 | FT-CAJ-02 | R-01 |
| RQ-USR-04-03 | HU-CAP-176 | FT-USR-01 | R-01 |
| RQ-USR-04-04 | HU-CAP-176 | FT-CLI-01 · FT-LEG-02 | R-11 |
| RQ-USR-04-05 | HU-CAP-176 | — | R-01 |
| RQ-USR-04-06 | HU-CAP-177 | — | R-01 |
| RQ-USR-04-07 | HU-CAP-177 | — | R-01 |
| RQ-USR-04-08 | HU-CAP-177 | — | R-01 |
| RQ-USR-04-09 | HU-CAP-177 | — | R-01 |
| RQ-USR-04-10 | HU-CAP-176 | — | R-01 |
| RQ-USR-04-11 | HU-CAP-176 | ADR-012 | R-01 |
| RQ-USR-04-12 | HU-CAP-176 | DEP-09 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-176 Registrar automáticamente cambios, accesos y lecturas sensibles
- HU-CAP-177 Consultar el Historial de acciones y el historial de cada ficha

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.

**Fuera de alcance**

- Registros técnicos y errores del sistema: ADR-012 (GlitchTip y registros JSON).
- El historial propio de dinero y stock (cobros, cierres, movimientos), que ya está en sus módulos.
- Auditoría de cada acción menor (estados de cocina, mensajes de chat).

**Preguntas abiertas**

1. **Plazo legal de conservación** — D-18, DEP-09. Propuesta: 2 años en línea y archivo cifrado después.
2. **¿Kevin quiere un aviso inmediato de ciertas acciones** (por ejemplo, anulaciones con PIN)? Propuesta: notificación al administrador, configurable.

---

Generado por IA: Decisión DT-49, ADR-014, RNF-CAP-009 y RN-CAP-094 — Revisado por: *(pendiente)*
