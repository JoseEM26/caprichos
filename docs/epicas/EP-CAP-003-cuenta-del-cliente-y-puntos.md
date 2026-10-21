---
id: EP-CAP-003
tipo: spec
titulo: "EP-CAP-003 Cuenta del cliente y puntos"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-024, NEC-CAP-036, NEC-CAP-048, NEC-CAP-057, NEC-CAP-064, NEC-CAP-097]
tags: [epica, plt-02, g1, clientes, deberia-tener]
---

# EP-CAP-003 — Cuenta del cliente y puntos

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-003 |
| NOMBRE | Cuenta del cliente y puntos |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Caprichos no sabe quiénes son sus clientes frecuentes ni tiene un programa para premiarlos. Al mismo tiempo, obligar a crear cuenta espanta a quien solo quiere pedir.

**Usuarios / segmentos**

- ACT-CAP-006: clientes que quieren acumular puntos o pedir como invitados
- ACT-CAP-002: cajero/a, que crea y busca clientes
- ACT-CAP-001: el dueño, que define el beneficio

**Evidencia**

- NEC-CAP-024, NEC-CAP-036 y NEC-CAP-048: cuenta opcional y puntos.
- NEC-CAP-057: cuenta con DNI y contraseña.
- NEC-CAP-097: cumpleaños y cupón de cumpleaños.
- Mockup: «Ingresar» en la carta y Usuarios ▸ Clientes.

**Alineamiento estratégico**

- Fidelización de clientes frecuentes (BRD §4 Siguiente).
- NEC-CAP-036 Nunca se obliga a crear cuenta.

## 2 OBJETIVOS

**Objetivo de negocio**

Conocer y premiar a los clientes frecuentes sin perder ventas de quienes compran como invitados.

**Objetivo del usuario**

Que el cliente vea sus puntos y su beneficio de cumpleaños, y que pueda seguir comprando sin cuenta.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Pedidos hechos con cuenta | Por medir | 30 % (propuesta) | Registro de pedidos | Mensual |
| Clientes con cuenta que vuelven a pedir en 30 días | Por medir | Por definir (propuesta) | Clientes y pedidos | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Compra como invitado sin puntos o con cuenta, con visto bueno para guardar datos (RN-CAP-066).
- Cuenta con DNI y contraseña; correo opcional; cumpleaños obligatorio para personas (RN-CAP-110).
- El 5 % del total en puntos al cobrarse el pedido (1 punto = S/ 1), con canje en el pedido (DT-55).
- Campanita con el cupón de cumpleaños (NEC-CAP-097).
- Crear, buscar y editar clientes en caja sin cambiar el documento (RN-CAP-083).

**Fuera de alcance (OUT)**

- Niveles del programa de puntos (horizonte futuro).
- Canje de puntos: a definir con el dueño (D-15).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-CLI-01 | Cuenta del cliente | Debería tener | Redactada en draft: [`FT-CLI-01-cuenta-del-cliente.md`](../features/FT-CLI-01-cuenta-del-cliente.md) |
| FT-CLI-02 | Puntos y beneficio de cumpleaños | Debería tener | Redactada en draft: [`FT-CLI-02-puntos-y-beneficio-de-cumpleanos.md`](../features/FT-CLI-02-puntos-y-beneficio-de-cumpleanos.md) |

**Supuestos**

- El cliente acepta dar su DNI a cambio de puntos.

**Restricciones**

- El DNI se guarda solo con aceptación y se muestra enmascarado (RN-CAP-071).

**Dependencias y riesgos**

- D-18 Datos personales.
- D-15 Qué se canjea con los puntos.

**Criterios de éxito / salida**

- Un cliente compra como invitado sin crear cuenta.
- Un cliente con cuenta suma puntos al cobrarse su pedido y los ve en la carta.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-024, NEC-CAP-036, NEC-CAP-048, NEC-CAP-057, NEC-CAP-064, NEC-CAP-097, RN-CAP-066, RN-CAP-071, RN-CAP-083, RN-CAP-110) — Revisado por: *(pendiente)*
