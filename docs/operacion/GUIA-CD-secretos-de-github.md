# Guía Paso a Paso: Secretos, Entornos de GitHub y Llave SSH de Despliegue

Esta guía está dirigida al operador humano (**José Ángel Espinoza**) para configurar de forma segura el despliegue continuo mediante GitHub Actions por SSH hacia el VPS de Contabo, sin exponer claves privadas en chats ni repositorios.

---

## 1. Generación de la Llave SSH Dedicada para Despliegues

Para aislar el acceso de CI/CD de tu llave SSH personal, genera un par de llaves Ed25519 exclusivo para GitHub Actions.

Ejecuta en tu terminal local:
```bash
# Generar par de llaves exclusivo (sin passphrase para permitir uso en CI)
ssh-keygen -t ed25519 -C "github-actions-deploy-caprichos" -f ~/.ssh/id_ed25519_caprichos_github
```

Esto generará dos archivos:
1. `~/.ssh/id_ed25519_caprichos_github` (Llave **PRIVADA** — va exclusivamente a GitHub Secrets).
2. `~/.ssh/id_ed25519_caprichos_github.pub` (Llave **PÚBLICA** — va al VPS).

---

## 2. Autorizar la Llave Pública en el VPS

Copia la llave pública al usuario `deploy` del VPS:

```bash
# Opción directa con ssh-copy-id:
ssh-copy-id -i ~/.ssh/id_ed25519_caprichos_github.pub -p 22 deploy@207.244.232.127

# O manualmente conectándote al servidor:
cat ~/.ssh/id_ed25519_caprichos_github.pub | ssh -i ~/.ssh/id_ed25519_caprichos_vps deploy@207.244.232.127 \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### Probar la conexión SSH con la nueva llave:
```bash
ssh -i ~/.ssh/id_ed25519_caprichos_github deploy@207.244.232.127 "echo 'Conexión SSH exitosa con llave dedicada'"
```

---

## 3. Generar el Token de Lectura para GHCR (`GHCR_READ_TOKEN`)

El VPS necesita permisos para descargar (`docker pull`) las imágenes privadas desde GitHub Container Registry (`ghcr.io/joseem26/*`).

1. En GitHub, ve a tu perfil (arriba a la derecha) > **Settings**.
2. Al final del menú izquierdo, haz clic en **Developer settings** > **Personal access tokens** > **Tokens (classic)**.
3. Clic en **Generate new token** > **Generate new token (classic)**.
4. **Note:** `caprichos-vps-ghcr-reader`
5. **Expiration:** 90 days o No expiration (según política de rotación).
6. **Scopes (Permisos):**
   - Selecciona únicamente: `read:packages` (Download packages from GitHub Container Registry).
7. Haz clic en **Generate token** y copia el token generado (`ghp_...`).

---

## 4. Configurar Entornos y Secretos en GitHub

En el repositorio privado **`JoseEM26/caprichos`**:

### 4.1 Entornos en GitHub (`demo` y `prod`) y Restricción de Plan Free
> [!IMPORTANT]
> **Ajuste por Plan Free de GitHub:** Los repositorios privados bajo el plan gratuito de GitHub **NO admiten reglas de protección de entorno como 'Required reviewers'** (la API de GitHub responde con error HTTP 422 si se intenta activar).
> Por este motivo, la aprobación de producción **no depende de revisores en la UI de GitHub**, sino de una **puerta de control manual deliberada en el workflow**:
> - Producción **NUNCA** se despliega por push de tags.
> - Solo se puede invocar manualmente mediante `workflow_dispatch`.
> - Exige escribir la palabra literal `PRODUCCION` en el campo de confirmación.
> - Valida criptográficamente que el tag `vX.Y.Z` exista y que su commit esté formalmente integrado en la rama `main`.
> *(Si en el futuro la organización contrata GitHub Team o GitHub Pro, se podrá volver a exigir revisores obligatorios en la configuración del entorno).*

1. Ve a **Settings** > **Environments** (menú izquierdo).
2. Crea los entornos:
   - `demo` (sin reglas de protección).
   - `prod` (sin reglas de protección; se utiliza para asociar auditoría y agrupar futuros secretos por ambiente).

### 4.2 Secretos de Despliegue en GitHub
Ve a **Settings** > **Secrets and variables** > **Actions** > pestaña **Secrets**. Los siguientes secretos deben estar cargados (o verificar que ya existan con estos nombres exactos):

| Nombre del Secreto | Valor / Formato | Propósito |
|---|---|---|
| `SSH_HOST` | `207.244.232.127` | IP pública del VPS Contabo |
| `SSH_USER` | `deploy` | Usuario de despliegue en el VPS |
| `SSH_KEY` | *(Contenido de `~/.ssh/id_ed25519_caprichos_github`)* | Llave privada para conectar por SSH al VPS |
| `SSH_KNOWN_HOSTS` | *(Salida de `ssh-keyscan -H 207.244.232.127`)* | Fingerprint del servidor SSH para validación estricta |
| `GHCR_READ_TOKEN` | *(Token clásico con permiso `read:packages`)* | Token para que el VPS ejecute `docker login` y `docker pull` |

---

## 5. Procedimiento para Desplegar

### 5.1 Despliegue Automático en Demo
- Cualquier push a la rama `ola-1` o a la rama `main` ejecuta automáticamente el pipeline de compilación, escaneo Trivy y despliegue hacia el ambiente **Demo**.

### 5.2 Despliegue Deliberado a Producción (Paso a Paso)
Cuando una versión esté lista para producción:
1. Asegúrate de que el código esté integrado en `main`.
2. Crea y sube el tag anotado en tu máquina local:
   ```bash
   git checkout main
   git pull origin main
   git tag -a v0.3.0 -m "release: version v0.3.0 para produccion"
   git push origin v0.3.0
   ```
3. En GitHub, ve a la pestaña **Actions** > **Deploy Caprichos por SSH**.
4. Haz clic en el botón desplegable **Run workflow**:
   - **Branch:** `main`
   - **Ambiente a desplegar:** `prod`
   - **Tag de versión:** `v0.3.0`
   - **Confirmación:** Escribe exactamente `PRODUCCION`
5. Haz clic en **Run workflow**.
6. El primer job (`validar-y-determinar`) validará que la palabra sea `PRODUCCION`, que el tag `v0.3.0` exista en el repo y que pertenezca a la historia de `main`. Si todo es correcto, compilará, escaneará y desplegará en el VPS por SSH.
