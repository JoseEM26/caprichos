---
id: FT-CLI-02
tipo: spec
titulo: "Puntos y beneficio de cumpleaños"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-003, FT-CLI-01, FT-CAJ-02, FT-OFE-03, FT-CFG-02, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008, NEC-CAP-036, NEC-CAP-097, RN-CAP-072]
tags: [clientes, plt-03, ep-cap-003, ft-cli-02, deberia-tener]
---

# FT-CLI-02 — Puntos y beneficio de cumpleaños

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CLIENTES · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CLI-02 | Puntos y beneficio de cumpleaños | EP-CAP-003 Cuenta del cliente y puntos |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-036 · NEC-CAP-097) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Con cuenta, cada pedido suma **1 punto por cada S/ 1** pagado (V8, configurable en Configuración del local), una sola vez, cuando el pedido se cobra (RN-CAP-072). Un pedido como invitado no suma. El cliente ve su saldo en la cabecera de la carta y su historial de puntos en Mi cuenta. Quien atiende suma puntos con solo el DNI; **ver o canjear** puntos requiere la contraseña (RN-CAP-071). Al acercarse su cumpleaños, el cliente recibe en la campanita de la carta un cupón de cumpleaños (NEC-CAP-097). El canje de puntos (qué se obtiene con cuántos puntos) no está definido por el cliente y queda como pregunta abierta.

**Beneficio esperado.** Fidelizar a los clientes frecuentes con un programa simple, sin obligar a nadie a registrarse. Hipótesis medible: **100 % de los pedidos cobrados con cuenta suman sus puntos una sola vez**; **0 puntos sumados a pedidos anulados**.

**Usuarios / roles.** ACT-CAP-006 Clientes (acumulan y ven sus puntos) · ACT-CAP-002 Cajero/a (suma puntos al cobrar) · ACT-CAP-001 Kevin Rosales, dueño y administrador (define puntos por sol).

**Pantallas de referencia.** Carta ▸ saldo en la cabecera, Mi cuenta, campanita; administrativo ▸ Clientes ▸ puntos (`Main.dc.html`, `Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CLI-02-01 | Al cobrarse un pedido con cuenta se suman los puntos una sola vez, según los puntos por sol configurados. | Debería tener | NEC-CAP-036 · RN-CAP-072 · V8 | Dado un pedido de S/ 37,80 de un cliente con cuenta y 1 punto por sol, cuando se cobra, entonces suma 37 puntos; si se reimprime o se vuelve a abrir, no suma otra vez. | Propuesto |
| RQ-CLI-02-02 | Un pedido como invitado no suma puntos. | Debería tener | RN-CAP-066 | Dado un pedido sin cuenta, cuando se cobra, entonces no se suman puntos a nadie. | Propuesto |
| RQ-CLI-02-03 | Anular un pedido cobrado resta los puntos que había sumado. | Debería tener | Propuesta (derivada de RN-CAP-072) | Dado un pedido que sumó 37 puntos, cuando se anula con su motivo, entonces el saldo baja 37 y el historial muestra la reversa. | Propuesto |
| RQ-CLI-02-04 | Quien atiende suma puntos con solo el DNI del cliente. | Debería tener | RN-CAP-071 | Dado un cliente con cuenta que paga en el local, cuando el cajero escribe su DNI en el pedido, entonces el pedido se asocia y suma al cobrarse, sin pedir contraseña. | Propuesto |
| RQ-CLI-02-05 | El cliente ve su saldo en la cabecera y su historial de puntos en Mi cuenta, con contraseña. | Debería tener | NEC-CAP-048 · RN-CAP-071 | Dado un cliente que ingresó, cuando abre Mi cuenta, entonces ve su saldo y cada movimiento con fecha, pedido y puntos. | Propuesto |
| RQ-CLI-02-06 | El cliente recibe en la campanita un cupón de cumpleaños. | Debería tener | NEC-CAP-097 | Dado un cliente con cumpleaños el 20/11, cuando ingresa a la carta en la semana de su cumpleaños, entonces la campanita muestra su cupón con código y vigencia. | Propuesto |
| RQ-CLI-02-07 | Los puntos por sol se cambian en Configuración del local y valen desde ese momento. | Podría tener | NEC-CAP-087 | Dado 1 punto por sol, cuando el administrador lo cambia a 2 con Sí/No, entonces los pedidos cobrados desde entonces suman el doble y los anteriores no cambian. | Propuesto |
| RQ-CLI-02-08 | El cajero no edita puntos. | Debe tener | RN-CAP-083 (1.ª) | Dada la ficha de un cliente abierta por el cajero, cuando busca cómo editar puntos, entonces no hay opción. | Propuesto |

Prioridad *Debería tener* por la épica. RQ-CLI-02-03 es derivado: si un cobro se anula, sus puntos no pueden quedar. El canje no tiene requerimiento hasta que Kevin lo defina. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-009 aplica porque cada suma o resta de puntos debe tener autor, fecha y pedido.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-071 | Sumar puntos requiere solo el DNI; ver o canjear requiere la contraseña. | BRD §5 |
| RN-CAP-072 | Los puntos se suman al cobrarse el pedido, una sola vez; el personal también suma. | Personal, caja |
| V8 | 1 punto por cada S/ 1 con cuenta. | NEC-CAP-036 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CLI-02-01 | HU-CAP-026 | FT-CAJ-02 | R-01 |
| RQ-CLI-02-02 | HU-CAP-026 | — | R-01 |
| RQ-CLI-02-03 | HU-CAP-026 | FT-CAJ-02 | R-01 |
| RQ-CLI-02-04 | HU-CAP-026 | — | R-01 |
| RQ-CLI-02-05 | HU-CAP-027 | — | R-01 |
| RQ-CLI-02-06 | HU-CAP-028 | FT-OFE-03 | R-01 |
| RQ-CLI-02-07 | HU-CAP-026 | FT-CFG-02 | R-01 |
| RQ-CLI-02-08 | HU-CAP-027 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-026 Sumar puntos al cobrar un pedido con cuenta
- HU-CAP-027 Ver mi saldo e historial de puntos
- HU-CAP-028 Recibir mi cupón de cumpleaños

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.

**Fuera de alcance**

- Crear y gestionar la cuenta: FT-CLI-01.
- Niveles del programa: horizonte futuro.
- Cómo se configura el cupón de cumpleaños como cupón: FT-OFE-03.

**Preguntas abiertas**

1. **¿Cómo se canjean los puntos?** No está en el BRD. Propuesta: canje por productos de la carta con un valor en puntos fijado por el administrador, solo en caja (pendiente de Kevin).
2. **¿Los puntos vencen?** Propuesta: no vencen en la primera versión.
3. **Beneficio de cumpleaños** — qué descuento y cuántos días vale (pendiente de Kevin).

---

Generado por IA: BRD (NEC-CAP-036, 048, 087, 097; RN-CAP-066, 071, 072, 083), V8 de decisiones.md y el mockup — Revisado por: *(pendiente)*
