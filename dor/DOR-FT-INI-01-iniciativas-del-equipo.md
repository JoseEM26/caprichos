---
id: DOR-FT-INI-01
tipo: spec
titulo: "Definition of Ready — FT-INI-01 Iniciativas del equipo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-022, FT-INI-01, HU-CAP-190, HU-CAP-191, HU-CAP-192, HU-CAP-193, HU-CAP-194, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012, FT-USR-04]
tags: [dor, plt-05, iniciativas, ft-ini-01, g4]
---

# PLT-05 · DEFINITION OF READY — FT-INI-01 Iniciativas del equipo

**Frente INICIATIVAS · módulo `iniciativas` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-022 Iniciativas del equipo · FT-INI-01 Iniciativas del equipo |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H2 · 01/03/2027 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-INI-01`, sus 5 historias (HU-CAP-190, HU-CAP-191, HU-CAP-192, HU-CAP-193, HU-CAP-194), la épica EP-CAP-022, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-022 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debería tener · H2 · 01/03/2027 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 5 historias, 13 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☑ | Reglas de negocio documentadas y validadas | Documentadas en la feature §4; sin decisiones abiertas propias |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-022.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-INI-01; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-004, RNF-CAP-005, RNF-CAP-009, RNF-CAP-012, RNF-CAP-014; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 13 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_INI_01["FT-INI-01<br>Iniciativas del equipo"]:::evaluado
  HU_CAP_190["HU-CAP-190"]:::evaluado --> FT_INI_01
  HU_CAP_191["HU-CAP-191"]:::evaluado --> FT_INI_01
  HU_CAP_192["HU-CAP-192"]:::evaluado --> FT_INI_01
  HU_CAP_193["HU-CAP-193"]:::evaluado --> FT_INI_01
  HU_CAP_194["HU-CAP-194"]:::evaluado --> FT_INI_01
  FT_USR_04["FT-USR-04"]:::interna --> FT_INI_01
  ADR_001["ADR-001"]:::interna -.-> FT_INI_01
  ADR_011["ADR-011"]:::interna -.-> FT_INI_01
  ADR_014["ADR-014"]:::interna -.-> FT_INI_01
  ADR_003["ADR-003"]:::interna -.-> FT_INI_01
  ADR_008["ADR-008"]:::interna -.-> FT_INI_01
  ADR_012["ADR-012"]:::interna -.-> FT_INI_01
  DEP_02["DEP-02"]:::externa ==> FT_INI_01
  DEP_06["DEP-06"]:::externa ==> FT_INI_01
```

- **Ítems evaluados:** FT-INI-01 y sus historias HU-CAP-190, HU-CAP-191, HU-CAP-192, HU-CAP-193, HU-CAP-194.
- **Dependencias técnicas:** FT-USR-04; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** ninguna propia.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  INICIATIVA ||--o{ INICIATIVA_COMENTARIO : ""
  USER_ACCOUNT ||--o{ INICIATIVA_COMENTARIO : ""
  ARCHIVO {
    bigint id PK
  }
  AUDITORIA {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `iniciativa`, `iniciativa_comentario`, `archivo`, `user_account`, `auditoria`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-190<br>Subir una iniciativa con captura"]
  P1["HU-CAP-191<br>Ver, buscar y filtrar las iniciativas del equipo"]
  P0 --> P1
  P2["HU-CAP-192<br>Comentar una iniciativa"]
  P1 --> P2
  P3["HU-CAP-193<br>Cambiar el estado de una iniciativa"]
  P2 --> P3
  P4["HU-CAP-194<br>Dejar cada acción en el Historial de acciones"]
  P3 --> P4
```

Ciclo de vida de **iniciativa**:

```mermaid
stateDiagram-v2
  [*] --> NUEVA : se sube
  NUEVA --> EN_REVISION : administrador
  EN_REVISION --> HECHA
  EN_REVISION --> NO_POR_AHORA
  NUEVA --> NO_POR_AHORA
  NUEVA --> HECHA
  HECHA --> EN_REVISION : reabrir
  NO_POR_AHORA --> EN_REVISION : reabrir
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
    M["módulo iniciativas"]
  end
  subgraph Datos
    PG[("PostgreSQL")]
    RD[("Redis · colas")]
  end
  C0 --> CF
  G --> M
  M --> PG
  M --> RD
  M --> X0["Copias B2/R2 · GlitchTip"]
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-008 Autenticación propia con JWT y autorización por rol y permiso; ADR-012 Archivos en el VPS, copias de seguridad y vigilancia del sistema |
| Integración | Externos: Copias B2/R2 · GlitchTip |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-INI-01-01 | Si no se resuelve «¿Debe entrar en el piloto (H1) o en H2? Propuesta: H2, porque no bloquea la operación (decisión de Kevin, pendiente)», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |
| R-FT-INI-01-02 | Si no se resuelve «¿Un cajero puede ver quién sube quejas sobre él? Por ahora sí, todos ven al autor (DT-53); si genera conflictos se puede limitar la vista al administrador (pendiente)», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06). Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-INI-01, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
