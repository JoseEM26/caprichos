# Análisis: base común

Módulo `/admin/analisis` (permiso `analisis/ver`: ADMIN y SUPERVISOR). Una pestaña por tema, con filtros de fechas comunes.

## Sumar una pestaña en 3 pasos

1. **API** `apps/api/src/modulos/analisis/<tema>/`: `<tema>.controller.ts` (`@Controller('admin/analisis/<tema>')`, `@Permiso('analisis', 'ver')`)
   y `<tema>.service.ts`. Valida con `resolverFiltros()` (`../comun/filtros`: fechas de Lima, máximo 92 días, modalidad, canal, turno)
   y resume con `resumirMinutos()`. Regístralos en `analisis.module.ts` (una línea en `controllers`, otra en `providers`).
2. **Web** `apps/web/src/admin/analisis/<tema>/`: un componente `({ filtros, esAdmin }: PropsPestanaAnalisis)` y un `index.ts` que exporta
   `export const pestanaTema: PestanaAnalisis = { id, etiqueta, filtros: ['modalidad'], Componente }`.
   Consulta con `useConsultaAnalisis(`/admin/analisis/<tema>?${consultaDe(filtros, ['modalidad'])}`)`.
3. **Registro** `../registro.ts`: agrega `pestanaTema` a `PESTANAS_ANALISIS`. No se toca nada más (ni menú, ni ruta, ni permisos).

## Componentes (`./graficos.tsx`)

| Componente | Para qué |
| --- | --- |
| `TarjetaAnalisis` | Marco de un gráfico: estados `cargando/vacio/error` (con Reintentar) y «Ver como tabla» (`tabla`). Úsalo siempre. |
| `BarrasHorizontales` | Una barra por fila con valor escrito, marca de meta, semáforo y fila destacada. Con `alElegir`, cada fila es botón (44 px). `valor: null` = «Sin dato». |
| `MapaDeCalor` | Tabla de calor (día × hora…). Cada celda escribe su número; el color solo refuerza. |
| `TarjetaIndicador` | Cifra grande (KPI) con detalle y semáforo opcional. |
| `Semaforo` | Verde ● / ámbar ▲ / rojo ■ / sin dato ○ con palabra: no depende del color. |
| `ListaRanking` | Lista numerada de mayor a menor con barra fina (`max` limita). |
| `PanelDetalle` | Detalle **inline** de un gráfico (región, Esc o Cerrar). Nunca un modal sobre otro. |
| `TablaDatos` | La tabla plegable (ya viene dentro de `TarjetaAnalisis`). |

## Filtros y datos

- `useFiltrosAnalisis()` (lo usa `AnalisisView`): período en la dirección (`?periodo=hoy|ayer|7d|30d|rango&desde&hasta`), `modalidad`, `canal`, `turno`.
- `FiltrosAnalisis` pinta solo los extras que la pestaña declara en `filtros`.
- `useConsultaAnalisis(ruta, { cadaMs, eventos })`: ignora respuestas viejas, conserva lo que ya se ve al refrescar, recarga por socket y cada `cadaMs`.
- Textos y fechas: `textoMinutos`, `hoyLima`, `rangoDePreset`, `errorDeRango` (`./fechas.ts`).

## Reglas

- Sin librerías de gráficos; modo claro con variables `--cp-*` (estilos `an-*` en `analisis.css`).
- Móvil 360 px: nada desplaza la página (las tablas anchas se desplazan dentro de su caja); botones y filas táctiles de 44 px.
- Si un dato no existe, muestra «Sin dato» y di qué faltaría guardar. No inventes ceros.
