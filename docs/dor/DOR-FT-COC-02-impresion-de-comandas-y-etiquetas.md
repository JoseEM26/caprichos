---
id: DOR-FT-COC-02
tipo: spec
titulo: "Definition of Ready — FT-COC-02 Impresión de comandas y etiquetas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-02, HU-CAP-051, HU-CAP-052, HU-CAP-053, HU-CAP-054, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, FT-CAR-01, FT-CFG-02, FT-COC-01, FT-PED-03]
tags: [dor, plt-05, cocina, ft-coc-02, g4]
---

# PLT-05 · DEFINITION OF READY — FT-COC-02 Impresión de comandas y etiquetas

**Frente COCINA · módulo `cocina` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-006 Cocina por áreas e impresión · FT-COC-02 Impresión de comandas y etiquetas |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-COC-02`, sus 4 historias (HU-CAP-051, HU-CAP-052, HU-CAP-053, HU-CAP-054), la épica EP-CAP-006, los ADR ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-006 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 4 historias, 10 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☐ | Reglas de negocio documentadas y validadas | Documentadas; abiertas: D-13 |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-006.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-COC-02; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-013, RNF-CAP-003; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 10 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_COC_02["FT-COC-02<br>Impresión de comandas y etiquetas"]:::evaluado
  HU_CAP_051["HU-CAP-051"]:::evaluado --> FT_COC_02
  HU_CAP_052["HU-CAP-052"]:::evaluado --> FT_COC_02
  HU_CAP_053["HU-CAP-053"]:::evaluado --> FT_COC_02
  HU_CAP_054["HU-CAP-054"]:::evaluado --> FT_COC_02
  FT_CAR_01["FT-CAR-01"]:::interna --> FT_COC_02
  FT_CFG_02["FT-CFG-02"]:::interna --> FT_COC_02
  FT_COC_01["FT-COC-01"]:::interna --> FT_COC_02
  FT_PED_03["FT-PED-03"]:::interna --> FT_COC_02
  ADR_001["ADR-001"]:::interna -.-> FT_COC_02
  ADR_011["ADR-011"]:::interna -.-> FT_COC_02
  ADR_014["ADR-014"]:::interna -.-> FT_COC_02
  ADR_002["ADR-002"]:::interna -.-> FT_COC_02
  ADR_006["ADR-006"]:::interna -.-> FT_COC_02
  ADR_007["ADR-007"]:::interna -.-> FT_COC_02
  DEP_02["DEP-02"]:::externa ==> FT_COC_02
  DEP_03["DEP-03"]:::externa ==> FT_COC_02
  DEP_06["DEP-06"]:::externa ==> FT_COC_02
```

- **Ítems evaluados:** FT-COC-02 y sus historias HU-CAP-051, HU-CAP-052, HU-CAP-053, HU-CAP-054.
- **Dependencias técnicas:** FT-CAR-01, FT-CFG-02, FT-COC-01, FT-PED-03; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.
- **Dependencias externas:** DEP-02, DEP-03, DEP-06.
- **Decisiones abiertas:** D-13.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |
| DEP-03 | Ver roadmap PLT-01 | Externa | Kevin | Según roadmap | Abierto |
| D-13 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  AREA_COCINA ||--o{ CATEGORIA : ""
  AREA_COCINA ||--o{ COMANDA_AREA : ""
  PEDIDO ||--o{ COMANDA_AREA : ""
  AREA_COCINA ||--o{ PRINT_JOB : ""
  PEDIDO ||--o{ PRINT_JOB : ""
  AREA_COCINA ||--o{ ALTA_DEMANDA : ""
  AGOTADO {
    bigint id PK
  }
  DEVICE_KEY {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `area_cocina`, `categoria`, `pedido`, `comanda_area`, `print_job`, `agotado`, `alta_demanda`, `device_key`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-051<br>Imprimir la comanda por área al pasar a cocina"]
  P1["HU-CAP-052<br>Imprimir las etiquetas general, por área y por bebida"]
  P0 --> P1
  P2["HU-CAP-053<br>Activar o desactivar tipos de etiqueta"]
  P1 --> P2
  P3["HU-CAP-054<br>Recibir la alerta de fallo y reimprimir"]
  P2 --> P3
```

Ciclo de vida de **comanda por área**:

```mermaid
stateDiagram-v2
  [*] --> NUEVO
  NUEVO --> EN_PREPARACION : toque
  EN_PREPARACION --> NUEVO : deshacer
  EN_PREPARACION --> LISTO : toque
  LISTO --> EN_PREPARACION : deshacer
  LISTO --> [*] : despejar (no cambia estado)
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["Pantallas de cocina PWA"]
    C1["TV de cocina"]
    C2["Agente local"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo cocina"]
  end
  subgraph Datos
    PG[("PostgreSQL")]
    RD[("Redis · colas")]
  end
  C0 --> CF
  C1 --> CF
  C2 --> CF
  G --> M
  M --> PG
  M --> RD
  M --> X0["Ticketeras ESC/POS"]
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-002 Impresión de comandas y etiquetas con un agente local ESC/POS; ADR-006 Tiempo real con WebSocket (Socket.IO) y salas por área, rol y mesa; ADR-007 Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ |
| Integración | Externos: Ticketeras ESC/POS |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-08 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-COC-02-01 | Si no se resuelve «Modelo y conexión de ticketeras y etiqueteras», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-COC-02-02 | Si no se resuelve «Tamaño de la etiqueta adhesiva», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06); decisiones abiertas D-13. Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-COC-02, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
