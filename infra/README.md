# Infraestructura y Despliegue — Caprichos

Este directorio contiene la automatización de aprovisionamiento del servidor VPS para la plataforma digital de **Caprichos** (Lima, Perú), así como la guía completa para la exposición segura mediante Cloudflare y la operación del entorno.

> **Referencias obligatorias:**
> - [operacion/RB-CAP-004: Runbook: preparar un servidor nuevo](../docs/operacion/RB-CAP-004-preparar-un-servidor-nuevo.md)
> - [operacion/INV-CAP-001: Inventario de infraestructura](../docs/operacion/INV-CAP-001-inventario-de-infraestructura.md)
> - [adr/ADR-011: VPS con Dokploy, Ansible, Cloudflare y CI/CD](../docs/adr/ADR-011-infraestructura-vps-dokploy-cloudflare-y-ci-cd.md)
> - [features/FT-PLA-02: Servidor, red, ambientes y secretos](../docs/features/FT-PLA-02-servidor-red-ambientes-y-secretos.md) (HU-CAP-181, HU-CAP-182)

---

## 1. Arquitectura de Infraestructura

- **VPS Host:** Ubuntu LTS, 8 vCPU, 8 GB RAM, 100 GB SSD (DT-30).
- **Aprovisionamiento:** Ansible (`infra/ansible/site.yml`).
- **Seguridad:**
  - Acceso SSH endurecido: puerto 22 limitado con rate limiting, exclusivamente mediante llave SSH, `PermitRootLogin no`, `PasswordAuthentication no`.
  - Firewall UFW: Política entrante por defecto `deny`; puertos 80 (HTTP) y 443 (HTTPS) permitidos **única y exclusivamente desde las IPs oficiales de Cloudflare**.
  - Fail2ban: Detección y bloqueo automático de ataques de fuerza bruta hacia SSH integrándose con UFW.
  - Parches desatendidos: `unattended-upgrades` para aplicación automática de actualizaciones de seguridad del SO.
- **Motor de Aplicaciones:** Docker CE oficial + Docker Compose / Swarm.
- **Plataforma de Despliegue:** Dokploy (versión fijada `v0.30.8`) con Traefik como proxy inverso interno.
- **Perímetro de Red:** Cloudflare (DNS, WAF, CDN/Proxy, Certificado SSL/TLS Full Strict, Cloudflare Access para proteger el panel).

---

## 2. Preparación y Ejecución de Ansible

### 2.1 Requisitos previos en la máquina del operador
- Ansible 2.14 o superior.
- Llave privada SSH con acceso inicial al VPS (ya sea provisionada por el proveedor o inyectada en el rescate).
- Docker (si se desea ejecutar validaciones o linting en local).

### 2.2 Configuración del inventario
1. Copiar la plantilla de inventario:
   ```bash
   cd infra/ansible
   cp inventory.example.ini inventory.ini
   ```
2. Editar `inventory.ini` con la IP real del VPS y la ruta a tu llave privada:
   ```ini
   [vps]
   vps-caprichos-prod ansible_host=203.0.113.10 ansible_user=deploy ansible_ssh_private_key_file=~/.ssh/id_ed25519

   [prod]
   vps-caprichos-prod
   ```
3. En `group_vars/all.yml` (o en variables locales de despliegue), confirmar que `deploy_user_ssh_public_key` contiene la llave pública de José Ángel Espinoza.

### 2.3 Ejecución del Playbook
Para aprovisionar el servidor desde cero:
```bash
ansible-playbook -i inventory.ini site.yml
```

Si el servidor es completamente virgen y solo admite conexión como `root`:
```bash
ansible-playbook -i inventory.ini site.yml -u root --extra-vars "ansible_user=root"
```

### 2.4 Verificación de Idempotencia
Al terminar la primera ejecución, vuelve a correr el comando inmediatamente:
```bash
ansible-playbook -i inventory.ini site.yml
```
**Resultado esperado:** Todas las tareas deben reportar `ok` y el resumen final debe mostrar `changed=0, failed=0`.

---

## 3. Configuración de Red y DNS (Migración a Cloudflare)

El dominio `caprichos.pe` está registrado en **punto.pe** (NIC Perú). La delegación DNS y la seguridad perimetral se delegan a **Cloudflare**.

### 3.1 Pasos en punto.pe
1. Iniciar sesión en el portal de [punto.pe](https://punto.pe).
2. Localizar el dominio administrado `caprichos.pe`.
3. Ir a la sección de **Servidores de Nombres (DNS / Name Servers)**.
4. Cambiar los servidores DNS actuales por los asignados por la cuenta de Cloudflare (por ejemplo, `ns1.cloudflare.com` y `ns2.cloudflare.com`).
5. Guardar los cambios y esperar el tiempo de propagación de los registros NS (habitualmente entre 15 minutos y 2 horas).

### 3.2 Pasos en Cloudflare (DNS y Proxy)
1. En el panel de Cloudflare, ingresar a la zona `caprichos.pe`.
2. En la sección **DNS > Records**, crear los siguientes registros tipo `A`, apuntando todos a la IP pública del VPS con **Proxy status: Proxied** (nube naranja activada):

| Tipo | Nombre (Subdominio) | Contenido / Destino | Proxy Status | Propósito |
|---|---|---|---|---|
| `A` | `@` (`caprichos.pe`) | `<IP-DEL-VPS>` | Proxied | Carta virtual y catálogo público |
| `A` | `admin` | `<IP-DEL-VPS>` | Proxied | Módulo administrativo y pantallas de cocina |
| `A` | `api` | `<IP-DEL-VPS>` | Proxied | API NestJS y servidor WebSocket (Socket.IO) |
| `A` | `staging` | `<IP-DEL-VPS>` | Proxied | Ambiente de pruebas aislado |
| `A` | `panel` | `<IP-DEL-VPS>` | Proxied | Panel Dokploy, Uptime Kuma y GlitchTip |

> **Nota:** La activación del proxy oculta por completo la IP real del VPS en las consultas DNS públicas mundiales.

### 3.3 Configuración de SSL/TLS (HTTPS Completo / Full Strict)
1. En Cloudflare, navegar a **SSL/TLS > Overview**.
2. Seleccionar el modo de cifrado: **Full (strict)** / **Completo (estricto)**. Esto garantiza que la comunicación entre Cloudflare y el VPS esté cifrada con validación de certificado.
3. En **SSL/TLS > Edge Certificates**:
   - Activar **Always Use HTTPS** (redirección 301 automática de HTTP a HTTPS).
   - Activar **HTTP Strict Transport Security (HSTS)** (max-age recomendado: 6 meses o 1 año).
   - Fijar **Minimum TLS Version** en `TLS 1.2` (o `1.3`).
4. En **SSL/TLS > Origin Server**:
   - Crear un **Origin Certificate** (Certificado de Origen) de Cloudflare con validez de 15 años para `*.caprichos.pe` y `caprichos.pe`.
   - Guardar el certificado (`cert.pem`) y la llave privada (`key.pem`) para instalarlos en el proxy Traefik gestionado por Dokploy.

### 3.4 Protección del Panel de Dokploy con Cloudflare Access (Zero Trust)
Para cumplir con el requerimiento **RQ-PLA-02-04** y **ADR-011**, el subdominio `panel.caprichos.pe` no debe estar expuesto a internet general:
1. Acceder a **Cloudflare Zero Trust Dashboard** > **Access** > **Applications**.
2. Hacer clic en **Add an Application** y seleccionar **Self-hosted**.
3. **Application Configuration:**
   - Application name: `Caprichos Control Panel`
   - Application domain: `panel.caprichos.pe`
4. **Policy Configuration:**
   - Policy name: `Allow Dev & Operations`
   - Action: `Allow`
   - Rule type (Include): `Emails` o `Email domain`.
   - Valor: Correo autorizado de José Ángel Espinoza (`jose@caprichos.pe`).
5. Guardar la aplicación.
6. **Efecto:** Cualquier usuario o escáner que intente abrir `https://panel.caprichos.pe` será interceptado en el borde de Cloudflare solicitando verificación de identidad mediante código PIN de un solo uso (OTP) por correo electrónico, antes de que el tráfico toque el VPS.

---

## 4. Primer Acceso a Dokploy y Configuración Inicial

Dado que UFW bloquea el puerto 3000 desde el exterior y los puertos 80/443 solo aceptan tráfico proveniente de las IPs de Cloudflare:
1. Abrir un túnel SSH seguro desde tu equipo local:
   ```bash
   ssh -L 3000:localhost:3000 deploy@<IP-DEL-VPS>
   ```
2. Abrir el navegador en `http://localhost:3000`.
3. Completar el asistente de bienvenida creando el usuario administrador y contraseña maestra.
4. En **Settings > Server Domain**, configurar `panel.caprichos.pe` para que Traefik gestione el enrutamiento interno.
5. Conectar GitHub Container Registry (GHCR):
   - Crear un Personal Access Token (PAT) en GitHub con permisos `read:packages`.
   - Registrar la credencial en Dokploy para permitir la descarga de las imágenes privadas `ghcr.io/joseem26/caprichos-api` y `ghcr.io/joseem26/caprichos-web`.

---

## 5. Pasos Manuales Fuera del Alcance de Ansible

Por políticas de seguridad, delegación externa o requerimiento de interacción humana, los siguientes pasos **no se pueden automatizar en el playbook** y deben ejecutarse manualmente siguiendo [operacion/RB-CAP-004](../docs/operacion/RB-CAP-004-preparar-un-servidor-nuevo.md):

1. **Gestión en punto.pe:** Modificación manual de los Name Servers del dominio `caprichos.pe` hacia Cloudflare (portal externo peruano).
2. **Dashboard de Cloudflare:** Creación de la zona, registros DNS `A` para subdominios (`admin`, `api`, `staging`, `panel`), configuración de cifrado Full Strict y emisión del Certificado de Origen.
3. **Cloudflare Access (Zero Trust):** Configuración de la política de autenticación para `panel.caprichos.pe`.
4. **Inicialización de Dokploy:** Creación del usuario y contraseña inicial de Dokploy mediante túnel SSH (`localhost:3000`).
5. **Carga de Secretos de Negocio en Dokploy:** Los valores sensibles (`DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `WHATSAPP_TOKEN`, claves de B2/R2) residen exclusivamente en el gestor de contraseñas de José Ángel y se cargan manualmente en las variables de entorno de cada servicio en Dokploy (DT-43).
6. **Configuración en Meta Developers:** Registro de la URL de webhook `https://api.caprichos.pe/webhook/whatsapp` y verificación del token en la consola de WhatsApp Cloud API.
7. **Monitoreo en Uptime Kuma:** Creación de los 6 monitores (carta, `/salud`, websocket, webhook de WhatsApp, agente de impresión y respaldo diario) y configuración del canal de alertas de Telegram.
