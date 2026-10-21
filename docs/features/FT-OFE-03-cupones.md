---
id: FT-OFE-03
tipo: spec
titulo: "Cupones"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-02, FT-PED-01, FT-CAJ-03, FT-LEG-01, FT-CLI-02, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, NEC-CAP-035, NEC-CAP-054, NEC-CAP-111, RN-CAP-069, RN-CAP-133, RN-CAP-134, RN-CAP-135]
tags: [ofertas, plt-03, ep-cap-012, ft-ofe-03, deberia-tener]
---

# FT-OFE-03 — Cupones

**PLT-03 · Feature · Catálogo de requerimientos** · Frente OFERTAS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-OFE-03 | Cupones | EP-CAP-012 Promociones, descuentos y cupones |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-035 · NEC-CAP-054 · NEC-CAP-111) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cupones de descuento completos: código, porcentaje o monto, compra mínima, vigencia, usos máximos y por cliente, categoría o producto, canal y si requiere cuenta (NEC-CAP-035). Hay dos modos (RN-CAP-134, DT-56): **código único en el comprobante** (distinto por comprobante, al azar, no correlativo y de un solo uso, que vence a los N días de emitido, 15 por defecto; lo usa **quien traiga el código**, en el local o en la carta) y **código de campaña con tope** (el mismo para todos, para volantes, transmisiones en vivo y redes, con tope de usos obligatorio —por ejemplo, los primeros 50— y máximo por cliente cuando pide con cuenta). **Un cupón por compra**; no se junta con otras promociones y el pedido con cupón no suma puntos (DT-56). Los cupones no se asignan a mano: al imprimir el comprobante salen abajo hasta N cupones (de 1 a 3, 2 por defecto), **sorteados al azar** entre los de código único activos; el sorteo se guarda y reimprimir da los mismos (RN-CAP-135). Se registra cada **emisión y canje** (vigente, canjeado, vencido, anulado), el administrador puede **anular** uno, y la carta **bloquea el campo 5 minutos tras 5 intentos fallidos** (RN-CAP-133, V11). CRUD completo (crear, editar, desactivar, ordenar) con historial de cambios e impresiones (NEC-CAP-054). Detalle en `analisis/cupones.md`.

**Seguridad.** Un código único no se puede adivinar ni reusar; el bloqueo por intentos evita probar códigos al azar.

**Beneficio esperado.** Que el cliente vuelva (cupón en su comprobante) y que las campañas en redes tengan un tope de costo. Hipótesis medible: **0 cupones de código único canjeados dos veces** y **tasa de canje medida por cupón**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (crea, ordena y anula cupones) · ACT-CAP-006 Clientes (los canjean) · ACT-CAP-002 Cajero/a (imprime el comprobante con cupones).

**Pantallas de referencia.** Administrativo ▸ Ofertas y descuentos ▸ Cupones, Cupones emitidos, historial; carta ▸ campo de cupón (`Admin.dc.html`, `Main.dc.html`); `analisis/cupones.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-OFE-03-01 | El administrador crea un cupón con descuento, mínimo, vigencia, alcance, canal y si requiere cuenta. | Debería tener | NEC-CAP-035 | Dado el formulario, cuando crea «20 % en Dúo, mínimo S/ 30, carta, 7 días», entonces queda guardado y aparece en la lista. | Propuesto |
| RQ-OFE-03-02 | Un cupón es de código único en el comprobante o de código compartido con tope obligatorio. | Debería tener | RN-CAP-134 | Dado un cupón compartido, cuando se intenta guardar sin tope de usos, entonces no se acepta. | Propuesto |
| RQ-OFE-03-03 | Al imprimir el comprobante salen hasta N cupones sorteados al azar entre los de código único activos. | Debería tener | RN-CAP-135 · NEC-CAP-054 | Dados 4 cupones de código único activos y N = 2, cuando se imprime un comprobante, entonces salen 2 elegidos al azar; reimprimirlo da los mismos 2. | Propuesto |
| RQ-OFE-03-04 | Cada cupón impreso lleva un código único, al azar y no correlativo, que vence a los N días de la compra. | Debería tener | RN-CAP-133 · RN-CAP-069 | Dados dos comprobantes seguidos, cuando se imprimen, entonces sus códigos no son consecutivos ni predecibles y cada uno vence a los días definidos. | Propuesto |
| RQ-OFE-03-05 | Los cupones compartidos no se imprimen. | Debería tener | RN-CAP-135 | Dado un cupón compartido activo, cuando se imprime un comprobante, entonces no aparece. | Propuesto |
| RQ-OFE-03-06 | Un pedido acepta un solo cupón, que no se junta con promociones ni con productos marcados «No suma puntos ni aplica cupones». | Debería tener | DT-56 · DT-65 | Dado un pedido con un cupón aplicado, cuando el cliente escribe otro, entonces ve «Solo se puede usar un cupón por compra»; en una línea con promoción o marcada, el cupón no descuenta. | Propuesto |
| RQ-OFE-03-07 | El cliente canjea el cupón escribiendo el código completo; el de código único vale una sola vez. | Debería tener | RN-CAP-133 | Dado un código ya canjeado, cuando otro cliente lo escribe, entonces ve «Este cupón ya se usó». | Propuesto |
| RQ-OFE-03-08 | El cupón compartido respeta su tope de usos y el máximo por cliente con cuenta. | Debería tener | RN-CAP-134 | Dado un tope de 100 usos con 100 canjes, cuando alguien lo escribe, entonces ve «Se agotaron los usos». | Propuesto |
| RQ-OFE-03-09 | Tras 5 intentos fallidos, el campo de cupón se bloquea 5 minutos. | Debería tener | RN-CAP-133 · V11 | Dados 5 códigos inválidos seguidos, cuando el cliente intenta un sexto, entonces el campo queda bloqueado 5 minutos. | Propuesto |
| RQ-OFE-03-10 | Se registra cada emisión y canje con su estado: vigente, canjeado, vencido o anulado. | Debería tener | RN-CAP-133 | Dado un cupón emitido hace 8 días con validez de 7, cuando el administrador abre Cupones emitidos, entonces aparece «Vencido». | Propuesto |
| RQ-OFE-03-11 | El administrador anula un cupón emitido. | Debería tener | RN-CAP-133 | Dado un cupón vigente, cuando el administrador lo anula con motivo y Sí/No, entonces queda «Anulado» y no se puede canjear. | Propuesto |
| RQ-OFE-03-12 | Los cupones se crean, editan, desactivan y ordenan, con historial de cambios e impresiones. | Debería tener | NEC-CAP-054 · RN-CAP-069 | Dado un cupón, cuando el administrador cambia su porcentaje, entonces el historial muestra el cambio con autor y fecha; no hay opción de eliminar. | Propuesto |

Prioridad *Debería tener* por la épica. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-010 aplica a dos canjes simultáneos del mismo código único: solo uno vale.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-069 | Un cupón impreso lleva su código y vale los días que defina; los cupones se desactivan y todo cambio queda en el historial. | Pedido del 17/10 |
| RN-CAP-133 | Código único al azar, un solo uso, vence a los N días; estados de emisión; bloqueo 5 intentos / 5 minutos. | Observación del dueño 19/10 |
| RN-CAP-134 | Dos modos: código único en el comprobante o código compartido con tope. | Decisión del dueño 19/10 |
| RN-CAP-135 | Hasta N cupones al azar por comprobante; el sorteo se guarda; los compartidos no se imprimen. | Decisión del dueño 19/10 |
| V11 | Bloqueo de 5 intentos fallidos durante 5 minutos. | decisiones.md |
| DT-56 | Cupón impreso de 1 a 3 por ticket, 15 días, un uso, para quien traiga el código; cupón de campaña con tope; uno por compra, sin puntos ni promociones. | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-OFE-03-01 | HU-CAP-112 | — | R-01 |
| RQ-OFE-03-02 | HU-CAP-112 | — | R-01 |
| RQ-OFE-03-03 | HU-CAP-113 | FT-LEG-01 | R-01 |
| RQ-OFE-03-04 | HU-CAP-113 | — | R-01 |
| RQ-OFE-03-05 | HU-CAP-113 | — | R-01 |
| RQ-OFE-03-06 | HU-CAP-114 | FT-OFE-02 | R-01 |
| RQ-OFE-03-07 | HU-CAP-114 | FT-PED-01 | R-01 |
| RQ-OFE-03-08 | HU-CAP-114 | FT-CLI-01 | R-01 |
| RQ-OFE-03-09 | HU-CAP-114 | — | R-11 |
| RQ-OFE-03-10 | HU-CAP-115 | — | R-01 |
| RQ-OFE-03-11 | HU-CAP-115 | — | R-01 |
| RQ-OFE-03-12 | HU-CAP-115 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-112 Crear y gestionar cupones de los dos modos
- HU-CAP-113 Imprimir cupones sorteados en el comprobante
- HU-CAP-114 Canjear un cupón en la carta o en caja
- HU-CAP-115 Ver, vencer y anular cupones emitidos

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.

**Fuera de alcance**

- Descuentos automáticos y acumulación: FT-OFE-02.
- Cupón de cumpleaños: FT-CLI-02 (usa esta feature).

**Preguntas abiertas**

1. **Días de vigencia por defecto** — resuelto en el acta 03: 15 días desde que se emite (DT-56), configurable.

---

Generado por IA: BRD (NEC-CAP-035, 054, 111; RN-CAP-069, 133 a 135), V11, DT-56, acta 03 y `analisis/cupones.md` — Revisado por: *(pendiente)*
