# Huecos de asistencia y planilla (auditoría, sin datos reales)

Revisión de `apps/api/src/modulos/asistencia` y `apps/web/src/admin/asistencia`. Ordenados por riesgo. Lo marcado «hecho» ya va en la rama `planilla-por-pasos`.

| # | Hueco | Hoy | Riesgo | Arreglo propuesto |
|---|---|---|---|---|
| 1 | Anular/aprobar una marca en un período ya pagado | `asistencia.service.ts:421` (`revisarMarca`) no comprueba período pagado; las correcciones sí (`asistencia-correcciones.service.ts:250,382,430`). El pago congelado queda desfasado de las marcas | Alto | Misma guarda `PERIODO_PAGADO` en `revisarMarca` y en marcas manuales |
| 2 | Cambiar el sueldo a mitad de período | `planilla.service.ts:130` hace `upsert` sin historial: el período abierto se recalcula entero con el sueldo nuevo (días ya trabajados incluidos) | Alto | Tabla de sueldo con vigencia desde-fecha y cálculo por tramo |
| 3 | Pagar sin resolver jornadas dudosas | El backend bloquea (`planilla.service.ts:503`) y no existe «pagar igual con confirmación»: la única salida es corregir cada día | Medio | Endpoint con `forzar` + motivo auditado (solo ADMIN); la UI ya dice qué falta (hecho: bloqueo guiado) |
| 4 | Créditos del personal de días anteriores sin cerrar | Solo entran a «consumos cobrados» si se marcan (`consumos` con `anterior`); antes se podía pagar sin verlos | Medio | Hecho: el paso Descuentos avisa «Tiene N créditos sin cerrar… por S/ X» y obliga a marcarlos o confirmar pagar sin descontarlos. Falta registrar esa confirmación en la auditoría de `pagar` |
| 5 | Marcas dudosas que nadie aprueba | Una jornada A_REVISAR/INCOMPLETO bloquea el pago indefinidamente; no hay aviso al admin | Medio | Campanita/resumen diario al admin con las jornadas por revisar de la semana que cierra |
| 6 | Jornada abierta sin cierre / turno que cruza medianoche | Depende del cierre de jornada del cálculo (otro agente trabaja `asistencia.calculo.ts`: «No marcó salida», fin de turno + 2 h) | Medio | Coordinar con ese cambio; probar turno 22:00–06:00 en planilla semanal |
| 7 | Correcciones fuera de plazo | `asistencia-correcciones.service.ts:178` filtra por plazo al listar; la creación (`:233`) depende del rol | Medio | Validar el plazo también en `crearSolicitud` y mostrar «fuera de plazo» al admin |
| 8 | Reemplazo aprobado pero no asistido | `asistencia-turnos.service.ts:390` (`aprobar`) crea la cobertura; si el reemplazo no marca no hay alerta ni reversión | Medio | Tarea que marque «reemplazo sin asistir» y avise al jefe y al admin |
| 9 | Descanso/feriado trabajado | El feriado ×2 funciona; el descanso trabajado solo aparece como extra pendiente de aprobar | Bajo | Insignia «Descanso trabajado» y aprobación explícita |
| 10 | Quién aprobó qué | Marcas y pago se auditan (`PAGAR_PLANILLA`, `APROBAR_MARCA`); el lote «Aprobar todas» audita cada marca pero no deja un registro único del lote | Bajo | Una fila de auditoría por lote con conteo y usuario |
| 11 | Vacaciones sobre período pagado | Ya hay guarda (`vacaciones.service.ts:179`) | Bajo | Sin acción |
| 12 | Avisos de pendientes al admin | No hay aviso de solicitudes, reemplazos ni jornadas por revisar | Bajo | Insignias con el conteo en Planilla/Solicitudes |

Pedido a coordinar con el otro agente: el bloqueo del paso 1 usa `pendientes` y `jornadasPorRevisar` del detalle; si los nuevos estados («No marcó salida», «Sin marcar entrada») deben bloquear el pago, tienen que entrar en `ESTADOS_PENDIENTES` (`planilla.calculo.ts:73`). No se tocó `ETIQUETA_ESTADO` ni el cálculo.
