---
id: DOR-FT-OFE-02
tipo: spec
titulo: "Definition of Ready — FT-OFE-02 Descuentos automáticos y acumulación"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-02, HU-CAP-109, HU-CAP-110, HU-CAP-111, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, FT-BOT-01, FT-OFE-03]
tags: [dor, plt-05, ofertas, ft-ofe-02, g4]
---

# PLT-05 · DEFINITION OF READY — FT-OFE-02 Descuentos automáticos y acumulación

**Frente OFERTAS · módulo `ofertas` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-012 Promociones, descuentos y cupones · FT-OFE-02 Descuentos automáticos y acumulación |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H2 · 01/03/2027 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-OFE-02`, sus 3 historias (HU-CAP-109, HU-CAP-110, HU-CAP-111), la épica EP-CAP-012, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-012 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debería tener · H2 · 01/03/2027 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 3 historias, 9 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☐ | Reglas de negocio documentadas y validadas | Documentadas; abiertas: D-10 |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-012.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-OFE-02; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-019, RNF-CAP-011; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 9 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_OFE_02["FT-OFE-02<br>Descuentos automáticos y acumulación"]:::evaluado
  HU_CAP_109["HU-CAP-109"]:::evaluado --> FT_OFE_02
  HU_CAP_110["HU-CAP-110"]:::evaluado --> FT_OFE_02
  HU_CAP_111["HU-CAP-111"]:::evaluado --> FT_OFE_02
  FT_BOT_01["FT-BOT-01"]:::interna --> FT_OFE_02
  FT_OFE_03["FT-OFE-03"]:::interna --> FT_OFE_02
  ADR_001["ADR-001"]:::interna -.-> FT_OFE_02
  ADR_011["ADR-011"]:::interna -.-> FT_OFE_02
  ADR_014["ADR-014"]:::interna -.-> FT_OFE_02
  ADR_003["ADR-003"]:::interna -.-> FT_OFE_02
  ADR_007["ADR-007"]:::interna -.-> FT_OFE_02
  DEP_02["DEP-02"]:::externa ==> FT_OFE_02
  DEP_06["DEP-06"]:::externa ==> FT_OFE_02
```

- **Ítems evaluados:** FT-OFE-02 y sus historias HU-CAP-109, HU-CAP-110, HU-CAP-111.
- **Dependencias técnicas:** FT-BOT-01, FT-OFE-03; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** D-10.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-007 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |
| D-10 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  CATEGORIA ||--o{ OFERTA : ""
  PRODUCTO ||--o{ OFERTA : ""
  OFERTA ||--o{ COMBO_PRECIO : ""
  CUPON ||--o{ CUPON_EMITIDO : ""
  CATEGORIA ||--o{ PRODUCTO : ""
  COMBO_PARTE {
    bigint id PK
  }
  REGLA_ACUMULACION {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `oferta`, `combo_parte`, `combo_precio`, `regla_acumulacion`, `cupon`, `cupon_emitido`, `categoria`, `producto`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-109<br>Crear un descuento automático con su vigencia"]
  P1["HU-CAP-110<br>Aplicar el mejor descuento en todos los canales"]
  P0 --> P1
  P2["HU-CAP-111<br>Configurar las reglas de acumulación"]
  P1 --> P2
```

Ciclo de vida de **cupón emitido**:

```mermaid
stateDiagram-v2
  [*] --> VIGENTE
  VIGENTE --> CANJEADO
  VIGENTE --> VENCIDO : pasan N días
  VIGENTE --> ANULADO : administrador
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["Administrativo PWA"]
    C1["Carta web"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo ofertas"]
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
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-007 Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ |
| Integración | Solo internos (PostgreSQL, Redis, WebSocket) |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-OFE-02-01 | Si no se resuelve «Acumulación», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-007 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06); decisiones abiertas D-10. Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-OFE-02, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
