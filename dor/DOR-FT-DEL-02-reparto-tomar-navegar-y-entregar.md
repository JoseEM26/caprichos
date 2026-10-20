---
id: DOR-FT-DEL-02
tipo: spec
titulo: "Definition of Ready — FT-DEL-02 Reparto: tomar, navegar y entregar"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-02, HU-CAP-071, HU-CAP-072, HU-CAP-073, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, FT-CIE-01, FT-INF-01, FT-USR-02]
tags: [dor, plt-05, delivery, ft-del-02, g4]
---

# PLT-05 · DEFINITION OF READY — FT-DEL-02 Reparto: tomar, navegar y entregar

**Frente DELIVERY · módulo `reparto` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-008 Delivery y entregas · FT-DEL-02 Reparto: tomar, navegar y entregar |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-DEL-02`, sus 3 historias (HU-CAP-071, HU-CAP-072, HU-CAP-073), la épica EP-CAP-008, los ADR ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-008 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 3 historias, 13 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☑ | Reglas de negocio documentadas y validadas | Documentadas en la feature §4; sin decisiones abiertas propias |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-008.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-DEL-02; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-010, RNF-CAP-004, RNF-CAP-006, RNF-CAP-008; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 13 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_DEL_02["FT-DEL-02<br>Reparto: tomar, navegar y entregar"]:::evaluado
  HU_CAP_071["HU-CAP-071"]:::evaluado --> FT_DEL_02
  HU_CAP_072["HU-CAP-072"]:::evaluado --> FT_DEL_02
  HU_CAP_073["HU-CAP-073"]:::evaluado --> FT_DEL_02
  FT_CIE_01["FT-CIE-01"]:::interna --> FT_DEL_02
  FT_INF_01["FT-INF-01"]:::interna --> FT_DEL_02
  FT_USR_02["FT-USR-02"]:::interna --> FT_DEL_02
  ADR_001["ADR-001"]:::interna -.-> FT_DEL_02
  ADR_011["ADR-011"]:::interna -.-> FT_DEL_02
  ADR_014["ADR-014"]:::interna -.-> FT_DEL_02
  ADR_006["ADR-006"]:::interna -.-> FT_DEL_02
  ADR_007["ADR-007"]:::interna -.-> FT_DEL_02
  ADR_010["ADR-010"]:::interna -.-> FT_DEL_02
  DEP_02["DEP-02"]:::externa ==> FT_DEL_02
  DEP_06["DEP-06"]:::externa ==> FT_DEL_02
```

- **Ítems evaluados:** FT-DEL-02 y sus historias HU-CAP-071, HU-CAP-072, HU-CAP-073.
- **Dependencias técnicas:** FT-CIE-01, FT-INF-01, FT-USR-02; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** ninguna propia.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  PARTY ||--o{ ASIGNACION_REPARTO : ""
  PEDIDO ||--o{ ASIGNACION_REPARTO : ""
  PEDIDO ||--o{ INCIDENTE_ENTREGA : ""
  ZONA_REPARTO {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `zona_reparto`, `pedido`, `asignacion_reparto`, `incidente_entrega`, `party`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-071<br>Ver y tomar un delivery listo"]
  P1["HU-CAP-072<br>Navegar y contactar al cliente"]
  P0 --> P1
  P2["HU-CAP-073<br>Marcar en camino y entregado con el cobro"]
  P1 --> P2
```

Ciclo de vida de **pedido de delivery**:

```mermaid
stateDiagram-v2
  [*] --> LISTO
  LISTO --> EN_CAMINO : repartidor toma y sale
  EN_CAMINO --> ENTREGADO
  EN_CAMINO --> EN_COORDINACION : no contesta o no encuentra
  EN_COORDINACION --> LISTO : reprogramar
  EN_COORDINACION --> ANULADO : devolver
  EN_COORDINACION --> COBRADO : cobrar igual
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["Celular del repartidor PWA"]
    C1["Administrativo PWA"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo reparto"]
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
  M --> X0["Google Places · OpenStreetMap"]
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-006 Tiempo real con WebSocket (Socket.IO) y salas por área, rol y mesa; ADR-007 Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ; ADR-010 Mapas: Google Places para elegir la dirección y Leaflet con zonas propias |
| Integración | Externos: Google Places · OpenStreetMap |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008); datos personales (ADR-005) |
| Datos personales | Sí: ver ADR-005 y DAT-CAP-001 §7 |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-09 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-DEL-02-01 | Si no se resuelve «¿Un repartidor puede tomar varios pedidos a la vez? Propuesta: sí, hasta 3, configurable», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-DEL-02-02 | Si no se resuelve «¿Caja puede asignar un pedido a un repartidor? Propuesta: sí, como respaldo, con aviso al repartidor», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06). Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-DEL-02, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
