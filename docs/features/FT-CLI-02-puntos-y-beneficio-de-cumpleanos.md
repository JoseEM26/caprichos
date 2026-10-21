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

**Descripción.** Los puntos son un **saldo para canjear**: **1 punto = S/ 1** en cualquier producto de Caprichos; no se retira (DT-55, acta 03). Con cuenta, cada pedido suma **el 5 % del total** pagado (V8; el administrador cambia el porcentaje en Configuración del local), con dos decimales, una sola vez, cuando el pedido se cobra (RN-CAP-072): una compra de S/ 70 suma 3,50 puntos. El porcentaje es **general**, no por producto, para que el cliente entienda fácil cuánto acumula. No suman los productos o promociones marcados «No suma puntos ni aplica cupones» (DT-65) ni un pedido con cupón (DT-56). Un pedido como invitado no suma; por eso, **al terminar el pedido**, al invitado se le recuerda que puede ingresar para acumular, y al que ingresó se le muestra el resumen: puntos de esta compra y total. **Canje en el pedido:** «¿Cuántos puntos deseas usar?», con los puntos disponibles debajo, lo que queda mientras escribe y un botón **Aplicar**. Quien atiende suma puntos con solo el DNI; **ver o canjear** requiere la contraseña (RN-CAP-071). Al acercarse su cumpleaños, el cliente recibe en la campanita de la carta un cupón de cumpleaños (NEC-CAP-097).

**Beneficio esperado.** Fidelizar a los clientes frecuentes con un programa simple que se entiende en soles, sin obligar a nadie a registrarse. Kevin lo considera «generoso» y «vale la pena para mantener la fidelidad» (acta 03). Hipótesis medible: **100 % de los pedidos cobrados con cuenta suman sus puntos una sola vez**; **0 puntos sumados a pedidos anulados**; **0 canjes mayores al saldo**.

**Usuarios / roles.** ACT-CAP-006 Clientes (acumulan, ven y canjean sus puntos) · ACT-CAP-002 Cajero/a (suma y canjea puntos al cobrar) · ACT-CAP-001 Kevin Rosales, dueño y administrador (define el porcentaje de puntos).

**Pantallas de referencia.** Carta ▸ saldo en la cabecera, resumen al terminar el pedido, «Usar mis puntos», Mi cuenta, campanita; administrativo ▸ Clientes ▸ puntos, cobro (`Main.dc.html`, `Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CLI-02-01 | Al cobrarse un pedido con cuenta se suma una sola vez el porcentaje configurado del total, con dos decimales. | Debería tener | NEC-CAP-036 · RN-CAP-072 · V8 · DT-55 | Dado un pedido de S/ 70,00 de un cliente con cuenta y 5 %, cuando se cobra, entonces suma 3,50 puntos; si se reimprime o se vuelve a abrir, no suma otra vez. | Propuesto |
| RQ-CLI-02-02 | Los productos marcados «No suma puntos ni aplica cupones» y los pedidos con cupón no suman puntos. | Debería tener | DT-55 · DT-56 · DT-65 | Dado un pedido con un 2×1 de frappé marcado «No suma puntos» (S/ 15) y un sándwich de S/ 20, con 5 %, cuando se cobra, entonces suma 1,00 punto (solo por el sándwich); un pedido pagado con cupón no suma. | Propuesto |
| RQ-CLI-02-03 | Un pedido como invitado no suma puntos. | Debería tener | RN-CAP-066 | Dado un pedido sin cuenta, cuando se cobra, entonces no se suman puntos a nadie. | Propuesto |
| RQ-CLI-02-04 | Anular un pedido cobrado resta los puntos que había sumado. | Debería tener | Propuesta (derivada de RN-CAP-072) | Dado un pedido que sumó 37 puntos, cuando se anula con su motivo, entonces el saldo baja 37 y el historial muestra la reversa. | Propuesto |
| RQ-CLI-02-05 | Quien atiende suma puntos con solo el DNI del cliente. | Debería tener | RN-CAP-071 | Dado un cliente con cuenta que paga en el local, cuando el cajero escribe su DNI en el pedido, entonces el pedido se asocia y suma al cobrarse, sin pedir contraseña. | Propuesto |
| RQ-CLI-02-06 | El cliente ve su saldo en la cabecera y su historial de puntos en Mi cuenta, con contraseña. | Debería tener | NEC-CAP-048 · RN-CAP-071 | Dado un cliente que ingresó, cuando abre Mi cuenta, entonces ve su saldo y cada movimiento con fecha, pedido y puntos. | Propuesto |
| RQ-CLI-02-07 | El cliente recibe en la campanita un cupón de cumpleaños. | Debería tener | NEC-CAP-097 | Dado un cliente con cumpleaños el 20/11, cuando ingresa a la carta en la semana de su cumpleaños, entonces la campanita muestra su cupón con código y vigencia. | Propuesto |
| RQ-CLI-02-08 | El porcentaje de puntos se cambia en Configuración del local y vale desde ese momento. | Debería tener | NEC-CAP-087 · DT-55 | Dado 5 %, cuando el administrador lo cambia a 3 % con Sí/No, entonces los pedidos cobrados desde entonces suman el 3 % y los anteriores no cambian; el cambio queda en el Historial de acciones. | Propuesto |
| RQ-CLI-02-09 | El cajero no edita puntos. | Debe tener | RN-CAP-083 (1.ª) | Dada la ficha de un cliente abierta por el cajero, cuando busca cómo editar puntos, entonces no hay opción. | Propuesto |
| RQ-CLI-02-10 | Al terminar el pedido, el cliente con cuenta ve los puntos de esta compra y su total; el invitado ve cuánto ganaría y la opción de ingresar, sin que lo bloquee. | Debería tener | DT-55 · RN-CAP-066 · Acta 03 | Dado un cliente con 1,50 puntos que pide S/ 70, cuando termina, entonces ve «Por esta compra acumulas 3,50 puntos · Tendrás 5,00»; un invitado ve «Ingresa y gana 3,50 puntos con este pedido» y puede seguir sin ingresar. | Propuesto |
| RQ-CLI-02-11 | En el pedido, el cliente con cuenta escribe cuántos puntos usar, ve sus disponibles y lo que queda, y toca «Aplicar». | Debería tener | DT-55 · RN-CAP-071 | Dado un cliente con 3,50 puntos y un pedido de S/ 20, cuando escribe 2 en «¿Cuántos puntos deseas usar?», entonces ve «Te quedan 1,50» y al tocar «Aplicar» el total baja a S/ 18,00. | Propuesto |
| RQ-CLI-02-12 | No se canjean más puntos que el saldo ni más que el total del pedido; anular un pedido devuelve los puntos canjeados. | Debe tener | DT-55 · RNF-CAP-011 | Dado un saldo de 3,50, cuando el cliente escribe 5, entonces ve «Solo tienes 3,50 puntos» y no se aplica; si el pedido con 2 puntos canjeados se anula, el saldo vuelve a subir 2 y el historial muestra la devolución. | Propuesto |
| RQ-CLI-02-13 | En caja, el canje se hace con el DNI del cliente y su contraseña, que escribe el propio cliente. | Debería tener | RN-CAP-071 · DT-55 | Dado un cliente con cuenta en el local, cuando el cajero toca «Usar puntos» en el cobro, entonces el cliente escribe su contraseña en la pantalla de caja y el cajero indica cuántos puntos usar; sin contraseña solo se suman puntos. | Propuesto |

Prioridad *Debería tener* por la épica. RQ-CLI-02-04 es derivado: si un cobro se anula, sus puntos no pueden quedar. El canje lo definió Kevin en el acta 03 (DT-55); RQ-CLI-02-12 es *Debe tener* porque protege el saldo. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

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
| V8 | Se gana el 5 % del total con cuenta (configurable); 1 punto = S/ 1. | Acta 03 · decisiones.md |
| DT-55 | Puntos como saldo, porcentaje general, excepciones marcadas, resumen al terminar y canje en el pedido. | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CLI-02-01 | HU-CAP-026 | FT-CAJ-02 · D-25 | R-01 |
| RQ-CLI-02-02 | HU-CAP-026 | FT-CON-01 · FT-OFE-01 | R-01 |
| RQ-CLI-02-03 | HU-CAP-026 | — | R-01 |
| RQ-CLI-02-04 | HU-CAP-026 | FT-CAJ-02 | R-01 |
| RQ-CLI-02-05 | HU-CAP-026 | — | R-01 |
| RQ-CLI-02-06 | HU-CAP-027 | — | R-01 |
| RQ-CLI-02-07 | HU-CAP-028 | FT-OFE-03 | R-01 |
| RQ-CLI-02-08 | HU-CAP-026 | FT-CFG-02 | R-01 |
| RQ-CLI-02-09 | HU-CAP-027 | — | R-01 |
| RQ-CLI-02-10 | HU-CAP-195 | — | R-01 |
| RQ-CLI-02-11 | HU-CAP-195 | — | R-01 |
| RQ-CLI-02-12 | HU-CAP-195 | FT-CAJ-02 | R-01 |
| RQ-CLI-02-13 | HU-CAP-195 | FT-CAJ-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-026 Sumar puntos al cobrar un pedido con cuenta
- HU-CAP-027 Ver mi saldo e historial de puntos
- HU-CAP-028 Recibir mi cupón de cumpleaños
- HU-CAP-195 Ver cuántos puntos gano y canjearlos en mi pedido

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.

**Fuera de alcance**

- Crear y gestionar la cuenta: FT-CLI-01.
- Niveles del programa: horizonte futuro.
- Cómo se configura el cupón de cumpleaños como cupón: FT-OFE-03.

**Preguntas abiertas**

1. **¿Sobre qué se calcula el 5 %?** — D-25 resuelta (DT-73, 21/10/2026): solo productos, sin envío ni lo pagado con puntos.
2. **¿Los puntos vencen?** Propuesta: no vencen en la primera versión.
3. **Beneficio de cumpleaños** — qué descuento y cuántos días vale (pendiente de Kevin).

---

Generado por IA: BRD (NEC-CAP-036, 048, 087, 097; RN-CAP-066, 071, 072, 083), DT-55, DT-56, DT-65, V8 y D-25 de decisiones.md, acta 03 y el mockup — Revisado por: *(pendiente)*
