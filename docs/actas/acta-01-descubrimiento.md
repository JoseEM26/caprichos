# Acta 01: Reunión de descubrimiento, Caprichos

| Campo | Detalle |
| :-- | :-- |
| **Fecha** | Lunes 12 de octubre de 2026 (inferida: Kevin menciona "ayer, domingo") |
| **Modalidad** | Videollamada (con pantalla compartida) |
| **Participantes** | Kevin Rosales (Caprichos, cliente) y José Ángel Espinoza Morales (desarrollador) |
| **Etapa del marco de trabajo** | 1 de 5: Descubrimiento |
| **Fuente** | Transcripción automática de la reunión. Tiene errores de reconocimiento de voz; lo dudoso se marca con (?) |

## 1. Contexto del cliente

- Caprichos es un negocio gastronómico donde el foco principal es la **hospitalidad**. Kevin insiste en que el proyecto no es solo programación: hay que entender la visión de la empresa, cómo trata a sus clientes, su vocabulario de marketing y sus cierres de venta.
- Hoy tienen un **bot de WhatsApp** hecho por un miembro del equipo (lesionado del tobillo, atendía el chat desde casa). Lo desarrolló con IA en **Antigravity** (asistente Gemini), en **Python**. Superó las expectativas, pero el **domingo 11 de octubre tuvo fallos** que generaron quejas de clientes. Kevin se comprometió con ellos a que no se repita.
- Ese colaborador sigue con ellos pero ya no a tiempo completo (trabaja para otra empresa de un familiar de Kevin).
- Kevin ha estado mejorando el bot desde entonces (lleva la noche sin dormir): escribe cambios en lenguaje coloquial al asistente, que los programa y aplica; también genera prompts en Gemini. El bot está en pruebas.
- El bot está programado para terminar cada respuesta con una pregunta de **cierre de venta**, para orientar al cliente hasta cerrar el pedido.
- Se paga con **recarga en dólares** (el consumo de Gemini). José señaló que, si consume directo de Gemini, habrá una API key; con saldo recargado no debería cortarse.
- Ya cuentan con un software de punto de venta (nombre dudoso en la transcripción: "Restauram" / "restaurant.p" (?)) y con un menú digital de OlaClick. Quieren **una combinación** de ambos.

## 2. Visión del cliente (lo que quieren lograr)

Un sistema **unificado** que incluya:

1. **Carta digital / menú digital** para que los clientes hagan el pedido ahí.
2. **Stock de insumos en tiempo real**, integrado con la carta (solo ofrecer lo disponible).
3. **Recetas** vinculadas, para saber el **margen de utilidad**.
4. **Pantallas de cocina**.
5. **Bot de WhatsApp** integrado: procesa el pedido, pero **solo el cajero o la cajera** lo acepta en el punto de venta tras verificarlo.
6. Al aceptar el pedido, este **aparece en todas las pantallas de cocina** y empiezan a correr los tiempos.
7. Opcional, propuesto por José: **registro de asistencia del personal** integrado (hoy usan el software gratuito Open Time Clock). Se haría desde la plataforma web, validando la **ubicación** del local y con **foto facial**; fuera del local no permitiría marcar.

Roles y áreas mencionados: cajero/a, meseros (toman pedidos con tablet y el pedido aparece en pantalla), cocina, almacenero (hay un encargado de stock).

## 3. Marco de trabajo propuesto por José

"Diseñamos primero, construimos después": cada paso se revisa y se aprueba con el cliente antes de escribir código.

| # | Etapa | Qué incluye |
| :-: | :-- | :-- |
| 1 | **Descubrimiento** | Reuniones para entender el negocio y su lógica. Es la etapa actual. |
| 2 | **Requerimientos y alcance** | Documentación completa (ADR, BRD, funcionalidades). El alcance queda aprobado por escrito. |
| 3 | **Diseño UX/UI (mockup)** | Diseño ficticio sin código; se cambian colores, letras y pantallas con costo y tiempo mínimos. |
| 4 | **Diseño técnico** | Framework, servicio de IA para el chatbot, tecnologías y arquitectura. |
| 5 | **Construcción e implementación** | Se construye por entregas, con reuniones de feedback hasta llegar a algo aprobado. Solo entonces se implementa. |

Ventajas dichas por José: menos retrabajo y sorpresas, el proyecto queda documentado (se podría pasar a otro programador), costo y tiempo más predecibles.

Referencias mostradas por José: un mockup de otro proyecto, la plataforma **Nexora** (seguimiento de avance de desarrolladores con Scrum, dashboard, observabilidad, documentación) y una intranet de gestión de consultores de una empresa de telecomunicaciones (ya sin acceso). Kevin preguntó por proyectos de restaurantes: José dijo que tiene pocos; la mayoría son proyectos empresariales a los que no puede dar acceso, y que tiene también proyectos personales. Kevin pidió referencias para revisar.

## 4. Decisiones y acuerdos de la reunión

1. Se seguirá el marco por etapas: **planificar todo primero y ejecutar al final** (Kevin lo confirmó).
2. **Orden de construcción sugerido por José:** primero la **carta y el ERP/POS** (base de datos con productos, stock y recetas), y **después el chatbot**, porque necesita consumir esa información. El chatbot sería la fase siguiente. Kevin dijo que el bot ya tiene la carta en imágenes y en texto (tamaños incluidos).
3. El chatbot final sería una **fusión**: guía de recomendaciones y cierres de venta (lo que ya hace el bot actual) más consulta a la base de datos (stock y disponibilidad).
4. José revisará el bot actual **sin compromiso**, probándolo por WhatsApp (Kevin le pasó el contacto del bot) y compartiendo pantalla.
5. Tema abierto: si se quiere **guardar las preferencias de cada cliente**, es un caso aparte que se evaluará.

## 5. Pendientes y preguntas abiertas

| # | Pendiente | Responsable |
| :-: | :-- | :-- |
| 1 | **Estimación de tiempo** del proyecto: Kevin la pidió "superficialmente"; José aún no la dio. Se hará tras el descubrimiento. | José |
| 2 | Definir si se **construye desde cero** o se reutiliza el POS actual y se integra la carta (Kevin lo planteó). | Ambos |
| 3 | Revisar y opinar sobre el **bot actual** y su flujo. | José |
| 4 | Entregar **referencias de proyectos** y mostrar avances. | José |
| 5 | Identificar el **nombre exacto del POS actual** y qué ofrece (API, exportación). | Kevin |
| 6 | Detallar requerimientos por categoría (productos, insumos, recetas, roles). Kevin anticipó que pedirá detalles puntuales. | Ambos |
| 7 | Decidir sobre el módulo de **asistencia** (reemplazar Open Time Clock). | Kevin |
| 8 | Decidir si se guardan **preferencias de clientes**. | Kevin |
| 9 | Consultar el **Excel de roles y funciones 2024** y documentar los flujos de operación (hoy los procesos son empíricos). | Kevin / José |

## 6. Material relacionado ya reunido (después de la reunión)

- `recursos/`: logos, plantillas de vasos y las dos cartas vigentes (PDF).
- `recursos/README.md`: misión, visión, valores, público objetivo, paleta y contexto (incluye el reto de reducir el tiempo de entrega de 20-25 min a un máximo de 13 min).
- `legacy/web-anterior/carta/`: análisis de la web anterior de pedidos en OlaClick (catálogo, imágenes, flujo de pedido y funcionalidades). Esa web es **histórica**; la carta vigente es la de los PDFs.
- Design system de Caprichos (artefacto): https://claude.ai/artifact/7GmJ8tWCzfidRpXfeEd4LR

## 7. Próximos pasos

1. Seguir la etapa de Descubrimiento con más reuniones y levantar la lógica de negocio.
2. Redactar los documentos de requerimientos (BRD/ADR) y el alcance, para aprobación por escrito.
3. Preparar el mockup de la carta digital y el POS.

## 8. Aclaraciones posteriores (dichas por José, sin verificar)

- El chatbot actual es **simple**: solo devuelve el enlace a la carta digital. No toma el pedido.
- La meta es **mejorarlo** para que tome un pedido real, con todas las personalizaciones (variantes, leche, endulzante, cremas y demás), **unido a la base de datos** del sistema.
- Motivo: parte de los clientes (mayores de edad) no manejan bien la web; con el chatbot eligen en WhatsApp, como en la página.
- Se cree que el negocio **ya tiene la API de WhatsApp** (por confirmar con Kevin: si es la API oficial de WhatsApp Business o cómo se conecta el bot actual).
- José confirma que el bot en producción es el simple (solo manda el enlace). En la reunión Kevin mencionó además un bot con IA (Python con Gemini) que falló el domingo; su estado real se aclara con Kevin.

### Prueba del chatbot actual (conversación del 12/10/2026, 21:29)

| Mensaje | Respuesta del bot |
| :-- | :-- |
| "hola" | Se presenta como **Capri** y pregunta en qué puede ayudar (tono cercano, con emojis). |
| "Carta" | Envía el enlace a la carta digital interactiva (`caprichos.restaurant.pe/menu-digital/#/inicio/1`) y dice que pedir desde el menú web hace que los productos se preparen y lleguen más rápido. Añade que, si prefiere pedir por WhatsApp o ver fotos de la carta, puede avisarle y se las comparte. |

Observaciones: solo se probó el camino "Carta"; no se probó pedir por WhatsApp ni pedir las fotos. El bot empuja al cliente hacia la carta web, y deja abierta la opción de pedir por WhatsApp, que es justo lo que el nuevo chatbot debe resolver de punta a punta. La ruta del enlace es `menu-digital`, distinta de `carta-digital` que aparece en el menú del sistema administrativo (a confirmar si son la misma carta).
