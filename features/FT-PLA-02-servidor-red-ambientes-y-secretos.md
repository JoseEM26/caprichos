---
id: FT-PLA-02
tipo: spec
titulo: "Servidor, red, ambientes y secretos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-01, FT-PLA-03, FT-PLA-05, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DT-30, DT-39, DT-40, DT-42, DT-43, DEP-02, RNF-CAP-003]
tags: [plataforma, plt-03, ep-cap-021, ft-pla-02, debe-tener]
---

# FT-PLA-02 — Servidor, red, ambientes y secretos

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PLATAFORMA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PLA-02 | Servidor, red, ambientes y secretos | EP-CAP-021 Plataforma, despliegue y operación |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (DT-30 · DT-39 · DT-40 · DT-42 · DT-43) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El VPS (8 vCPU, 8 GB, 100 GB; DT-30) se prepara **desde cero con un playbook de Ansible** (`infra/ansible`): usuario sin root, SSH solo con llave, zona horaria de Lima, firewall UFW que solo deja entrar a Cloudflare por 80 y 443, fail2ban, parches automáticos, Docker y Dokploy (DT-40). El dominio `caprichos.pe` (registrado en punto.pe) pasa a **Cloudflare** como DNS y proxy, con HTTPS y los subdominios `admin.`, `api.`, `staging.` y `panel.` (DT-42). **Pruebas y producción** corren en el mismo VPS **aislados**: base y Redis propios, número de prueba de WhatsApp, impresión a PDF y datos ficticios (DT-39). Los **secretos** viven en las variables de Dokploy y en GitHub Secrets, nunca en el repositorio (DT-43). Todo queda descrito en `operacion/INV-CAP-001` y el procedimiento de preparar un servidor nuevo en `operacion/RB-CAP-004`.

**Beneficio esperado.** Poder rehacer el servidor completo en otro VPS en menos de una hora y que pruebas nunca toque a clientes reales. Hipótesis medible: **Un VPS nuevo queda listo con una sola corrida de Ansible**; **0 mensajes o impresiones reales desde pruebas**.

**Usuarios / roles.** Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD) (prepara y opera el servidor).

**Pantallas de referencia.** No tiene pantallas de negocio: se opera desde GitHub, el panel de Dokploy, Uptime Kuma y GlitchTip (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PLA-02-01 | Un playbook de Ansible deja un VPS nuevo listo (usuario, SSH con llave, zona horaria, UFW, fail2ban, parches, Docker, Dokploy) y se puede correr dos veces sin romper nada. | Debe tener | DT-40 | Dado un VPS recién creado, cuando se corre `ansible-playbook site.yml` dos veces seguidas, entonces la segunda corrida no cambia nada y el servidor no acepta SSH con contraseña ni como root. | Propuesto |
| RQ-PLA-02-02 | El firewall solo deja entrar por 80 y 443 desde las IP de Cloudflare, y SSH solo con llave. | Debe tener | DT-42 · ADR-011 | Dado el VPS, cuando alguien abre `http://IP-del-VPS` directo, entonces no responde; por `https://caprichos.pe` sí. | Propuesto |
| RQ-PLA-02-03 | El dominio `caprichos.pe` usa Cloudflare como DNS y proxy con HTTPS de punta a punta y los subdominios acordados. | Debe tener | DT-42 | Dados los servidores de nombres cambiados en punto.pe, cuando se abren `caprichos.pe`, `admin.`, `api.` y `staging.`, entonces responden con HTTPS válido y la IP del VPS no aparece en el DNS público. | Propuesto |
| RQ-PLA-02-04 | El panel de Dokploy solo se abre con acceso restringido. | Debe tener | ADR-011 | Dado `panel.caprichos.pe`, cuando lo abre alguien sin acceso, entonces Cloudflare Access lo bloquea antes de llegar al VPS. | Propuesto |
| RQ-PLA-02-05 | Pruebas y producción corren aislados en el mismo VPS: base, Redis, WhatsApp de prueba, impresión a PDF y datos ficticios. | Debe tener | DT-39 | Dado un pedido de prueba en `staging.`, cuando pasa a cocina, entonces no aparece en producción, el mensaje sale por el número de prueba de Meta y la comanda se genera como PDF. | Propuesto |
| RQ-PLA-02-06 | Los secretos viven en Dokploy y GitHub Secrets; el repositorio solo tiene `.env.example` y un hook que bloquea commits con claves. | Debe tener | DT-43 | Dado un commit que incluye una clave de OpenAI, cuando se intenta, entonces el hook lo rechaza; y `git grep` en el repositorio no encuentra claves reales. | Propuesto |
| RQ-PLA-02-07 | El inventario de infraestructura (servicios, dominios, cuentas, puertos y costos) está al día en INV-CAP-001. | Debería tener | DT-51 | Dado un servicio nuevo en Dokploy, cuando se publica, entonces aparece en INV-CAP-001 con su ambiente, puerto interno y responsable. | Propuesto |
| RQ-PLA-02-08 | El playbook y sus variables viven en el repositorio y RB-CAP-004 explica cómo correrlo en un VPS nuevo. | Debe tener | DT-40 · DT-51 | Dado RB-CAP-004, cuando lo sigue otra persona en un VPS nuevo, entonces deja el servidor listo sin preguntar nada fuera del documento. | Propuesto |
| RQ-PLA-02-09 | El ambiente de pruebas se puede apagar fuera de horario sin afectar a producción. | Debería tener | DT-39 | Dado pruebas encendido, cuando se apaga desde Dokploy a las 23:00, entonces producción sigue respondiendo y la RAM libre del VPS sube cerca de 1 GB. | Propuesto |

Prioridad *Debe tener*: sin servidor, red y ambientes no hay piloto. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica porque pruebas nunca debe usar datos reales de clientes.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| DT-30 | VPS de US$ 7,27/mes con Dokploy. | decisiones.md |
| DT-39 | Tres ambientes; pruebas aislado. | decisiones.md |
| DT-40 | Preparación con Ansible. | decisiones.md |
| DT-42 | Cloudflare como DNS y proxy. | decisiones.md |
| DT-43 | Secretos fuera del repositorio. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PLA-02-01 | HU-CAP-181 | operacion/RB-CAP-004 | R-01 |
| RQ-PLA-02-02 | HU-CAP-182 | — | R-01 |
| RQ-PLA-02-03 | HU-CAP-182 | Cambio en punto.pe | R-01 |
| RQ-PLA-02-04 | HU-CAP-182 | — | R-01 |
| RQ-PLA-02-05 | HU-CAP-183 | — | R-01 |
| RQ-PLA-02-06 | HU-CAP-183 | — | R-11 |
| RQ-PLA-02-07 | HU-CAP-181 | operacion/INV-CAP-001 | R-01 |
| RQ-PLA-02-08 | HU-CAP-181 | operacion/RB-CAP-004 | R-01 |
| RQ-PLA-02-09 | HU-CAP-183 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-181 Preparar el VPS desde cero con Ansible
- HU-CAP-182 Poner el dominio detrás de Cloudflare con HTTPS y firewall
- HU-CAP-183 Separar pruebas y producción y manejar los secretos

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.

**Fuera de alcance**

- Copias: FT-PLA-03.
- Vigilancia: FT-PLA-04.
- Alta disponibilidad con dos servidores (riesgo aceptado, ADR-011).

**Preguntas abiertas**

1. **¿Quién tiene la cuenta de Cloudflare y la de punto.pe?** Propuesta: a nombre del negocio, con José como administrador.

---

Generado por IA: DT-30, DT-39, DT-40, DT-42, DT-43, ADR-011 y DT-51 — Revisado por: *(pendiente)*
