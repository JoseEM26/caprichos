---
id: RB-CAP-006
tipo: runbook
titulo: "Runbook: código del supervisor (TOTP rotativo), generación, rotación y contingencia"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-25
relacionados: [RB-CAP-005, SEC-CAP-001]
tags: [runbook, seguridad, supervisor, totp, contingencia, operaciones]
---

# RB-CAP-006 — Código del supervisor (TOTP rotativo): generación, rotación y contingencia

| Campo | Valor |
|---|---|
| Cuándo usarlo | Configuración inicial del local, rotación de secreto, sospecha de filtración, pérdida de dispositivo del supervisor, o fallas de sincronización horaria |
| Tiempo esperado | Generación o rotación: menos de 2 minutos · Contingencia por pérdida: menos de 10 minutos |
| Quién lo ejecuta | Rol `ADMIN` (administrador / supervisor general) o Soporte DevOps |
| Módulos afectados | `apps/api/src/supervisor-codigo`, `apps/web/src/supervisor`, BD (`supervisor_secreto`), Redis |

---

## 1. Descripción del mecanismo

El sistema Caprichos reemplaza el PIN fijo tradicional por un **código rotativo general de 6 dígitos** (RFC 6238 TOTP: HMAC-SHA1, paso de tiempo de 30 segundos).

- **Alcance:** Un único código compartido para todo el local en cada ventana de 30 segundos.
- **Acceso:** Solo visible para usuarios con rol `ADMIN` (permiso `supervisor/ver_codigo`) desde la pantalla `/admin/supervisor-codigo`.
- **Cálculo:** Se calcula exclusivamente en el backend (`apps/api`) y se entrega bajo demanda vía `GET /admin/supervisor/codigo` con encabezado `Cache-Control: no-store`.
- **Tolerancia:** El servidor acepta el código de la ventana de tiempo actual ($T_0$) y el de la ventana inmediata anterior ($T_{-1}$), permitiendo entre 30 y 60 segundos de holgura para compensar el tipeo del cajero o la latencia de red.
- **Anti-repetición:** Todo código consumido con éxito queda registrado en Redis mediante `SET supervisor:codigo:consumido:<codigo> NX EX 90`. Un código no puede reutilizarse en ninguna acción dentro de su período de validez.
- **Protección contra fuerza bruta:** 3 intentos fallidos consecutivos bloquean el acceso al código de supervisor durante 5 minutos (almacenado en Redis).
- **Falla cerrada (Fail-Closed):** Si Redis no responde, el servicio responde `503` rechazando cualquier acción protegida para evitar bypass por caída de caché.

---

## 2. Generación inicial del secreto

Cuando se despliega una nueva base de datos o local, el secreto aún no existe. Mientras no exista, cualquier acción que requiera código de supervisor devolverá `409 SUPERVISOR_SIN_CONFIGURAR`.

### Procedimiento:
1. Inicie sesión en el sistema web con una cuenta de rol `ADMIN`.
2. En el menú lateral de navegación, diríjase a **Configuración → Código del supervisor** (`/admin/supervisor-codigo`).
3. La interfaz indicará que no existe secreto configurado para el local.
4. Presione el botón **Generar secreto**.
5. Aparecerá un diálogo modal con la pregunta: *"¿Generar secreto del supervisor? Se creará una clave criptográfica de 20 bytes para emitir códigos rotativos de 30 segundos en este local."*.
6. Presione **Confirmar generación**.
7. El sistema generará 20 bytes criptográficamente seguros (`crypto.randomBytes(20)`), los cifrará con AES-256-GCM (clave derivada por HKDF de `SUPERVISOR_CLAVE_CIFRADO` o `JWT_SECRET`) y los guardará en la tabla `supervisor_secreto`.
8. La pantalla comenzará a mostrar el código de 6 dígitos vigente junto con su cuenta regresiva circular de 30 segundos.

---

## 3. Rotación del secreto (preventiva o correctiva)

La rotación debe ejecutarse si se sospecha que una persona no autorizada vio el secreto en base de datos o si cambian los responsables del local.

### Procedimiento:
1. Inicie sesión como `ADMIN` y vaya a `/admin/supervisor-codigo`.
2. Haga clic en el botón secundario **Rotar secreto**.
3. En el modal de advertencia, confirme la acción:
   - *"¿Rotar secreto del supervisor? El secreto actual quedará invalidado de inmediato. Cualquier código emitido con el secreto anterior dejará de funcionar al instante."*
4. Presione **Confirmar rotación**.
5. El sistema generará y cifrará una nueva clave de 20 bytes, reemplazando la anterior en `supervisor_secreto`.
6. Los códigos emitidos con el secreto anterior son rechazados inmediatamente con `403 CODIGO_INVALIDO`.

---

## 4. Contingencia: pérdida de celular o dispositivo del supervisor

Dado que el código TOTP no reside en una aplicación externa (como Google Authenticator) sino que se consulta en tiempo real desde la aplicación web autenticada:

1. **Paso 1 — Inactivar o cambiar clave de la cuenta comprometida:**
   - Un administrador debe ir a `/admin/usuarios` y **desactivar** el usuario cuyo celular o computadora se extravió, o cambiar su contraseña.
   - Si es necesario cerrar todas las sesiones activas de inmediato, se puede rotar la variable `JWT_SECRET` en las variables de entorno del servidor (ver `RB-CAP-005`).
2. **Paso 2 — Rotar el secreto del supervisor:**
   - Desde cualquier otro dispositivo seguro con sesión `ADMIN`, entrar a `/admin/supervisor-codigo` y presionar **Rotar secreto**.
   - Esto anula instantáneamente cualquier código de la ventana actual generado antes de la pérdida.
3. **Paso 3 — Continuidad operativa:**
   - El supervisor o reemplazante asignado inicia sesión en el nuevo equipo y accede a `/admin/supervisor-codigo` para dictar los códigos al cajero.

---

## 5. Sincronización de reloj del servidor (NTP)

El algoritmo TOTP (RFC 6238) asume que el reloj del servidor está alineado con el tiempo universal coordinado (UTC).

- Aunque el backend tolera 1 ventana previa (hasta 30 segundos de atraso relativo), una desviación mayor a 30 segundos en el servidor provocará que los códigos calculados no coincidan con la ventana esperada, arrojando errores sistemáticos `403 CODIGO_INVALIDO`.

### Verificación en el host (Linux / VPS):
```bash
# Con timedatectl:
timedatectl status

# Verificar que las líneas indiquen:
#   System clock synchronized: yes
#   NTP service: active
```

O con `chrony`:
```bash
chronyc tracking
# La desviación (System time) debe ser inferior a 0.100 segundos.
```

Si el reloj no está sincronizado:
```bash
sudo systemctl restart systemd-timesyncd
# O si se usa chrony:
sudo systemctl restart chronyd
```

---

## 6. Códigos de error HTTP y resolución

| Código HTTP | Error en respuesta | Causa habitual | Acción recomendada |
|---|---|---|---|
| `403` | `CODIGO_INVALIDO` | El cajero tipeó mal el código o pasaron más de 60 segundos desde que se generó. | Solicitar al supervisor el código visible actual en pantalla y volver a intentar. |
| `403` | `CODIGO_BLOQUEADO` | Se ingresaron 3 códigos incorrectos consecutivos. | Esperar 5 minutos a que expire el bloqueo en Redis. La pantalla del cajero muestra el tiempo restante. |
| `409` | `SUPERVISOR_SIN_CONFIGURAR` | No se ha generado el secreto para el local en `supervisor_secreto`. | El rol `ADMIN` debe ingresar a `/admin/supervisor-codigo` y pulsar **Generar secreto**. |
| `410` | `PIN_DEPRECADO` | Se llamó al endpoint legado `POST /admin/usuarios/:id/pin`. | El PIN fijo ha sido retirado del sistema. No se debe utilizar este endpoint. |
| `503` | `SERVICIO_NO_DISPONIBLE` | Redis está caído o inaccesible para verificar anti-repetición o bloqueos. | Verificar el contenedor o servicio Redis (`systemctl status redis` o `docker compose ps redis`). El sistema falla cerrado por seguridad. |
