---
id: DOR-FT-CAJ-02
tipo: spec
titulo: "Definition of Ready — FT-CAJ-02 Cobro con medios de pago y pago mixto"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-02, HU-CAP-033, HU-CAP-034, HU-CAP-035, HU-CAP-036, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, FT-CFG-02, FT-CIE-01, FT-CIE-02, FT-LEG-01, FT-SAL-02, FT-USR-03]
tags: [dor, plt-05, caja, ft-caj-02, g4]
---

# PLT-05 · DEFINITION OF READY — FT-CAJ-02 Cobro con medios de pago y pago mixto

**Frente CAJA · módulo `pedidos y caja` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-004 Confirmación y cobro en caja · FT-CAJ-02 Cobro con medios de pago y pago mixto |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-CAJ-02`, sus 4 historias (HU-CAP-033, HU-CAP-034, HU-CAP-035, HU-CAP-036), la épica EP-CAP-004, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-004 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 4 historias, 11 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☑ | Reglas de negocio documentadas y validadas | Documentadas en la feature §4; sin decisiones abiertas propias |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-004.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-CAJ-02; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-011, RNF-CAP-009, RNF-CAP-007, RNF-CAP-012, RNF-CAP-014; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 11 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_CAJ_02["FT-CAJ-02<br>Cobro con medios de pago y pago mixto"]:::evaluado
  HU_CAP_033["HU-CAP-033"]:::evaluado --> FT_CAJ_02
  HU_CAP_034["HU-CAP-034"]:::evaluado --> FT_CAJ_02
  HU_CAP_035["HU-CAP-035"]:::evaluado --> FT_CAJ_02
  HU_CAP_036["HU-CAP-036"]:::evaluado --> FT_CAJ_02
  FT_CFG_02["FT-CFG-02"]:::interna --> FT_CAJ_02
  FT_CIE_01["FT-CIE-01"]:::interna --> FT_CAJ_02
  FT_CIE_02["FT-CIE-02"]:::interna --> FT_CAJ_02
  FT_LEG_01["FT-LEG-01"]:::interna --> FT_CAJ_02
  FT_SAL_02["FT-SAL-02"]:::interna --> FT_CAJ_02
  FT_USR_03["FT-USR-03"]:::interna --> FT_CAJ_02
  ADR_001["ADR-001"]:::interna -.-> FT_CAJ_02
  ADR_011["ADR-011"]:::interna -.-> FT_CAJ_02
  ADR_014["ADR-014"]:::interna -.-> FT_CAJ_02
  ADR_003["ADR-003"]:::interna -.-> FT_CAJ_02
  ADR_006["ADR-006"]:::interna -.-> FT_CAJ_02
  ADR_007["ADR-007"]:::interna -.-> FT_CAJ_02
  ADR_008["ADR-008"]:::interna -.-> FT_CAJ_02
  ADR_010["ADR-010"]:::interna -.-> FT_CAJ_02
  ADR_012["ADR-012"]:::interna -.-> FT_CAJ_02
  DEP_02["DEP-02"]:::externa ==> FT_CAJ_02
  DEP_06["DEP-06"]:::externa ==> FT_CAJ_02
```

- **Ítems evaluados:** FT-CAJ-02 y sus historias HU-CAP-033, HU-CAP-034, HU-CAP-035, HU-CAP-036.
- **Dependencias técnicas:** FT-CFG-02, FT-CIE-01, FT-CIE-02, FT-LEG-01, FT-SAL-02, FT-USR-03; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** ninguna propia.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  PEDIDO ||--o{ PEDIDO_LINEA : ""
  PEDIDO_LINEA ||--o{ PEDIDO_LINEA : ""
  ARCHIVO ||--o{ COMPROBANTE_PAGO : ""
  PEDIDO ||--o{ COMPROBANTE_PAGO : ""
  CAJA ||--o{ COBRO : ""
  PEDIDO ||--o{ COBRO : ""
  COBRO ||--o{ COBRO_PAGO : ""
  ZONA_REPARTO {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `pedido`, `pedido_linea`, `comprobante_pago`, `archivo`, `cobro`, `cobro_pago`, `caja`, `zona_reparto`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-033<br>Cobrar un pedido con un medio de pago y vuelto"]
  P1["HU-CAP-034<br>Cobrar con pago mixto"]
  P0 --> P1
  P2["HU-CAP-035<br>Elegir comprobante y cobrar a crédito del personal"]
  P1 --> P2
  P3["HU-CAP-036<br>Anular un pedido con motivo y PIN"]
  P2 --> P3
```

Ciclo de vida de **pedido**:

```mermaid
stateDiagram-v2
  [*] --> POR_CONFIRMAR
  POR_CONFIRMAR --> EN_COCINA : confirmar con pago
  POR_CONFIRMAR --> RECHAZADO : motivo
  EN_COCINA --> EN_PREPARACION
  EN_PREPARACION --> LISTO
  LISTO --> COBRADO
  EN_COCINA --> ANULADO : motivo
  COBRADO --> ANULADO : PIN y caja abierta
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
    M["módulo pedidos y caja"]
  end
  subgraph Datos
    PG[("PostgreSQL")]
    RD[("Redis · colas")]
  end
  C0 --> CF
  G --> M
  M --> PG
  M --> RD
  M --> X0["Google Places · OpenStreetMap"]
  M --> X1["Copias B2/R2 · GlitchTip"]
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-006 Tiempo real con WebSocket (Socket.IO) y salas por área, rol y mesa; ADR-007 Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ; ADR-008 Autenticación propia con JWT y autorización por rol y permiso; ADR-010 Mapas: Google Places para elegir la dirección y Leaflet con zonas propias; ADR-012 Archivos en el VPS, copias de seguridad y vigilancia del sistema |
| Integración | Externos: Google Places · OpenStreetMap, Copias B2/R2 · GlitchTip |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-CAJ-02-01 | Si no se resuelve «Devolución de un cobro de una caja ya cerrada», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-CAJ-02-02 | Si no se resuelve «¿La tarjeta lleva número de operación del terminal? Propuesta: opcional», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06). Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-CAJ-02, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
