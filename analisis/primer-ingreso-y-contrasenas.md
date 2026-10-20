---
id: FLU-CAP-003
tipo: analisis
titulo: Primer ingreso de un usuario nuevo: contraseña inicial, contraseña nueva obligatoria y foto opcional
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza (desarrollo); validación pendiente de Kevin Rosales"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001, REG-CAP-001, FLU-CAP-002]
tags: [usuarios, contraseña, primer-ingreso, seguridad, mockup, v142]
---

# Primer ingreso de un usuario nuevo

> Decisión del 19/10/2026. Por validar con Kevin Rosales. Aplica al **personal** que entra al módulo administrativo (no a los clientes de la carta, que crean su cuenta con DNI y contraseña propia).

## 1. Regla

| Tema | Regla |
|---|---|
| Contraseña inicial | **Igual para todos los usuarios nuevos: 123456.** La asigna el sistema al crear el usuario (alta en Usuarios). |
| Primer ingreso | Con la contraseña inicial el sistema **no deja entrar al escritorio**: abre primero una pantalla para crear la contraseña nueva. |
| Contraseña nueva | **Obligatoria.** Se escribe **dos veces**. Mínimo 6 caracteres, **distinta de la inicial** (no se acepta 123456) y las dos iguales. |
| Ver la contraseña | Un botón **Ver contraseña / Ocultar contraseña** cambia ambos campos entre puntos y letras. |
| Foto de perfil | **Opcional.** Se puede subir, cambiar o quitar en esa pantalla, o dejarla para después. |
| Después | Se guarda la contraseña nueva, se entra al escritorio del rol y los siguientes ingresos piden la contraseña propia. |
| Quién no la ve | Un usuario que ya cambió su contraseña entra directo; la pantalla **no vuelve a salir**. |

## 2. Flujo

1. Administrador crea el usuario (Usuarios) → el sistema le pone la contraseña inicial 123456 y lo marca como **nuevo**.
2. El usuario escribe su usuario y 123456 en el inicio de sesión.
3. El sistema muestra **«Bienvenido, nombre»** con: contraseña nueva, repetirla, botón para verla, reglas con marca (✓ al cumplirse), foto opcional.
4. **Guardar y entrar**:
   - Si falta una regla, avisa cuál (por ejemplo «Las dos contraseñas no son iguales»).
   - Si todo está bien, el usuario deja de ser nuevo y entra.
5. **Volver al inicio de sesión** cancela sin cambiar nada (sigue siendo nuevo).

## 3. En el mockup (v142)

- En la pantalla de **Iniciar sesión**, bajo «Entrar como», hay un control de la maqueta **«Estado del usuario (solo en la maqueta)»** con dos opciones:
  - **Ya cambió su contraseña** (por defecto): el ingreso es directo y no molesta mientras se prueba el resto.
  - **Usuario nuevo (primer ingreso)**: al iniciar sesión sale la pantalla de contraseña nueva y foto.
- Al guardar, el control vuelve solo a «Ya cambió su contraseña», como pasaría en la realidad.
- La maqueta **no guarda ninguna contraseña**: el valor escrito solo vive en pantalla y se borra al entrar. La foto, si se sube, queda como foto del perfil del rol.
- La maqueta sigue sin validar usuario ni contraseña del inicio de sesión (decide el rol elegido).

## 4. Riesgos y recomendaciones (seguridad)

Una contraseña inicial **igual para todos y fácil de adivinar** (123456) es el punto débil de este diseño. Mientras el usuario no la cambie, cualquiera que conozca el usuario podría entrar. Para el sistema real se recomienda:
1. **Bloquear todo lo demás** hasta cambiarla (ya es la regla): sin escritorio, sin API, sin nada.
2. **Caducidad de la contraseña inicial** (por ejemplo 48 horas); pasado ese plazo el usuario queda bloqueado hasta que el administrador la restablezca.
3. **Límite de intentos** y bloqueo temporal tras varios errores.
4. **No guardar contraseñas en texto**: solo su huella (hash con sal) en la base de datos; nunca en el código ni en archivos.
5. **Restablecer contraseña** (solo administrador): vuelve a la inicial y obliga a cambiarla otra vez; queda en el historial.
6. Alternativa más segura si Kevin lo acepta: una contraseña inicial **distinta por usuario**, entregada en persona.
7. Rechazar contraseñas muy comunes (123456, 111111, «caprichos») y, si se quiere, pedir mezcla de letras y números.

## 5. Por decidir con Kevin

1. ¿Mínimo de 6 caracteres o más (8)?
2. ¿Pide letras y números?
3. ¿Cuánto dura la contraseña inicial antes de caducar?
4. ¿Quién restablece una contraseña olvidada: solo el administrador?
5. ¿La foto es solo del personal o también sale en el escritorio y en las notificaciones?

## 6. Relación con otras reglas

- Sustituye la parte de RN-CAP-098 que decía que la clave inicial se entrega en persona: ahora la inicial es común (123456) y de un solo uso (ver RN-CAP-119 y RN-CAP-120 del BRD).
- Los usuarios no se eliminan: se desactivan (RN-CAP-098, sin cambios).
