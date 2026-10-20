---
name: aybar-trazabilidad
description: Use cuando hay que comprobar que el paquete del Marco Aybar está completo y enlazado de punta a punta (necesidad → requisito → historia → criterio → caso de prueba → tarea, más épica, feature, DoR y ADR), por ejemplo antes de pedir una puerta G0–G4, antes de un handoff o tras editar documentos. Corre un script de solo lectura y explica los huecos.
---

# Aybar · Trazabilidad

Comprueba que **todo lo que se pidió llega a una prueba y a una tarea, y que nada de lo citado es inventado**. Es una comprobación **mecánica** (ids que existen, cuentas que cuadran). No juzga si el contenido es bueno: eso es de `aybar-revision-adversarial`, y la firma es de las personas.

## 1. Cuándo se usa

- Antes de pedir una puerta (`aybar-gate`) o de pasar el paquete al líder técnico.
- Después de añadir, borrar o renombrar HU, features, ADR, casos de prueba o tareas.
- Cuando el usuario pregunta «¿está todo cubierto?», «¿qué falta?» o «¿cuántas decisiones siguen abiertas?».

## 2. Cómo se corre

```
python3 -I .claude/skills/aybar-trazabilidad/scripts/trazabilidad.py <carpeta-del-paquete>
```

Solo lee; no escribe nada. Código de salida: `0` sin incumplimientos, `1` con incumplimientos (A a F), `2` si no encuentra documentos. Lee `analisis/ epicas/ features/ adr/ historias/ dor/ pruebas/ backlog/tareas/*.json`; ignora los `README.md`.

## 3. Qué comprueba

| Sección | Comprobación | Si falla |
|---|---|---|
| A | Todo id citado (EP, FT, HU, ADR, RQ, RN, RNF, TC, D, R…) existe en algún documento | **Incumplimiento** |
| B | Todo requisito RQ-… aparece en al menos una historia | **Incumplimiento** |
| C | Cada HU tiene criterios CA-n y exactamente un caso TC-<dom>-<HU>-NN por criterio | **Incumplimiento** |
| D | Cada HU tiene tareas en el JSON; sin dependencias rotas ni ciclos; sin HU fantasma | **Incumplimiento** |
| E | Cada FT tiene su DoR y está en una épica; cada épica tiene su JSON | **Incumplimiento** |
| F | Cada ADR lo usa alguna feature, historia o DoR | **Incumplimiento** |
| G | Documentos que ya no están en `draft`; `approved` sin aprobadores | Informa |
| H | Decisiones D-xx abiertas vs cerradas (cerrada = su línea dice «Decidid…») | Informa |
| I | Documentos con más marcas de «pendiente» | Informa |

## 4. Procedimiento

1. Correr el script y **mostrar el resultado completo**, sin resumirlo de memoria.
2. Por cada incumplimiento A–F, decir **qué documento hay que tocar** (el que debería citar o definir el id) y proponer el arreglo en una línea. **No editar** documentos salvo que el usuario lo pida; si lo pide, un documento a la vez y volver a correr el script.
3. Para G–I, resumir en tres líneas lo que bloquea la siguiente puerta (decisiones abiertas, firmas faltantes) sin dramatizar.
4. Cerrar con la conclusión: «Trazabilidad A–F: cumple / no cumple», más lo que **no** garantiza.

## 5. Reglas

- **Solo lectura.** El script y esta skill no cambian el paquete.
- **El script no aprueba nada.** Un paquete trazable sigue en `draft` hasta que las personas firmen («la IA propone, el humano firma»); no tocar `estado` ni `aprobadores`.
- **No cifras de memoria.** Los conteos salen de la ejecución de hoy, no de lo que se recuerde.
- **No inventar ids** para tapar un hueco: se reporta el hueco.
- Si el paquete usa otro dominio de ids (otra sigla que `MCP`), el script lo detecta por el patrón `XXX-<SIGLA>-NN`; si una familia de ids nueva no se reconoce, decirlo en vez de dar un «cumple» falso.
- No sustituye al validador de estados (`estado.py`): ese mira frontmatter y puertas; este mira enlaces.

## 6. Lo que NO garantiza

- Que un criterio esté bien redactado, que un caso de prueba pruebe de verdad lo que dice, o que las horas sean razonables → `aybar-revision-adversarial`.
- Que las firmas sean reales, que exista ticket AYB (R13) u owner (R16).
- Que el código cumpla: no hay código hasta que G3 y G4 estén aprobados (R1).

## 7. Checklist

- [ ] Script corrido hoy sobre la carpeta correcta, salida mostrada completa
- [ ] Cada incumplimiento A–F tiene documento a tocar y arreglo propuesto
- [ ] Nada editado sin pedido del usuario
- [ ] Conclusión dicha con sus límites (sección 6)
