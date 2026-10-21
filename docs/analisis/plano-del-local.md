---
id: ANA-CAP-042
tipo: analisis
titulo: "Plano del local — diseño por defecto del mockup"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "José Ángel Espinoza (UX/UI Designer)", "Kevin Rosales (Stakeholder)"]
fecha: 2026-10-19
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Plano del local — diseño por defecto del mockup

**Estado:** documentado el 19/10/2026 a partir del código publicado (versión 200 del mockup). Es el plano con el que arranca el módulo *Plano del local* en un navegador nuevo. **No incluye** los cambios que se hayan hecho a mano en un navegador concreto: el plano editado se guarda en ese navegador y no lo puede leer quien documenta. Para guardar un plano editado, usar *Plano del local ▸ Guardar o cambiar el diseño ▸ Ver / copiar el diseño ▸ Copiar* y pegarlo en este documento.

Archivo con el diseño exacto (pisos, elementos, posiciones): [`plano-del-local.default.json`](plano-del-local.default.json). Se puede pegar en *Aplicar el diseño pegado* para restaurarlo.

## Cuadrícula

- Piso 1: 20 columnas × 12 filas. Cada elemento ocupa celdas completas (x, y desde la esquina superior izquierda).
- Se pueden cambiar las columnas y filas desde *Tamaño del plano*.
- Piso 1 siempre está activo; el Piso 2 existe pero viene **desactivado**.

## Piso 1 (activo)

Leyenda: `#` pared · `E` entrada · `C` cocina · `B` barra · `$` caja · `W` baños · cada mesa se marca con su número en la esquina superior izquierda (`0` = mesa 10).

```
x→  0         1
    01234567890123456789
 0  ####################
 1  #CCCCC··BBBBBB·$$$·#
 2  #CCCCC··BBBBBB·$$$·#
 3  #CCCCC·············#
 4  #··················#
 5  #·1M·2M·3M·4M·5M···#
 6  #·MM·MM·MM·MM·MM···#
 7  #··················#
 8  #·6M·7M·8M·9M·0MWWW#
 9  #·MM·MM·MM·MM·MMWWW#
10  #···············WWW#
11  ########EEEE########
```

| Elemento | Posición (x, y) | Tamaño | Notas |
|---|---|---|---|
| Cocina | 1, 1 | 5 × 3 | arriba a la izquierda |
| Barra | 8, 1 | 6 × 2 | arriba al centro |
| Caja | 15, 1 | 3 × 2 | arriba a la derecha |
| Baños | 16, 8 | 3 × 3 | abajo a la derecha |
| Entrada | 8, 11 | 4 × 1 | en la pared de abajo, al centro, horizontal |
| Paredes | contorno | — | 6 tramos; la de abajo queda abierta en la entrada (columnas 8 a 11) |

### Mesas del Piso 1 (10 mesas, 38 personas)

| Fila | Mesa | x, y | Personas |
|---|---|---|---|
| Superior (y = 5) | 1 | 2, 5 | 2 |
| | 2 | 5, 5 | 2 |
| | 3 | 8, 5 | 4 |
| | 4 | 11, 5 | 4 |
| | 5 | 14, 5 | 4 |
| Inferior (y = 8) | 6 | 2, 8 | 4 |
| | 7 | 5, 8 | 4 |
| | 8 | 8, 8 | 6 |
| | 9 | 11, 8 | 6 |
| | 10 | 14, 8 | 2 |

Todas las mesas miden 2 × 2. La **Mesa 4** (arriba) y la **Mesa 9** (abajo) están en la misma columna (x = 11) y entre ellas queda el pasillo de la fila 7.

## Piso 2 (desactivado por defecto)

```
    01234567890123456789
 0  ####################
 1  #SS·············WWW#
 2  #SS·············WWW#
 3  #SS·············WWW#
 4  #····1M··2M········#   (mesas 11 y 12)
 5  #····MM··MM········#
 6  #··················#
 7  #··················#
 8  #····3M··4M········#   (mesas 13 y 14)
 9  #····MM··MM········#
10  #··················#
11  ####################
```

Escalera (1, 1; 2 × 3), baños (16, 1; 3 × 3) y 4 mesas (11 y 12 de 4 personas; 13 y 14 de 6 personas): 20 personas.

## Totales

| | Piso 1 | Piso 2 | Total |
|---|---|---|---|
| Mesas | 10 | 4 | 14 |
| Personas | 38 | 20 | 58 |

Con el Piso 2 desactivado, la capacidad en uso es de 10 mesas y 38 personas.

## Reglas del módulo (según el mockup)

- Elementos disponibles: mesa, barra, pared, entrada, escalera, cocina, caja y baños.
- Se colocan tocando el plano, se mueven arrastrándolos y se cambian de nombre, personas (solo mesas), ancho y alto. **Girar** intercambia ancho y alto (convierte una entrada vertical en horizontal y al revés).
- Se puede desactivar cualquier elemento. Se puede eliminar cualquiera salvo una mesa con pedido abierto o reserva activa hoy; los pedidos y reservas cerrados conservan el nombre de la mesa.
- El mozo ve este plano al tomar un pedido de mesa; las reservas y juntar mesas lo usan.
- La numeración de las mesas es continua entre pisos (11 a 14 en el Piso 2); una mesa nueva toma el número siguiente al mayor que exista.

## Pendiente

- El plano real del restaurante, tal como lo dibujó el dueño, **no está** en este documento. Falta recibirlo con *Copiar el diseño* para dejarlo como plano por defecto.
- Confirmar los cambios pedidos sobre la entrada: ubicarla a la derecha, entre las mesas 4 y 9, en horizontal, y qué se numera del 1 al 6; y con qué se rellena la parte de abajo.
