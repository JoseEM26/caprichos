---
id: FT-USR-01
tipo: spec
titulo: "Usuarios y primer ingreso"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-02, FT-USR-03, FT-CLI-01, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, NEC-CAP-088, NEC-CAP-099, RN-CAP-098, RN-CAP-119, RN-CAP-120]
tags: [usuarios, plt-03, ep-cap-013, ft-usr-01, debe-tener]
---

# FT-USR-01 — Usuarios y primer ingreso

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PERSONAL · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-USR-01 | Usuarios y primer ingreso | EP-CAP-013 Personal, usuarios y roles |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-088 · NEC-CAP-099) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El administrador da de **alta** a cada persona del equipo con nombre, DNI, teléfono, rol y fecha de alta, y la **desactiva** cuando deja de trabajar; los usuarios no se eliminan (RN-CAP-098). Todo usuario nuevo entra con la **contraseña inicial común** (123456) y, antes de ver su escritorio, el sistema le **exige crear una contraseña nueva**: al menos 6 caracteres, distinta de la inicial, escrita dos veces, con botón para verla u ocultarla; después le ofrece, sin obligar, una **foto de perfil** (NEC-CAP-099, RN-CAP-119). Todos pueden cambiar su foto; los datos personales y el rol solo los edita el administrador (BRD §4 «Perfil de usuario»). Las contraseñas se guardan solo como huella. Para el sistema real se recomienda caducidad de la contraseña inicial, límite de intentos, restablecimiento por el administrador y rechazo de contraseñas muy comunes (RN-CAP-120, D-17). La lista de usuarios se filtra por rol, estado y fechas de alta. Cada usuario tiene su **horario de trabajo**: qué días trabaja y de qué hora a qué hora cada día, porque no todos trabajan 8 horas; el administrador también registra **coberturas** de un día puntual (quién reemplaza a quién en su descanso). El sistema usa ese horario para saber **quién está de turno**, por ejemplo para el aviso del almacén (DT-64, acta 03). No es un control de asistencia. Detalle en `analisis/primer-ingreso-y-contrasenas.md`.

**Beneficio esperado.** Cada persona entra con su propio usuario, sin compartir claves, y el dueño sabe quién hizo qué. Hipótesis medible: **100 % de usuarios activos con contraseña propia** (ninguno con la inicial después del primer ingreso); **0 contraseñas en texto**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (da altas, desactiva y restablece) · ACT-CAP-002 Cajero/a (usa su usuario) · ACT-CAP-003 Cocina y barra (usa su usuario) · ACT-CAP-004 Mozos (usa su usuario) · ACT-CAP-005 Almacén (usa su usuario) · ACT-CAP-009 Repartidor (motorizado) (usa su usuario).

**Pantallas de referencia.** Administrativo ▸ Usuarios (pestaña Personal), primer ingreso, Mi perfil (`Admin.dc.html`); `analisis/primer-ingreso-y-contrasenas.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-USR-01-01 | El administrador da de alta a un usuario con nombre, DNI, teléfono, rol y fecha de alta. | Debe tener | NEC-CAP-088 | Dado el formulario, cuando el administrador crea a «Ana, cajera», entonces queda activa con la contraseña inicial y la fecha de alta. | Propuesto |
| RQ-USR-01-02 | Un DNI no se repite entre usuarios. | Debe tener | Propuesta (calidad) | Dado un DNI ya usado, cuando se crea otro usuario con él, entonces no se acepta. | Propuesto |
| RQ-USR-01-03 | Un usuario se desactiva y se reactiva; no se elimina. | Debe tener | RN-CAP-098 · RN-CAP-014 | Dada Ana activa, cuando el administrador la desactiva con Sí/No, entonces no puede entrar y su historial se conserva; al reactivarla vuelve a entrar. | Propuesto |
| RQ-USR-01-04 | En el primer ingreso con la contraseña inicial no se entra al escritorio sin crear una nueva. | Debe tener | NEC-CAP-099 · RN-CAP-119 | Dado un usuario nuevo, cuando entra con 123456, entonces ve «Crea tu contraseña» y no puede ir a otra pantalla. | Propuesto |
| RQ-USR-01-05 | La nueva contraseña tiene al menos 6 caracteres, es distinta de la inicial y se escribe dos veces igual. | Debe tener | RN-CAP-119 | Dada la pantalla de primer ingreso, cuando el usuario escribe «123456» o dos contraseñas distintas, entonces no se acepta; con «café2026» dos veces, sí. | Propuesto |
| RQ-USR-01-06 | Hay botón para ver u ocultar la contraseña. | Debe tener | NEC-CAP-099 | Dado el campo de contraseña, cuando el usuario toca el ojo, entonces ve el texto; otro toque lo oculta. | Propuesto |
| RQ-USR-01-07 | Tras crear la contraseña se ofrece, sin obligar, una foto de perfil. | Debería tener | NEC-CAP-099 | Dada la contraseña creada, cuando aparece la foto de perfil, entonces el usuario puede subirla o tocar «Ahora no» y entra al escritorio. | Propuesto |
| RQ-USR-01-08 | Todos cambian su foto; solo el administrador edita datos personales y rol. | Debe tener | BRD §4 «Perfil de usuario» | Dado un mozo en Mi perfil, cuando lo abre, entonces puede cambiar su foto y su contraseña, y su nombre, DNI y rol aparecen bloqueados. | Propuesto |
| RQ-USR-01-09 | El administrador restablece la contraseña de un usuario a la inicial. | Debería tener | RN-CAP-120 · D-17 | Dado un usuario que olvidó su contraseña, cuando el administrador la restablece con Sí/No, entonces vuelve a la inicial y se le pide crear una nueva al entrar. | Propuesto |
| RQ-USR-01-10 | Tras 5 intentos fallidos el ingreso se bloquea unos minutos. | Debería tener | RN-CAP-120 · D-17 | Dados 5 intentos errados, cuando se intenta un sexto, entonces se rechaza y se avisa cuánto falta. | Propuesto |
| RQ-USR-01-11 | La lista de usuarios se filtra por rol, estado y fechas de alta. | Debería tener | NEC-CAP-047 · NEC-CAP-050 | Dados 12 usuarios, cuando el administrador filtra «Cajero» activos dados de alta en octubre, entonces solo ve esos. | Propuesto |
| RQ-USR-01-12 | Solo el administrador restablece la contraseña de un usuario a la inicial, con confirmación Sí/No; ningún otro rol ve el botón ni puede llamar a la acción, y queda en el Historial de acciones. | Debe tener | Pedido del dueño 20/10/2026 · RN-CAP-120 | Dada una cajera que olvidó su contraseña, cuando el administrador pulsa «Restablecer contraseña» en su ficha y responde «Sí», entonces su contraseña vuelve a la inicial, al entrar el sistema le exige crear una nueva y el historial registra quién la restableció; dado un mozo que intenta la misma acción por la API, entonces recibe 403 y nada cambia. | Propuesto |
| RQ-USR-01-13 | Un usuario desactivado no puede iniciar sesión en el administrativo: ve un aviso claro, sus sesiones abiertas se cierran y su historial se conserva. | Debe tener | Pedido del dueño 20/10/2026 · RN-CAP-098 | Dado un cajero desactivado por el administrador, cuando escribe su usuario y su contraseña correcta, entonces no entra y ve «Tu usuario está desactivado»; si tenía una sesión abierta, la siguiente acción le pide ingresar y no puede; al reactivarlo vuelve a entrar con su misma contraseña. | Propuesto |
| RQ-USR-01-14 | El administrador define el horario de trabajo de cada usuario: días de la semana y hora de entrada y salida de cada día. | Debería tener | DT-64 · Acta 03 | Dado Marvel, cuando el administrador marca lunes a sábado de 15:00 a 23:00 y el domingo libre, y a la repostera de 06:00 a 12:00, entonces la ficha de cada uno muestra su horario y se guarda con Sí/No. | Propuesto |
| RQ-USR-01-15 | El administrador registra la cobertura de un día puntual: quién reemplaza a quién en su descanso. | Debería tener | DT-64 · Acta 03 | Dado el jueves 22/10 como descanso de Marvel, cuando el administrador registra que lo cubre Jeffrey de 15:00 a 23:00, entonces ese día Jeffrey figura de turno en almacén y Marvel no. | Propuesto |
| RQ-USR-01-16 | El sistema dice quién está de turno en cada rol en un momento dado, según horarios y coberturas. | Debería tener | DT-64 | Dado el jueves 22/10 a las 16:00, cuando el sistema busca a quién avisar en almacén, entonces devuelve a Jeffrey; a las 07:00 no devuelve a nadie de almacén. | Propuesto |
| RQ-USR-01-17 | Para cambiar su propia contraseña, el usuario confirma que es él: escribe primero su contraseña actual; sin eso no se cambia, y el cambio queda en el Historial de acciones. | Debe tener | Pedido del dueño 20/10/2026 · RNF-CAP-007 | Dado un mozo en Mi perfil, cuando pulsa «Cambiar mi contraseña» y deja vacía la actual o escribe una equivocada, entonces no se cambia y ve un aviso; con la actual correcta y una nueva válida (6 o más caracteres, distinta de la inicial y de la actual, escrita dos veces igual), entonces se cambia y queda registrado. | Propuesto |

Prioridad por NEC-CAP-088 y NEC-CAP-099 (E1). RQ-USR-01-09 y 10 dependen de la política de contraseñas (D-17). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-007 | Seguridad | Las contraseñas y PIN se guardan solo como huella (hash con sal), nunca en texto. | 0 contraseñas en texto · revisión de la base (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-007 es el umbral clave: la contraseña inicial común solo es aceptable si obliga a cambiarla y se guarda como huella.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-098 | Los usuarios no se eliminan; la contraseña inicial es común y se cambia en el primer ingreso; ninguna se guarda en texto. | Seguridad |
| RN-CAP-119 | Con la inicial no se entra al escritorio; nueva de al menos 6, distinta y escrita dos veces; foto opcional. | Seguridad |
| RN-CAP-120 | Recomendado: caducidad de la inicial, límite de intentos, huella, restablecimiento por el administrador. | Seguridad |
| D-17 | Política de contraseñas del sistema real (propuesta: inicial que vence en 24 horas, 5 intentos, recuperación por el administrador). | decisiones.md |
| DT-64 | Cada usuario tiene su horario de trabajo y sus coberturas; los usuarios son personales. | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-USR-01-01 | HU-CAP-116 | — | R-01 |
| RQ-USR-01-02 | HU-CAP-116 | — | R-01 |
| RQ-USR-01-03 | HU-CAP-116 | — | R-01 |
| RQ-USR-01-04 | HU-CAP-117 | — | R-01 |
| RQ-USR-01-05 | HU-CAP-117 | — | R-01 |
| RQ-USR-01-06 | HU-CAP-117 | — | R-01 |
| RQ-USR-01-07 | HU-CAP-117 | — | R-01 |
| RQ-USR-01-08 | HU-CAP-118 | — | R-01 |
| RQ-USR-01-09 | HU-CAP-118 | D-17 | R-01 |
| RQ-USR-01-10 | HU-CAP-117 | D-17 | R-11 |
| RQ-USR-01-11 | HU-CAP-116 | — | R-01 |
| RQ-USR-01-12 | HU-CAP-118 | — | R-11 |
| RQ-USR-01-13 | HU-CAP-116 | — | R-11 |
| RQ-USR-01-14 | HU-CAP-201 | — | R-01 |
| RQ-USR-01-15 | HU-CAP-201 | — | R-01 |
| RQ-USR-01-16 | HU-CAP-201 | FT-ALM-03 | R-01 |
| RQ-USR-01-17 | HU-CAP-118 | — | R-11 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-116 Dar de alta y desactivar a un usuario
- HU-CAP-117 Crear mi contraseña en el primer ingreso
- HU-CAP-118 Cambiar mi foto, cambiar mi contraseña y restablecer la de otros
- HU-CAP-201 Definir los días y horas de trabajo de cada persona y quién cubre un descanso

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.

**Fuera de alcance**

- Roles, permisos y escritorio: FT-USR-02.
- Crédito del personal: FT-USR-03.
- Registro de asistencia (horizonte futuro).
- Ingreso con Google o con código por SMS (no pedido).

**Preguntas abiertas**

1. **Política de contraseñas** — D-17.
2. **¿La contraseña inicial común se mantiene?** Riesgo de seguridad; propuesta: generarla al azar por usuario (pendiente de Kevin).

---

Generado por IA: BRD (NEC-CAP-047, 050, 088, 099; RN-CAP-014, 098, 119, 120), D-17 y `analisis/primer-ingreso-y-contrasenas.md` — Revisado por: *(pendiente)*
