---
name: aybar-revision-adversarial
description: Use cuando hay que revisar con ojo crítico un documento o paquete del Marco Aybar (ficha, BRD, épica, feature, ADR, HU, DoR, plan de pruebas, tareas JSON) buscando contradicciones, huecos, supuestos sin respaldo y cifras inventadas antes de una puerta G0–G4. Genera solo un informe; no edita nada ni aprueba.
---

# Aybar · Revisión adversarial

Un segundo par de ojos que **busca lo que está mal o falta**, no que confirma lo que ya se escribió. Quien redactó un documento (o una IA que lo ayudó a redactar) tiende a creer que está bien. Esta revisión parte de lo contrario: «¿dónde falla esto?».

## 1. Por qué existe

- **Complacencia:** una IA que acaba de escribir un documento lo defiende. Una IA que revisa en la misma conversación hereda ese sesgo.
- **Auto-preferencia:** los modelos puntúan mejor lo que se parece a su propia redacción.
- **Lo ausente no se ve:** los errores más caros son lo que no está (una regla sin caso de prueba, un riesgo sin dueño), y no se ven leyendo solo lo escrito.

Por eso la revisión **corre sin la historia de la conversación** (sección 4) y **exige evidencia** por hallazgo.

## 2. Qué se revisa y contra qué

| Documento | Se contrasta con |
|---|---|
| Ficha intake | lo que dijo el solicitante; supuestos y alcance |
| BRD | ficha; reglas RN, riesgos R, métricas |
| Épica | BRD (objetivos y RN que cubre) |
| Feature | épica y BRD; RQ y RNF con criterio medible |
| ADR | BRD y feature; ¿hay opciones reales, costo, qué haría reconsiderar? |
| HU | feature (RQ que dice cubrir); criterios CA verificables; formato Como/Quiero/Para |
| DoR | HU y feature; lo marcado «Listo» tiene respaldo o es «propuesta IA» |
| Plan de pruebas | HU: un caso por criterio, negativos, seguridad, rendimiento, regresión |
| Tareas JSON | HU; estimaciones, responsable, dependencias y el criterio de «hecho» |

Si falta el documento contra el que se contrasta, **decirlo y revisar en degradado** (solo consistencia interna), sin fingir que se contrastó.

## 3. Qué se busca

1. **Contradicciones** entre documentos (cifra, nombre, regla, estado distintos).
2. **Huecos:** requisitos sin criterio, riesgos sin mitigación, decisiones sin dueño, casos sin dato de prueba.
3. **Supuestos sin respaldo:** «se asume…», cifras sin fuente, precios sin fecha. Regla del Marco: **no inventar cifras**.
4. **Criterios no verificables:** «rápido», «seguro», «fácil» sin número o prueba.
5. **Violaciones del Marco:** `estado` distinto de `draft` sin firma, `aprobadores` rellenados por la IA, datos reales en lugar de sintéticos, claves o tokens pegados, owner o ticket (R13/R16) inventados, código antes de G3 y G4 (R1).
6. **ADR flojos:** opción elegida sin comparar, «por qué no» que es opinión, costo sin cálculo.
7. **Alcance que se corre:** historias que meten algo que la épica o el BRD excluyen, o al revés.

No se repite lo mecánico (ids que no existen, cuentas que no cuadran): eso lo cubre `aybar-trazabilidad`. Si no se corrió hoy, **correrla primero** y partir de su salida.

## 4. Procedimiento

1. **Acotar:** qué documento(s) y para qué puerta. Si no se dijo, preguntar una vez.
2. **Trazabilidad primero:** correr `aybar-trazabilidad`; lo mecánico entra al informe tal cual.
3. **Independencia:** lanzar la revisión en un **subagente sin la historia de la conversación**, con solo estas entradas: la ruta de los documentos, la tabla de la sección 2, las secciones 3, 5 y 6 de esta skill. No pasarle tus conclusiones ni opinión previa. Si no se puede lanzar un subagente, decirlo en el informe: «revisión hecha en la misma conversación; menos independiente».
4. **Cada hallazgo lleva evidencia:** archivo, cita corta o línea, y **por qué importa** (qué pasa si no se arregla). Sin cita no es hallazgo.
5. **Verificar antes de informar:** releer la fuente de cada hallazgo y descartar los que no resistan. Es mejor 5 hallazgos ciertos que 20 dudosos.
6. **Discrepar primero, sin inventar:** si algo parece mal pero no hay evidencia, va como **Sugerencia** con la pregunta que lo resolvería, nunca como hecho.
7. **Escribir el informe** (sección 5) y detenerse. No arreglar nada.

## 5. Informe

Se muestra en la conversación. Solo se guarda como archivo si el usuario lo pide (un documento a la vez, con el frontmatter de 11 claves, `estado: draft`, `aprobadores: []`).

```
REVISIÓN ADVERSARIAL · <documento(s)> · para <puerta> · <fecha>
Independencia: subagente sin historia | misma conversación
Trazabilidad A–F: cumple | no cumple (n)

CRÍTICO (bloquea la puerta)
1. <qué está mal> — <archivo>: «<cita>» — Por qué importa: … — Arreglo sugerido: …
ADVERTENCIA (conviene arreglar antes de aprobar)
…
SUGERENCIA (mejora o pregunta)
…
LO QUE NO SE PUDO REVISAR: <y por qué>
```

**Severidad:**
- **Crítico:** contradicción entre documentos, requisito sin prueba, cifra inventada, violación de una regla del Marco, riesgo grave sin mitigación.
- **Advertencia:** criterio vago, supuesto sin respaldo, estimación sin base, ADR sin comparación real.
- **Sugerencia:** redacción, orden, pregunta abierta.

Si no hay nada que reportar, **decirlo y decir qué se miró**. No rellenar para parecer útil.

## 6. Reglas

- **Solo informa.** No edita documentos, no corrige, no cambia `estado`. Los arreglos los decide el dueño del documento.
- **La IA no aprueba.** El informe no es una aprobación ni la sustituye: «la IA propone, el humano firma».
- **Sin relleno:** cero hallazgos genéricos («falta más detalle»). Cada uno señala un lugar y una consecuencia.
- **Sin cifras propias:** si se corrige una cifra, citar de dónde sale la correcta; si no hay fuente, «por definir».
- **No exponer secretos:** si aparece una clave o token en un documento, se reporta la ubicación sin repetir el valor.
- **Datos sensibles:** no pegar datos reales de personas en el informe.
- **Especialización:** si el documento es un ADR, una HU, un plan de pruebas, etc., aplicar con más peso la fila correspondiente de la sección 2.

## 7. Checklist

- [ ] Alcance y puerta definidos
- [ ] `aybar-trazabilidad` corrida hoy y su resultado incluido
- [ ] Revisión en subagente sin historia (o la limitación declarada)
- [ ] Cada hallazgo con archivo, cita, consecuencia y severidad
- [ ] Cada hallazgo verificado contra la fuente; descartados los dudosos
- [ ] Informe presentado; nada editado ni aprobado
- [ ] «Lo que no se pudo revisar» incluido
