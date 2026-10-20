---
id: DOR-FT-STK-03
tipo: spec
titulo: "Definition of Ready — FT-STK-03 Descuento por venta y disponibilidad"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-03, HU-CAP-085, HU-CAP-086, HU-CAP-087, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, FT-ALM-01, FT-CAR-02, FT-INF-03, FT-OFE-01, FT-STK-02]
tags: [dor, plt-05, stock, ft-stk-03, g4]
---

# PLT-05 · DEFINITION OF READY — FT-STK-03 Descuento por venta y disponibilidad

**Frente STOCK · módulo `stock` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-009 Stock y recetas · FT-STK-03 Descuento por venta y disponibilidad |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H2 · 01/03/2027 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-STK-03`, sus 3 historias (HU-CAP-085, HU-CAP-086, HU-CAP-087), la épica EP-CAP-009, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-009 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debería tener · H2 · 01/03/2027 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 3 historias, 8 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☑ | Reglas de negocio documentadas y validadas | Documentadas en la feature §4; sin decisiones abiertas propias |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-009.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-STK-03; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-020, RNF-CAP-002, RNF-CAP-011; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 8 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_STK_03["FT-STK-03<br>Descuento por venta y disponibilidad"]:::evaluado
  HU_CAP_085["HU-CAP-085"]:::evaluado --> FT_STK_03
  HU_CAP_086["HU-CAP-086"]:::evaluado --> FT_STK_03
  HU_CAP_087["HU-CAP-087"]:::evaluado --> FT_STK_03
  FT_ALM_01["FT-ALM-01"]:::interna --> FT_STK_03
  FT_CAR_02["FT-CAR-02"]:::interna --> FT_STK_03
  FT_INF_03["FT-INF-03"]:::interna --> FT_STK_03
  FT_OFE_01["FT-OFE-01"]:::interna --> FT_STK_03
  FT_STK_02["FT-STK-02"]:::interna --> FT_STK_03
  ADR_001["ADR-001"]:::interna -.-> FT_STK_03
  ADR_011["ADR-011"]:::interna -.-> FT_STK_03
  ADR_014["ADR-014"]:::interna -.-> FT_STK_03
  ADR_003["ADR-003"]:::interna -.-> FT_STK_03
  ADR_007["ADR-007"]:::interna -.-> FT_STK_03
  DEP_02["DEP-02"]:::externa ==> FT_STK_03
  DEP_06["DEP-06"]:::externa ==> FT_STK_03
```

- **Ítems evaluados:** FT-STK-03 y sus historias HU-CAP-085, HU-CAP-086, HU-CAP-087.
- **Dependencias técnicas:** FT-ALM-01, FT-CAR-02, FT-INF-03, FT-OFE-01, FT-STK-02; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** ninguna propia.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-007 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  LUGAR_STOCK ||--o{ LUGAR_STOCK : ""
  INSUMO ||--o{ STOCK : ""
  LUGAR_STOCK ||--o{ STOCK : ""
  PRODUCTO ||--o{ STOCK : ""
  PRODUCTO ||--o{ RECETA : ""
  INSUMO ||--o{ RECETA_LINEA : ""
  OPCION ||--o{ RECETA_LINEA : ""
  RECETA ||--o{ RECETA_LINEA : ""
  INSUMO ||--o{ MOVIMIENTO_STOCK : ""
  LUGAR_STOCK ||--o{ MOVIMIENTO_STOCK : ""
  MOVIMIENTO_STOCK ||--o{ MOVIMIENTO_STOCK : ""
  PRODUCTO ||--o{ MOVIMIENTO_STOCK : ""
  AJUSTE_OPCION {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `insumo`, `lugar_stock`, `stock`, `receta`, `receta_linea`, `ajuste_opcion`, `opcion`, `movimiento_stock`, `producto`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-085<br>Descontar insumos al pasar un pedido a cocina"]
  P1["HU-CAP-086<br>Devolver insumos al anular un pedido"]
  P0 --> P1
  P2["HU-CAP-087<br>Avisar stock negativo o bajo y apagar productos sin insumos"]
  P1 --> P2
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["Administrativo PWA"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo stock"]
  end
  subgraph Datos
    PG[("PostgreSQL")]
    RD[("Redis · colas")]
  end
  C0 --> CF
  G --> M
  M --> PG
  M --> RD
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-007 Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ |
| Integración | Solo internos (PostgreSQL, Redis, WebSocket) |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-02 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-STK-03-01 | Si no se resuelve «¿Descontar al pasar a cocina o al cobrar? Propuesta: al pasar a cocina, porque es cuando se usan los insumos», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-STK-03-02 | Si no se resuelve «¿Apagar productos automáticamente por stock desde el piloto? Propuesta: solo cuando las recetas estén completas y validadas», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-007 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06). Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-STK-03, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
