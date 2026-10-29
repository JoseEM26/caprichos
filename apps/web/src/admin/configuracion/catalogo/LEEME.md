# Catálogo de Configuración (buscador + salto al ajuste)

Todo ajuste de `/admin/configuracion` debe poder encontrarse con el buscador y explicarse solo.

## Agregar un ajuste (3 pasos)

1. **Catálogo**: una entrada en `catalogo/<pestaña>.ts` (tipo `EntradaConfig` en `tipos.ts`).
   `id` kebab-case único y estable (no se renombra: lo usan enlaces y recientes guardados).
2. **Destino**: envuelve el campo/tarjeta con `<CampoConfig id="mismo-id">` (de `../CampoConfig`),
   o pon `data-cfg-id="mismo-id" tabIndex={-1}` directo en un contenedor que ya exista.
   Campos del formulario genérico de `ConfiguracionLocalView` ya se envuelven solos con
   `idCampoGenerico(tab, clave)` = `<tab>-<clave-en-kebab>` (ej. `operacion-tiempo-base`).
   Parámetros de `ParametrosOperacionTab`: `parametros-<clave-con-guiones>`.
   Si el ajuste está dentro de un `<details>` plegado, se abre solo.
3. **Ayuda**: usa `<CampoAyuda id etiqueta ayuda ejemplo? efecto? porDefecto? unidad? rango? cfgId?>{input}</CampoAyuda>`
   (de `../AyudaCampo`). `cfgId` hace de una vez el paso 2. El input recibe `id` y `aria-describedby` solos.

`?tab=<pestaña>&campo=<id>` salta al ajuste (también si solo cambia `campo`). El test `catalogo-configuracion.spec.ts`
falla si un `data-cfg-id` / `CampoConfig id` literal no existe en el catálogo, o si hay ids repetidos.

## Cómo redactar

- `titulo`: lo que cambia, con palabras del dueño («Mensajes por minuto antes de silenciar»), no la clave técnica.
- `descripcion` (1-2 frases): **qué cambia** y **a quién afecta** (cliente, caja, cocina, repartidor). Sin jerga (nada de «payload», «TTL», «endpoint»).
- `ejemplo`: un caso concreto con número: «Si pones 10, el bot calla al cliente que mande más de 10 mensajes en un minuto».
- `palabras`: sinónimos que usaría la gente, sin tildes da igual (spam, silencio, delivery gratis, voucher, impresora). Incluye la clave técnica en `clave`.
- `peligro`: `alto` si toca dinero, cobros o deja de atender clientes; `medio` si cambia tiempos o mensajes visibles; `bajo` el resto.
- `permiso`: solo si exige uno más fuerte que entrar a Configuración (ej. `cocina/demanda`, `configuracion/editar`).
- Español, sin emojis, tono claro. Unidad y rango van en `CampoAyuda` (`unidad`, `rango`, `porDefecto`).

## TODO por archivo (los completan los otros agentes)

- `local.ts`: ubicación (lat/lng, detectar), contacto, redes, logo, empresa por campo.
- `horario.ts`, `fechas.ts`: HorarioTab (apertura, cierre, día cerrado, copiar) y FechasEspecialesTab (alta/edición/borrado).
- `pagos.ts`: PagosTab (cuentas, titular, notas).
- `zonas.ts`: normalizar zonas, tarifa y minutos por zona, polígonos.
- `demanda.ts`: pasos 1-3 de SeccionAltaDemanda.
- `reparto.ts`: SeccionRepartoConfig (colores, mensajes 1-3, entregas fallidas, recargo).
- `parametros.ts`: una entrada por clave de `META_PARAMETROS` en ParametrosOperacionTab (id `parametros-<clave>`).
- `chatbot.ts`: un ajuste por interruptor (`META_FUNCIONES`), por texto (`META_TEXTOS`), límites anti-spam, desbloqueo, privacidad.
- `impresion.ts`, `ayuda.ts`, `vouchers.ts`, `ingreso.ts`: tarjetas respectivas (ver comentarios TODO al inicio de cada archivo).
- `operacion.ts`: tiempos, wifi, áreas de cocina, textos y avisos por campo del formulario genérico.
- Pendiente aparte: usar `CampoAyuda` en los inputs de esas pestañas hijas (hoy solo hay `CampoConfig`/`data-cfg-id` de ejemplo en Parámetros y Chatbot).
