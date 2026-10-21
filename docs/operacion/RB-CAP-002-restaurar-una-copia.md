---
id: RB-CAP-002
tipo: runbook
titulo: "Runbook: restaurar una copia de seguridad"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [FT-PLA-03, HU-CAP-185, ADR-012, DT-31, DT-47, RB-CAP-004]
tags: [runbook, copias, restauracion, devops]
---

# RB-CAP-002 — Restaurar una copia de seguridad

| Campo | Valor |
|---|---|
| Cuándo usarlo | Se perdió o dañó la base o las fotos; se borró un dato por error; prueba trimestral de restauración |
| Tiempo esperado | Restauración completa: menos de 1 hora (meta) · Un solo dato: unos 20 minutos |
| Quién lo ejecuta | Quien tenga acceso SSH al VPS y la clave de restic |
| Riesgo | Alto si se restaura sobre producción: **siempre se restaura primero en una base aparte** |
| Feature | FT-PLA-03 (HU-CAP-185) · ADR-012 · DT-31 · DT-47 |

## Qué hay en cada copia

- Volcado de PostgreSQL de **producción** y de **pruebas** (`pg_dump -Fc`).
- Carpetas `/data/uploads/publico` (fotos) y `/data/uploads/privado` (comprobantes de pago).
- Cifrado con restic y guardado fuera del VPS (Backblaze B2 o Cloudflare R2). 30 diarias y 6 mensuales.

## Antes de empezar

- [ ] Tienes la **clave de restic** y el acceso al almacenamiento (están en el gestor de contraseñas, no solo en el VPS).
- [ ] Sabes qué quieres recuperar: todo, la base, las fotos o un solo registro, y de qué fecha.
- [ ] Si es producción, avisaste a Kevin que el sistema puede estar en mantenimiento.

## A. Ver las copias disponibles

```bash
ssh deploy@<vps>
export RESTIC_REPOSITORY=<repositorio>      # valor en el gestor de contraseñas
export RESTIC_PASSWORD_FILE=~/.restic-pass  # o pegar la clave al pedirla
# más las variables de acceso del almacenamiento (B2_ACCOUNT_ID/KEY o AWS_* para R2)
restic snapshots --tag caprichos
```

## B. Recuperar un solo dato borrado por error (sin tocar producción)

1. Restaura la copia de la fecha elegida en una carpeta temporal:
   ```bash
   restic restore <id-snapshot> --target /tmp/restaurar --include /backups/prod.dump
   ```
2. Créala como base aparte y carga el volcado:
   ```bash
   docker exec -i caprichos-postgres createdb -U caprichos restaurada
   docker exec -i caprichos-postgres pg_restore -U caprichos -d restaurada < /tmp/restaurar/backups/prod.dump
   ```
3. Busca el registro en `restaurada` y cópialo a producción con un `INSERT` revisado (o desde la pantalla si existe).
   - La tabla `auditoria` **no se toca**: no admite cambios (ADR-014).
4. Borra la base y la carpeta temporales: `dropdb restaurada` y `rm -rf /tmp/restaurar`.

## C. Restauración completa

1. Si el VPS se perdió, primero sigue **RB-CAP-004** para preparar uno nuevo.
2. Pon producción en mantenimiento: en Dokploy, detén `api` y `web` de producción.
3. Restaura la base:
   ```bash
   restic restore <id-snapshot> --target /tmp/restaurar
   docker exec -i caprichos-postgres dropdb -U caprichos caprichos
   docker exec -i caprichos-postgres createdb -U caprichos caprichos
   docker exec -i caprichos-postgres pg_restore -U caprichos -d caprichos < /tmp/restaurar/backups/prod.dump
   ```
4. Restaura las carpetas:
   ```bash
   rsync -a /tmp/restaurar/data/uploads/ /data/uploads/
   ```
5. Arranca `api` y `web` en Dokploy y comprueba con la tabla de **D**.
6. Lo ocurrido entre la copia y el fallo **se perdió**: avisa a Kevin para revisar los pedidos y cobros de ese rato con los comprobantes en papel o en WhatsApp.

## D. Comprobar

| Comprobación | Resultado esperado |
|---|---|
| `/salud` | `200` |
| Último pedido del día de la copia | Aparece con sus líneas y su cobro |
| Una foto de producto y un comprobante de pago | Se ven (el comprobante solo con sesión de caja) |
| Verificación de la cadena de auditoría | 0 eslabones rotos |
| Uptime Kuma | Todo en verde |

## Prueba trimestral (DT-47)

El primer lunes de cada trimestre: restaurar la copia del día en el **ambiente de pruebas** siguiendo C (sin tocar producción) y anotar el tiempo.

| Fecha | Quién | Copia restaurada | Tiempo total | ¿Completa? | Notas |
|---|---|---|---|---|---|
| *(pendiente: primera prueba antes del piloto)* | | | | | |

---

Generado por IA: runbook propuesto desde ADR-012, DT-31, DT-47 y FT-PLA-03; nombres de contenedores y rutas se ajustan al construir — Revisado por: (pendiente)
