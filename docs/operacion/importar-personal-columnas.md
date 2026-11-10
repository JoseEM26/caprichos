# Importar personal: del Excel de pagos al CSV

Complementa [importar-personal.md](./importar-personal.md). El CSV de siempre sigue valiendo: las columnas de planilla son
**opcionales**. Se exporta la hoja del personal del Excel a CSV (Archivo > Descargar > CSV en Google Sheets, o Guardar como
CSV UTF-8 en Excel), se renombran las cabeceras como abajo y se corre el simulacro. Los datos reales nunca van al repositorio.

## Correspondencia columna del Excel a columna del CSV

| En el Excel | Columna del CSV | Notas |
|---|---|---|
| Nombres / Apellidos | `nombres`, `apellidos` | obligatorias |
| Tipo y número de documento (DNI, Cédula, CE) | `tipo_documento`, `documento` | `DNI`, `CEDULA`, `CE`; documento obligatorio |
| Celular | `celular` | 9 dígitos que empiezan en 9 |
| Nacimiento | `fecha_nacimiento` | `AAAA-MM-DD` o `dd/mm/aaaa` |
| País | `pais_nacimiento` | |
| Fecha de inicio | `fecha_ingreso` | abre el periodo laboral y es la fecha de ingreso del vínculo |
| Reingreso | `fecha_reingreso` | una fecha; `NO` se ignora; `LICENCIA SIN GOCE` deja la cuenta inactiva con el periodo abierto (igual que `licencia = si`) |
| (rol de la persona) | `rol_principal` (obligatoria la columna; puede ir vacía si hay casillas) | roles del sistema: `MOZO`, `CAJERO`, `COCINA`... |
| Casillas de roles | `casillas_roles` | nombres separados por `\|`, ver tabla siguiente |
| Área | `area` | informativa: queda en la nota del vínculo |
| Acuerdo laboral | `acuerdo_laboral` | `Tiempo Parcial`, `Tiempo Completo` o `Tercerizado Mensual` |
| Remuneración mensual | `sueldo_mensual` | `1500`, `1,500.00` o `S/ 1500`; crea el sueldo MENSUAL con valor hora sueldo ÷ 24 ÷ 9 |
| (tarifa fija por hora, sin sueldo) | `tarifa_hora` | método `TARIFA_HORA`; no se combina con `sueldo_mensual` |
| (a una persona se le divide entre 8) | `dias_mes`, `horas_dia` | opcionales, por persona (defectos 24 y 9) |
| Número de Yape/Plin | `pago_celular` | dato personal: solo lo ve el ADMIN; nunca se imprime |
| Medio de pago | `pago_medio` | `YAPE`, `PLIN`, `TRANSFERENCIA` o `EFECTIVO` |
| (licencia) | `licencia` | `si` = cuenta inactiva con el periodo laboral abierto (licencia sin goce) |
| | `roles_extra`, `activo` | como siempre |

Cabecera completa de ejemplo:

```
nombres,apellidos,tipo_documento,documento,celular,fecha_nacimiento,fecha_ingreso,fecha_reingreso,pais_nacimiento,rol_principal,roles_extra,activo,area,casillas_roles,acuerdo_laboral,sueldo_mensual,tarifa_hora,dias_mes,horas_dia,pago_celular,pago_medio,licencia
```

## Casillas de roles del Excel a roles del sistema

| Casilla | Rol del sistema | Área de cocina |
|---|---|---|
| Despacho / Mozo | `MOZO` | |
| Caja | `CAJERO` | |
| Bebidas | `COCINA` | Bebidas |
| Salado | `COCINA` | Salado |
| Postres | `COCINA` | Postres |
| Repostería | `COCINA` | Repostería |
| Almacén | `ALMACEN` | |
| Delivery | `REPARTIDOR` | |
| Supervisión | `SUPERVISOR` | |

- Si `rol_principal` viene vacío, el principal se elige por prioridad: Caja, Mozo, Cocina, Almacén, Supervisión. Los demás pasan a roles extra.
- Las áreas de cocina se asignan por nombre a las áreas activas del sistema. Si no existe una, la fila se crea igual y sale el aviso para asignarla a mano.
- **Delivery (`REPARTIDOR`) no se combina con otros roles:** una fila con Delivery y otras casillas sale con error y se separa a mano.
- Una casilla que no está en la tabla da error de esa fila (no se adivina).

## Áreas administrativas

Filas cuya `area` es administrativa (Alquiler local, Marketing, Contabilidad, Administración) **y no traen ningún rol**
se omiten: sale `omitida: área administrativa ... sin rol operativo` y no se crea cuenta (sin cuenta no marcan
asistencia ni entran a planilla por error). Si hace falta una cuenta, se crea a mano. Con casillas de rol sí se importan.

## Acuerdo laboral y planilla

- `Tiempo Parcial` y `Tiempo Completo`: vínculo **PLANILLA** (feriado ×2 y vacaciones aplican).
- `Tercerizado Mensual`: vínculo **CONTRATO_TEMPORAL** (sin feriado ×2 ni vacaciones). La nota del vínculo guarda área y acuerdo.
- El ADMIN no lleva planilla: aunque la fila traiga sueldo, no se crea.
- El sueldo y el pago se guardan en la misma transacción que la cuenta. Las personas que ya existen se omiten sin tocarlas.
- La salida del simulacro no imprime documentos, celulares, sueldos ni claves.
