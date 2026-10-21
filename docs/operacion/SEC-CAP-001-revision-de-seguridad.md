---
id: SEC-CAP-001
tipo: seguridad
titulo: "Revisión de seguridad antes del piloto"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [FT-PLA-05, HU-CAP-189, ADR-005, ADR-008, ADR-009, ADR-011, ADR-012, ADR-014, DT-43, RB-CAP-005, TP-CAP-001]
tags: [seguridad, g7, devops]
---

# SEC-CAP-001 — Revisión de seguridad antes del piloto

> Lista de controles para el **Security Gate (G7)**. Cada fila se marca con su evidencia (prueba, captura o commit) cuando se construya. Hoy todo está **pendiente**: no hay código. Un control crítico sin cumplir bloquea la salida (REL-CAP-001, requisito 3).

**Escala:** Crítico (bloquea la salida) · Alto (se resuelve antes de dos semanas) · Medio (se planifica).

## 1. Acceso y sesiones (ADR-008)

| # | Control | Nivel | Evidencia | Estado |
|---|---|---|---|---|
| A1 | Cada endpoint exige permiso por módulo y acción en el servidor; un rol sin permiso recibe 403 | Crítico | Caso SEC-01 del plan de pruebas | Pendiente |
| A2 | Contraseñas y PIN con argon2id; ninguna en texto | Crítico | Revisión de la tabla `user_account` | Pendiente |
| A3 | Primer ingreso obliga a cambiar la contraseña inicial | Alto | HU-CAP-117 | Pendiente |
| A4 | 5 intentos fallidos bloquean; cupones bloquean 5 minutos | Alto | SEC-04 | Pendiente |
| A5 | Token de renovación en cookie `HttpOnly`, `Secure`, `SameSite=Strict`; desactivar un usuario corta su sesión | Alto | SEC-02, SEC-03 | Pendiente |

## 2. Datos personales (ADR-005, Ley 29733)

| # | Control | Nivel | Evidencia | Estado |
|---|---|---|---|---|
| D1 | Sin aceptación no se recuerdan datos del cliente | Alto | HU-CAP-175 | Pendiente |
| D2 | DNI enmascarado en listas; completo solo al administrador y queda en el historial | Alto | HU-CAP-025, FT-USR-04 | Pendiente |
| D3 | Capturas de pago en carpeta privada, solo por la API con sesión | Crítico | SEC-06 | Pendiente |
| D4 | A la IA no se envían DNI, teléfonos ni direcciones | Alto | SEC-09 | Pendiente |
| D5 | GlitchTip y registros sin DNI, teléfonos, contraseñas ni tokens | Alto | SEC-10 | Pendiente |
| D6 | Pruebas usa datos ficticios y el número de prueba de WhatsApp | Alto | HU-CAP-183 | Pendiente |
| D7 | Aviso de privacidad y Libro de Reclamaciones revisados por el asesor legal | Crítico | DEP-09 | Pendiente |

## 3. Aplicación

| # | Control | Nivel | Evidencia | Estado |
|---|---|---|---|---|
| P1 | La API recalcula precios y totales; rechaza montos manipulados | Crítico | SEC-08 | Pendiente |
| P2 | Validación de entradas y consultas parametrizadas (Prisma); sin inyección SQL ni XSS | Crítico | SEC-07 | Pendiente |
| P3 | Webhook de WhatsApp con firma verificada | Crítico | SEC-05 | Pendiente |
| P4 | Límite de solicitudes en los endpoints públicos (Cloudflare y API) | Alto | Configuración de Cloudflare | Pendiente |
| P5 | Subida de archivos: solo imágenes, máximo 5 MB, nombres generados por el sistema | Alto | Prueba de subida | Pendiente |
| P6 | Historial de acciones inalterable y con la cadena verificada | Alto | ADR-014, prueba del trigger | Pendiente |

## 4. Infraestructura (ADR-011, ADR-012)

| # | Control | Nivel | Evidencia | Estado |
|---|---|---|---|---|
| I1 | SSH solo con llave, sin root; fail2ban activo | Crítico | RB-CAP-004 (comprobaciones) | Pendiente |
| I2 | El VPS solo acepta 80/443 desde Cloudflare | Crítico | SEC-12 | Pendiente |
| I3 | Panel de Dokploy detrás de Cloudflare Access | Crítico | HU-CAP-182 | Pendiente |
| I4 | Parches de seguridad automáticos | Alto | HU-CAP-188 | Pendiente |
| I5 | Trivy sin vulnerabilidades críticas en las imágenes publicadas | Crítico | CI | Pendiente |
| I6 | Copias cifradas fuera del VPS y restauración probada | Crítico | RB-CAP-002 | Pendiente |

## 5. Secretos (DT-43)

| # | Control | Nivel | Evidencia | Estado |
|---|---|---|---|---|
| S1 | Ningún secreto en el repositorio (`git grep` y hook de pre-commit) | Crítico | Escaneo del repositorio | Pendiente |
| S2 | Secretos separados por ambiente en Dokploy | Alto | INV-CAP-001 | Pendiente |
| S3 | Claves del bot anterior rotadas (estuvieron en texto plano) | Crítico | RB-CAP-005 | Pendiente |
| S4 | Topes de gasto en OpenAI, Google y plantillas de WhatsApp | Alto | Paneles de cada proveedor | Pendiente |

## 6. Resultado

| Críticos pendientes | Altos pendientes | Decisión |
|---|---|---|
| 14 | 14 | **No apto para salir** (nada construido aún) |

## 7. Firmas (G7)

| Rol | Nombre | Fecha | Decisión |
|---|---|---|---|
| Technical Lead | José Ángel Espinoza | | ☐ Apto ☐ Apto con condiciones ☐ No apto |
| Revisión de seguridad | *(pendiente — R16)* | | ☐ Apto ☐ Apto con condiciones ☐ No apto |

---

Generado por IA: controles derivados de los ADR-005, 008, 009, 011, 012 y 014, DT-43 y los casos SEC del plan de pruebas — Revisado por: (pendiente)
