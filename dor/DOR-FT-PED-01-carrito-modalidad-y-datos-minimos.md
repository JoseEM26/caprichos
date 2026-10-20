---
id: DOR-FT-PED-01
tipo: spec
titulo: "Definition of Ready — FT-PED-01 Carrito, modalidad y datos mínimos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-01, HU-CAP-012, HU-CAP-013, HU-CAP-014, HU-CAP-015, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, FT-CFG-02, FT-LEG-01, FT-LEG-02, FT-OFE-02, FT-OFE-03, FT-PED-02]
tags: [dor, plt-05, pedido, ft-ped-01, g4]
---

# PLT-05 · DEFINITION OF READY — FT-PED-01 Carrito, modalidad y datos mínimos

**Frente PEDIDO · módulo `pedidos` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-002 Pedido del cliente en la carta · FT-PED-01 Carrito, modalidad y datos mínimos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-PED-01`, sus 4 historias (HU-CAP-012, HU-CAP-013, HU-CAP-014, HU-CAP-015), la épica EP-CAP-002, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-002 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 4 historias, 16 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☐ | Reglas de negocio documentadas y validadas | Documentadas; abiertas: D-03, D-18 |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-002.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-PED-01; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-004, RNF-CAP-005, RNF-CAP-011, RNF-CAP-008; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 16 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_PED_01["FT-PED-01<br>Carrito, modalidad y datos mínimos"]:::evaluado
  HU_CAP_012["HU-CAP-012"]:::evaluado --> FT_PED_01
  HU_CAP_013["HU-CAP-013"]:::evaluado --> FT_PED_01
  HU_CAP_014["HU-CAP-014"]:::evaluado --> FT_PED_01
  HU_CAP_015["HU-CAP-015"]:::evaluado --> FT_PED_01
  FT_CFG_02["FT-CFG-02"]:::interna --> FT_PED_01
  FT_LEG_01["FT-LEG-01"]:::interna --> FT_PED_01
  FT_LEG_02["FT-LEG-02"]:::interna --> FT_PED_01
  FT_OFE_02["FT-OFE-02"]:::interna --> FT_PED_01
  FT_OFE_03["FT-OFE-03"]:::interna --> FT_PED_01
  FT_PED_02["FT-PED-02"]:::interna --> FT_PED_01
  ADR_001["ADR-001"]:::interna -.-> FT_PED_01
  ADR_011["ADR-011"]:::interna -.-> FT_PED_01
  ADR_014["ADR-014"]:::interna -.-> FT_PED_01
  ADR_003["ADR-003"]:::interna -.-> FT_PED_01
  ADR_005["ADR-005"]:::interna -.-> FT_PED_01
  ADR_009["ADR-009"]:::interna -.-> FT_PED_01
  ADR_010["ADR-010"]:::interna -.-> FT_PED_01
  DEP_02["DEP-02"]:::externa ==> FT_PED_01
  DEP_06["DEP-06"]:::externa ==> FT_PED_01
```

- **Ítems evaluados:** FT-PED-01 y sus historias HU-CAP-012, HU-CAP-013, HU-CAP-014, HU-CAP-015.
- **Dependencias técnicas:** FT-CFG-02, FT-LEG-01, FT-LEG-02, FT-OFE-02, FT-OFE-03, FT-PED-02; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** D-03, D-18.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |
| D-03 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |
| D-18 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  PEDIDO ||--o{ PEDIDO_LINEA : ""
  PEDIDO_LINEA ||--o{ PEDIDO_LINEA : ""
  PARTY ||--o{ CONTACT_MECHANISM : ""
  PARTY ||--o{ CONSENT : ""
  ZONA_REPARTO {
    bigint id PK
  }
  CUPON_EMITIDO {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `pedido`, `pedido_linea`, `party`, `contact_mechanism`, `consent`, `zona_reparto`, `cupon_emitido`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-012<br>Agregar y editar productos en el carrito"]
  P1["HU-CAP-013<br>Dar mis datos mínimos al final"]
  P0 --> P1
  P2["HU-CAP-014<br>Elegir cómo pagar sin pagar en la web"]
  P1 --> P2
  P3["HU-CAP-015<br>Ver el resumen con descuentos, cupón y comprobante"]
  P2 --> P3
```

Ciclo de vida de **pedido (fuera del local)**:

```mermaid
stateDiagram-v2
  [*] --> POR_CONFIRMAR
  POR_CONFIRMAR --> EN_COCINA : confirmar
  POR_CONFIRMAR --> RECHAZADO : rechazar
  EN_COCINA --> LISTO
  LISTO --> ENTREGADO
  ENTREGADO --> COBRADO
  COBRADO --> [*]
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
    M["módulo pedidos"]
  end
  subgraph Datos
    PG[("PostgreSQL")]
    RD[("Redis · colas")]
  end
  C0 --> CF
  G --> M
  M --> PG
  M --> RD
  M --> X0["WhatsApp Cloud API · OpenAI"]
  M --> X1["Google Places · OpenStreetMap"]
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-005 Datos personales: consentimiento, enmascarado y conservación (Ley 29733); ADR-009 Chatbot con la API oficial de WhatsApp (Cloud API) e IA de OpenAI acotada; ADR-010 Mapas: Google Places para elegir la dirección y Leaflet con zonas propias |
| Integración | Externos: WhatsApp Cloud API · OpenAI, Google Places · OpenStreetMap |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008); datos personales (ADR-005) |
| Datos personales | Sí: ver ADR-005 y DAT-CAP-001 §7 |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-11 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-PED-01-01 | Si no se resuelve «Pedido mínimo», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-PED-01-02 | Si no se resuelve «¿Se guarda el carrito si el cliente cierra la carta? Propuesta: sí, en el dispositivo, por 24 horas», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06); decisiones abiertas D-03, D-18. Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-PED-01, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
