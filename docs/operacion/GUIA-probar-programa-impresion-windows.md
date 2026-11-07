# Probar el programa de impresión en Windows

Qué pasaba: el programa se cerraba al instante al abrirlo con doble clic. Cualquier error al arrancar
(sin internet, código mal copiado) terminaba el proceso y Windows cerraba la ventana antes de poder leer
nada. Ahora la ventana siempre queda abierta con el motivo y se guarda un registro.

## Prueba (5 minutos, en un PC con Windows)
1. Descarga el programa desde Caprichos > Configuración > Impresión.
2. Doble clic. Debe abrirse una ventana negra con "Programa de impresión de Caprichos" y pedir el código.
3. Escribe `PRUEBA` y Enter: debe decir "No se pudo vincular..." y volver a pedir el código (no cerrarse).
4. Pega el código real (clic derecho pega). Elige etiquetera y ticketera. Debe decir "Configuración guardada".
5. Cierra y vuelve a abrir: ya no pide código y queda imprimiendo ("Iniciando Agente Local...").
6. Revisa el registro en `%APPDATA%\CaprichosAgente\agente.log` (pega esa ruta en el Explorador).

Si SmartScreen dice "Windows protegió su PC": Más información > Ejecutar de todas formas.
Si el antivirus lo borra o bloquea, la ventana no llega a abrirse y no queda registro.

## Construcción
El workflow `Programa de impresión (Windows y Linux)` empaqueta `apps/agente-local/src/entrada.ts` con
esbuild + pkg y hace una prueba de humo del binario Linux (mismo código) antes de subirlo.
El .exe ya publicado en el servidor conserva el defecto hasta que corra ese workflow.
