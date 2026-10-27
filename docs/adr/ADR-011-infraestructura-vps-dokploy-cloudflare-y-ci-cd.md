---
id: ADR-011
tipo: adr
titulo: "Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, D-12, DT-30, DT-39, DT-40, DT-41, DT-42, DT-43, DEP-02, RNF-CAP-003, ADR-015, ADR-016]
tags: [adr, infraestructura, devops, dokploy, cloudflare, g3]
---

# ADR-011: Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD con GitHub Actions

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)
- **Ampliado / Sustituido parcialmente por:** **ADR-015** (sustitución de Dokploy por Docker Compose autónomo y GitHub Actions por SSH) y **ADR-016** (despliegue sin corte con docker-rollout, Traefik, colas BullMQ y Socket.IO con Redis).

## Contexto

Hay un VPS contratado (actualizado el 20/10/2026): Contabo Cloud VPS 6 con 6 vCPU, 12 GB de RAM, 200 GB SSD, 2 snapshots, 300 Mbit/s y tráfico ilimitado, sin Auto Backup, por 1 mes de prueba a US$ 9,20 (DT-30). El dominio `caprichos.pe` está registrado en punto.pe. José eligió Dokploy, Ansible, Cloudflare, GitHub Actions con GHCR, secretos en Dokploy y GitHub, y tres ambientes (DT-39 a DT-43).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** VPS preparado con **Ansible**, apps desplegadas con **Dokploy** desde imágenes de **GHCR** construidas en **GitHub Actions**, detrás de **Cloudflare** | — | Que se necesite alta disponibilidad (dos servidores) o varios locales. |
| Coolify | Su panel consume 0,5 a 1 GB de RAM. | Que Dokploy se abandone como proyecto. |
| Docker Compose sin panel | Todo por consola. | Querer cero RAM de panel. |
| Dokploy construyendo en el VPS | El build gasta CPU y RAM del servidor que atiende al local. | Que se quiera evitar GHCR. |

## Decisión

1. **Ansible** (`infra/ansible`): usuario sin root, SSH solo con llave y puerto 22 limitado, UFW (22, y 80/443 solo para las IP de Cloudflare), fail2ban, parches automáticos, zona horaria de Lima, Docker, Dokploy y las tareas de copia (ADR-012).
2. **Dokploy** gestiona los servicios por ambiente: `api`, `web` (estáticos), `postgres`, `redis`, más `uptime-kuma` y `glitchtip` (ADR-012). Producción y pruebas en redes Docker separadas.
3. **Cloudflare** como DNS y proxy (se cambian los servidores de nombres en punto.pe): `caprichos.pe` (carta), `admin.caprichos.pe`, `api.caprichos.pe`, `staging.caprichos.pe` y `panel.caprichos.pe` (Dokploy, protegido con Cloudflare Access). HTTPS de punta a punta con certificado de origen; caché para `/assets` y fotos.
4. **CI/CD**: en cada PR, lint, pruebas, revisión de dependencias entre módulos y build; Trivy revisa las imágenes. Al unir a `main`: imágenes a GHCR, migraciones de Prisma y despliegue a **pruebas**. Producción se despliega con un tag `vX.Y.Z` aprobado (Conventional Commits).
5. **Secretos** en las variables de Dokploy por ambiente y en GitHub Secrets; nunca en el repo; `.env.example` documenta las claves; hook de pre-commit que bloquea secretos.
6. **Pruebas aislado** (DT-39): base y Redis propios, número de prueba de WhatsApp, impresión a PDF, IA con tope bajo y datos ficticios; se puede apagar fuera de horario.

## Consecuencias

- Obliga a:
  - Cambiar los servidores de nombres de `caprichos.pe` en punto.pe.
  - Documentar el procedimiento para restaurar en un VPS nuevo con Ansible y las copias en menos de 1 hora.
- Impide:
  - Alta disponibilidad: el VPS es un punto único de falla (aceptado para el piloto; mitigado con copias y Ansible).
- Cuesta:
  - VPS US$ 7,27 al mes; Cloudflare, GitHub Actions (cuota gratis) y GHCR gratis; dominio .pe renovado en punto.pe.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: US$ 7,27 al mes más el dominio.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: ninguna.
- Linaje: no aplica.
- Reglas de calidad: ninguna propia.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (D-12, DT-30, DT-39, DT-40, DT-41, DT-42, DT-43) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
