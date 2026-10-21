---
id: DOR-FT-CAR-01
tipo: spec
titulo: "Definition of Ready — FT-CAR-01 Catálogo por categorías con tamaños y opciones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-001, FT-CAR-01, HU-CAP-001, HU-CAP-002, HU-CAP-003, HU-CAP-004, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, FT-COC-02, FT-OFE-01]
tags: [dor, plt-05, carta, ft-car-01, g4]
---

# PLT-05 · DEFINITION OF READY — FT-CAR-01 Catálogo por categorías con tamaños y opciones

**Frente CARTA · módulo `carta` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-001 Carta virtual y catálogo · FT-CAR-01 Catálogo por categorías con tamaños y opciones |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-CAR-01`, sus 4 historias (HU-CAP-001, HU-CAP-002, HU-CAP-003, HU-CAP-004), la épica EP-CAP-001, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-001 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 4 historias, 17 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☐ | Reglas de negocio documentadas y validadas | Documentadas; abiertas: D-15 |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-001.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-CAR-01; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-001, RNF-CAP-004, RNF-CAP-005, RNF-CAP-011, RNF-CAP-003; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 17 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_CAR_01["FT-CAR-01<br>Catálogo por categorías con tamaños y opciones"]:::evaluado
  HU_CAP_001["HU-CAP-001"]:::evaluado --> FT_CAR_01
  HU_CAP_002["HU-CAP-002"]:::evaluado --> FT_CAR_01
  HU_CAP_003["HU-CAP-003"]:::evaluado --> FT_CAR_01
  HU_CAP_004["HU-CAP-004"]:::evaluado --> FT_CAR_01
  FT_COC_02["FT-COC-02"]:::interna --> FT_CAR_01
  FT_OFE_01["FT-OFE-01"]:::interna --> FT_CAR_01
  ADR_001["ADR-001"]:::interna -.-> FT_CAR_01
  ADR_011["ADR-011"]:::interna -.-> FT_CAR_01
  ADR_014["ADR-014"]:::interna -.-> FT_CAR_01
  ADR_003["ADR-003"]:::interna -.-> FT_CAR_01
  ADR_006["ADR-006"]:::interna -.-> FT_CAR_01
  DEP_02["DEP-02"]:::externa ==> FT_CAR_01
  DEP_05["DEP-05"]:::externa ==> FT_CAR_01
  DEP_06["DEP-06"]:::externa ==> FT_CAR_01
```

- **Ítems evaluados:** FT-CAR-01 y sus historias HU-CAP-001, HU-CAP-002, HU-CAP-003, HU-CAP-004.
- **Dependencias técnicas:** FT-COC-02, FT-OFE-01; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-006.
- **Dependencias externas:** DEP-02, DEP-05, DEP-06.
- **Decisiones abiertas:** D-15.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-006 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |
| DEP-05 | Ver roadmap PLT-01 | Externa | Kevin | Según roadmap | Abierto |
| D-15 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  AREA_COCINA ||--o{ CATEGORIA : ""
  CATEGORIA ||--o{ PRODUCTO : ""
  PRODUCTO ||--o{ PRODUCTO_TAMANO : ""
  GRUPO_OPCIONES ||--o{ OPCION : ""
  PRODUCTO ||--o{ SABOR : ""
  RANKING_MES {
    bigint id PK
  }
  MENSAJE_CARTA {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `categoria`, `producto`, `producto_tamano`, `grupo_opciones`, `opcion`, `sabor`, `area_cocina`, `ranking_mes`, `mensaje_carta`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-001<br>Navegar la carta por categorías y buscador"]
  P1["HU-CAP-002<br>Armar un producto con tamaño y opciones"]
  P0 --> P1
  P2["HU-CAP-003<br>Elegir sabores y armar un combo por unidad"]
  P1 --> P2
  P3["HU-CAP-004<br>Ver promociones y combos con su precio"]
  P2 --> P3
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["Carta web"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo carta"]
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
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-006 Tiempo real con WebSocket (Socket.IO) y salas por área, rol y mesa |
| Integración | Solo internos (PostgreSQL, Redis, WebSocket) |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-03 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-CAR-01-01 | Si no se resuelve «Lista final de toppings y sus precios», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-CAR-01-02 | Si no se resuelve «Fotos de todos los productos», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-006 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06); decisiones abiertas D-15. Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-CAR-01, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
