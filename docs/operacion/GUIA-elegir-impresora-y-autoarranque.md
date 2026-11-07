# Elegir la impresora, dejarla fija y que el programa abra solo

Para quién: quien instala el programa de impresión en las computadoras del local.
Problema que resuelve: al instalar salen muchas impresoras (hasta 15) y no se sabe cuál es la etiquetera
y cuál la ticketera. Aquí se prueba **cada una**, se elige por número y queda **guardada para siempre**; al
apagar y volver a encender la computadora el programa se conecta **solo** a esa impresora.

## Cómo queda repartido (por defecto)

Hay DOS computadoras con el programa, cada una con su propio código de vinculación (su propia llave):

| Computadora | Máquinas | Imprime |
|---|---|---|
| PC1 (Caja) | ticketera + etiquetera | Ticket de pago y comanda de salón (mesa); y, para delivery y recojo, el sticker general y los stickers por área |
| PC2 (Bebidas) | una etiquetera | SOLO los stickers de vaso (bebida) de delivery y recojo |

- La PC2 se asigna al área **Bebidas** en Configuración › Impresión › Mapa (botón «+ Asignar equipo»). Así sus
  trabajos solo los toma ella: ninguna otra computadora los imprime dos veces.
- Si una computadora está apagada, sus trabajos **esperan en la cola** (no se pierden) y el panel avisa cuál
  falta. Salen al abrir el programa (hasta 3 horas; después quedan «vencidos» y se reimprimen a mano).
- Qué tipos de pedido saca cada sticker se cambia en el Mapa con los botones «Sale en» (salón, llevar,
  recojo, delivery) del sticker general, del de área y del de bebida.

## Instalar en cada PC

1. En Caprichos: Configuración › Impresión › Equipos y estado › «Instalar o vincular programa». Descarga el
   programa de Windows (o Linux) y genera un **código de vinculación** (un código por computadora).
2. En la PC: doble clic al programa (Windows pedirá permiso: «Más información › Ejecutar de todas formas»).
3. Pega el código (clic derecho pega) y Enter. Dice «Vinculado correctamente».
4. El asistente muestra las impresoras reales (sin PDF, OneNote, Fax ni XPS). Si no sabes cuál es, deja Enter
   y sigue con el menú de abajo.
5. Al final el asistente activa el **arranque automático** en Windows y lo dice en pantalla.
6. Se abre un menú numerado: 2 = «Probar TODAS», 4 = elegir etiquetera, 5 = elegir ticketera, 6 = estado.

## Saber cuál impresora es cuál (probar todas)

Desde el panel: Configuración › Impresión › Equipos y estado. Cada computadora tiene su bloque:
1. «Probar TODAS»: cada impresora imprime una hoja con «Impresora N de M» en grande y su nombre.
2. Mira cuál sacó la hoja y pulsa en esa fila «Usar como etiquetera» o «Usar como ticketera» (Sí/No).
3. «Imprimir prueba» prueba una sola; si falla muestra el motivo y «Reintentar».

Desde la terminal de la PC (ventana de comandos en la carpeta del programa; en Windows el nombre es
`agente-impresion-windows.exe`, en Linux `./agente-impresion-linux`):

```
agente-impresion-windows.exe impresoras              lista numerada
agente-impresion-windows.exe probar-todas            cada una imprime su número
agente-impresion-windows.exe probar 3                hoja solo en la 3 (o: probar "TSC TTP-247")
agente-impresion-windows.exe usar etiquetera 3       deja la 3 como etiquetera, guardada
agente-impresion-windows.exe usar ticketera 5        deja la 5 como ticketera, guardada
agente-impresion-windows.exe estado                  qué tiene guardado y si aparece
agente-impresion-windows.exe autoarranque activar    abre solo al encender (desactivar para quitar)
agente-impresion-windows.exe menu                    menú con números, sin recordar comandos
agente-impresion-windows.exe vincular                volver a vincular / reconfigurar
```

Una impresora que no dice si es de etiquetas o de tickets recibe las dos hojas (la que no corresponde sale
como texto raro: ignórala). El número es el de la lista; si conectas o quitas una impresora la numeración
puede cambiar, vuelve a listar antes de elegir.

## Qué queda guardado y cómo se reconecta

- Windows: el **nombre exacto** de la impresora en el spooler. Linux: modelo y serie USB (no el número
  `/dev/usb/lpN`, que cambia al reiniciar); si no tiene serie, la ruta.
- Al encender la computadora el programa busca ESA impresora. Si no está, sigue buscándola cada pocos
  segundos y avisa en el panel; **nunca cambia a otra por su cuenta**. Se cambia solo eligiendo otra en el
  panel o con `usar ...`.
- La elección hecha en el panel viaja al programa en su siguiente aviso (unos segundos) y la guarda en su
  `config.json`. Es por computadora: la de Caja y la de Bebidas se eligen por separado.

## Que el programa abra solo al encender (Windows)

`autoarranque activar` crea una entrada del usuario actual en
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (sin administrador, sin servicios). `autoarranque
desactivar` la borra. Abre al **iniciar sesión** de Windows, no antes: la PC debe iniciar sesión sola
(o alguien iniciarla) para que se abra. Solo funciona con el programa .exe, no ejecutado con node.

**No se pudo probar en Windows real desde Linux.** Se probó con funciones simuladas (la orden `reg add` /
`reg delete` / `reg query` correcta). Primera vez en el local: ejecutar `autoarranque activar`, reiniciar
la PC e iniciar sesión, y comprobar que se abre la ventana del programa y el panel dice «Programa conectado».

## Qué significa cada estado del panel

| El panel dice | Qué pasa | Qué hacer |
|---|---|---|
| El programa no está corriendo (sin programa) | La computadora no manda señales (apagada, programa cerrado, sin internet) | Abrir el programa; activar `autoarranque`; revisar internet. Lo pendiente espera en cola |
| Aún no elegiste la impresora para este rol (no configurada) | El programa corre pero ese rol no tiene impresora | «Probar TODAS» y «Usar como...» |
| La impresora elegida no aparece (nombre) (desconectada) | Está guardada pero apagada, desconectada o cambió de nombre | Encenderla/conectarla (se reconecta sola) o elegir otra |
| Sin papel / sin permiso / error | La impresora responde con ese problema | Poner papel; en Linux `sudo usermod -aG lp $USER` y reiniciar; ver el log |
| Lista: nombre | Todo bien | — |

## Ver el registro (log)

El programa guarda `agente.log` junto a su configuración: Windows `%APPDATA%\CaprichosAgente\agente.log`
(pégalo en el Explorador); Linux `~/.config/CaprichosAgente/agente.log`. Ahí queda el motivo si la ventana
se cierra o algo falla al arrancar. Para enviarlo a soporte basta ese archivo (no lleva la llave).

## Reinstalar o reconfigurar

- Cambiar una impresora: panel o `usar ...`. No hace falta reinstalar.
- Volver a vincular (llave nueva): en el panel generar otro código, y en la PC `vincular` (borra antes
  `config.json` si quieres empezar de cero). Desactiva en el panel la llave vieja.
- Programa nuevo: descargar el .exe nuevo y reemplazar el anterior; el `config.json` y el arranque
  automático se conservan (si cambió la carpeta, ejecutar otra vez `autoarranque activar`).

## Qué NO se pudo probar sin Windows ni impresoras reales

- Arranque automático en un Windows real (ver arriba).
- Listado `Get-Printer` con nombres, controladores y puertos reales; el filtro de virtuales y la sugerencia
  de rol por nombre se probaron con listas de ejemplo.
- Que cada marca de impresora reciba bien la hoja de prueba (TSPL en la etiquetera, ESC/POS en la ticketera) y
  el tamaño de la letra del número; se ajusta en `apps/agente-local/src/pruebaImpresora.ts`.
