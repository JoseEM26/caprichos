---
id: RB-CAP-001
tipo: runbook
titulo: "Runbook: publicar una versión y volver atrás"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [FT-PLA-01, HU-CAP-180, ADR-011, ADR-003, DT-41, REL-CAP-001]
tags: [runbook, despliegue, rollback, devops]
---

# RB-CAP-001 — Publicar una versión y volver atrás

| Campo | Valor |
|---|---|
| Cuándo usarlo | Para publicar en producción, o cuando una versión publicada falla y hay que volver a la anterior |
| Tiempo esperado | Publicar: unos 10 minutos · Volver atrás: menos de 10 minutos |
| Quién lo ejecuta | Quien tenga acceso de escritura al repositorio y al panel de Dokploy |
| Riesgo | Medio: afecta a la carta, al administrativo y al bot |
| Feature | FT-PLA-01 (HU-CAP-180) · ADR-011 · DT-41 |

## Antes de empezar

- [ ] El cambio está unido a `main` y **publicado en pruebas** (`https://staging.caprichos.pe/version` muestra el commit).
- [ ] Se probó en pruebas lo que cambia (y los E2E del plan de pruebas si es una versión grande).
- [ ] Las migraciones nuevas son **compatibles hacia atrás**: solo agregan; lo que se quita va en una versión posterior (ADR-003).
- [ ] No es hora punta. Mejor publicar fuera del horario de atención o entre 15:00 y 17:00.
- [ ] Hay copia del día verificada (monitor «copia» en verde en Uptime Kuma).

## A. Publicar en producción

1. En tu equipo, desde `main` actualizado:
   ```bash
   git switch main && git pull
   git tag -a v0.4.0 -m "v0.4.0: <qué cambia, en una línea>"
   git push origin v0.4.0
   ```
2. GitHub Actions corre `deploy-prod.yml`: comprueba que la imagen de ese commit ya pasó el CI, aplica las migraciones de Prisma (`prisma migrate deploy`) y le pide a Dokploy que publique la imagen `ghcr.io/joseem26/caprichos-api:v0.4.0` y la de `web`.
3. Mira el flujo en GitHub → *Actions* hasta que termine en verde.

## B. Comprobar que funcionó

| Comprobación | Cómo | Resultado esperado |
|---|---|---|
| Versión | `curl -s https://api.caprichos.pe/version` | `v0.4.0` y el commit |
| Salud | `curl -s -o /dev/null -w "%{http_code}" https://api.caprichos.pe/salud` | `200` |
| Carta | Abrir `https://caprichos.pe` en el celular | Carga y muestra productos |
| Administrativo | Entrar con un usuario de prueba de cada rol crítico (caja, cocina) | Ve su escritorio |
| Vigilancia | Uptime Kuma | Todo en verde |
| Errores | GlitchTip, últimos 10 minutos | Sin errores nuevos repetidos |

Si algo falla, pasa a **C** sin intentar arreglarlo en caliente.

## C. Volver atrás (rollback)

1. Identifica la versión anterior buena: `git tag --sort=-creatordate | head -3` (por ejemplo `v0.3.2`).
2. En Dokploy → servicio `api` de producción → *Deployments* → elige el despliegue de `v0.3.2` → **Redeploy**. Repite con `web`.
   - Alternativa por consola: volver a correr el flujo `deploy-prod.yml` con la entrada `tag = v0.3.2`.
3. **No se revierten migraciones**: como solo agregan columnas o tablas, la versión anterior sigue funcionando con la base nueva. Si una migración rompió datos, sigue RB-CAP-002 (restaurar en una base aparte y corregir).
4. Comprueba con la tabla de **B** que `/version` muestra `v0.3.2`.
5. Anota el incidente en la tabla de abajo y abre un issue con la causa.

## D. Avisar

- Si la carta o la caja estuvieron caídas más de 5 minutos en horario de atención, avisa a Kevin por WhatsApp: qué pasó, cuánto duró y que ya está resuelto.
- Si un cambio quedó a medias (por ejemplo, la versión nueva tenía una función que ya se anunció), avísalo también.

## Registro de publicaciones fallidas

| Fecha | Versión | Qué falló | Se volvió a | Tiempo | Causa |
|---|---|---|---|---|---|
| | | | | | |

## Pruebas de este runbook

| Fecha | Quién lo siguió | Ambiente | Resultado | Tiempo |
|---|---|---|---|---|
| *(pendiente: probar en pruebas antes del piloto)* | | | | |

---

Generado por IA: runbook propuesto desde ADR-011, ADR-003, DT-41 y FT-PLA-01; los comandos exactos se ajustan al construir los flujos de GitHub Actions — Revisado por: (pendiente)
