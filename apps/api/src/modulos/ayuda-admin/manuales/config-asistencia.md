---
modulo: asistencia
titulo: Configuración de asistencia
ruta: /admin/asistencia
seccion: config
activa_con: [pestana=config]
permiso: asistencia/administrar
roles: [ADMIN]
relacionados: [mi-asistencia, asistencia-pantalla, usuarios]
sugerencias:
  - ¿Cómo configuro el punto del local para que el personal marque su asistencia?
  - ¿Qué es el radio del local y cómo lo cambio?
  - ¿Cuántos minutos de tolerancia hay antes de contar una tardanza?
  - ¿Cuántos días se guardan las selfies de las marcas?
---
# Configuración de asistencia

## Para que sirve
Fija las reglas con las que se acepta una marca de asistencia: desde qué punto se mide (la ubicación del local), a cuántos metros se puede marcar (radio), con qué precisión del GPS, cuántos minutos de tolerancia antes de contar una tardanza y cuántos días se guardan las selfies. Se ve en la pestaña "Configuración" de Asistencia (enlace directo: [Configuración de asistencia](/admin/asistencia?pestana=config)). Los trabajadores marcan en [[mi-asistencia]] y el QR del local se muestra en [[asistencia-pantalla]].

## Como se hace: poner la ubicación del local
1. Entra a Asistencia y abre la pestaña "Configuración" (/admin/asistencia?pestana=config). Si falta la ubicación, la pantalla avisa "Aún no configuras la ubicación del local: nadie podrá marcar".
2. En la tarjeta "Ubicación del local" escribe la Latitud y la Longitud del local, o busca la dirección, o toca o arrastra el punto en el mapa.
3. También puedes pulsar "Usar mi ubicación actual": tienes que estar dentro del local, de preferencia al centro y con el GPS activado. Si el equipo no tiene GPS preciso (precisión peor que 25 m aparece un aviso de color; ubicación por internet se rechaza), corrige a mano o usa tu celular dentro del local.
4. Revisa el punto en el mapa y pulsa "Guardar configuración". Se confirma con "Configuración guardada."

## Como se hace: cambiar el radio, la tolerancia y la precisión del GPS
1. En la tarjeta "Marcas" cambia "Radio del local (m)": a cuántos metros del punto del local se puede marcar (de 3 a 100; por defecto 10).
2. Cambia "Tolerancia de tardanza (min)": minutos después de la hora de entrada que aún no cuentan como tardanza (de 0 a 60; por defecto 10).
3. Cambia "Precisión GPS máxima aceptada (m)": si el GPS del celular es peor que esto, se le pide reintentar (de 5 a 100; por defecto 25).
4. Pulsa "Guardar configuración".

## Como se hace: cambiar cuántos días se guardan las selfies
1. En la tarjeta "Selfies" cambia "Días que se guardan las selfies" (de 7 a 3650; por defecto 90).
2. Pasado ese plazo la foto se borra cada madrugada (03:00 hora de Lima); la marca se conserva. Pulsa "Guardar configuración".

## Ajustes: Asistencia
- **Latitud y longitud del local**: el punto desde el que se mide la distancia al marcar. Sin ubicación, nadie puede marcar. [Ubicación del local](/admin/asistencia?pestana=config)
- **Radio del local (m)** (radioM): a cuántos metros del punto se puede marcar; de 3 a 100, por defecto 10. [Radio del local](/admin/asistencia?pestana=config)
- **Tolerancia de tardanza (min)** (toleranciaMin): minutos después de la hora de entrada que no cuentan como tardanza (tampoco salida anticipada ni extra); de 0 a 60, por defecto 10. [Tolerancia de tardanza](/admin/asistencia?pestana=config)
- **Precisión GPS máxima aceptada (m)** (precisionMaxM): si el GPS es peor que esto se pide reintentar; de 5 a 100, por defecto 25. [Precisión del GPS](/admin/asistencia?pestana=config)
- **Días que se guardan las selfies** (retencionDias): luego la foto se borra y la marca se conserva; de 7 a 3650, por defecto 90. [Retención de selfies](/admin/asistencia?pestana=config)

## Errores y dudas comunes
- "Estás a N m del local. Debes estar a X m o menos para marcar": el trabajador está fuera del radio; revisa el punto del local o sube el radio.
- Se le pide reintentar al marcar: la precisión del GPS de su celular es peor que el máximo aceptado.
- Nadie puede marcar: falta la ubicación del local.
- Un valor fuera de rango (por ejemplo radio 500) no se guarda: usa los rangos indicados.

## Quien puede hacerlo
Solo el Administrador (permiso asistencia/administrar). Los demás roles solo marcan su propia asistencia.
