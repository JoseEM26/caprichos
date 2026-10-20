---
id: DOR-FT-OFF-01
tipo: spec
titulo: "Definition of Ready — FT-OFF-01 Operación local y sincronización"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-019, FT-OFF-01, HU-CAP-168, HU-CAP-169, ADR-001, ADR-011, ADR-014, ADR-002, ADR-013]
tags: [dor, plt-05, offline, ft-off-01, g4]
---

# PLT-05 · DEFINITION OF READY — FT-OFF-01 Operación local y sincronización

**Frente OFFLINE · módulo `agente-local` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-019 Modo sin internet · FT-OFF-01 Operación local y sincronización |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | Fase aparte, con cotización propia (DT-12, D-11) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-OFF-01`, sus 2 historias (HU-CAP-168, HU-CAP-169), la épica EP-CAP-019, los ADR ADR-001, ADR-011, ADR-014, ADR-002, ADR-013, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-019 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | No esta vez · Fase aparte, con cotización propia (DT-12, D-11); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 2 historias, 5 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☐ | Reglas de negocio documentadas y validadas | Documentadas; abiertas: D-11 |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-019.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-OFF-01; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-018; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 5 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_OFF_01["FT-OFF-01<br>Operación local y sincronización"]:::evaluado
  HU_CAP_168["HU-CAP-168"]:::evaluado --> FT_OFF_01
  HU_CAP_169["HU-CAP-169"]:::evaluado --> FT_OFF_01
  ADR_001["ADR-001"]:::interna -.-> FT_OFF_01
  ADR_011["ADR-011"]:::interna -.-> FT_OFF_01
  ADR_014["ADR-014"]:::interna -.-> FT_OFF_01
  ADR_002["ADR-002"]:::interna -.-> FT_OFF_01
  ADR_013["ADR-013"]:::interna -.-> FT_OFF_01
  DEP_02["DEP-02"]:::externa ==> FT_OFF_01
  DEP_03["DEP-03"]:::externa ==> FT_OFF_01
  DEP_06["DEP-06"]:::externa ==> FT_OFF_01
```

- **Ítems evaluados:** FT-OFF-01 y sus historias HU-CAP-168, HU-CAP-169.
- **Dependencias técnicas:** ninguna otra feature; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-002, ADR-013.
- **Dependencias externas:** DEP-02, DEP-03, DEP-06.
- **Decisiones abiertas:** D-11.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-002, ADR-013 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |
| DEP-03 | Ver roadmap PLT-01 | Externa | Kevin | Según roadmap | Abierto |
| D-11 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  PEDIDO ||--o{ COBRO : ""
  PEDIDO ||--o{ COMANDA_AREA : ""
  PEDIDO ||--o{ PEDIDO_MESA : ""
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `pedido`, `cobro`, `comanda_area`, `pedido_mesa`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-168<br>Seguir operando sin internet"]
  P1["HU-CAP-169<br>Sincronizar al volver la conexión"]
  P0 --> P1
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["PWA en red local"]
    C1["Agente local"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo agente-local"]
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
  M --> X0["Ticketeras ESC/POS"]
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-002 Impresión de comandas y etiquetas con un agente local ESC/POS; ADR-013 Modo sin internet con base local en el agente de caja (fase aparte) |
| Integración | Externos: Ticketeras ESC/POS |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-06 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-OFF-01-01 | Si no se resuelve «Equipos del local, caja siempre encendida y frecuencia de caídas», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-OFF-01-02 | Si no se resuelve «Cotización», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-002, ADR-013 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06); decisiones abiertas D-11; fase aparte sin cotizar (DT-12, D-11). Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-OFF-01, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-002, ADR-013, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
