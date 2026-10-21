---
id: DOR-FT-COM-03
tipo: spec
titulo: "Definition of Ready — FT-COM-03 Registro y recepción de compras"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-011, FT-COM-03, HU-CAP-102, HU-CAP-103, HU-CAP-104, ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, FT-ALM-01, FT-COM-01, FT-COM-02, FT-STK-01, FT-STK-02]
tags: [dor, plt-05, compras, ft-com-03, g4]
---

# PLT-05 · DEFINITION OF READY — FT-COM-03 Registro y recepción de compras

**Frente COMPRAS · módulo `stock (compras)` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-011 Compras y proveedores · FT-COM-03 Registro y recepción de compras |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H2 · 01/03/2027 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-COM-03`, sus 3 historias (HU-CAP-102, HU-CAP-103, HU-CAP-104), la épica EP-CAP-011, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-011 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debería tener · H2 · 01/03/2027 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 3 historias, 8 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☑ | Reglas de negocio documentadas y validadas | Documentadas en la feature §4; sin decisiones abiertas propias |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-011.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-COM-03; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-020, RNF-CAP-011, RNF-CAP-014, RNF-CAP-009; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 8 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_COM_03["FT-COM-03<br>Registro y recepción de compras"]:::evaluado
  HU_CAP_102["HU-CAP-102"]:::evaluado --> FT_COM_03
  HU_CAP_103["HU-CAP-103"]:::evaluado --> FT_COM_03
  HU_CAP_104["HU-CAP-104"]:::evaluado --> FT_COM_03
  FT_ALM_01["FT-ALM-01"]:::interna --> FT_COM_03
  FT_COM_01["FT-COM-01"]:::interna --> FT_COM_03
  FT_COM_02["FT-COM-02"]:::interna --> FT_COM_03
  FT_STK_01["FT-STK-01"]:::interna --> FT_COM_03
  FT_STK_02["FT-STK-02"]:::interna --> FT_COM_03
  ADR_001["ADR-001"]:::interna -.-> FT_COM_03
  ADR_011["ADR-011"]:::interna -.-> FT_COM_03
  ADR_014["ADR-014"]:::interna -.-> FT_COM_03
  ADR_003["ADR-003"]:::interna -.-> FT_COM_03
  ADR_004["ADR-004"]:::interna -.-> FT_COM_03
  DEP_02["DEP-02"]:::externa ==> FT_COM_03
  DEP_06["DEP-06"]:::externa ==> FT_COM_03
```

- **Ítems evaluados:** FT-COM-03 y sus historias HU-CAP-102, HU-CAP-103, HU-CAP-104.
- **Dependencias técnicas:** FT-ALM-01, FT-COM-01, FT-COM-02, FT-STK-01, FT-STK-02; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-004.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** ninguna propia.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-004 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  PARTY ||--o{ ORGANIZATION : ""
  PARTY_ROLE ||--o{ SUPPLIER_DETAIL : ""
  PARTY ||--o{ PARTY_ROLE : ""
  INSUMO ||--o{ PEDIDO_PROVEEDOR_LINEA : ""
  PARTY ||--o{ PEDIDO_PROVEEDOR_LINEA : ""
  PEDIDO_PROVEEDOR ||--o{ PEDIDO_PROVEEDOR_LINEA : ""
  COMPRA ||--o{ COMPRA_LINEA : ""
  INSUMO ||--o{ COMPRA_LINEA : ""
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `party`, `organization`, `supplier_detail`, `party_role`, `pedido_proveedor`, `pedido_proveedor_linea`, `compra`, `compra_linea`, `insumo`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-102<br>Registrar una compra con su comprobante"]
  P1["HU-CAP-103<br>Recibir un pedido por recibir, completo o parcial"]
  P0 --> P1
  P2["HU-CAP-104<br>Anular una compra o marcarla pagada"]
  P1 --> P2
```

Ciclo de vida de **pedido a proveedor**:

```mermaid
stateDiagram-v2
  [*] --> POR_RECIBIR
  POR_RECIBIR --> PARCIAL
  PARCIAL --> RECIBIDO
  POR_RECIBIR --> RECIBIDO
  POR_RECIBIR --> ANULADO
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
    M["módulo stock (compras)"]
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
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-004 Modelo de personas y organizaciones con el patrón Party simple |
| Integración | Solo internos (PostgreSQL, Redis, WebSocket) |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-COM-03-01 | Si no se resuelve «Recepción parcial», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-004 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06). Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-COM-03, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
