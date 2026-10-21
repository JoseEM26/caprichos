---
id: ADR-008
tipo: adr
titulo: "Autenticación propia con JWT y autorización por rol y permiso"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, DT-38, D-17, RN-CAP-013, RN-CAP-094, RN-CAP-119, RN-CAP-120, RNF-CAP-006, RNF-CAP-007]
tags: [adr, seguridad, autenticacion, jwt, g3]
---

# ADR-008: Autenticación propia con JWT y autorización por rol y permiso

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

Hay dos tipos de usuario: el **personal**, con siete roles y permisos editables (FT-USR-02), y el **cliente**, con cuenta opcional por DNI y contraseña (FT-CLI-01). El BRD fija una contraseña inicial común con cambio obligatorio (RN-CAP-119) y recomienda límites de intentos (RN-CAP-120). Las acciones sensibles piden el PIN del administrador (RN-CAP-094). José eligió autenticación propia con JWT (DT-38).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** autenticación propia en NestJS: **argon2id**, token de acceso de 15 minutos y token de renovación rotativo en cookie `HttpOnly`, autorización por rol y permiso en el servidor | — | Que se necesite ingreso único con otros sistemas o varios locales. |
| Keycloak (OIDC, como en Aybar) | Consume 0,5 a 1 GB de RAM y es mucho para dos tipos de usuario. | Integración con Aybar u otros sistemas. |
| Clerk o Auth0 | Cobra por usuario, saca los datos del país y no encaja con el ingreso por DNI. | Ninguno previsible. |

## Decisión

1. Contraseñas y PIN con **argon2id** (RNF-CAP-007). Ingreso del personal por DNI y del cliente por DNI. Dos audiencias de token: `admin` y `carta`.
2. Token de acceso JWT de 15 minutos con el party, el rol del sistema y la versión de permisos; token de renovación rotativo de 7 días en cookie `HttpOnly`, `Secure` y `SameSite=Strict`, guardado como huella en la base, para poder **cerrar sesiones** al desactivar un usuario.
3. **Primer ingreso** (RN-CAP-119): con `debe_cambiar = true` el token solo permite `POST /auth/cambiar-contrasena`. Propuesta D-17: la contraseña inicial vence en 24 horas; 5 intentos fallidos bloquean 15 minutos (Redis, ADR-007); restablece solo el administrador; se rechazan contraseñas comunes.
4. **Autorización en el servidor** (RNF-CAP-006): cada endpoint declara módulo y acción (`@Permiso('caja', 'cobrar')`); un guard compara con la matriz `rol_permiso` (editable, FT-USR-02), guardada en caché y versionada. Las pantallas ocultan lo que no se puede usar, pero el control real es el servidor.
5. **PIN del administrador** para acciones sensibles hechas por otro rol (anular, crédito, ofertas): se envía en la misma solicitud y queda registrado en la auditoría.
6. Las llaves de dispositivo (agente de impresión y TV) son aparte: tokens largos revocables por el administrador (ADR-002).

## Consecuencias

- Obliga a:
  - Pruebas automáticas de autorización: un usuario por rol contra cada endpoint (criterio del BRD §6).
  - Rotar el secreto de firma de JWT si se filtra (procedimiento en ADR-011).
- Impide:
  - Ingreso con redes sociales en la primera versión.
- Cuesta:
  - Desarrollo y pruebas de seguridad.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `user_account`, `customer_account` (ADR-004), `rol`, `permiso`, `rol_permiso`, `sesion` (huella del token de renovación, dispositivo, expira, revocada).
- Linaje: credenciales solo en la API. **Sensibles:** huellas de contraseña y PIN (nunca en registros ni en GlitchTip).
- Reglas de calidad: 0 contraseñas en texto; 0 usuarios activos con la contraseña inicial pasado su primer ingreso.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (DT-38, D-17) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
