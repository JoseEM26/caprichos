---
id: HU-CAP-176
tipo: hu
titulo: "Registrar automáticamente cambios, accesos y lecturas sensibles"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-04, RQ-USR-04-01, RQ-USR-04-02, RQ-USR-04-03, RQ-USR-04-04, RQ-USR-04-05, RQ-USR-04-06, RQ-USR-04-07, RQ-USR-04-12, RQ-USR-04-13, RQ-USR-04-14, HU-CAP-177, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, D-18, DEP-02, DEP-09, R-01, R-11]
tags: [hu, usuarios, capa-a, ft-usr-04, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-176 | Título | Registrar automáticamente cambios, accesos y lecturas sensibles |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-013 · FT-USR-04 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | que el sistema registre solo los cambios sensibles, los accesos y las lecturas de datos sensibles, sin que nadie pueda alterarlos | saber siempre quién cambió, anuló o vio algo sensible, sin depender de nadie |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-USR-04 «Historial de acciones (auditoría)» (Debe tener, épica EP-CAP-013). Cubre los requerimientos: **RQ-USR-04-01** Cada cambio sensible queda registrado con quién, cuándo, módulo, acción, antes, después y motivo. **RQ-USR-04-02** Una anulación y cada uso del PIN de la supervisora quedan registrados con quién pidió, quién aprobó y el motivo. **RQ-USR-04-03** Marcar un producto como agotado, ocultarlo o desactivarlo queda registrado con quién lo hizo y cuándo. **RQ-USR-04-04** Cada conteo de un cierre ciego y cada vez que la supervisora abre su detalle quedan registrados. **RQ-USR-04-05** Los ingresos y los intentos fallidos de contraseña y de PIN quedan registrados. **RQ-USR-04-06** Ver el DNI completo, abrir un comprobante de pago o exportar datos de una persona queda registrado. **RQ-USR-04-07** En el historial los DNI y teléfonos aparecen enmascarados y nunca se guardan contraseñas, PIN ni tokens. **RQ-USR-04-12** El historial no se puede editar ni borrar, ni desde la aplicación ni desde la base con el usuario de la API. **RQ-USR-04-13** Una verificación diaria comprueba la huella encadenada y avisa si se rompió. **RQ-USR-04-14** Los registros de más de 2 años pasan a un archivo cifrado y salen de la base, conservando la cadena. | **Alcance.**<br>• Cada cambio sensible queda registrado con quién, cuándo, módulo, acción, antes, después y motivo.<br>• Una anulación y cada uso del PIN de la supervisora quedan registrados con quién pidió, quién aprobó y el motivo.<br>• Marcar un producto como agotado, ocultarlo o desactivarlo queda registrado con quién lo hizo y cuándo.<br>• Cada conteo de un cierre ciego y cada vez que la supervisora abre su detalle quedan registrados.<br>• Los ingresos y los intentos fallidos de contraseña y de PIN quedan registrados.<br>• Ver el DNI completo, abrir un comprobante de pago o exportar datos de una persona queda registrado.<br>• En el historial los DNI y teléfonos aparecen enmascarados y nunca se guardan contraseñas, PIN ni tokens.<br>• El historial no se puede editar ni borrar, ni desde la aplicación ni desde la base con el usuario de la API.<br>• Una verificación diaria comprueba la huella encadenada y avisa si se rompió.<br>• Los registros de más de 2 años pasan a un archivo cifrado y salen de la base, conservando la cadena. |
| **Problema.** Que el dueño pueda revisar cambios de precios, anulaciones, permisos y accesos sin depender de nadie, y responder ante un reclamo o una pérdida. | **Fuera de alcance.**<br>• HU-CAP-177: Consultar el Historial de acciones y el historial de cada ficha.<br>• Registros técnicos y errores del sistema: ADR-012 (GlitchTip y registros JSON).<br>• El historial propio de dinero y stock (cobros, cierres, movimientos), que ya está en sus módulos.<br>• Auditoría de cada acción menor (estados de cocina, mensajes de chat). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un administrador que cambia el precio del capuchino de S/ 9 a S/ 10 | guarda | el historial muestra «carta · PRECIO · capuchino», S/ 9 → S/ 10, su nombre, la hora y el dispositivo (RQ-USR-04-01) |
| CA-2 | un cajero que anula un cobro con el PIN de la supervisora | se confirma | el historial registra la anulación con el motivo, el cajero que la pidió y la supervisora que la aprobó (RQ-USR-04-02) |
| CA-3 | un cajero que marca el club sándwich como agotado | el administrador filtra «AGOTAR» | ve el producto, quién lo marcó, la hora y cuándo volvió a ofrecerse (RQ-USR-04-03) |
| CA-4 | un cierre que no cuadró al primer conteo | se revisa el historial | aparecen los dos conteos del cajero y la apertura del detalle por la supervisora con su hora (RQ-USR-04-04) |
| CA-5 | 3 intentos fallidos con el DNI 00000012 | el administrador filtra «Accesos» | ve los 3 intentos con resultado «Rechazado», la hora y la IP (RQ-USR-04-05) |
| CA-6 | un administrador que abre el DNI completo de un cliente | lo ve | el historial registra «LECTURA_SENSIBLE · VER_DNI» con el cliente y quién lo vio (RQ-USR-04-06) |
| CA-7 | un cambio en los datos de un cliente | se revisa su registro | el DNI se ve como «4567****» y no hay ninguna contraseña ni PIN (RQ-USR-04-07) |
| CA-8 | un registro | alguien intenta editarlo o borrarlo | la base lo rechaza con «La auditoría no se edita ni se borra» (RQ-USR-04-12) |
| CA-9 | una fila alterada por fuera | corre la verificación de las 03:30 | el administrador recibe «Historial alterado desde el registro N» y Uptime Kuma marca la alerta (RQ-USR-04-13) |
| CA-10 | un registro de hace 25 meses | corre el archivado mensual | queda en el archivo cifrado de copias y ya no aparece en la pantalla; la cadena sigue verificando (RQ-USR-04-14) |

Origen: criterios de verificación de FT-USR-04 (RQ-USR-04-01, RQ-USR-04-02, RQ-USR-04-03, RQ-USR-04-04, RQ-USR-04-05, RQ-USR-04-06, RQ-USR-04-07, RQ-USR-04-12, RQ-USR-04-13, RQ-USR-04-14); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-094) Anular por otro rol exige el PIN del administrador.<br>**RB-02** (DT-49) Alcance, pantalla, inmutabilidad con huella y conservación de 2 años.<br>**RB-03** (DT-61) Anulación con PIN de la supervisora y cierre ciego: queda quién pidió, quién aprobó y cada conteo.<br>**RNF aplicables:** RNF-CAP-009, RNF-CAP-006, RNF-CAP-008, RNF-CAP-014, RNF-CAP-017. | `auditoria` (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) · `Usuario` (DNI único, rol, activo, fecha de alta, huella de contraseña, debe cambiarla, foto) · `Rol` · `Permiso` (rol, módulo, acción) · `PinAdministrador` (huella) · `ConsumoPersonal` (usuario, mes, pedido, monto con descuento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-CAJ-02.<br>• FT-COC-03.<br>• FT-CIE-02.<br>• FT-USR-01.<br>• FT-CLI-01 · FT-LEG-02.<br>• ADR-012.<br>• DEP-09.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01, R-11 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-18 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-USR-04 (requerimientos RQ-USR-04-01, RQ-USR-04-02, RQ-USR-04-03, RQ-USR-04-04, RQ-USR-04-05, RQ-USR-04-06, RQ-USR-04-07, RQ-USR-04-12, RQ-USR-04-13, RQ-USR-04-14, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
