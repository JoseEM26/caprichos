---
name: aybar-plan-pruebas
description: Use cuando hay que crear o actualizar el Plan de Pruebas (T-TEST-PLAN) de un servicio en el marco Aybar (gate G4), asegurando la cobertura exhaustiva de criterios de HU (TC-IDN-<HU>-<NN>), complementos, adversariales, performance, regresión y el anexo de trazabilidad (incluye pruebas de plataforma, restauración y seguridad de salida).
---

# Aybar · Plan de Pruebas (T-TEST-PLAN)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/pruebas/`** — archivo `test-plan.md`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

Guía especializada para redactar y estructurar el Plan de Pruebas bajo el formato estándar Aybar. Este artefacto es un prerrequisito de calidad para el cierre del **Gate G4** (Ready for Sprint) y fija la línea base de verificación que se ejecuta en **G6**.

Modelo de referencia en el paquete:
- `pruebas/test-plan.md`

## 1. Para qué sirve y Gate

- **Propósito:** Consolidar la estrategia de aseguramiento de calidad del servicio, definiendo los ciclos de prueba (0 a 3), los casos de prueba exhaustivos derivados directamente de cada criterio de aceptación de las HU de capa A, los casos adversariales/seguridad, performance, regresión y la matriz de defectos/NFRs.
- **Gate:** Entra en **G4** (definición completa sin ejecutar) y se ejecuta y evidencia formalmente en **G6**.

## 2. Convención de archivos y Frontmatter obligatorio

- **Ruta y nombre:** `pruebas/test-plan.md` (o `pruebas/TP-<DOM>-###.md`).
- **Frontmatter YAML obligatorio** (exactamente en este orden):

```yaml
---
id: TP-<DOM>-###
tipo: test-plan
titulo: "Plan de pruebas de <nombre-servicio> — <ticket>"
estado: draft
producto: aybarcorp
version: "1.0"
owner: "(pendiente — R16)"
aprobadores: []
fecha: YYYY-MM-DD
relacionados: [AYB-1042, EP-<DOM>-###, FT-<AREA>-##, ...]
tags: [test-plan, roles-permisos, qa, g4, g6, t3]
---
```

## 3. Secciones obligatorias en orden estricto

Tomadas directamente del modelo oficial `pruebas/test-plan.md`:

1. `# Test Plan (T-TEST-PLAN) - G6 · <servicio>`
   - Metadatos iniciales en lista viñetada: Ticket, HUs referenciadas (capa A activas, capa B diferidas), Tipo (T3), propuesta de Flujos críticos E2E para confirmación del PO, enlace a `analisis/decisiones.md` como fuente de verdad y advertencia de estado («plan, nada ejecutado»).
2. `## Ciclos ejecutados (referencia: qa-ciclos.md)`
   - Tabla de ciclos: `| Ciclo | Fecha | Casos | Fallidos | % | Sev x Impacto | Resultado | Valida |` (Ciclos 0 Perf+Sec, 1 Funcional, 2 Integral, 3 UAT).
   - Detalle de qué casos entran a cada ciclo y criterios de salida (umbrales de fallos). Las columnas de ejecución quedan vacías al redactar el plan.
3. `## Casos`
   - Reglas de convención: nomenclatura `TC-IDN-<HU>-<NN>` para cada criterio de aceptación, entregas (E1, E1 si cabe / E2, Después), tipos (func, E2E, API, integ, regres, advers) y aviso de datos sintéticos.
   - Tablas agrupadas por subsecciones (`### <Nombre módulo / Épica>`):
     - `| ID | Caso | Tipo (func/E2E/API/integ/regres/advers) | Resultado | Evidencia (commit) |`
     - Subsecciones obligatorias: Módulos funcionales de capa A, `### Flujos críticos E2E`, `### Adversariales y de seguridad (Ciclo 0)`, `### Performance y disponibilidad (Ciclo 0)`, `### Regresión` y `### Capa B — Después (sin casos detallados)`.
4. `## Defectos`
   - Tabla: `| ID | Severidad | Impacto negocio | Estado | Plan (mayores: aprueba PO) |` (vacía al crear el plan).
   - Metas de NFRs numéricos (latencia p95, disponibilidad, TTL de token, logs, etc.) y valores medidos.
   - Bloque de trazabilidad: `Ejecutado por IA: (nada ejecutado; plan generado por IA) - Consolidado y aprobado por: QA (pendiente — R16)`.
5. `## Anexo — HU → casos`
   - Tabla de reconciliación: `| HU | Entrega | Criterios en la HU | Casos TC-<HU> | De ellos, complementos |`
   - Conteo total consolidado de criterios, casos de HU, complementos, E2E, SEC, PERF, REG y total general.

## 4. Reglas críticas y errores típicos

- **Correspondencia 1 a 1 de criterios:** Hay exactamente un caso `TC-IDN-<HU>-<NN>` por cada criterio `CA-N` de las HUs de capa A. Si se añade un caso no presente en los CA de la HU, se clasifica obligatoriamente como **complemento** con numeración posterior y se documenta su origen (RQ, decisión D-## o contrato OpenAPI).
- **Nada ejecutado:** Las columnas `Resultado` y `Evidencia (commit)` quedan vacías. La IA nunca inventa resultados de ejecución ni commits de prueba inexistentes.
- **Datos 100% sintéticos:** Solo cuentas de prueba (9001, 9002), emails `@ejemplo.test`, empresas sintéticas (3, 7) e IPs RFC 5737 (`203.0.113.0`). Prohibido usar datos de producción o documentos reales.
- **Trazabilidad estricta:** Todos los tickets (`AYB-1042`), HUs, Épicas y ADRs citados deben existir físicamente en el repositorio.
- **Capa B en espera:** Las HUs de capa B no se detallan con casos individuales hasta que su modelo de datos y dependencias estén aprobados en G3; se listan como bloque diferido.

## 5. Checklist de verificación final

Antes de concluir el Plan de Pruebas:
- [ ] Frontmatter completo con los 11 campos obligatorios.
- [ ] Todo criterio de cada HU de capa A tiene su caso mapeado `TC-IDN-<HU>-<NN>`.
- [ ] Flujos E2E, casos adversariales (SEC), performance (PERF) y regresión (REG) definidos.
- [ ] Tabla del anexo de reconciliación `HU → casos` cuadra matemáticamente con el total de casos del plan.
- [ ] Columnas de ejecución vacías y notas de trazabilidad de IA presentes.
- [ ] Verificación automatizada ejecutando:
  ```bash
  python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'
  ```

## DevOps, plataforma e infraestructura (DT-51)

- Los casos de seguridad (`SEC-##`) se enlazan con los controles de la **revisión de seguridad** `operacion/SEC-<DOM>-###` (G7): cada control crítico debe tener al menos un caso.
- Los casos de rendimiento y disponibilidad (`PERF-##`) incluyen **restaurar una copia en el tiempo meta** y la RAM del servidor en hora punta.
- Las historias de plataforma tienen sus `TC-` 1 a 1 como cualquier HU, ejecutados en el ambiente de pruebas.
- El **plan de release** (`operacion/REL-`) usa los E2E de este plan como prueba de humo del día de salida.
