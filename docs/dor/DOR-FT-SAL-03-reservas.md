---
id: DOR-FT-SAL-03
tipo: spec
titulo: "Definition of Ready — FT-SAL-03 Reservas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-03, HU-CAP-065, HU-CAP-066, HU-CAP-067, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, FT-CFG-01, FT-CFG-02, FT-SAL-01, FT-SAL-02]
tags: [dor, plt-05, salon, ft-sal-03, g4]
---

# PLT-05 · DEFINITION OF READY — FT-SAL-03 Reservas

**Frente SALON · módulo `salon` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-007 Salón: plano, mesas, pedido del mozo y reservas · FT-SAL-03 Reservas |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-SAL-03`, sus 3 historias (HU-CAP-065, HU-CAP-066, HU-CAP-067), la épica EP-CAP-007, los ADR ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-007 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 3 historias, 9 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☑ | Reglas de negocio documentadas y validadas | Documentadas en la feature §4; sin decisiones abiertas propias |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-007.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-SAL-03; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-019, RNF-CAP-008, RNF-CAP-012; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 9 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_SAL_03["FT-SAL-03<br>Reservas"]:::evaluado
  HU_CAP_065["HU-CAP-065"]:::evaluado --> FT_SAL_03
  HU_CAP_066["HU-CAP-066"]:::evaluado --> FT_SAL_03
  HU_CAP_067["HU-CAP-067"]:::evaluado --> FT_SAL_03
  FT_CFG_01["FT-CFG-01"]:::interna --> FT_SAL_03
  FT_CFG_02["FT-CFG-02"]:::interna --> FT_SAL_03
  FT_SAL_01["FT-SAL-01"]:::interna --> FT_SAL_03
  FT_SAL_02["FT-SAL-02"]:::interna --> FT_SAL_03
  ADR_001["ADR-001"]:::interna -.-> FT_SAL_03
  ADR_011["ADR-011"]:::interna -.-> FT_SAL_03
  ADR_014["ADR-014"]:::interna -.-> FT_SAL_03
  ADR_006["ADR-006"]:::interna -.-> FT_SAL_03
  ADR_007["ADR-007"]:::interna -.-> FT_SAL_03
  DEP_02["DEP-02"]:::externa ==> FT_SAL_03
  DEP_06["DEP-06"]:::externa ==> FT_SAL_03
```

- **Ítems evaluados:** FT-SAL-03 y sus historias HU-CAP-065, HU-CAP-066, HU-CAP-067.
- **Dependencias técnicas:** FT-CFG-01, FT-CFG-02, FT-SAL-01, FT-SAL-02; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** ninguna propia.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-006, ADR-007 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  PISO ||--o{ PISO : ""
  ELEMENTO_PLANO ||--o{ PEDIDO_MESA : ""
  PEDIDO ||--o{ PEDIDO_MESA : ""
  ELEMENTO_PLANO ||--o{ RESERVA_MESA : ""
  RESERVA ||--o{ RESERVA_MESA : ""
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `piso`, `elemento_plano`, `pedido`, `pedido_mesa`, `reserva`, `reserva_mesa`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-065<br>Registrar una reserva con una o varias mesas"]
  P1["HU-CAP-066<br>Ver la reserva en el plano, sentarla o dejar que venza"]
  P0 --> P1
  P2["HU-CAP-067<br>Ver las reservas en el calendario del mes"]
  P1 --> P2
```

Ciclo de vida de **reserva**:

```mermaid
stateDiagram-v2
  [*] --> ACTIVA
  ACTIVA --> SENTADA : sentar
  ACTIVA --> NO_ASISTIO : vence tolerancia
  ACTIVA --> CANCELADA : motivo
  SENTADA --> [*]
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["Tablet del mozo PWA"]
    C1["Administrativo PWA"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo salon"]
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
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-006 Tiempo real con WebSocket (Socket.IO) y salas por área, rol y mesa; ADR-007 Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ |
| Integración | Solo internos (PostgreSQL, Redis, WebSocket) |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008); datos personales (ADR-005) |
| Datos personales | Sí: ver ADR-005 y DAT-CAP-001 §7 |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-SAL-03-01 | Si no se resuelve «¿Se avisa al cliente un recordatorio de su reserva? No está en el BRD; propuesta: no en la primera versión», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-006, ADR-007 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06). Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-SAL-03, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
