---
id: FT-CLI-01
tipo: spec
titulo: "Cuenta del cliente"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-003, FT-CLI-02, FT-CAJ-03, FT-LEG-02, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008, NEC-CAP-024, NEC-CAP-036, NEC-CAP-048, NEC-CAP-057, NEC-CAP-064, RN-CAP-066, RN-CAP-071]
tags: [clientes, plt-03, ep-cap-003, ft-cli-01, deberia-tener]
---

# FT-CLI-01 — Cuenta del cliente

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CLIENTES · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CLI-01 | Cuenta del cliente | EP-CAP-003 Cuenta del cliente y puntos |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-024 · NEC-CAP-057) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Una cuenta opcional para que el cliente acumule puntos. Se identifica con el **DNI y una contraseña**; el correo es opcional y el cumpleaños se elige en un calendario, obligatorio para personas y no para empresas (NEC-CAP-057, RN-CAP-110). La carta tiene el botón «Ingresar» con tres caminos: ingresar, crear cuenta o seguir como invitado; **nunca se obliga** (NEC-CAP-048, RN-CAP-066). Crear cuenta exige aceptar que se guarden los datos. En el local, quien atiende puede registrar a un cliente o pedir en su nombre **solo con su DNI**, nunca con su contraseña; el cliente crea su contraseña después, en la carta. En el administrativo, el cajero crea, busca por DNI completo y edita clientes sin cambiar el documento, y ve su historial de pedidos (NEC-CAP-064, RN-CAP-083). El personal usa la misma cuenta que en el administrativo y también suma puntos.

**Dato personal.** El DNI se guarda solo con aceptación, se muestra enmascarado en listas y completo solo a quien administra (RN-CAP-071, D-18).

**Beneficio esperado.** Conocer a los clientes frecuentes y habilitar el programa de puntos sin frenar la compra como invitado (NEC-CAP-024, NEC-CAP-036). Hipótesis medible: **0 pedidos bloqueados por no tener cuenta** y **100 % de cuentas con aceptación registrada**.

**Usuarios / roles.** ACT-CAP-006 Clientes (crean e ingresan a su cuenta) · ACT-CAP-002 Cajero/a (registra y busca clientes) · ACT-CAP-004 Mozos (pide en nombre de un cliente con su DNI) · ACT-CAP-001 Kevin Rosales, dueño y administrador (ve el DNI completo).

**Pantallas de referencia.** Carta ▸ «Ingresar», crear cuenta, mi cuenta; administrativo ▸ Clientes y Usuarios ▸ pestaña Clientes (`Main.dc.html`, `Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CLI-01-01 | La carta ofrece «Ingresar» con tres caminos: ingresar, crear cuenta o seguir como invitado. | Debería tener | NEC-CAP-048 | Dado un cliente sin sesión, cuando toca «Ingresar», entonces ve las tres opciones y «Seguir como invitado» lo devuelve a la carta sin pedir nada. | Propuesto |
| RQ-CLI-01-02 | Crear cuenta pide DNI, nombre, contraseña escrita dos veces, cumpleaños por calendario y aceptación; el correo es opcional. | Debería tener | NEC-CAP-057 · NEC-CAP-097 · RN-CAP-110 | Dado el formulario, cuando el cliente deja el correo vacío y acepta, entonces la cuenta se crea; sin aceptación, sin cumpleaños (persona) o con las contraseñas distintas, no. | Propuesto |
| RQ-CLI-01-03 | Un DNI no puede tener dos cuentas. | Debe tener | NEC-CAP-057 | Dado un DNI ya registrado, cuando alguien intenta crear otra cuenta con él, entonces ve «Ese DNI ya tiene cuenta» con la opción de ingresar. | Propuesto |
| RQ-CLI-01-04 | El cliente ingresa con DNI y contraseña y ve su nombre y sus puntos. | Debería tener | RN-CAP-071 · NEC-CAP-048 | Dado un cliente con cuenta, cuando ingresa con su DNI y contraseña, entonces la cabecera muestra su nombre y su saldo de puntos. | Propuesto |
| RQ-CLI-01-05 | Tras 5 intentos fallidos de contraseña, el ingreso se bloquea unos minutos. | Debería tener | D-17 · RN-CAP-120 | Dado un DNI con 5 contraseñas erradas seguidas, cuando se intenta una sexta, entonces se rechaza y se avisa cuánto falta para reintentar. | Propuesto |
| RQ-CLI-01-06 | Quien atiende registra a un cliente en el local o pide en su nombre solo con su DNI. | Debería tener | NEC-CAP-057 | Dado un cliente sin cuenta en el local, cuando el cajero lo registra con DNI, nombre, cumpleaños y aceptación, entonces queda creado sin contraseña y puede crearla después en la carta. | Propuesto |
| RQ-CLI-01-07 | Un cliente registrado en el local crea su contraseña en la carta. | Debería tener | NEC-CAP-057 | Dado un cliente sin contraseña, cuando entra a «Ingresar», escribe su DNI y confirma un dato (cumpleaños), entonces crea su contraseña y entra. | Propuesto |
| RQ-CLI-01-08 | El cajero busca un cliente por DNI completo o RUC y ve su historial de pedidos. | Debe tener | NEC-CAP-064 | Dado un cliente con 3 pedidos, cuando el cajero escribe su DNI completo, entonces lo encuentra y ve sus pedidos con fecha y total; con un DNI parcial no se muestra nada. | Propuesto |
| RQ-CLI-01-09 | El documento de un cliente no se cambia al editar; el cajero no edita puntos ni pedidos. | Debe tener | RN-CAP-083 (1.ª) | Dado un cliente, cuando el cajero lo edita, entonces el DNI o RUC aparece bloqueado y no hay campos de puntos ni pedidos. | Propuesto |
| RQ-CLI-01-10 | El DNI se muestra enmascarado en las listas y completo solo al administrador. | Debe tener | RN-CAP-071 · D-18 | Dada la lista de clientes, cuando la abre el cajero, entonces ve «4567****»; el administrador ve el DNI completo en la ficha. | Propuesto |
| RQ-CLI-01-11 | El personal usa la misma cuenta del administrativo para pedir y suma puntos. | Podría tener | NEC-CAP-057 · RN-CAP-072 | Dado un trabajador con usuario, cuando pide para sí mismo, entonces el pedido se asocia a su cuenta y suma puntos al cobrarse (FT-CLI-02). | Propuesto |

Prioridad *Debería tener* por la épica (fase Siguiente). RQ-CLI-01-03, 08, 09 y 10 son *Debe tener* porque protegen datos personales o los usa caja desde la fase Ahora. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-007 | Seguridad | Las contraseñas y PIN se guardan solo como huella (hash con sal), nunca en texto. | 0 contraseñas en texto · revisión de la base (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-007 y 008 aplican por la contraseña y el DNI; RNF-CAP-006 porque solo el administrador ve el DNI completo.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-066 | La cuenta es opcional; crear cuenta exige aceptar que se guarden los datos. | Acta 02 y 17/10 |
| RN-CAP-071 | El DNI se guarda con aceptación, se enmascara en listas; sumar puntos requiere solo el DNI; ver o canjear requiere contraseña. | BRD §5 |
| RN-CAP-083 (1.ª) | El documento de un cliente no se cambia al editar; el cajero no edita puntos, pedidos ni crédito (id repetido, O1). | Revisión del rol cajero |
| RN-CAP-110 | El cumpleaños se guarda como día y mes; obligatorio para personas. | Clientes |
| RN-CAP-120 | Recomendado: límite de intentos y contraseñas solo como huella. | Seguridad |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CLI-01-01 | HU-CAP-022 | — | R-01 |
| RQ-CLI-01-02 | HU-CAP-022 | FT-LEG-02 · D-18 | R-11 |
| RQ-CLI-01-03 | HU-CAP-022 | — | R-01 |
| RQ-CLI-01-04 | HU-CAP-023 | FT-CLI-02 | R-01 |
| RQ-CLI-01-05 | HU-CAP-023 | D-17 | R-01 |
| RQ-CLI-01-06 | HU-CAP-024 | FT-CAJ-03 | R-01 |
| RQ-CLI-01-07 | HU-CAP-024 | D-17 | R-01 |
| RQ-CLI-01-08 | HU-CAP-025 | — | R-01 |
| RQ-CLI-01-09 | HU-CAP-025 | — | R-01 |
| RQ-CLI-01-10 | HU-CAP-025 | D-18 | R-11 |
| RQ-CLI-01-11 | HU-CAP-023 | FT-USR-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-022 Crear mi cuenta o seguir como invitado
- HU-CAP-023 Ingresar a mi cuenta con DNI y contraseña
- HU-CAP-024 Registrar a un cliente en el local y que cree su contraseña
- HU-CAP-025 Buscar y editar clientes en caja

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.

**Fuera de alcance**

- Puntos, canje y cupón de cumpleaños: FT-CLI-02.
- Niveles del programa (Platino, Súper Capricho): horizonte futuro (BRD §4).
- Recuperar la contraseña por correo o SMS: pendiente (D-17).

**Preguntas abiertas**

1. **Recuperación de contraseña** — D-17. Propuesta: el cliente la recupera confirmando su cumpleaños o en el local; sin correo obligatorio no hay recuperación por correo.
2. **Plazo de conservación de los datos** — D-18 (ADR-005 propuesto).

---

Generado por IA: BRD (NEC-CAP-024, 036, 048, 057, 064, 097; RN-CAP-066, 071, 072, 083, 110, 120), decisiones D-17 y D-18 y el mockup — Revisado por: *(pendiente)*
