---
id: EP-CAP-013
tipo: spec
titulo: "EP-CAP-013 Personal, usuarios y roles"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [FT-USR-04, CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-008, NEC-CAP-010, NEC-CAP-025, NEC-CAP-088, NEC-CAP-094, NEC-CAP-099, NEC-CAP-108]
tags: [epica, plt-02, g1, usuarios, debe-tener]
---

# EP-CAP-013 — Personal, usuarios y roles

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-013 |
| NOMBRE | Personal, usuarios y roles |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Los roles y funciones del personal están desactualizados desde 2024 y todos ven todo. No hay altas ni bajas ordenadas de usuarios, y el consumo del personal a crédito se lleva aparte, sin detalle de lo que se llevó cada uno.

**Usuarios / segmentos**

- ACT-CAP-001: el dueño (administrador), que da altas, bajas y permisos
- ACT-CAP-002: cajero/a, mozos, cocina, almacén, producción, call center y repartidores, que entran con su usuario

**Evidencia**

- NEC-CAP-008 y NEC-CAP-010: roles documentados y escritorio por rol.
- NEC-CAP-088 y NEC-CAP-099: usuarios, permisos y primer ingreso.
- NEC-CAP-025, NEC-CAP-094 y NEC-CAP-108: crédito del personal, revisado por semana y por rango de fechas (DT-63).
- `analisis/modulos-y-roles.md` y `analisis/primer-ingreso-y-contrasenas.md`.

**Alineamiento estratégico**

- NEC-CAP-010 Cada persona ve solo lo que le corresponde.
- DT-15 Crédito del personal por mes.

## 2 OBJETIVOS

**Objetivo de negocio**

Que cada persona entre con su usuario y vea solo lo suyo, y que el consumo del personal quede registrado por mes para descontarlo.

**Objetivo del usuario**

Que cada trabajador entre a su escritorio con lo importante para su función y cambie su clave en el primer ingreso.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Usuarios compartidos entre varias personas | Por medir | Cero (propuesta) | Lista de usuarios | Mensual |
| Accesos a un módulo sin permiso | Por medir | Cero (RN-CAP-013) | Registro de accesos | Mensual |
| Consumos del personal sin detalle | Por medir | Cero (NEC-CAP-108) | Créditos del personal | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Altas y desactivación de usuarios; nada se elimina (RN-CAP-098).
- Primer ingreso con contraseña inicial y cambio obligatorio (RN-CAP-119).
- Permisos editables por rol y escritorio por rol (RN-CAP-013).
- Usuarios: pestañas de personal y clientes con filtros por fecha de creación y último acceso.
- Pedido del personal en el local o para llevar, solo de usuarios activos (RN-CAP-106).
- Crédito del personal: 25 % de descuento, acumulado por mes con el detalle de lo consumido, sin plazo ni abonos (RN-CAP-131).

**Fuera de alcance (OUT)**

- Registro de asistencia del personal (horizonte futuro).
- Descontar el crédito de la planilla: se hace fuera del sistema (DT-15).
- Cargar el crédito desde la carta (D-09).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-USR-01 | Usuarios y primer ingreso | Debe tener | Redactada en draft: [`FT-USR-01-usuarios-y-primer-ingreso.md`](../features/FT-USR-01-usuarios-y-primer-ingreso.md) |
| FT-USR-02 | Roles, permisos y escritorio por rol | Debe tener | Redactada en draft: [`FT-USR-02-roles-permisos-y-escritorio-por-rol.md`](../features/FT-USR-02-roles-permisos-y-escritorio-por-rol.md) |
| FT-USR-03 | Crédito del personal | Debería tener | Redactada en draft: [`FT-USR-03-credito-del-personal.md`](../features/FT-USR-03-credito-del-personal.md) |
| FT-USR-04 | Historial de acciones (auditoría) | Debe tener | Redactada en draft: [`FT-USR-04-historial-de-acciones.md`](../features/FT-USR-04-historial-de-acciones.md) (agregada el 20/10/2026, DT-49) |

**Supuestos**

- Siete roles: administrador, cajero, cocina y barra, mozo, call center, almacén y repartidor, más producción.
- El administrador es el dueño o quien él designe.

**Restricciones**

- Los usuarios no se eliminan: se desactivan (RN-CAP-098).
- Solo el administrador edita datos personales y roles.

**Dependencias y riesgos**

- D-17 Política de contraseñas del sistema real.
- D-09 Crédito desde la carta.
- R-10 Sin PO ni TL.

**Criterios de éxito / salida**

- Cada rol, al entrar, ve solo sus módulos y su escritorio; un rol sin permiso no accede a otros módulos.
- Un usuario nuevo no entra al escritorio sin crear su contraseña.
- El consumo de un trabajador se suma a su mes con el detalle de lo que se llevó.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-008, NEC-CAP-010, NEC-CAP-025, NEC-CAP-088, NEC-CAP-094, NEC-CAP-099, NEC-CAP-108, RN-CAP-013, RN-CAP-098, RN-CAP-106, RN-CAP-119, RN-CAP-131) y `analisis/modulos-y-roles.md` — Revisado por: *(pendiente)*
