---
id: DOR-FT-BOT-01
tipo: spec
titulo: "Definition of Ready — FT-BOT-01 Pedido por botones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-01, HU-CAP-126, HU-CAP-127, HU-CAP-128, HU-CAP-129, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, FT-ATN-01, FT-CAJ-01, FT-CAR-01, FT-CAR-02, FT-COC-03, FT-DEL-01, FT-OFE-02]
tags: [dor, plt-05, chatbot, ft-bot-01, g4]
---

# PLT-05 · DEFINITION OF READY — FT-BOT-01 Pedido por botones

**Frente CHATBOT · módulo `bot` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-014 Chatbot: pedido y pago por WhatsApp · FT-BOT-01 Pedido por botones |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H2 · 01/03/2027 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-BOT-01`, sus 4 historias (HU-CAP-126, HU-CAP-127, HU-CAP-128, HU-CAP-129), la épica EP-CAP-014, los ADR ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-014 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debería tener · H2 · 01/03/2027 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 4 historias, 8 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☐ | Reglas de negocio documentadas y validadas | Documentadas; abiertas: D-08, D-20 |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-014.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-BOT-01; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-016, RNF-CAP-015, RNF-CAP-011, RNF-CAP-003; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 8 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_BOT_01["FT-BOT-01<br>Pedido por botones"]:::evaluado
  HU_CAP_126["HU-CAP-126"]:::evaluado --> FT_BOT_01
  HU_CAP_127["HU-CAP-127"]:::evaluado --> FT_BOT_01
  HU_CAP_128["HU-CAP-128"]:::evaluado --> FT_BOT_01
  HU_CAP_129["HU-CAP-129"]:::evaluado --> FT_BOT_01
  FT_ATN_01["FT-ATN-01"]:::interna --> FT_BOT_01
  FT_CAJ_01["FT-CAJ-01"]:::interna --> FT_BOT_01
  FT_CAR_01["FT-CAR-01"]:::interna --> FT_BOT_01
  FT_CAR_02["FT-CAR-02"]:::interna --> FT_BOT_01
  FT_COC_03["FT-COC-03"]:::interna --> FT_BOT_01
  FT_DEL_01["FT-DEL-01"]:::interna --> FT_BOT_01
  FT_OFE_02["FT-OFE-02"]:::interna --> FT_BOT_01
  ADR_001["ADR-001"]:::interna -.-> FT_BOT_01
  ADR_011["ADR-011"]:::interna -.-> FT_BOT_01
  ADR_014["ADR-014"]:::interna -.-> FT_BOT_01
  ADR_007["ADR-007"]:::interna -.-> FT_BOT_01
  ADR_009["ADR-009"]:::interna -.-> FT_BOT_01
  DEP_02["DEP-02"]:::externa ==> FT_BOT_01
  DEP_06["DEP-06"]:::externa ==> FT_BOT_01
  DEP_12["DEP-12"]:::externa ==> FT_BOT_01
```

- **Ítems evaluados:** FT-BOT-01 y sus historias HU-CAP-126, HU-CAP-127, HU-CAP-128, HU-CAP-129.
- **Dependencias técnicas:** FT-ATN-01, FT-CAJ-01, FT-CAR-01, FT-CAR-02, FT-COC-03, FT-DEL-01, FT-OFE-02; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.
- **Dependencias externas:** DEP-02, DEP-06, DEP-12.
- **Decisiones abiertas:** D-08, D-20.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-007, ADR-009 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |
| DEP-12 | Ver roadmap PLT-01 | Externa | Kevin | Según roadmap | Abierto |
| D-08 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |
| D-20 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  CONVERSACION ||--o{ MENSAJE_CHAT : ""
  PEDIDO ||--o{ COMPROBANTE_PAGO : ""
  SOLICITUD_RESERVA {
    bigint id PK
  }
  RESERVA {
    bigint id PK
  }
  USO_EXTERNO {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `conversacion`, `mensaje_chat`, `pedido`, `comprobante_pago`, `solicitud_reserva`, `reserva`, `uso_externo`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-126<br>Elegir productos y opciones con botones en WhatsApp"]
  P1["HU-CAP-127<br>Armar el carrito y dar la entrega en WhatsApp"]
  P0 --> P1
  P2["HU-CAP-128<br>Enviar el pedido del bot a caja"]
  P1 --> P2
  P3["HU-CAP-129<br>Pasar a una persona cuando el bot no entiende"]
  P2 --> P3
```

Ciclo de vida de **conversación**:

```mermaid
stateDiagram-v2
  [*] --> BOT
  BOT --> VALIDAR_PAGO : llega captura
  VALIDAR_PAGO --> BOT : aprobado o rechazado
  BOT --> PERSONA : urgente o pide persona
  PERSONA --> BOT : soltar o inactividad
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["WhatsApp"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo bot"]
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
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-007 Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ; ADR-009 Chatbot con la API oficial de WhatsApp (Cloud API) e IA de OpenAI acotada |
| Integración | Externos: WhatsApp Cloud API · OpenAI |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | Sí: ver ADR-005 y DAT-CAP-001 §7 |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-04 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-07 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-BOT-01-01 | Si no se resuelve «Acceso a la cuenta de Meta y costo», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-BOT-01-02 | Si no se resuelve «¿Se reemplaza el bot actual o conviven?», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-007, ADR-009 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06); decisiones abiertas D-08, D-20. Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-BOT-01, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
