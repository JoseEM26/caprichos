---
id: ADR-018
tipo: adr
titulo: "Asistente de ayuda administrativa Capri con grafo de conocimiento en memoria sobre manuales Markdown"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-27
relacionados: [ADR-001, ADR-005, ADR-008, ADR-009, ADR-014]
tags: [adr, ayuda-admin, capri, grafo-conocimiento, markdown, openai, sin-embeddings]
---

# ADR-018: Asistente de ayuda administrativa Capri con grafo de conocimiento en memoria sobre manuales Markdown

- **Estado:** borrador (draft — la IA propone; aprueba y firma el líder técnico)
- **Relacionado con:** **ADR-001** (Monolito modular NestJS/React), **ADR-005** (Protección de datos personales Ley 29733) y **ADR-008** (Control de acceso basado en roles).
- **Fecha:** 2026-10-27

---

## 1. Contexto

El panel administrativo de Caprichos cuenta con más de 30 módulos y flujos operativos (apertura y cuadre de caja, gestión de stock, recetas de producción, reservas, comanda de salón y configuración fiscal). La rotación natural de personal en cafeterías (mozos, baristas, cajeros) requiere que el sistema provea inducción y asistencia en línea inmediata ("¿cómo anulo un cobro con diferencia?", "¿cómo registro una merma en cocina?").

Un diseño ingenuo basado en un modelo conversacional de IA conectado directamente a internet o sin límites de contexto genera graves deficiencias:
1. **Alucinaciones en procedimientos críticos:** Respuestas inventadas en tareas que involucran cuadre de dinero, anulación de pedidos o manipulación de inventarios.
2. **Filtración de permisos y funciones entre roles:** Un mozo podría consultar cómo anular transacciones o un cajero cómo modificar permisos de usuario.
3. **Respuestas extensas y dispersas:** Respuestas con párrafos de relleno que entorpecen la agilidad operativa en el mostrador.
4. **Dependencia y sobrecosto:** Obligar al sistema a consultar bases de datos vectoriales externas o embeddings para un conjunto acotado de documentación.

Se requería un asistente embebido en el panel administrativo que guiase al personal con respuestas concisas y exactas, sustentadas exclusivamente en la documentación oficial del sistema y aisladas estrictamente según el rol del usuario.

---

## 2. Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
|---|---|---|
| **Elegida:** **Documentación fuente en Markdown + Grafo de conocimiento en memoria + Recuperación léxica con sinónimos y 1 salto relacional + IA opcional concisa (o respaldo sin IA)** | — | Expansión del corpus documental a miles de artículos heterogéneos no estructurados. |
| **RAG tradicional con Embeddings y Base Vectorial (pgvector / Pinecone)** | Corpus pequeño (~35 manuales estructurados); la vectorización añade latencia innecesaria (llamada HTTP por cada búsqueda), sobrecosto de embeddings, pérdida de determinismo en permisos por rol y complejidad operacional. | Crecimiento a más de 500 manuales o necesidad de búsqueda semántica multilingüe no estructurada. |
| **Búsqueda por coincidencia de texto simple (LIKE / ILIKE)** | Incapaz de resolver vocabulario operativo común de hostelería (ej. buscar "cuadre" para tareas de "diferencia", o "cancelar" para "anular") y no provee navegación entre tareas correlativas. | Si la aplicación solo admitiera búsquedas por título exacto. |
| **Asistente conversacional libre (LLM sin contexto documental)** | Alto riesgo de alucinación en procedimientos de negocio y nulo cumplimiento de políticas internas del restaurante. | En ningún caso para operaciones administrativas críticas. |

---

## 3. Decisión

1. **Fuente Única de Verdad en Markdown (`apps/api/src/modulos/ayuda-admin/manuales/`):**
   - La documentación vive versionada en el repositorio en archivos Markdown estándar con frontmatter estructurado (`titulo`, `modulo`, `roles`, `orden`, `ruta`, `requiere`, `siguiente`, `relaciones`, `tags`).
   - El equipo técnico y los administradores actualizan los manuales mediante control de versiones sin requerir bases de conocimiento externas.

2. **Grafo de Conocimiento Derivado en Memoria (`AyudaGrafoService`):**
   - Al inicializar la API, el servicio procesa los manuales y construye un grafo bidireccional en memoria RAM (tiempo de carga inferior a 50 ms).
   - **Nodos:** Roles del sistema (`ADMIN`, `CAJERO`, `MOZO`, `COCINA`), Módulos administrativos y Tareas operativas.
   - **Aristas tipadas:** `PERTENECE_A_MODULO`, `ACCESIBLE_POR_ROL`, `REQUIERE_TAREA`, `CONTINUA_CON`, `RELACIONADO_CON`.
   - **Aislamiento por rol:** Toda consulta filtra estrictamente el subgrafo alcanzable mediante aristas `ACCESIBLE_POR_ROL` asociadas al rol del usuario autenticado. Ningún usuario puede visualizar tareas que excedan sus permisos.

3. **Recuperación Léxica con Diccionario de Sinónimos y 1 Salto:**
   - La recuperación utiliza un diccionario de normalización de términos de cafetería (`anular`/`cancelar`, `cobrar`/`pagar`, `diferencia`/`cuadre`/`faltante`, `supervisor`/`totp`/`pin`/`codigo`, `agotar`/`stock`, etc.).
   - Al localizar la tarea o módulo objetivo, el grafo navega **1 salto relacional** para incorporar los requisitos previos (`REQUIERE_TAREA`) y pasos posteriores (`CONTINUA_CON`), entregando contexto procedural completo.

4. **Herramientas de Exportación y Verificación del Grafo:**
   - Comando CLI disponible: `pnpm --filter @caprichos/api ayuda:grafo` (ejecuta `apps/api/scripts/generar-grafo.ts`).
   - Genera automáticamente los artefactos `docs/ayuda/grafo-ayuda.json` y `docs/ayuda/grafo-ayuda.md` para auditoría y visualización de la topología de la ayuda.
   - Prueba automatizada obligatoria (`validar-manuales.spec.ts`) que valida que cada manual referencie rutas válidas y cumpla el esquema de frontmatter.

5. **IA Opcional y Modo de Respaldo Determinista Sin IA:**
   - Controlado por el parámetro configurable `ayuda_ia_activo` (boolean en tabla `parametro`).
   - **Con IA activa:** Invocación a OpenAI con prompt restrictivo: respuestas directas enfocadas exclusivamente en lo preguntado (para qué sirve el módulo o pasos numerados de la tarea), sin relleno, con prompt acotado y límite de salida de 400 caracteres.
   - **Modo respaldo (sin IA o falla de cuota):** El sistema entrega de inmediato el resumen estructurado y la secuencia de pasos extraída directamente del Markdown, asegurando el 100% de operatividad aunque no haya internet hacia el proveedor de IA o se agote el saldo.
   - Consumo registrado en `ia_consumo` con `origen: 'AYUDA_ADMIN'`.

6. **Principio de No Ejecución:**
   - El asistente de ayuda Capri es estrictamente consultivo y pedagógico; no posee herramientas de función-calling para modificar base de datos ni ejecutar acciones administrativas.

7. **Interfaz de Usuario en el Panel Web (`apps/web/src/admin/ayuda/`):**
   - Botón flotante accesible en todas las vistas administrativas.
   - Panel lateral en pantallas de escritorio y hoja inferior (*bottom sheet*) en dispositivos móviles.
   - Botón de minimizar a tamaño compacto en la esquina para no obstaculizar botones de acción como "Enviar" o "Pulir", y botón de restaurar/agrandar.
   - Enlaces directos a módulos ("Ir a") y sugerencias contextuales según la pantalla donde se encuentre el usuario.

8. **Justificación: Por qué NO embeddings en este momento:**
   - El corpus total del sistema comprende aproximadamente 35 manuales concisos.
   - La búsqueda léxica enriquecida con grafo en memoria ofrece tiempos de respuesta menores a 5 milisegundos, costo cero de indexación vectorial, cero mantenimiento de dependencias externas (pgvector) y total determinismo en el cumplimiento de la matriz de roles.
   - Antes de incorporar modelos de embeddings se medirá el crecimiento futuro del corpus documental.

---

## 4. Consecuencias

### Positivas
- **Respuestas inmediatas y precisas:** Personal capacitado al instante sin interrumpir a compañeros o administradores.
- **Cero alucinación:** Respuestas respaldadas exclusivamente por la documentación oficial versionada en git.
- **Aislamiento de seguridad:** Imposibilidad de que un rol acceda a información operativa o administrativa fuera de su alcance.
- **Economía y resiliencia:** Funciona perfectamente sin IA mediante el respaldo nativo de manuales, con costo cero recurrente en modo sin IA.

### Negativas / Mitigaciones
- **Mantenimiento de metadatos:** Exige mantener actualizados los encabezados de frontmatter y relaciones entre manuales cuando se agregan funcionalidades. *Mitigación:* Pruebas automatizadas en CI (`validar-manuales.spec.ts`) que impiden integrar manuales con enlaces rotos o sintaxis incorrecta.

---

## 5. Datos (Gobierno de Datos - Puerta F4)

- **Entidades afectadas:** Tabla `parametro` (parámetro `ayuda_ia_activo`) y tabla `ia_consumo` (`origen: 'AYUDA_ADMIN'`).
- **Privacidad y cumplimiento de la Ley 29733:**
  - El servicio de ayuda incluye filtros que rechazan activamente consultas que contengan números de documento de identidad (DNI/RUC), teléfonos o contraseñas.
  - No se almacenan historiales de conversación en base de datos; la interacción reside en el estado local de la sesión del navegador.

---

*Generado por IA: Borrador formal según especificación de docs-contrato.txt y directrices del proyecto Caprichos — Revisado por: (pendiente) — Aprueba: Technical Lead*
