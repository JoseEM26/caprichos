---
id: DOR-FT-PLA-02
tipo: spec
titulo: "Definition of Ready — FT-PLA-02 Servidor, red, ambientes y secretos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-02, HU-CAP-181, HU-CAP-182, HU-CAP-183, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012]
tags: [dor, plt-05, plataforma, ft-pla-02, g4]
---

# PLT-05 · DEFINITION OF READY — FT-PLA-02 Servidor, red, ambientes y secretos

**Frente PLATAFORMA · módulo `plataforma (infra/ y .github/)` · Caprichos · ticket *(pendiente — R13, D-14)***

| Campo | Valor |
| --- | --- |
| ÍTEM EVALUADO | EP-CAP-021 Plataforma, despliegue y operación · FT-PLA-02 Servidor, red, ambientes y secretos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| LÍDER TÉCNICO | José Ángel Espinoza (DT-48) |
| FECHA DE REVISIÓN | 2026-10-20 |
| SPRINT / RELEASE DESTINO | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |
| RESULTADO | (lo decide el PO — propuesta IA: **NO READY**) |

> Insumos: `analisis/decisiones.md` (fuente de verdad), la feature `FT-PLA-02`, sus 3 historias (HU-CAP-181, HU-CAP-182, HU-CAP-183), la épica EP-CAP-021, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, `arquitectura/ARQ-CAP-001` y `ARQ-CAP-002`, y `datos/DAT-CAP-001`.

## 1 CHECKLIST DE PREPARACIÓN

| Grupo | ☐/☑ | Ítem | Responsable / evidencia |
| --- | --- | --- | --- |
| NEGOCIO | ☑ | Objetivo y valor con KPI | Épica EP-CAP-021 §2 y feature §1 (hipótesis medible) |
| NEGOCIO | ☐ | Alcance dentro y fuera acordado | Redactado en la feature; falta la firma del PO (DT-48) |
| NEGOCIO | ☐ | Prioridad y release confirmados | Debe tener · H1 · piloto en el local · 28/12/2026 (supuesto, D-19); fechas supuestas hasta D-19 |
| FUNCIONAL | ☑ | Historias con criterios verificables | 3 historias, 9 criterios Dado/Cuando/Entonces |
| FUNCIONAL | ☑ | Reglas de negocio documentadas y validadas | Documentadas en la feature §4; sin decisiones abiertas propias |
| FUNCIONAL | ☐ | Estimación por el equipo | Tareas en `backlog/tareas/EP-CAP-021.json` con `estimacion_horas: null` |
| DISEÑO / UX | ☑ | Prototipos aprobados (DEP-06) | No aplica: sin pantalla propia |
| DISEÑO / UX | ☑ | Textos y mensajes definidos | No aplica |
| TÉCNICO | ☑ | Dependencias, modelado y arquitectura | Secciones 2 a 4 de este DoR; ARQ-CAP-001 |
| TÉCNICO | ☐ | Contrato de API | Borrador en ARQ-CAP-002 §FT-PLA-02; se aprueba en G3 |
| TÉCNICO | ☐ | Modelo de datos / DDL | DAT-CAP-001 y `datos/ddl-propuesto.sql` (probado en PostgreSQL 16); sin aprobar (G3) |
| TÉCNICO | ☐ | RNF y seguridad | RNF-CAP-003, RNF-CAP-006, RNF-CAP-008; umbrales propuestos (feature §3) |
| CALIDAD | ☑ | Estrategia y datos de prueba | `pruebas/test-plan.md`: 9 casos TC para estas historias, datos sintéticos |
| CALIDAD | ☑ | Riesgos con mitigación y dueño | Sección 5 |

## 2 DIAGRAMA DE DEPENDENCIAS

```mermaid
flowchart LR
  classDef evaluado fill:#fde68a,stroke:#b45309
  classDef interna fill:#dbeafe,stroke:#1d4ed8
  classDef externa fill:#fee2e2,stroke:#b91c1c
  FT_PLA_02["FT-PLA-02<br>Servidor, red, ambientes y secretos"]:::evaluado
  HU_CAP_181["HU-CAP-181"]:::evaluado --> FT_PLA_02
  HU_CAP_182["HU-CAP-182"]:::evaluado --> FT_PLA_02
  HU_CAP_183["HU-CAP-183"]:::evaluado --> FT_PLA_02
  ADR_001["ADR-001"]:::interna -.-> FT_PLA_02
  ADR_011["ADR-011"]:::interna -.-> FT_PLA_02
  ADR_014["ADR-014"]:::interna -.-> FT_PLA_02
  ADR_003["ADR-003"]:::interna -.-> FT_PLA_02
  ADR_012["ADR-012"]:::interna -.-> FT_PLA_02
  DEP_02["DEP-02"]:::externa ==> FT_PLA_02
  DEP_06["DEP-06"]:::externa ==> FT_PLA_02
```

- **Ítems evaluados:** FT-PLA-02 y sus historias HU-CAP-181, HU-CAP-182, HU-CAP-183.
- **Dependencias técnicas:** ninguna otra feature; decisiones técnicas ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.
- **Dependencias externas:** DEP-02, DEP-06.
- **Decisiones abiertas:** ninguna propia.

**Bloqueantes**

| ID | Bloqueante | Tipo | Dueño | Fecha | Estado |
| --- | --- | --- | --- | --- | --- |
| G3 | Aprobación de ADR-001, ADR-011, ADR-014, ADR-003, ADR-012 | Arquitectura | José Ángel Espinoza (TL, DT-48) | Antes de G4 | Abierto |
| DEP-02 | Plataforma y hosting (ADR-001, ADR-011) | Técnica | Desarrollo | Antes de G3 | Abierto |

## 3 MODELADO (DATOS Y PROCESO)

No aplica un modelo de datos: esta feature no tiene tablas de negocio. Maneja archivos de infraestructura (`infra/ansible`, `.github/workflows`, servicios de Dokploy, repositorio de copias) descritos en `operacion/INV-CAP-001-inventario-de-infraestructura.md`.

Proceso (orden de las historias):

```mermaid
flowchart TB
  P0["HU-CAP-181<br>Preparar el VPS desde cero con Ansible"]
  P1["HU-CAP-182<br>Poner el dominio detrás de Cloudflare con HTTPS y firewall"]
  P0 --> P1
  P2["HU-CAP-183<br>Separar pruebas y producción y manejar los secretos"]
  P1 --> P2
```

Ciclo de vida de **publicación**:

```mermaid
stateDiagram-v2
  [*] --> PR : cambio
  PR --> MAIN : CI en verde y revisión
  MAIN --> PRUEBAS : imágenes en GHCR y migraciones
  PRUEBAS --> PRODUCCION : tag vX.Y.Z
  PRODUCCION --> ANTERIOR : volver atrás (RB-CAP-001)
  ANTERIOR --> PRODUCCION : corrección y nuevo tag
```

## 4 DIAGRAMA DE ARQUITECTURA

```mermaid
flowchart TB
  subgraph Canales
    C0["GitHub: PR y tags"]
    C1["Panel de Dokploy"]
    C2["SSH con llave"]
  end
  subgraph API["API / Seguridad"]
    CF["Cloudflare"] --> G["NestJS · guard de permisos (ADR-008)"]
  end
  subgraph Servicios
    M["módulo plataforma (infra/ y .github/)"]
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
  M --> X0["Copias B2/R2 · GlitchTip"]
```

| Aspecto | Detalle |
| --- | --- |
| Decisiones clave (ADR) | ADR-001 Plataforma: monolito modular en NestJS con front React y monorepo; ADR-011 Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions; ADR-014 Auditoría de acciones: qué se registra, inmutabilidad con huella encadenada y conservación; ADR-003 Base de datos PostgreSQL con acceso por Prisma; ADR-012 Archivos en el VPS, copias de seguridad y vigilancia del sistema |
| Integración | Externos: Copias B2/R2 · GlitchTip |
| Ambientes | Local, pruebas aislado (staging) y producción en el VPS (DT-39, ADR-011) |
| Seguridad | JWT y permisos por rol en el servidor (ADR-008); datos personales (ADR-005) |
| Datos personales | Sí: ver ADR-005 y DAT-CAP-001 §7 |

## 5 RIESGOS

| ID | Riesgo | Prob. | Impacto | Mitigación | Dueño | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-11 | Riesgo de roadmap (ver PLT-01) | — | — | Según roadmap | Ver PLT-01 | Abierto |
| R-FT-PLA-02-01 | Si no se resuelve «¿Quién tiene la cuenta de Cloudflare y la de punto.pe? Propuesta: a nombre del negocio, con José como administrador», hay que rehacer criterios o pantallas | Media | Medio | Resolver con Kevin antes de G4 con la propuesta escrita en la feature | Kevin | Abierto |

## 6 DECISIÓN Y APROBACIÓN

☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento

**Propuesta IA: NO READY.** Motivos: G0 a G3 sin aprobar (DT-48); ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-012 propuestos, no aprobados (G3); tareas sin estimar. Lo que sí está listo: historias con criterios verificables, casos de prueba 1 a 1, modelo de datos probado y dependencias identificadas. Con las firmas de G2 y G3 y la estimación, pasaría a **READY CON CONDICIONES**. La decisión es del PO.

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner | José Ángel Espinoza |  |  |
| Líder técnico / Arquitecto | José Ángel Espinoza |  |  |
| QA | José Ángel Espinoza |  |  |
| UX | José Ángel Espinoza |  |  |

---

Generado por IA: DoR armado desde FT-PLA-02, sus historias, los ADR ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DAT-CAP-001 (ER desde las claves foráneas del DDL) y el plan de pruebas — Revisado por: (pendiente)
