---
id: RB-CAP-011
tipo: runbook
titulo: "Runbook: activación y operación del Asistente de Ayuda Capri en el Panel Administrativo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-27
relacionados: [RB-CAP-007, COS-CAP-001, ADR-014, SEC-CAP-001]
tags: [runbook, ayuda-admin, capri, asistente, grafo, manuales, ia, openai]
---

# RB-CAP-011 — Activación y operación del Asistente de Ayuda Capri en el Panel Administrativo

| Campo | Valor |
|---|---|
| Cuándo usarlo | Para habilitar o deshabilitar el asistente de ayuda interactivo Capri en el panel administrativo, regenerar el grafo de manuales, monitorear el consumo de IA o activar el modo de contingencia sin IA |
| Tiempo esperado | Activación en panel: menos de 1 minuto · Regeneración del grafo: menos de 30 segundos |
| Quién lo ejecuta | Rol `ADMIN` o personal técnico |
| Riesgo | Mínimo: el asistente es de solo lectura y orientación; no ejecuta acciones en el sistema |
| Módulos afectados | `apps/api/src/modulos/ayuda-admin/`, `apps/web/src/admin/ayuda/`, `apps/web/src/mascota/` |

---

## 1. Arquitectura del asistente y modelo de grafo

El Asistente de Ayuda Capri orienta a los usuarios del panel administrativo basándose en los manuales oficiales de cada módulo sin alucinar ni filtrar información no autorizada.

```
┌────────────────────────────────────────────────────────┐
│        34-35 Manuales Markdown en el Servidor          │
│   (apps/api/src/modulos/ayuda-admin/manuales/*.md)     │
└──────────────────────────┬─────────────────────────────┘
                           │ Parseo y extracción de relaciones
                           ▼
┌────────────────────────────────────────────────────────┐
│           Grafo de Documentación en Memoria            │
│  - Nodos: Módulo, Tarea, Rol, Permiso                  │
│  - Aristas: requiere, antes, despues, ver_tambien      │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
 [Recuperación Léxica + 1 Salto]       [Filtrado por Rol]
 (Sinónimos: anular/cancelar...)       (Aislamiento de permisos)
       │                                       │
       └───────────────────┬───────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
    [Modo Con IA: gpt-4o-mini]     [Modo Sin IA: Respaldo puro]
    (Respuesta directa <=400 car)  (Pasos del manual del grafo)
```

### Por qué grafo en memoria y NO embeddings vectoriales:
- **Tamaño del corpus:** El sistema cuenta con ~35 manuales y ~100 tareas operativas específicas.
- **Determinismo y latencia:** La búsqueda léxica con expansión tipada de 1 salto en memoria tarda menos de 2 milisegundos, no requiere bases de datos vectoriales (evitando costos y dependencias externas como pgvector o Pinecone) y garantiza cero costo de indexación.
- **Seguridad estricta de roles:** El grafo filtra en memoria según los permisos del usuario; un cajero o mozo jamás recibe en su contexto tareas de administración o reportes a los que no tiene acceso.
- **Decisión de arquitectura:** Antes de introducir embeddings, se monitoreará el porcentaje de acierto del grafo en producción. Solo si se detectan consultas no resueltas se justificará la complejidad de un modelo vectorial.

---

## 2. Parámetros de configuración y activación

La activación del asistente se realiza en:
**Panel Administrativo → Configuración del local → Parámetros del sistema** (`/admin/mirest?tab=parametros`).

| Parámetro | Tipo | Por defecto | Descripción |
|---|:---:|:---:|---|
| `ayuda_ia_activo` | Sí/No | `false` | Activa la síntesis con OpenAI (`gpt-4o-mini`). Si está apagado, Capri responde en modo `sin_ia` estructurado desde el grafo. |
| `ayuda_ia_max_por_minuto_usuario` | Numérico | `20` | Cuota de seguridad por usuario en Redis para evitar abusos o bucles. |
| `ayuda_ia_max_por_hora_usuario` | Numérico | `200` | Cuota horaria por usuario en Redis. |

### Clave de OpenAI requerida:
Si `ayuda_ia_activo` está encendido, el servidor debe tener configurada la variable `OPENAI_API_KEY` en el archivo `/opt/caprichos/<ambiente>/.env` (ver [RB-CAP-009](./RB-CAP-009-activar-y-operar-vouchers-ia.md)).

---

## 3. Regeneración del grafo de conocimiento

Cuando se añadan, modifiquen o corrijan manuales Markdown en `apps/api/src/modulos/ayuda-admin/manuales/`:

1. Ejecutar el script CLI de generación:
   ```bash
   pnpm --filter @caprichos/api ayuda:grafo
   ```
2. Este comando:
   - Valida la sintaxis frontmatter y relaciones tipadas de todos los manuales.
   - Genera el archivo JSON en `docs/ayuda/grafo-ayuda.json`.
   - Genera la documentación visual con diagrama Mermaid en `docs/ayuda/grafo-ayuda.md`.
3. Ejecutar las pruebas unitarias para asegurar que no hay enlaces rotos:
   ```bash
   pnpm --filter @caprichos/api exec jest src/modulos/ayuda-admin
   ```

---

## 4. Reglas de diseño y comportamiento de Capri

1. **Regla de oro: SOLO AYUDA:**
   - Capri nunca ejecuta mutaciones, no anula pedidos, no cambia estados ni realiza cobros.
   - Su función es puramente pedagógica: explica qué es una pantalla, cuáles son los pasos de una tarea y qué requisitos hacen falta.
   - Todas las respuestas terminan guiando al usuario para que él mismo presione los botones y confirme con Sí/No.

2. **Respuestas directas y concisas:**
   - Prompt de sistema hermético limitado a un máximo de 400 caracteres de salida.
   - Responde exclusivamente lo preguntado, sin saludos redundantes, sin disculpas innecesarias y con a lo sumo un botón directo sugerido (`Ir a <modulo>`).

3. **Mascota Capri y personalización visual:**
   - Diseñada como una chef mujer: carita tono piel, mejillas rosadas, cabello castaño con flequillo y colitas con moñitos, gorro esponjoso separado de la cabeza y uniforme naranja y negro con ribetes dorados.
   - **Renderizado 3D procedural con Three.js:** Carga diferida para no penalizar el tiempo de carga del panel.
   - **Respaldo 2D SVG (`CapriFallback`):** Se activa instantáneamente en dispositivos móviles o navegadores sin WebGL.
   - **Modo Minimizado:** Botón redondo pequeño en la esquina inferior que permite reducir a Capri para que no tape los botones *Enviar* o *Pulir mensaje* en pantallas angostas.
   - Página oculta de pruebas de animaciones: `/mascota`.

---

## 5. Modo de contingencia (Respaldo sin IA)

Si OpenAI presenta interrupciones de servicio, se agota el saldo de la API o el administrador decide apagar la IA (`ayuda_ia_activo: false`):
1. El sistema no se cae ni muestra errores al usuario.
2. Conmuta automáticamente al modo de respuesta de respaldo (`estado: 'sin_ia'`).
3. El motor de búsqueda en el grafo localiza la tarea más relevante y muestra sus pasos estructurados directamente en el panel de ayuda:
   - *Propósito del módulo.*
   - *Pasos numerados oficiales extraídos del manual Markdown.*
   - *Requisitos previos y advertencias.*
   - *Enlace directo al módulo correspondiente.*

---

## 6. Monitoreo, auditoría y resolución de dudas

### Registro de auditoría:
Toda consulta a Capri se audita en la tabla `auditoria` con:
- `categoria`: `'ACCESO'`
- `modulo`: `'ayuda-admin'`
- `accion`: `'CONSULTAR_AYUDA'`
- La pregunta del usuario se almacena recortada a 200 caracteres y con cualquier dato personal (teléfonos, DNI) automáticamente neutralizado bajo la Ley 29733.

### Cuadro de resolución de incidencias:

| Problema | Causa | Solución |
|---|---|---|
| Capri muestra el mensaje de modo sin IA | `ayuda_ia_activo` está en falso o no hay saldo en OpenAI | Revisar la tarjeta de parámetros en `/admin/mirest?tab=parametros` y validar la cuenta de OpenAI. |
| La consulta es rechazada con aviso de datos personales | El usuario ingresó un DNI (8 dígitos), celular o correo | Indicar al personal que la ayuda es solo para el funcionamiento del sistema y no para consultar datos de clientes específicos. |
| El panel lateral tapa un formulario crítico | El usuario trabaja en una pantalla pequeña | Presionar el botón circular de minimizar en la cabecera de Capri para reducirla a un ícono flotante. |
| Error al compilar o arrancar la API tras editar manuales | Error de sintaxis en el frontmatter YAML de un nuevo manual | Correr `pnpm --filter @caprichos/api ayuda:grafo` en la consola para ver qué archivo `.md` tiene formato inválido. |
