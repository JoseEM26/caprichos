# Formato de proyecto.json

Es la única entrada de `construir.js`. `extraer_aybar.py` lo genera; si los datos vienen de otra fuente, escríbelo a mano con este formato.

```json
{
  "proyecto": { "nombre": "access-control-service", "empresa": "AybarCorp", "prefijoId": "-IDN-" },
  "epicas":   [ { "id": "EP-IDN-001", "titulo": "Cuentas e identidades federadas" } ],
  "features": [ { "id": "FT-IDN-001", "titulo": "Cuentas y ciclo de vida", "epica": "EP-IDN-001" } ],
  "hus": [
    {
      "id": "HU-IDN-002",
      "titulo": "Vincular cada identidad federada por el sub",
      "epica": "EP-IDN-001",
      "feature": "FT-IDN-001",
      "prioridad": "DEBE",
      "dependeDe": ["HU-IDN-001"],
      "dependeDeTexto": [],
      "externos": ["DEP-01", "DEP-04"],
      "tareas": 12
    }
  ],
  "externos": { "DEP-01": "Registro en Google, Microsoft y Apple" },
  "fueraDeAlcance": "fuera de alcance por ahora (capa B)",
  "notas": { "HU-IDN-061": "Su texto dice que …" },
  "notasDocumentacionHtml": "<b>Diferencias en la documentación:</b> …<ul><li>…</li></ul>",
  "preparacion": {
    "FT-IDN-001": {
      "status": "READY_COND",
      "externals": ["DEP-01"], "approvals": ["G2", "G3"],
      "decisions": ["D-22"], "questions": ["O39"],
      "other": [], "estimation": true
    }
  },
  "revision": []
}
```

## Campos

| Campo | Obligatorio | Qué es |
|---|---|---|
| `proyecto.nombre` | sí | Aparece arriba de la página, junto a `empresa`. |
| `proyecto.prefijoId` | no | Parte del código que se acorta en pantalla (`-IDN-` → HU-010). Vacío si no aplica. |
| `epicas[]`, `features[]` | sí | Código y título. La feature indica su épica. Si falta un título, se usa el código. |
| `hus[].prioridad` | sí | `DEBE`, `DEBERIA`, `PODRIA` o `NO` (No esta vez). Lo desconocido se toma como `DEBE` con aviso. |
| `hus[].dependeDe` | sí | HU que deben terminar antes, según el backlog. Es lo que ordena el gráfico. |
| `hus[].dependeDeTexto` | no | Dependencias que solo dice el texto de la HU. Se dibujan, se marcan con * y no cambian el paso base. |
| `hus[].externos` | no | Códigos de bloqueos externos (DEP-xx) que menciona la HU. |
| `hus[].tareas` | no | Cantidad de tareas, solo informativo. |
| `externos` | no | Etiqueta corta y simple de cada bloqueo externo. |
| `fueraDeAlcance` | no | Explicación de "No esta vez". |
| `notas` | no | Nota "No coincidía en la documentación" por HU (la arma `aplicar_revision.py`). |
| `notasDocumentacionHtml` | no | Viñeta de "Cómo leer el gráfico" con las diferencias. |
| `preparacion` | no | Resumen del Definition of Ready por feature. `status`: `READY`, `READY_COND` o `NO`. `approvals` usa G0 a G4. Sin este campo, el panel no muestra "Lo que falta resolver". |
| `hus[].historia` | no | `{como, quiero, para}` original de la HU; se muestra como "Historia original". |
| `logros` | no | Qué se logra con cada épica, feature y HU, en lenguaje simple. Se muestra arriba del panel. |
| `codigos` | no | Explicación de cada D-##, O##, G# y DEP-xx: `tipo`, `texto` original, `responsable`, `fecha`, `fuente` (ruta corta) y los campos simples `pregunta`/`propuesta` (D), `simple` (O, G, DEP) y `nombre` (G, DEP). |
| `fuentes` | no | Ruta corta del documento de cada épica, feature y HU (y `DOR:<feature>` para su Definition of Ready). |
| `crudo` | no | Textos originales de épicas y features, solo para redactar `logros`. La página no los usa. |
| `revision` | no | Diferencias detectadas entre el texto y el backlog. `construir.js` lo ignora; sirve para conversarlas con el usuario. |

## Reglas que conviene saber

- Una HU que depende de otra inexistente produce un aviso y esa dependencia se ignora.
- Las dependencias mutuas (A necesita a B y B a A) se permiten. Se dibuja la que arranca primero y el panel explica la otra espera.
- El "paso" se calcula solo con `dependeDe`, así el acomodo no se desarma al sumar dependencias del texto.
