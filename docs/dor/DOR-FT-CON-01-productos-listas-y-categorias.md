---
id: DOR-FT-CON-01
tipo: spec
titulo: "Definition of Ready — FT-CON-01 Productos, listas y categorías"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CON-01, HU-CAP-144, HU-CAP-145, HU-CAP-146, HU-CAP-147, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, FT-CAR-01]
tags: [dor, plt-05, contenidos, ft-con-01, g4]
---

# PLT-05 · DEFINITION OF READY — FT-CON-01 Productos, listas y categorías

**Frente CONTENIDOS · módulo `carta y contenidos` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-016 Administración de la carta y contenidos · FT-CON-01 Productos, listas y categorías |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H2 · 01/03/2027 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-CON-01`, sus 4 historias (HU-CAP-144, HU-CAP-145, HU-CAP-146, HU-CAP-147), la épica EP-CAP-016, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-016 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debería tener · H2 · 01/03/2027 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 4 historias, 9 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☐ | Reglas de negocio documentadas y validadas | Documentadas; abiertas: D-15 |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-016.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☐ | Prototipos aprobados (DEP-06) | Mockup navegable como referencia (DT-04); Figma o aceptación del mockup pendiente (G2) |
| DISEÑO / UX | ☐ | Textos y mensajes definidos | Los del mockup; por revisar con Kevin |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-CON-01; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-014, RNF-CAP-009, RNF-CAP-012; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 9 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_CON_01["FT-CON-01<br>Productos, listas y categorías"]:::evaluado
  HU_CAP_144["HU-CAP-144"]:::evaluado --> FT_CON_01
  HU_CAP_145["HU-CAP-145"]:::evaluado --> FT_CON_01
  HU_CAP_146["HU-CAP-146"]:::evaluado --> FT_CON_01
  HU_CAP_147["HU-CAP-147"]:::evaluado --> FT_CON_01
  FT_CAR_01["FT-CAR-01"]:::interna --> FT_CON_01
  ADR_001["ADR-001"]:::interna -.-> FT_CON_01
  ADR_011["ADR-011"]:::interna -.-> FT_CON_01
  ADR_014["ADR-014"]:::interna -.-> FT_CON_01
  ADR_003["ADR-003"]:::interna -.-> FT_CON_01
  ADR_012["ADR-012"]:::interna -.-> FT_CON_01
  DEP_02["DEP-02"]:::externa ==> FT_CON_01
  DEP_06["DEP-06"]:::externa ==> FT_CON_01
```

- **Ítems evaluados:** FT-CON-01 y sus historias HU-CAP-144, HU-CAP-145, HU-CAP-146, HU-CAP-147.
- **Dependencias técnicas:** FT-CAR-01; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** D-15.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G2 | Mockup aprobado o aceptación del mockup navegable (DEP-06) | Diseño | José Ángel Espinoza (UX, DT-48) | Antes de G4 | Abierto |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-012 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |
| D-15 | Decisión pendiente (ver `analisis/decisiones.md`) | Decisión | Kevin | Antes de G4 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

```mermaid
erDiagram
  ARCHIVO ||--o{ PRODUCTO : ""
  CATEGORIA ||--o{ PRODUCTO : ""
  LISTA ||--o{ GRUPO_OPCIONES : ""
  GRUPO_OPCIONES ||--o{ OPCION : ""
  LISTA_VALOR ||--o{ OPCION : ""
  CATEGORIA ||--o{ GRUPO_ALCANCE : ""
  GRUPO_OPCIONES ||--o{ GRUPO_ALCANCE : ""
  PRODUCTO ||--o{ GRUPO_ALCANCE : ""
  LISTA ||--o{ LISTA_VALOR : ""
  PRODUCTO ||--o{ SABOR : ""
  ARCHIVO ||--o{ NOVEDAD_FOTO : ""
  NOVEDAD ||--o{ NOVEDAD_FOTO : ""
  ARCHIVO ||--o{ DESTACADA_FOTO : ""
  DESTACADA ||--o{ DESTACADA_FOTO : ""
  PRODUCTO ||--o{ DESTACADA_FOTO : ""
  VERSION_CARTA {
    bigint id PK
  }
```

Tablas de `datos/ddl-propuesto.sql` que usa la feature: `categoria`, `producto`, `grupo_opciones`, `opcion`, `grupo_alcance`, `lista`, `lista_valor`, `sabor`, `version_carta`, `novedad`, `novedad_foto`, `destacada`, `destacada_foto`, `archivo`. Las relaciones son las claves foráneas físicas del script (ADR-003); el detalle de columnas y restricciones está en DAT-CAP-001.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-144<br>Crear un producto en una categoría fija o con opciones"]
  P1["HU-CAP-145<br>Gestionar opciones y tamaños en un solo lugar"]
  P0 --> P1
  P2["HU-CAP-146<br>Gestionar listas y categorías"]
  P1 --> P2
  P3["HU-CAP-147<br>Gestionar tipos con sabores"]
  P2 --> P3
```

Ciclo de vida de **versión de la carta**:

```mermaid
stateDiagram-v2
  [*] --> BORRADOR
  BORRADOR --> PUBLICADA : publicar
  BORRADOR --> [*] : descartar
  PUBLICADA --> ARCHIVADA : nueva publicación
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
    M["módulo carta y contenidos"]
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
  M --> X0["Copias B2/R2 · GlitchTip"]
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-012 Archivos en el VPS, copias de seguridad y vigilancia del sistema |
| Integración | Externos: Copias B2/R2 · GlitchTip |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008) |
| Datos personales | No maneja datos personales propios |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-CON-01-01 | Si no se resuelve «Carta validada y fotos», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-012 propuestos, no aprobados (G3); tareas sin estimar; mockup sin aprobar (G2, DEP-06); decisiones abiertas D-15. Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-CON-01, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
