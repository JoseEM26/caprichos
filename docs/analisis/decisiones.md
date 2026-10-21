# Registro de decisiones del paquete de análisis y diseño

**Frente:** Plataforma digital de Caprichos (carta virtual, módulo administrativo, pantallas de cocina y chatbot de WhatsApp)
**Servicio:** caprichos
**Fecha:** 19/10/2026
**Decide:** José Ángel Espinoza (PO y TL, DT-48) · Stakeholder: Kevin Rosales

Este registro es la **fuente de verdad** del paquete. Si un documento (BRD, roadmap, épica, feature, historia, ADR o DoR) lo contradice, **manda este registro** y el documento se corrige.

Generado por IA: a partir de `analisis/BRD.md` (v1.51), `analisis/ficha-intake.md`, las actas 01, 02 y 03, `analisis/registro-mockup.md` y `analisis/informacion-a-pedir-al-cliente.md` — Revisado por: *(pendiente)*

aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
---

## 1. Forma de trabajo

| # | Decisión | Fuente |
| --- | --- | --- |
| DT-01 | En este proyecto **no hay Product Owner ni Technical Lead asignados**. El paquete se genera con las skills del marco y queda **todo en `draft`**, sin firmas. Las casillas de firma quedan vacías hasta que alguien asuma esos roles. *(Reemplazada el 20/10/2026 por DT-48.)* | Decisión del desarrollador, 19/10/2026 |
| DT-48 | **José Ángel Espinoza asume los roles de Product Owner, Technical Lead, QA y UX** del paquete (20/10/2026); Kevin Rosales sigue como Stakeholder y dueño del negocio. La IA no firma: los documentos pasan a `approved` solo cuando José lo hace con `scripts/aprobar.py`. Como José también es autor, el marco pide que **Kevin firme como Stakeholder G1 (BRD y épicas) y G2 (diseño)**, para que nadie se autoapruebe en lo que decide el cliente. | Instrucción de José Ángel, 20/10/2026 |
| DT-02 | La IA propone y no firma: ningún documento pasa a `approved` sin una persona que lo apruebe. | Marco de entrega Aybar |
| DT-03 | Lo que no tiene fuente no se escribe como hecho: queda vacío con su pendiente `D-##`. | Marco de entrega Aybar |
| DT-04 | El mockup navegable (artifact de Claude: carta, administrativo, chatbot y Workflow) es la referencia de pantallas mientras no exista Figma. No reemplaza al G2. | `analisis/registro-mockup.md` |
| DT-05 | Ids del paquete: `EP-CAP-###` (épicas), `FT-<AREA>-##` (features), `HU-CAP-###` (historias), `ADR-###`, `DOR-<FT-id>`, `TC-CAP-<HU>-##` (casos). | Convención del marco |
| DT-06 | Los registros no se eliminan: se desactivan (salvo las excepciones escritas en el BRD, como elementos del plano o un círculo de destacadas). | RN-CAP-014 |

## 2. Plazo y equipo

| # | Decisión | Fuente |
| --- | --- | --- |
| DT-07 | Equipo de desarrollo: José Ángel Espinoza (desarrollador). Cliente y owner de negocio: Kevin Rosales. | Ficha de intake |
| DT-08 | No hay fecha de entrega comprometida. Las fechas del roadmap son **supuestos de calendario** hasta que se fije el plazo (D-19). | Sin fuente de plazo |

## 3. Alcance

| # | Decisión | Fuente |
| --- | --- | --- |
| DT-09 | Tres líneas de producto en una sola plataforma web: carta virtual, módulo administrativo (con pantallas de cocina y rol repartidor) y chatbot de WhatsApp. | BRD §4 |
| DT-10 | No hay aplicación móvil propia: el repartidor usa la misma web. | BRD §4 Fuera de alcance |
| DT-11 | La facturación electrónica ante SUNAT y el pago en línea con pasarela quedan fuera: el sistema registra la venta y el medio de pago. El comprobante por defecto es nota de venta. | BRD §4; RN-CAP-037 |
| DT-12 | El modo sin internet es una fase aparte, con su propia cotización. *(Confirmada y concretada por DT-52 el 20/10/2026: se hará, con un mini servidor en la caja; queda pendiente solo su cotización.)* | BRD §4 «Propuesto como fase aparte» |
| DT-13 | Descartado por Kevin: tótems de autoservicio, reservas desde la web, filtros por rango de precio, reseñas públicas en la carta y órdenes de compra por correo. | Acta 02 |
| DT-14 | Un insumo se pide a un solo proveedor por pedido (no se reparte mitad y mitad). | RN-CAP-137 |
| DT-15 | El crédito es solo para el personal: se acumula por mes, sin plazo ni abonos; el descuento del pago se hace fuera del sistema. | RN-CAP-131 |

## 4. Reglas del negocio que ordenan el diseño

| # | Decisión | Fuente |
| --- | --- | --- |
| DT-16 | Dos caminos para un pedido: el del mozo en el local va directo a cocina; todo pedido de fuera del local llega «por confirmar» y una persona lo confirma antes de cocina. | RN-CAP-073, RN-CAP-074 |
| DT-17 | La carta y el chatbot no cobran: informan cómo pagar y una persona confirma el pago. | RN-CAP-076, RN-CAP-101 |
| DT-18 | El chatbot pide por botones; la IA solo responde dudas y recomienda, consultando la disponibilidad real. | RN-CAP-049 |
| DT-19 | La venta descuenta insumos por receta; la producción descuenta materia prima y suma producto terminado; el stock nunca queda en negativo. La producción toma primero de cocina o barra y, si falta, del almacén, con confirmación. | RN-CAP-039, RN-CAP-117; `analisis/registro-mockup.md` v187 |
| DT-20 | Un dato del local se escribe una sola vez, en Configuración del local. | RN-CAP-059 |

## 5. Arquitectura (por decidir en G3)

| # | Decisión | Fuente |
| --- | --- | --- |
| DT-21 | Las decisiones técnicas (plataforma, hosting, impresión, WhatsApp, datos personales, modo sin internet) se tomarán en ADR. Formalizadas el 20/10/2026 en **ADR-001 a ADR-013** (estado *propuesto*, pendientes de aprobación en G3): D-12 → ADR-001, ADR-003 y ADR-011; D-13 → ADR-002; D-08 → ADR-009; D-18 → ADR-005; D-11 → ADR-013. | Marco de entrega Aybar |

**Elecciones técnicas del equipo (20/10/2026).** José Ángel las eligió en un formulario con recomendaciones de la IA. Son la entrada de los ADR del Bloque 4, que las formalizan con opciones y consecuencias. Siguen sin firma de TL (DT-01).

| # | Elección | Alternativas descartadas | Responde a |
| --- | --- | --- | --- |
| DT-22 | **Monolito modular**: un solo backend dividido en un módulo por dominio (pedidos, caja, cocina, stock, ofertas, usuarios, bot). | Monolito con el bot aparte; microservicios | D-12 |
| DT-23 | **Backend en TypeScript con NestJS.** | Java con Spring Boot (Aybar SDK); Python con FastAPI | D-12 |
| DT-24 | **Front en React + Vite**: una sola aplicación para la carta, el administrativo y las pantallas de cocina, instalable como app web (PWA). | Next.js; Angular | D-12 |
| DT-25 | **Base de datos PostgreSQL**, con acceso por **Prisma** (SQL directo para informes y bloqueos). | PostgreSQL + MongoDB (CQRS); MySQL. Drizzle; TypeORM | D-12 |
| DT-26 | **Patrón Party simple** para personas y organizaciones. Incluye: `party`, `person`, `organization`, `party_identifier` (DNI, RUC o CE, opcional), `contact_mechanism` (teléfonos y direcciones con ubicación), `consent` y `party_role` (CLIENTE, TRABAJADOR, PROVEEDOR, con vigencia), más una tabla de detalle por rol. No incluye `party_relationship` por ahora. El rol del sistema (cajero, mozo…) va en `user_account`, aparte del rol de negocio. Los pedidos guardan una copia del nombre, el teléfono y la dirección del momento. Vistas `vw_clientes`, `vw_personal` y `vw_proveedores`. | Party completo con relaciones; tablas separadas por rol | D-18 y referencia `UPN/base-datos-upn/docs/proyecto-final/02-modelo-datos/patron-party.md` |
| DT-27 | **Tiempo real con WebSocket (Socket.IO)**: salas por área, rol y mesa, con reconexión automática. | Server-Sent Events; consultas periódicas | RNF-CAP-002 |
| DT-28 | **Redis + BullMQ**. Redis se usa para la cola de trabajos (impresión, mensajes de WhatsApp, encuesta posventa, vencimientos), los bloqueos de mesa, reparto y chat, el límite de intentos y el reparto de eventos del WebSocket. | Cola en PostgreSQL; RabbitMQ o Kafka | RNF-CAP-010 |
| DT-29 | **Escritorio como PWA + agente local** en la PC de caja. El agente imprime por ESC/POS en las ticketeras y etiqueteras, y es la base del futuro modo sin internet. | Electron; Tauri; solo navegador. QZ Tray; impresión en la nube | D-13, D-11 |
| DT-30 | **VPS de Contabo, Cloud VPS 6 (actualizado el 20/10/2026):** 6 vCPU, 12 GB de RAM, 200 GB de SSD, 2 snapshots, región EE. UU. Central, **sin Auto Backup**, contratado por **1 mes de prueba a US$ 9,20**; según el piloto se decide 12 o 24 meses. *(Antes: 8 vCPU, 8 GB, US$ 7,27 con Auto Backup.)* Puerto de 300 Mbit/s y tráfico ilimitado. El despliegue va con **Dokploy** (Docker), con HTTPS automático. Consumo estimado: 2 a 2,5 GB de RAM. | Coolify; Docker Compose sin panel | D-12 |
| DT-31 | **Copias de seguridad**: cada día, con restic y cifrado, se copian **fuera del VPS** (Backblaze B2 o Cloudflare R2) el volcado de PostgreSQL, la carpeta de fotos y la carpeta privada de comprobantes de pago, con 30 días de historial. Se suman al Auto Backup y al snapshot del proveedor. *(Ajustado el 20/10: antes solo incluía la base.)* | Solo el Auto Backup; volcado dentro del mismo VPS | RNF-CAP-003 |
| DT-32 | **WhatsApp con la API oficial de Meta (Cloud API)**. | Proveedor intermediario; librería no oficial | D-08 |
| DT-33 | **IA del bot con un modelo pequeño de OpenAI**, con tope de gasto mensual y registro de costo. Se usa para las dudas, las recomendaciones y el botón «Pulir mensaje». | Claude Haiku; sin IA en la primera versión | R-07 |
| DT-34 | **Mapas en dos partes.** Donde se elige la dirección (carta, Nuevo pedido, ubicar pedido) se usan la búsqueda de **Google Places** y el mapa de Google, porque los términos de Google no permiten mostrar sus resultados en otro mapa. El mapa de entregas, las zonas y los mapas internos usan **Leaflet + OpenStreetMap**. La zona se calcula en el propio sistema y el enlace del repartidor abre Google Maps o Waze. Para no salir de la cuota gratis de Google: tope diario de consultas, alerta de presupuesto de US$ 1 y clave restringida al dominio y al servidor. *(Ajustado el 20/10: antes la búsqueda era con Nominatim.)* | Nominatim, que encuentra peor las direcciones de Lima; todo con Google; Mapbox | NEC-CAP-049 |
| DT-35 | **Fotos en el disco del VPS** (unas 40 a 50 de productos, novedades y destacadas). Al subirlas se reducen y se pasan a WebP con sharp, y Cloudflare las sirve en caché. Los **comprobantes de pago** van en una carpeta **privada**, que no se publica y solo ve el personal autorizado. Las dos carpetas entran en la copia diaria (DT-31). | Cloudinary (una cuenta más; no apto para comprobantes); Cloudflare R2; Backblaze B2 | NEC-CAP-042, RNF-CAP-008 |
| DT-36 | **Monorepo con pnpm workspaces**: `apps/api`, `apps/web`, `apps/agente-local` y `packages/compartido` (tipos y reglas de precio, descuentos y zonas). | Repositorios separados; Nx o Turborepo | — |
| DT-37 | **Backend con módulos por dominio en hexagonal ligero**: cada módulo tiene dominio, aplicación e infraestructura, y las reglas de negocio se prueban sin base de datos. | Hexagonal estricto (Aybar SDK); MVC simple | — |
| DT-38 | **Autenticación propia con JWT en NestJS**. Contraseñas cifradas con argon2, token de acceso corto y token de renovación en cookie segura, límite de intentos en Redis y PIN del administrador. | Keycloak; Clerk o Auth0 | D-17 |
| DT-39 | **Tres ambientes**: local, pruebas (`staging`) y producción. Pruebas corre en el mismo VPS **totalmente aislado**: base y Redis propios, el número de prueba de WhatsApp de Meta (nunca el real), impresión a PDF en vez de las ticketeras del local, IA con un tope de gasto bajo y datos ficticios. Si falta RAM, se apaga fuera de horario. | Solo local y producción; pruebas en otro VPS | — |

**Elecciones de DevOps (20/10/2026).** José Ángel las eligió en un segundo formulario.

| # | Elección | Alternativas descartadas | Responde a |
| --- | --- | --- | --- |
| DT-40 | **Preparación del VPS con un playbook de Ansible** versionado en `infra/ansible`. Roles: base (usuario sin root, SSH solo con llave, zona horaria de Lima), seguridad (UFW, fail2ban, parches automáticos), Docker, Dokploy y copias de seguridad. | Script bash; Terraform + Ansible; configuración a mano | D-12 |
| DT-41 | **CI/CD con GitHub Actions + GHCR + Dokploy.** Cada PR pasa lint, pruebas y build. Al unir a `main` se construyen las imágenes, se suben a GHCR y se despliega en pruebas. Producción se aprueba con un tag. Las migraciones de Prisma corren antes de levantar la API. | Dokploy construyendo en el VPS; despliegue manual | — |
| DT-42 | **Cloudflare (gratis) como DNS y proxy** de `caprichos.pe`. El dominio sigue registrado en punto.pe; solo se cambian sus servidores de nombres. Cloudflare da HTTPS, caché de fotos y carta, protección y oculta la IP del VPS. El firewall solo deja entrar a Cloudflare por 80 y 443. Subdominios: `caprichos.pe` (carta), `admin.`, `api.`, `staging.` y `panel.` (Dokploy, con acceso restringido). | Solo el DNS del registrador; Cloudflare Tunnel | RNF-CAP-003 |
| DT-43 | **Secretos** en las variables de Dokploy (por ambiente) y en GitHub Secrets (para el CI). Nunca en el repositorio: solo un `.env.example`, y un hook que bloquea los commits con claves. | Ansible Vault; Infisical o Doppler | — |
| DT-44 | **Uptime Kuma** en el VPS. Revisa cada minuto la carta, la API, el WebSocket, el webhook de WhatsApp y el agente de impresión, y avisa al celular. | UptimeRobot externo; ambos | RNF-CAP-003 |
| DT-45 | **Vigilancia simple para el piloto**: Uptime Kuma (DT-44), registros y consumo por contenedor en el panel de Dokploy, y **GlitchTip** en el VPS para los errores de la API, el front y el bot. Ningún dato sale del servidor y se filtran el DNI y los teléfonos. *(Ajustado el 20/10.)* | Sentry en la nube; solo registros | RNF-CAP-008 |
| DT-46 | **Grafana + Loki + Prometheus quedan para después del piloto**, cuando haya tráfico real que medir. Desde el inicio la API escribe sus registros en JSON con pino, con el número de pedido, así el cambio no exige tocar código. *(Ajustado el 20/10: antes iban desde el inicio.)* | Tenerlos desde el inicio; Netdata | — |
| DT-47 | **Mantenimiento**: parches de seguridad automáticos, Renovate para dependencias e imágenes, Trivy en el CI y una prueba de restauración de copia cada 3 meses. | Solo parches; todo manual | RNF-CAP-003 |
| DT-49 | **Auditoría de acciones** (ADR-014): se registran los cambios sensibles (precios, ofertas, cupones, parámetros, permisos, usuarios, anulaciones, uso del PIN), los accesos (ingresos e intentos fallidos de contraseña y PIN) y las lecturas de datos sensibles (DNI completo, comprobantes de pago, exportaciones). Se consulta en una pantalla **Historial de acciones** solo para el administrador, con «Ver historial» en cada ficha (FT-USR-04). La tabla solo admite inserciones, con **huella encadenada** verificada a diario. Se guarda **2 años en línea** y luego pasa a un archivo cifrado (plazo por confirmar en la revisión legal). | Cambios sensibles sin accesos; todo cada acción. Solo «Ver historial»; sin pantalla. Solo insertar sin huella. 1 año; para siempre | RNF-CAP-009, ADR-005 |
| DT-50 | **Descartada (20/10/2026):** registrar equipos del local, guardar la IP del local y clasificar cada acción por origen (dentro o fuera del local). Se descartó por simpleza: la IP del local puede cambiar y la llave guardada en cada navegador es frágil. **Queda la auditoría de DT-49**, que guarda y muestra la IP de cada acción tal cual, sin clasificarla. | Registrar equipos + IP del local con aviso; bloqueo desde fuera | DT-49 |
| DT-51 | **El trabajo de plataforma y DevOps es una épica habilitadora** (EP-CAP-021 «Plataforma, despliegue y operación», fase Ahora, primera ola): monorepo y CI/CD, servidor y ambientes, copias y recuperación, vigilancia, y seguridad y mantenimiento (FT-PLA-01 a FT-PLA-05), con historias cuyo usuario es el equipo de desarrollo y operación. Sus tareas salen de HU-CAP-001. Los **documentos de operación** viven en `operacion/`: runbooks (`RB-CAP-###`), plan de release (`REL-CAP-###`, para G8), revisión de seguridad (`SEC-CAP-###`, para G7) e inventario de infraestructura (`INV-CAP-###`). Las skills del paquete los tienen en cuenta (skill `aybar-devops-operacion`). | Tareas de plataforma colgadas de una historia de negocio; documentos de operación sueltos | ADR-011, ADR-012, RNF-CAP-003 |
| DT-52 | **El modo sin internet se hace, con un mini servidor en la PC de caja** (ADR-013, EP-CAP-019). No es una aplicación de escritorio aparte: es el agente local de DT-29. Sin internet, caja, mozo y cocina siguen trabajando por la red del local; los pedidos y cobros se guardan en la caja y **se envían todos cuando vuelve la conexión**. **No se compra router con respaldo 4G.** **Riesgo aceptado:** mientras no hay internet no llegan los pedidos de la carta ni de WhatsApp y no se manda información al delivery; lo que importa es el local (R-06). Hoy hay **una sola tablet** (la del mozo). **Orden de construcción:** la **primera meta** es la carta y el administrativo en línea, **sin el agente local todavía**; después se construye el agente (impresión automática y mini servidor). Hasta entonces, la contingencia es el modo manual (PCN-CAP-001). | Router con respaldo 4G; dejarlo solo con datos del celular y papel; construirlo dentro del piloto | R-06, DT-12, DT-29, D-11 |
| DT-53 | **Módulo «Iniciativas»** (EP-CAP-022, FT-INI-01): cualquier persona del equipo sube una **queja, mejora o idea** con área, título, comentario y una captura opcional. **Todo el personal ve todas y ve quién la subió**; todos pueden comentar; **solo el administrador cambia el estado** (nueva, en revisión, hecha, no por ahora). No se borra ni se edita. Cada acción (subir, comentar, cambiar el estado) queda en el **Historial de acciones** con su IP (DT-49). Sin anónimas, votos ni avisos por WhatsApp. Prioridad propuesta *Debería tener*, H2 (por confirmar con Kevin). Ya está en el mockup. | Solo el administrador las ve; anónimas; votos y puntos | DT-49, ADR-014, ADR-012 |
| DT-54 | **Contraseñas y cuentas desactivadas** (FT-USR-01, FT-USR-03): solo el administrador restablece la contraseña de un usuario (vuelve a la inicial y debe crear una nueva); quien quiere cambiar la suya confirma primero que es él escribiendo su contraseña actual; un usuario desactivado no puede entrar al administrativo (sesiones abiertas incluidas) y deja de recibir el descuento del personal en cualquier canal, también la carta virtual. Todo queda en el Historial de acciones. Ya está en el mockup. | Que cada quien se restablezca solo; ver el aviso sin cerrar la sesión | DT-49, RN-CAP-098, RN-CAP-106, RN-CAP-120 |

**RAM estimada con todo lo elegido**, de los 8 GB del VPS:

| Pieza | RAM aprox. |
| --- | --- |
| Producción: Postgres, API, Redis y front | 2–2,5 GB |
| Ambiente de pruebas | ~1 GB |
| Dokploy | ~0,4 GB |
| Grafana, Loki y Prometheus | 0 (después del piloto: ~1 GB) |
| GlitchTip | ~0,5 GB |
| Uptime Kuma | ~0,1 GB |
| **Total** | **~4–4,5 GB** (con Grafana después: ~5–5,5 GB) |

Queda margen. Si se ajusta, lo primero es apagar el ambiente de pruebas fuera de horario.

**Riesgo anotado:** si la búsqueda de Google Places supera la cuota gratis, el tope diario la corta y la persona puede marcar el punto tocando el mapa (NEC-CAP-059). No hay cobro sorpresa.

## 6. Prioridades

| Prioridad | Épica | Por qué |
| --- | --- | --- |
| Debe tener | EP-CAP-001 Carta virtual y catálogo | Es el canal propio que reemplaza la carta vencida (NEC-CAP-006). |
| Debe tener | EP-CAP-002 Pedido del cliente en la carta | Sin esto el pedido no llega a caja (NEC-CAP-001, NEC-CAP-017). |
| Debe tener | EP-CAP-004 Confirmación y cobro en caja | Todo pedido de fuera pasa por una persona (RN-CAP-074). |
| Debe tener | EP-CAP-005 Apertura y cierre de caja | Cuadre diario del dinero (NEC-CAP-062). |
| Debe tener | EP-CAP-006 Cocina por áreas e impresión | El pedido tiene que llegar a quien prepara (NEC-CAP-020, NEC-CAP-013). |
| Debe tener | EP-CAP-007 Salón: plano, mesas, pedido del mozo y reservas | El salón es el canal principal del local (NEC-CAP-014, NEC-CAP-023). |
| Debe tener | EP-CAP-008 Delivery y entregas | Reparto con ubicación y tarifa por zona (NEC-CAP-009, NEC-CAP-076). |
| Debe tener | EP-CAP-013 Personal, usuarios y roles | Cada rol ve solo lo suyo (NEC-CAP-010). |
| Debe tener | EP-CAP-017 Configuración del local | Única fuente de los datos del negocio (NEC-CAP-038). |
| Debe tener | EP-CAP-020 Comprobantes y obligaciones legales | Nota de venta, datos de boleta/factura, privacidad y reclamaciones (NEC-CAP-031, NEC-CAP-089). |
| Debería tener | EP-CAP-009 Stock y recetas | No vender lo que no hay y conocer el margen (OBJ-CAP-002, OBJ-CAP-003). |
| Debería tener | EP-CAP-010 Almacén y producción | Stock real de insumos y productos del día (NEC-CAP-026, NEC-CAP-081). |
| Debería tener | EP-CAP-011 Compras y proveedores | Reponer a tiempo y con costo (NEC-CAP-027, NEC-CAP-069). |
| Debería tener | EP-CAP-012 Promociones, descuentos y cupones | Ventas con reglas claras (NEC-CAP-056, NEC-CAP-111). |
| Debería tener | EP-CAP-014 Chatbot: pedido y pago por WhatsApp | Clientes que no manejan la web (NEC-CAP-004). |
| Debería tener | EP-CAP-015 Atención por WhatsApp y posventa | El bot y la persona no se cruzan (NEC-CAP-091, NEC-CAP-029). |
| Debería tener | EP-CAP-016 Administración de la carta y contenidos | El dueño cambia la carta sin programador (NEC-CAP-011, NEC-CAP-044). |
| Debería tener | EP-CAP-003 Cuenta del cliente y puntos | Fidelización sin obligar a crear cuenta (NEC-CAP-024, NEC-CAP-036). |
| Podría tener | EP-CAP-018 Informes, indicadores y notificaciones | Decisiones con datos (NEC-CAP-041). |
| Debe tener (segunda meta) | EP-CAP-019 Modo sin internet | Mini servidor en la caja; se construye después de la primera meta (DT-52). Su cotización queda aparte (DT-12). |

## 7. Valores

### Valores tomados de las fuentes

| # | Valor | Fuente |
| --- | --- | --- |
| V1 | Tiempo de entrega que se le dice al cliente sin congestión: **de 25 a 35 minutos** (DT-58; la alta demanda suma minutos). Reemplaza los 13 minutos del prototipo. | Acta 03 (20/10/2026) |
| V2 | Envío gratis desde S/ 70 («más de 70» por defecto, D-02). | RN-CAP-095 |
| V3 | Pedido mínimo de delivery S/ 14.50 (por confirmar, D-03). | RN-CAP-008 |
| V4 | Horario de 14:00 a 22:00 (por confirmar, D-04). | RN-CAP-010 |
| V5 | Descuento del personal: 25 % sobre el pedido, sin combos ni promociones. | RN-CAP-036 |
| V6 | Tolerancia de reservas: 15 minutos. | RN-CAP-032 |
| V7 | Vida útil de las donas: aviso a las 10 horas, alerta a las 12. | RN-CAP-092 |
| V8 | Puntos: **se gana el 5 % del total** de la compra con cuenta (configurable); los puntos son saldo para canjear (DT-55). Se eliminó la regla «1 punto por cada S/ 1» (21/10/2026). | Acta 03 (20/10/2026) |
| V9 | Zonas de reparto Z2, Z3, Z4, Z5 y Z7, con tarifas de 2 a 7 soles. | NEC-CAP-076 |

### Valores propuestos (sin fuente del cliente)

| # | Valor | Justificación |
| --- | --- | --- |
| V10 | Alta demanda: de 5 a 180 minutos extra, con atajos de 5 a 60. | Prototipo; RN-CAP-113 |
| V11 | Cupones: bloqueo de 5 intentos fallidos durante 5 minutos en la carta. | Seguridad de cupones, `analisis/cupones.md` |

## 8. Pendientes

| # | Qué falta | Recomendación |
| --- | --- | --- |
| D-01 | Tiempo de entrega prometido (13 minutos de la propuesta o 30 a 45 del bot actual). | **Resuelta en el acta 03:** de 25 a 35 minutos (V1, DT-58), configurable. |
| D-02 | Envío gratis: «más de S/ 70» o «desde S/ 70». | «Más de S/ 70», como el bot actual, para no cambiar lo que el cliente ya conoce. |
| D-03 | Pedido mínimo y tarifas de delivery vigentes. | Confirmar con Kevin la tabla de zonas y tarifas antes del piloto. |
| D-04 | Horario de atención y fechas especiales. | Cargar el horario real por día en Configuración del local. |
| D-05 | Plazo para atender un pedido «por confirmar» antes de avisar o anular. | Avisar a caja a los 5 minutos; nunca anular solo. |
| D-06 | Texto y plazo del Libro de Reclamaciones. | Revisión legal antes de publicar la carta. |
| D-07 | Boleta y factura electrónica. | Mantener el facturador actual y registrar solo los datos; integrar después. |
| D-08 | Costo de las plantillas de WhatsApp y acceso a la cuenta de Meta. | Que Kevin dé acceso a la cuenta y asuma el costo de las plantillas; medir cuántas se envían al mes. |
| D-09 | Si un trabajador, desde la carta con su usuario, puede cargar el pedido a su consumo del mes. | No en la primera versión: el crédito del personal se usa solo en el pedido del personal en el local. |
| D-10 | Si una promoción se acumula con descuentos y cupones. | «No acumula» por defecto: se aplica solo el beneficio mayor. |
| D-11 | Modo sin internet. | **Resuelta por DT-52: se hará con un mini servidor en la caja, después de la primera meta.** Queda pendiente solo su cotización con Kevin. |
| D-12 | Plataforma, lenguaje y hosting. | Decidir en ADR-001 con costo mensual estimado. |
| D-13 | Cómo se conecta la ticketera (red, USB o Bluetooth) y modelo. | Relevar las ticketeras del local y decidir en ADR-002. |
| D-14 | Ticket del tablero (R13) y nombres de PO, TL, QA y UX (R16). | **Nombres resueltos por DT-48.** Queda solo el ticket: mientras no exista, se usa `CAP-PENDIENTE`. |
| D-15 | Recetas, insumos con costos, proveedores, fotos y datos del negocio. | Pedirlos en tandas con `analisis/informacion-a-pedir-al-cliente.md`. |
| D-16 | Plano real del local (mesas, entrada) para dejarlo por defecto. | Que Kevin copie el diseño desde Plano del local ▸ «Copiar» (ver `analisis/plano-del-local.md`). |
| D-17 | Política de contraseñas del sistema real (caducidad de la inicial, intentos, recuperación). | Clave inicial que vence en 24 horas, bloqueo tras 5 intentos y recuperación por el administrador. |
| D-18 | Datos personales: consentimiento, retención y atención de derechos (Ley 29733). | Guardar DNI solo con aceptación, enmascararlo en listas y definir un plazo de conservación en ADR-005. |
| D-19 | Plazo del proyecto y fecha del piloto. | Fijar una fecha de piloto para la fase «Ahora» y recalcular el roadmap. |
| D-20 | Qué se mantiene de restaurant.pe y del bot actual durante la transición. | Convivir un mes: el sistema nuevo para pedidos y cocina; el actual solo para facturar. |
| D-21 | Cuánto trabajo se puede perder si el servidor se pierde: hasta 24 horas (copia diaria) o minutos (copia continua de la base). | Empezar con 24 horas y el modo manual (PCN-CAP-001); evaluar la copia continua si Kevin no tolera perder un día de pedidos. |
| D-22 | Segundo responsable técnico y acceso de emergencia (gestor de contraseñas y clave de restic). | Una persona de confianza con acceso de emergencia y Kevin con la clave de restic impresa y guardada. |
| D-23 | Equipos de respaldo del local: UPS y un segundo proveedor de VPS identificado. *(El router con respaldo 4G se descartó en DT-52.)* | UPS antes del piloto; el segundo proveedor identificado, sin contratarlo. |
| D-24 | Cómo se identifica un trabajador en la carta virtual para recibir su descuento del personal (propuesta: iniciando sesión con su usuario del administrativo, solo si está activo). | Se decide con Kevin antes de construir FT-USR-03. |
| D-25 | Sobre qué se calcula el 5 % de puntos: ¿incluye el costo de envío? ¿Se ganan puntos por la parte pagada con puntos? | **Resuelta por DT-73 (21/10/2026).** |
| D-26 | El pedido que pasa directo a comandas (DT-57): ¿vale también para el pedido por el chatbot? ¿Qué se hace si el cliente nunca manda la captura de pago? | **Resuelta por DT-71 (21/10/2026):** todo directo, sin freno. |
| D-27 | Textos de los tres mensajes de reparto y momento exacto del segundo y del tercero (en la reunión se mezcló «estamos cerca» con «he llegado»). | **Momento resuelto por DT-74 (21/10/2026).** Quedan los textos: Kevin envía su plantilla. |
| D-28 | Si se puede agregar al cliente a los contactos del WhatsApp del local de forma automática. | José lo investiga; mientras tanto, exportar a Excel e importar a Google Contactos a mano (DT-67). |
| D-29 | Umbrales de color del mapa de reparto. | Verde hasta 35 minutos, naranja de 35 a 50, rojo desde 50 (DT-59), configurables. Confirmar con Kevin. |
| D-30 | A quién le llega el aviso del almacén si en ese momento nadie del almacén está de turno. | Al administrador. Confirmar con Kevin. |
| D-31 | Plan B de los avisos de reparto mientras no esté la API de WhatsApp de Meta. | **Ya no hace falta: José ya tiene la API de Meta (DT-72, 21/10/2026).** Propuesta anterior: Que «En camino» y «He llegado» abran WhatsApp con el mensaje ya escrito y el repartidor solo toque «Enviar»: sin costo y sin depender de Meta (`analisis/analisis-delivery.md` P3). |
| D-32 | Cuántos pedidos puede llevar a la vez un repartidor. | **Resuelta por DT-68 (21/10/2026):** hasta 3, configurable. |
| D-33 | Meta de tiempo de cocina para delivery, coherente con la entrega de 25 a 35 minutos. | **Resuelta por DT-69 (21/10/2026):** no hay meta aparte; se usan los tiempos de Kevin. |
| D-34 | Evidencia de una entrega fallida (Kevin: «va a tomar foto y va a tener registro de las llamadas»). | **Resuelta por DT-70 (21/10/2026).** |
| D-35 | Ubicación del repartidor en tiempo real. | Mantenerla fuera de la primera versión. El costo real es casi cero (GPS del celular y OpenStreetMap); los motivos son la privacidad del repartidor, la batería y la complejidad. Volver a evaluar después del piloto. |

## 9. Aclaraciones de alcance

| # | Aclaración | Por qué |
| --- | --- | --- |
| A1 | La carta no pide fecha: todos los pedidos son para el mismo día. | RN-CAP-028 |
| A2 | El pedido en mesa lo hace solo el mozo desde el administrativo; la carta ofrece delivery y para recoger. | Decisión del 17/10 (BRD §4) |
| A3 | El repartidor no toma pedidos; los toman cajero, mozo y call center. | RN-CAP-033 |
| A4 | Las reservas llegan por WhatsApp como solicitud; no hay reserva desde la web. | RN-CAP-047; DT-13 |
| A5 | La TV de cocina es solo para ver; se opera desde la mini computadora de cocina. | RN-CAP-022, RN-CAP-023 |

## 10. Observaciones al libro de requisitos

| # | Observación | Origen |
| --- | --- | --- |
| O1 | El BRD repite ids de reglas: RN-CAP-081 a RN-CAP-086 aparecen dos veces con textos distintos. Hay que renumerar las segundas. | Revisión del BRD v1.51 |
| O2 | NEC-CAP-019 y NEC-CAP-049 se solapan (ubicación actual en delivery). | Revisión del BRD v1.51 |
| O3 | RN-CAP-084 de abonos del crédito quedó obsoleta: el crédito ya no tiene abonos (DT-15). | Revisión del BRD v1.51 |
| O4 | Los informes de trabajo de `analisis/` (cajero, cocina, delivery, revisión cruzada…) no tienen frontmatter; son material de apoyo, no documentos del paquete. | Validador `estado.py` |

## 11. Acuerdos de la revisión del mockup (acta 03, 20/10/2026)

Salen de `actas/acta-03-revision-mockup.md`. Donde contradicen un documento anterior, **mandan estas decisiones** y el documento se corrige en las olas D2 a D6.

| # | Decisión | Alternativas descartadas | Responde a |
| --- | --- | --- | --- |
| DT-55 | **Puntos como saldo** (FT-CLI-02, FT-CFG-02): saldo para canjear en cualquier producto (se eliminó la regla «1 punto por sol»); no se retira. Con cuenta se gana **el 5 % del total** (por defecto; el administrador lo cambia en Configuración del local), con dos decimales (S/ 70 → 3,50 puntos). El porcentaje es **general**, no por producto. No suman los productos o promociones marcados «No suma puntos ni aplica cupones» (DT-65). Al terminar el pedido se muestra el resumen: puntos de esta compra y total. **Canje en el pedido:** «¿Cuántos puntos deseas usar?», con los disponibles debajo, lo que queda al escribir y un botón «Aplicar». Para ver o canjear hay que haber entrado a la cuenta (RN-CAP-071). | Puntos por producto como restaurant.pe (difícil de entender para el cliente); 1 punto por cada S/ 1 (V8 anterior, demasiado generoso) | Acta 03 §2; NEC-CAP-036 |
| DT-56 | **Dos tipos de cupón** (FT-OFE-03): **(1) impreso en el ticket**: de 1 a 3 por ticket (configurable), para la siguiente compra, código único generado por el sistema, vigencia desde que se emite (15 días por defecto), un solo uso, lo usa quien traiga el código, en el local o en la carta; **(2) de campaña**: un mismo código para volantes o transmisiones, creado por el administrador, con tope de usos. Ninguno suma puntos, se junta con otras promociones ni se usa más de uno por compra. | Cupón ligado a la persona que compró (Kevin aceptó que lo use quien lo traiga) | Acta 03 §3 |
| DT-57 | **Pedido en la carta** (FT-PED-01, FT-PED-02, FT-PED-03, FT-CAR-01): (a) «Usar mi ubicación actual» muestra el **mapa con el punto**, que el cliente puede mover, y un botón **«Confirmar ubicación»**; la ubicación **no es obligatoria** (sin ella, el asesor la pide por WhatsApp); (b) **los límites de las zonas no se muestran** al cliente; (c) **el método de pago se elige en la carta** (obligatorio) y **la captura no se pide** (la pide el asesor por WhatsApp); (d) al enviar, **llega un mensaje automático al WhatsApp** del cliente con el resumen y el método, y **el pedido pasa directo a las comandas**, sin esperar la confirmación de caja. Esto reemplaza RN-CAP-074 («por confirmar») para la carta; (e) entrar a la cuenta es opcional y al final se recuerda acumular puntos (DT-55); (f) en las bebidas se pide **«Ingresa el nombre de la persona que tomará esta bebida»**, una por unidad, con imagen de referencia. | Pedir la captura en la carta (frena el pedido); elegir el pago por WhatsApp (recarga al personal); ubicación obligatoria; mostrar las zonas (15–20 % movía el punto a la más barata) | Acta 03 §1; riesgo nuevo: pedidos sin pago que ya se cocinaron (D-26) |
| DT-58 | **Cocina y despacho** (FT-COC-01, FT-COC-02, FT-COC-03): la pantalla por área tiene **un solo botón, «Despejar»** (se quita «empezar a preparar»: al llegar ya se prepara), y los pedidos **ocupan todo el ancho**. Botón **«Historial»** con lo despejado del día para **devolver** un pedido despejado por error. Cuando todas las áreas despejan su parte, el pedido queda **listo**. **Despacho** tiene una vista (pantalla o impresión) que **junta todo el pedido** de todas las áreas, con nombre y código. **Etiqueta de bebida:** el nombre de la persona en grande, luego la bebida y su contenido. **Alta demanda:** suma minutos al rango de 25 a 35 (V1) y se ve en tiempo real en todas las áreas, la carta y el bot. | Tres columnas (nuevo, en preparación, listo): más clics para el barista | Acta 03 §5, §10, §16 |
| DT-59 | **Mapa del repartidor** (FT-DEL-02): pantalla principal = **mapa a pantalla completa** con zoom automático que abarca los pedidos listos; también hay vista de lista. Cada punto lleva el **nombre completo del cliente** y debajo, chico, el **código**. **Color por tiempo** desde que el cliente terminó el pedido: verde hasta 35 minutos, naranja de 35 a 50 y **rojo palpitando** desde 50 (configurables, D-29). Agrupado por las **zonas de reparto ya definidas** (FT-DEL-01). **Orden sugerido** por cercanía y tiempo, calculado sin API de pago, solo como sugerencia. Al tocar un punto: resumen abajo con **Llamar**, **WhatsApp** y Google Maps o Waze, y el botón grande del estado: **Tomar pedido → En camino → He llegado → Entregado**. Cada repartidor tiene su usuario; dos no pueden tomar el mismo pedido. | Números correlativos 1, 2, 3 (Kevin prefirió nombres); zonas dinámicas según cantidad de pedidos (más complejo); **ubicación del repartidor en tiempo real (descartada por costo de API)** | Acta 03 §6 |
| DT-60 | **Mensajes de reparto al cliente** (FT-DEL-02, FT-BOT-02): mensaje 1 automático al pulsar «En camino»; si el cliente no responde, mensaje 2 («¿nos confirmas si estás en tu ubicación?») y mensaje 3 (espera máxima de 10 minutos; si no está, el pedido vuelve al local). Si el cliente responde, no se envían los siguientes. Los mensajes llevan botones de respuesta. **Los textos los edita el administrador** (Configuración ▸ Mensajes). Momento exacto: D-27. | Dar al cliente el tiempo de espera desde el inicio (el repartidor tiende a llegar al tope) | Acta 03 §6; costo de plantillas de Meta (D-08) |
| DT-61 | **Cierre de caja ciego y anulación con PIN** (FT-CIE-02, FT-CAJ-02, FT-USR-04): el cajero ingresa lo que cuenta en efectivo, Yape, Plin, tarjeta y transferencia **sin ver los totales esperados** y solo ve **«Cuadra»** o **«No cuadra»**. Si no cuadra, el **detalle por método** solo lo ve la supervisora (rol administrador) con su PIN. **Anular:** lo puede hacer el cajero, con **motivo obligatorio** y el **PIN de 6 dígitos de la supervisora**, ingresado en persona en la caja (no por notificación). Todo va al Historial de acciones. El PIN pasa de 4 a 6 dígitos. | Mostrar los totales al cajero (permite «cuadrar» anulando ventas); aprobación remota por notificación | Acta 03 §8; DT-49 |
| DT-62 | **Pedido desde caja y mozo** (FT-CAJ-03, FT-SAL-02, FT-OFE-02): al elegir una **cantidad mayor a 1** de un producto con opciones, se elige la opción de **cada unidad** (mismo tamaño; dos con leche entera y una con leche de almendra). El sistema **sugiere** la promoción para la que califica el pedido y el mozo la aplica si el cliente acepta. | Una línea por cada combinación hecha a mano | Acta 03 §7 |
| DT-63 | **Crédito del personal por semana** (FT-USR-03): el resumen se ve **por semana** (el pago es semanal) y por **rango de fechas**; el mes queda como un rango más. | Solo por mes | Acta 03 §13 |
| DT-64 | **Almacén con turnos** (FT-ALM-03, FT-USR-01, FT-COM-03): cada usuario tiene su **horario de trabajo** (qué días y de qué hora a qué hora, porque no todos trabajan 8 horas), que carga el administrador. El **pedido al almacén** suena en la pantalla del almacén **hasta que alguien marque «Recibido»** y llega por **WhatsApp a quien está de turno** según ese horario (incluye a quien cubre el descanso). Quien saca insumos sin almacenero registra **la salida con su propio usuario**. **Compras sin lote ni fecha de vencimiento.** | Elegir a mano a quién avisar en cada pedido; un usuario compartido de almacén (no se sabe quién sacó qué); lote y vencimiento (almacén chico, sin código de barras) | Acta 03 §11; respuesta de José del 21/10/2026 |
| DT-65 | **Producto que no suma** (FT-CON-01, FT-OFE-01): el producto y la promoción tienen la marca **«No suma puntos ni aplica cupones»**, para campañas muy ajustadas (un 2×1 de frappé). | Excepciones a mano en caja | Acta 03 §2, §14 |
| DT-66 | **Descartada (21/10/2026): mostrar reseñas de Google Maps** con nombre y foto en la carta. **Por qué:** (1) el nombre y la foto de quien escribió la reseña son **datos personales** según la **Ley N.° 29733, Ley de Protección de Datos Personales** (Perú), y su reglamento (D. S. 016-2024-JUS); usarlos en la publicidad propia de Caprichos es un uso distinto al que esa persona aceptó al publicar en Google, y para ese uso hace falta su **consentimiento**; (2) **copiar las reseñas de forma automática** (*scraping*) va contra los términos de servicio de Google Maps; la vía oficial (API de Google Places) devuelve pocas reseñas, exige mostrar el autor y tiene costo. Como no se puede automatizar de forma segura, **no se arriesga hasta que un abogado lo revise**. Mientras tanto, la carta puede llevar solo un **enlace a la ficha de Google Maps** («Ver nuestras reseñas en Google»), que no copia ningún dato. *[El alcance legal exacto está por confirmar con un abogado; no es asesoría legal.]* | Solo texto y primer nombre, sin foto (sigue siendo un dato tomado sin consentimiento y a mano) | Acta 03 §19; decisión de José del 21/10/2026; D-18 |
| DT-67 | **Datos de clientes** (FT-USR-01, FT-CLI-01, FT-INF-01): el **DNI y el RUC** completos solo los ve el administrador (en el resto, enmascarados) y verlos queda en el Historial de acciones. El administrador puede **exportar a Excel** (clientes con teléfono, ventas) para indicadores propios o para importar contactos a Google Contactos a mano; la exportación también queda registrada. **Listas de difusión masivas: descartadas** (costo de Meta y riesgo de bloqueo del número). | Envíos masivos por WhatsApp de noche o espaciados | Acta 03 §20; D-18 |
| DT-68 | **Hasta 3 pedidos por repartidor** a la vez, configurable (FT-DEL-02, RQ-DEL-02-20). | 2 pedidos; sin límite (el primero llega frío en hora punta) | D-32; respuesta de José del 21/10/2026 |
| DT-69 | **Tiempos de cocina = tiempos de Kevin.** En el audio Kevin no dio un tiempo propio para cocina: dio tres tiempos contados **desde que el cliente terminó su pedido**: 25 minutos lo ideal, 35 retraso y 50 crítico (acta 03 §6, minuto 41–43). La pantalla de cocina y el mapa de reparto usan los mismos: naranja desde 35 y rojo desde 50, configurables (FT-COC-01, FT-DEL-02). Se quita el ámbar a los 19 y el rojo a los 25, que eran una propuesta sin fuente. | Meta aparte de 15 o 20 minutos para cocina (no la dio el cliente) | D-33; acta 03; pedido de José del 21/10/2026 de revisar el audio |
| DT-70 | **Evidencia de la entrega fallida** (FT-DEL-03, RQ-DEL-03-10): cada llamada y mensaje de WhatsApp al cliente queda con su hora, y el repartidor puede agregar una foto de la puerta, guardada en la carpeta privada (ADR-005). **No se borra a los 30 días:** se conserva como el Historial de acciones (2 años en línea y luego archivo cifrado, DT-49). *La Ley 29733 pide que el plazo de conservación esté definido; se fija en la política de privacidad (D-18).* | Borrar la foto a los 30 días; foto obligatoria | D-34; respuesta de José del 21/10/2026 |
| DT-71 | **Todo pedido de la carta y del chatbot va directo a cocina, sin freno** para clientes nuevos ni por monto. Si el cliente no paga, caja anula con motivo y el PIN de la supervisora (DT-61). Riesgo aceptado: se cocinan algunos pedidos que no se pagan; se mide cuántos se anulan por falta de pago. | Freno al primer pedido de un teléfono nuevo de más de S/ 80; volver a «por confirmar» para todos | D-26; respuesta de José del 21/10/2026 |
| DT-72 | **Los avisos al cliente salen automáticos por la API de WhatsApp de Meta**, que José ya tiene vinculada al número de Caprichos (acta 03 §4). No hace falta el plan B manual (D-31). El token y los datos de la cuenta van por variables de entorno, nunca en Git. Sigue pendiente medir el costo de las plantillas (D-08). | Botón que abre WhatsApp con el texto listo (plan B, ya no necesario) | D-31; respuesta de José del 21/10/2026 |
| DT-73 | **Los puntos se calculan sobre los productos**: no cuentan el costo de envío ni lo que se pagó con puntos (FT-CLI-02). Así está en el mockup. | Sobre el total con envío; incluir lo pagado con puntos | D-25; respuesta de José del 21/10/2026 |
| DT-74 | **Momento de los avisos de reparto**, revisado en el audio (acta 03, minutos 51 a 62): mensaje 1 al pulsar **«En camino»** («atento a tu celular para recibir la llamada»); mensaje 2 al pulsar **«He llegado»** («¿nos confirmas si estás en tu ubicación?»); mensaje 3 si el cliente no responde en **minuto y medio** («recuerda que el tiempo máximo de espera es de 10 minutos; si no estás, el repartidor regresa al local»). Si el cliente responde (botones Sí/No o texto), no se envían los siguientes. Kevin descartó un tercer botón «Estamos cerca» porque son demasiados toques en la moto. El minuto y medio es configurable. Reemplaza los 2 minutos de DT-60. | Tres botones (en camino, estamos cerca, he llegado); los tres mensajes desde «En camino» | D-27; pedido de José del 21/10/2026 de revisar el audio |
| DT-75 | **Solo el administrador exporta a Excel y ve el DNI o RUC completo de los clientes.** Vale para todas las exportaciones: informes, clientes, créditos del personal, cierres e Historial de acciones. Los demás roles no ven el botón, y el servidor rechaza la descarga (RNF-CAP-006). En las listas, el DNI y el RUC salen enmascarados para todos; el administrador los ve completos en la ficha o con «Ver completo», y cada vez queda en el Historial de acciones (DT-67). | Exportar también desde caja o almacén | Pedido de José del 21/10/2026 |
| DT-76 | **Contraseña inicial aleatoria** (ADR-008, FT-USR-01): cada usuario nuevo o restablecido recibe una contraseña aleatoria de 12 caracteres que el administrador ve **una sola vez**; el usuario debe cambiarla al primer ingreso. No hay una contraseña común como la `123456` del mockup. | Decisión del equipo técnico (21/10/2026), sin bloquear la ola 1 | Contraseña común para todos | Usuarios; seed del administrador |
| DT-77 | **Comprobante en la carta** (FT-LEG-01, HU-CAP-170): el cliente elige solo **Boleta** o **Factura**; se quita «Sin comprobante». Por defecto va Boleta (DNI); Factura pide RUC y razón social. La nota de venta sigue siendo el comprobante interno que imprime el local. | Dejar «Sin comprobante» en la carta (pedido del 21/10/2026) | Carta; mockup |
| DT-78 | **Tres formas de dar la ubicación en el pedido** (FT-PED-02, HU-CAP-016): «Mi ubicación» (GPS), «Escribir dirección» (sin mapa; no se impide pedir) y «Marcar en el mapa» (mueve el punto). Una sola fila compacta en «Mi pedido». Sin punto, el chatbot coordina ubicación y pago. | Pedido del 21/10/2026 | Solo GPS con la dirección como plan B | Carta; chatbot |
| DT-79 | **El chatbot lee la ubicación de WhatsApp** (FT-BOT-01, HU-CAP-127): un mensaje de tipo ubicación (clip 📎) trae latitud y longitud y se guarda en el pedido con su zona y envío; un enlace de Google Maps con coordenadas también (los cortos se abren desde el servidor). Un enlace sin coordenadas no usa la API de Google (cuesta): el bot pide la ubicación con el clip y, si no llega, la ubica el asesor. Cada punto guarda su origen (`entrega_origen`). | Pedido del 21/10/2026 | Geocodificar con la API de Google; leer solo texto | Chatbot; API |

