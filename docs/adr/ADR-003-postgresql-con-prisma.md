---
id: ADR-003
tipo: adr
titulo: "Base de datos PostgreSQL con acceso por Prisma"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, D-12, DT-25, RNF-CAP-011, RNF-CAP-014, RNF-CAP-020]
tags: [adr, postgresql, prisma, datos, g3]
---

# ADR-003: Base de datos PostgreSQL con acceso por Prisma

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

El sistema mueve dinero (caja, cobros, cupones) y stock: necesita **transacciones** y restricciones fuertes. El marco Aybar propone CQRS con PostgreSQL para escribir y MongoDB para leer, pero el volumen de un solo local no lo justifica.

D-12 dejaba abierta la base de datos; José eligió PostgreSQL con Prisma (DT-25).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** **PostgreSQL 16** como única base, con **Prisma** para el acceso y las migraciones, y SQL directo para bloqueos e informes | — | Informes tan pesados que frenen la operación (entonces, réplica de lectura o vistas materializadas). |
| PostgreSQL + MongoDB (CQRS de Aybar) | Duplica piezas, RAM y sincronización para pocos miles de pedidos al mes. | Varios locales con informes en tiempo real muy pesados. |
| MySQL o MariaDB | Menos útil aquí: índices parciales, JSONB, `SELECT … FOR UPDATE SKIP LOCKED` y restricciones de exclusión. | Que el hosting solo ofrezca MySQL. |
| Drizzle o TypeORM en lugar de Prisma | Drizzle tiene menos documentación; TypeORM tiene migraciones menos fiables. | Que Prisma limite consultas complejas de forma frecuente. |

## Decisión

1. Una base `caprichos` por ambiente (producción y pruebas, DT-39). Esquemas lógicos por módulo con prefijo de tabla (`ped_`, `caj_`, `stk_`…), y el núcleo Party sin prefijo (ADR-004).
2. Montos en `numeric(12,2)` (RNF-CAP-011); cantidades de insumos en `numeric(14,3)`; fechas en `timestamptz` y reglas de día con la zona `America/Lima` (RNF-CAP-019).
3. **Nada se borra** (RNF-CAP-014): columnas `activo`, `anulado_en` y `anulado_por`, salvo las excepciones del BRD (elementos del plano y destacadas, DT-06).
4. Auditoría: `creado_por`, `creado_en`, `actualizado_por` y `actualizado_en` en toda tabla de negocio, y una tabla `auditoria` con el antes y el después de los cambios sensibles (precios, parámetros, permisos, anulaciones) (RNF-CAP-009).
5. Concurrencia con restricciones en la base, además de los bloqueos de Redis (ADR-007): un índice único parcial impide dos pedidos abiertos por mesa, otro una confirmación doble, y el canje del código único de cupón se hace con `UPDATE … WHERE estado = 'VIGENTE'` (RNF-CAP-010).
6. Las migraciones de Prisma corren en el CI antes de levantar la API (DT-41). El modelo está en `datos/DAT-CAP-001-modelo-de-datos.md` y el DDL de referencia en `datos/ddl-propuesto.sql`.

## Consecuencias

- Obliga a:
  - Revisar cada migración en el PR (expandir antes de contraer, sin borrar columnas en uso).
  - Usar SQL directo (`$queryRaw`) para bloqueos e informes.
- Impide:
  - Guardar documentos sin esquema fuera de columnas JSONB acotadas.
- Cuesta:
  - 1 a 1,5 GB de RAM en producción.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno adicional.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: todas las del modelo `datos/DAT-CAP-001`; dueño del dato: Caprichos (Kevin Rosales).
- Linaje: escritura por la API; lectura por la API y los informes. Datos personales en el núcleo Party (ADR-004, ADR-005).
- Reglas de calidad: montos cuadrados entre pedido, cobro y cierre (RNF-CAP-011); 100 % de cambios de stock con movimiento (RNF-CAP-020).

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (D-12, DT-25) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
