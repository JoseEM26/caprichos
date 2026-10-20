---
id: ADR-014
tipo: adr
titulo: "Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, DT-49, RNF-CAP-009, RNF-CAP-008, D-18, R-11, RN-CAP-094]
tags: [adr, auditoria, seguridad, datos, g3]
---

# ADR-014: Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

El dueño necesita saber quién hizo qué: quién cambió un precio, anuló un cobro, usó el PIN, cambió permisos o vio el DNI completo de un cliente (RNF-CAP-009, RN-CAP-094). El dinero y el stock ya tienen historial propio (cobros, anulaciones, cierres, movimientos), pero los cambios de configuración, permisos y catálogo, los ingresos y las lecturas de datos sensibles no.

En el modelo inicial la tabla `auditoria` existía, pero sin pantalla, sin intentos fallidos, sin lecturas sensibles y sin protección contra cambios. José eligió el alcance, la pantalla, la protección y la conservación (DT-49).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** auditoría de **cambios sensibles, accesos y lecturas sensibles**, escrita por un interceptor de NestJS en la misma transacción, en una tabla **solo de inserción con huella encadenada**, consultable en «Historial de acciones» y conservada **2 años en línea** | — | Que un regulador pida otro plazo o que el volumen crezca mucho (entonces, particionar por mes). |
| Solo cambios sensibles | No se sabría quién intentó entrar ni quién vio un DNI (Ley 29733). | Que el registro de accesos genere demasiado ruido. |
| Auditar cada acción | Miles de filas al día; lo importante se pierde entre estados de cocina y mensajes, que ya tienen su propio historial. | Una investigación puntual (se activa por módulo). |
| Herramienta externa (registros en Loki o un SIEM) | Más piezas; los registros técnicos rotan a los 14 días y no sirven como prueba. | Varios locales o requisitos de cumplimiento mayores. |

## Decisión

1. **Qué se registra** (categoría): `CAMBIO` (precios, productos, ofertas, cupones, parámetros, horarios, zonas, permisos, usuarios, anulaciones, reaperturas, uso del PIN), `ACCESO` (ingreso, ingreso fallido, PIN fallido, cierre de sesiones, restablecer contraseña) y `LECTURA_SENSIBLE` (ver el DNI completo, abrir un comprobante de pago, exportar o anonimizar los datos de una persona, exportar informes).
2. **Cómo se escribe:** cada endpoint auditable lleva el decorador `@Auditar(modulo, accion)`; un interceptor de NestJS guarda en la **misma transacción** quién, cuándo, IP, dispositivo, número de solicitud, el antes y el después y el motivo. Si la acción falla, no queda registro de cambio; los rechazos de acceso se guardan con `resultado = RECHAZADO`.
3. **IP:** en cada registro se guarda y se muestra la IP de la solicitud, tal cual. No se clasifica ni se compara con una IP del local (se descartó: la IP del local puede cambiar, DT-50).
4. **Datos personales:** en el antes y el después, DNI y teléfonos se guardan enmascarados; nunca contraseñas, PIN ni tokens (ADR-005).
5. **Inmutable:** el usuario de la base de la API solo tiene `SELECT` e `INSERT` sobre `auditoria`; además, un trigger rechaza `UPDATE` y `DELETE`. Un trigger calcula la **huella encadenada** (`sha256` de la fila anterior más la actual, con bloqueo para que la cadena sea lineal). Una tarea diaria verifica la cadena y avisa en Uptime Kuma y por notificación si se rompió.
6. **Consulta:** pantalla «Historial de acciones» solo para `ADMIN` (FT-USR-04), con filtros por persona, módulo, acción, resultado y fechas; antes y después lado a lado; exportación a CSV (que también queda auditada). Cada ficha (pedido, producto, usuario, cliente, parámetro) tiene «Ver historial».
7. **Conservación:** 2 años en línea; luego, cada mes, las filas vencidas se exportan a un archivo comprimido y cifrado en el almacenamiento de copias (ADR-012) y se borran con un usuario de mantenimiento; la huella del último registro archivado queda como punto de partida de la cadena. Plazo por confirmar en la revisión legal (DEP-09).

## Consecuencias

- Obliga a:
  - Marcar con `@Auditar` cada endpoint de la lista; una prueba del CI falla si un endpoint de la lista no lo tiene.
  - Revisar la alerta de cadena rota.
- Impide:
  - Corregir o borrar un registro de auditoría desde la aplicación o la base con el usuario de la API.
- Cuesta:
  - Unas 300 a 800 filas al día (de 100 a 300 mil al año); unos pocos MB por año.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: ninguna; se amplía `auditoria` (categoría, módulo, resultado, motivo, IP, dispositivo, número de solicitud, huellas).
- Linaje: la API escribe; solo el administrador lee; el archivo va a las copias. **Datos personales:** quién hizo la acción y datos enmascarados del registro afectado.
- Reglas de calidad: 0 eslabones rotos en la verificación diaria; 0 endpoints auditables sin `@Auditar`.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (DT-49, D-18) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
