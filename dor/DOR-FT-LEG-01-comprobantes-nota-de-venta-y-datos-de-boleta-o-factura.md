---
id: DOR-FT-LEG-01
tipo: spec
titulo: "Definition of Ready — FT-LEG-01 Comprobantes: nota de venta y datos de boleta o factura"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-020, FT-LEG-01, HU-CAP-170, HU-CAP-171, HU-CAP-172, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, FT-CFG-01, FT-OFE-03]
tags: [dor, plt-05, legal, ft-leg-01, g4]
---

# PLT-05 · DEFINITION OF READY — FT-LEG-01 Comprobantes: nota de venta y datos de boleta o factura

**Frente LEGAL · módulo `legal` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-020 Comprobantes y obligaciones legales · FT-LEG-01 Comprobantes: nota de venta y datos de boleta o factura |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-LEG-01`, sus 3 historias (HU-CAP-170, HU-CAP-171, HU-CAP-172), la épica EP-CAP-020, los ADR ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-020 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 3 historias, 5 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☐ | Reglas de negocio documentadas y validadas | Documentadas; abiertas: D-07 |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-020.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-LEG-01; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-011, RNF-CAP-008, RNF-CAP-014; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 5 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_LEG_01["FT-LEG-01<br>Comprobantes: nota de venta y datos de boleta o factura"]:::evaluado
  HU_CAP_170["HU-CAP-170"]:::evaluado --> FT_LEG_01
  HU_CAP_171["HU-CAP-171"]:::evaluado --> FT_LEG_01
  HU_CAP_172["HU-CAP-172"]:::evaluado --> FT_LEG_01
  FT_CFG_01["FT-CFG-01"]:::interna --> FT_LEG_01
  FT_OFE_03["FT-OFE-03"]:::interna --> FT_LEG_01
  ADR_001["ADR-001"]:::interna -.-> FT_LEG_01
  ADR_011["ADR-011"]:::interna -.-> FT_LEG_01
  ADR_014["ADR-014"]:::interna -.-> FT_LEG_01
  ADR_004["ADR-004"]:::interna -.-> FT_LEG_01
  ADR_005["ADR-005"]:::interna -.-> FT_LEG_01
  DEP_02["DEP-02"]:::externa ==> FT_LEG_01
  DEP_06["DEP-06"]:::externa ==> FT_LEG_01
  DEP_13["DEP-13"]:::externa ==> FT_LEG_01
```

- **Ítems evaluados:** FT-LEG-01 y sus historias HU-CAP-170, HU-CAP-171, HU-CAP-172.
- **Dependencias técnicas:** FT-CFG-01, FT-OFE-03; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-004, ADR-005.
- **Dependencias externas:** DEP-02, DEP-06, DEP-13.
- **Decisiones abiertas:** D-07.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-004, ADR-005 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |
| DEP-13 | Ver roadmap PLT-01 | Externa | Kevin | Según roadmap | Abierto |
| D-07 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  PEDIDO ||--o{ RECLAMO : ""
  PARTY ||--o{ CONSENT : ""
  DATA_REQUEST {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `pedido`, `reclamo`, `party`, `consent`, `data_request`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-170<br>Elegir el comprobante y sus datos"]
  P1["HU-CAP-171<br>Imprimir y reimprimir la nota de venta"]
  P0 --> P1
  P2["HU-CAP-172<br>Ver los comprobantes por emitir en el facturador"]
  P1 --> P2
```

Ciclo de vida de **reclamo**:

```mermaid
stateDiagram-v2
  [*] --> REGISTRADO : constancia
  REGISTRADO --> RESPONDIDO : dentro del plazo
  RESPONDIDO --> [*]
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["Carta web"]
    C1["Administrativo PWA"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo legal"]
  end
  subgraph Datos
    PG[("PostgreSQL")]
    RD[("Redis · colas")]
  end
  C0 --> CF
  C1 --> CF
  G --> M
  M --> PG
  M --> RD
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-004 Modelo de personas y organizaciones con el patrón Party simple; ADR-005 Datos personales: consentimiento, enmascarado y conservación (Ley 29733) |
| Integración | Solo internos (PostgreSQL, Redis, WebSocket) |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008); datos personales (ADR-005) |
| Datos personales | Sí: ver ADR-005 y DAT-CAP-001 §7 |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-LEG-01-01 | Si no se resuelve «¿La nota de venta es válida para el negocio? Revisión con el contador (D-07)», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-004, ADR-005 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06); decisiones abiertas D-07. Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-LEG-01, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
