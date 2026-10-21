---
id: DOR-FT-CIE-01
tipo: spec
titulo: "Definition of Ready — FT-CIE-01 Apertura, movimientos y liquidación de repartidores"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-01, HU-CAP-041, HU-CAP-042, HU-CAP-043, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, FT-CAJ-02, FT-DEL-02]
tags: [dor, plt-05, cierre-caja, ft-cie-01, g4]
---

# PLT-05 · DEFINITION OF READY — FT-CIE-01 Apertura, movimientos y liquidación de repartidores

**Frente CAJA · módulo `caja` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-005 Apertura y cierre de caja · FT-CIE-01 Apertura, movimientos y liquidación de repartidores |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-CIE-01`, sus 3 historias (HU-CAP-041, HU-CAP-042, HU-CAP-043), la épica EP-CAP-005, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-005 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 3 historias, 9 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☑ | Reglas de negocio documentadas y validadas | Documentadas en la feature §4; sin decisiones abiertas propias |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-005.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-CIE-01; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-011, RNF-CAP-009, RNF-CAP-014, RNF-CAP-019; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 9 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_CIE_01["FT-CIE-01<br>Apertura, movimientos y liquidación de repartidores"]:::evaluado
  HU_CAP_041["HU-CAP-041"]:::evaluado --> FT_CIE_01
  HU_CAP_042["HU-CAP-042"]:::evaluado --> FT_CIE_01
  HU_CAP_043["HU-CAP-043"]:::evaluado --> FT_CIE_01
  FT_CAJ_02["FT-CAJ-02"]:::interna --> FT_CIE_01
  FT_DEL_02["FT-DEL-02"]:::interna --> FT_CIE_01
  ADR_001["ADR-001"]:::interna -.-> FT_CIE_01
  ADR_011["ADR-011"]:::interna -.-> FT_CIE_01
  ADR_014["ADR-014"]:::interna -.-> FT_CIE_01
  ADR_003["ADR-003"]:::interna -.-> FT_CIE_01
  ADR_008["ADR-008"]:::interna -.-> FT_CIE_01
  DEP_02["DEP-02"]:::externa ==> FT_CIE_01
  DEP_06["DEP-06"]:::externa ==> FT_CIE_01
```

- **Ítems evaluados:** FT-CIE-01 y sus historias HU-CAP-041, HU-CAP-042, HU-CAP-043.
- **Dependencias técnicas:** FT-CAJ-02, FT-DEL-02; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** ninguna propia.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-008 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  CAJA ||--o{ COBRO : ""
  COBRO ||--o{ COBRO_PAGO : ""
  CAJA ||--o{ MOVIMIENTO_CAJA : ""
  CAJA ||--o{ LIQUIDACION : ""
  CAJA ||--o{ CIERRE_CAJA : ""
  CIERRE_CAJA ||--o{ CIERRE_MEDIO : ""
  CAJA ||--o{ CONTEO_CIERRE : ""
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `caja`, `cobro`, `cobro_pago`, `movimiento_caja`, `liquidacion`, `cierre_caja`, `cierre_medio`, `conteo_cierre`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-041<br>Abrir la caja del día"]
  P1["HU-CAP-042<br>Ver ventas por medio y registrar ingresos y egresos"]
  P0 --> P1
  P2["HU-CAP-043<br>Liquidar el efectivo de un repartidor"]
  P1 --> P2
```

Ciclo de vida de **caja**:

```mermaid
stateDiagram-v2
  [*] --> ABIERTA : abrir en cero
  ABIERTA --> ABIERTA : cobros, ingresos, egresos, liquidaciones
  ABIERTA --> CERRADA : sin pendientes ni liquidaciones
  CERRADA --> [*]
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
    M["módulo caja"]
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
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-008 Autenticación propia con JWT y autorización por rol y permiso |
| Integración | Solo internos (PostgreSQL, Redis, WebSocket) |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-CIE-01-01 | Si no se resuelve «¿Hay más de un turno de caja al día? El BRD habla de una caja diaria. Propuesta: una sola apertura y un solo cierre por día», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-CIE-01-02 | Si no se resuelve «¿Qué pasa con una diferencia en la liquidación? Propuesta: se registra y no se descuenta a nadie (como RN-CAP-080)», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-008 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06). Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-CIE-01, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
