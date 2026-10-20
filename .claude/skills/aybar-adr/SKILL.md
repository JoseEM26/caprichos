---
name: aybar-adr
description: Use cuando hay que redactar o actualizar un Registro de Decisión Arquitectónica (ADR / T-ADR) para el gate G3 de Arquitectura en el paquete Aybar (incluidos los de infraestructura y DevOps).
---

# Aybar · Generar ADR (T-ADR)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/adr/`** — archivo `ADR-###-<slug>.md`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

Especializada en la redacción de Registros de Decisión Arquitectónica (ADR / T-ADR) del marco Aybar.

## 1. Para qué sirve y en qué gate entra

El ADR captura decisiones de arquitectura, plataforma, seguridad y diseño técnico de forma justificada y auditable.
- **Gate:** Entra en **G3 (Architecture Gate)**, cuya aprobación corresponde al **Technical Lead (TL)** y bloquea el inicio del desarrollo.
- **Modelos de referencia:** `adr/ADR-021-registro-de-roles-y-permisos-por-microservicios.md` y `adr/ADR-020-starters-del-sdk-del-servicio.md`.

## 2. Frontmatter obligatorio y convenciones

El archivo debe ubicarse en `adr/ADR-###-<slug>.md` (ej. `adr/ADR-021-registro-de-roles-y-permisos-por-microservicios.md`).

```yaml
---
id: ADR-###
tipo: adr
titulo: "<Título descriptivo de la decisión>"
estado: draft
producto: aybarcorp
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: AAAA-MM-DD
relacionados: [AYB-1042, <IDs de decisiones D-##, acuerdos R##, RF/RN/RNF, otros ADR>]
tags: [adr, <tecnología o dominio>, g3]
---
```

## 3. Secciones obligatorias en orden estricto

Tomadas estrictamente de `adr/ADR-021-*.md` y `adr/ADR-020-*.md`:

1. `# ADR-###: <Título>`
   Metadatos iniciales bajo el encabezado:
   - `- Estado: propuesto`
   - `- Ticket: AYB-#### - Fecha: AAAA-MM-DD`
   - `- Compatibilidad con M0: (pendiente — vínculo con el lineamiento del Directorio)`
2. `## Contexto`
   Hechos verificados, problema técnico, dependencias y huecos para G3 citando decisiones o acuerdos vigentes.
3. `## Opciones evaluadas`
   Tabla Markdown con las columnas: `| Opción | Por qué no | Qué la haría reconsiderar |`. La primera fila describe la opción elegida.
4. `## Decisión`
   Puntos numerados detallando la solución adoptada, impacto en contratos y mecanismos de control.
5. `## Consecuencias`
   Lista estructurada con subsecciones:
   - `- Obliga a:`
   - `- Impide:`
   - `- Cuesta:` (incluir siempre impacto en costo cloud: `Costo cloud: (pendiente: estimación con la calculadora de precios de Azure)`).
6. `## Datos (puerta F4 de Gobierno de Datos, si toca datos)`
   - Entidades nuevas y dueño de dato (si no aplica: declarar explícitamente "ninguna").
   - Linaje fuente-destino (flujo de escritura/lectura y consumidores). PII/sensibilidad.
   - Reglas de calidad que entran a la batería de F10 (o "ninguna propia").
7. Pie de trazabilidad:
   `Generado por IA: <qué> — Revisado por: (pendiente) - Aprueba: TL`

## 4. Reglas, SDK y errores típicos

- **Alineación con el SDK y desvíos:** Si la arquitectura se desvía de los starters del SDK (ej. Mongo apagado, Kafka retirado, secretos leídos de Azure Key Vault, cadenas de seguridad rearmadas a mano), declara la desviación de forma explícita tal como en `ADR-020`. No alteres skills selladas.
- **Compatibilidad con M0:** Sin vínculo explícito a M0 o dispensa de Data Chief / Directorio, el ADR no es válido para cerrar G3.
- **Existencia de IDs:** Todo ID en `relacionados` o en el texto (`D-##`, `R##`, `RF-*`, `ADR-*`) debe existir en `analisis/decisiones.md` o en el paquete.
- **Campos sin fuente:** Lo no respaldado por una decisión o requerimiento se deja vacío como decisión pendiente `(pendiente — D-xx)`. Nunca inventar supuestos como hechos consumados.
- **Firma humana:** La IA nunca marca `approved` ni llena la lista `aprobadores: []`.

## 5. Checklist final de verificación

1. [ ] Archivo nombrado como `adr/ADR-###-<slug>.md`.
2. [ ] Frontmatter completo en orden con `estado: draft` y `aprobadores: []`.
3. [ ] Metadato `- Compatibilidad con M0:` presente antes de Contexto.
4. [ ] Secciones en orden exacto: Contexto, Opciones evaluadas, Decisión, Consecuencias, Datos (F4).
5. [ ] Costo cloud declarado en Consecuencias (estimación con calculadora de Azure).
6. [ ] Desviaciones de starters del SDK declaradas si aplica.
7. [ ] Pie de trazabilidad con `Generado por IA: ... — Revisado por: (pendiente) - Aprueba: TL`.
8. [ ] Ejecutar verificación de integridad:
   `python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'`

## 6. Documento modelo a copiar

Copiar estructura y convenciones de `adr/ADR-021-registro-de-roles-y-permisos-por-microservicios.md` o `adr/ADR-020-starters-del-sdk-del-servicio.md`.

## DevOps, plataforma e infraestructura (DT-51)

- Un ADR de infraestructura (servidor, despliegue, red, copias, vigilancia, secretos) debe nombrar en «Consecuencias → Obliga a» los **runbooks** que exige (`operacion/RB-<DOM>-###`) y la actualización del **inventario** (`operacion/INV-<DOM>-###`).
- Costo: si no se usa la nube del marco, escribe el costo real del proveedor elegido.
- Ningún valor de secreto en el ADR: solo dónde vive (skill `aybar-secretos`).
