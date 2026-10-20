# Registro de decisiones del paquete de análisis y diseño

**Frente:** Plataforma digital de Caprichos (carta virtual, módulo administrativo, pantallas de cocina y chatbot de WhatsApp)
**Servicio:** caprichos
**Fecha:** 19/10/2026
**Decide:** José Ángel Espinoza (PO y TL, DT-48) · Stakeholder: Kevin Rosales

Este registro es la **fuente de verdad** del paquete. Si un documento (BRD, roadmap, épica, feature, historia, ADR o DoR) lo contradice, **manda este registro** y el documento se corrige.

Generado por IA: a partir de `analisis/BRD.md` (v1.51), `analisis/ficha-intake.md`, las actas 01 y 02, `analisis/registro-mockup.md` y `analisis/informacion-a-pedir-al-cliente.md` — Revisado por: *(pendiente)*

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
| DT-12 | El modo sin internet es una fase aparte, con su propia cotización. | BRD §4 «Propuesto como fase aparte» |
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
| DT-30 | **VPS de US$ 7,27 al mes**: 8 vCPU, 8 GB de RAM, 100 GB de SSD, Auto Backup, 1 snapshot, puerto de 200 Mbit/s y tráfico ilimitado. El despliegue va con **Dokploy** (Docker), con HTTPS automático. Consumo estimado: 2 a 2,5 GB de RAM. | Coolify; Docker Compose sin panel | D-12 |
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
| No esta vez (fase aparte) | EP-CAP-019 Modo sin internet | Requiere base local y sincronización; se cotiza aparte (DT-12). |

## 7. Valores

### Valores tomados de las fuentes

| # | Valor | Fuente |
| --- | --- | --- |
| V1 | Tiempo de entrega prometido en el prototipo: 13 minutos (por confirmar, D-01). | OBJ-CAP-001 |
| V2 | Envío gratis desde S/ 70 («más de 70» por defecto, D-02). | RN-CAP-095 |
| V3 | Pedido mínimo de delivery S/ 14.50 (por confirmar, D-03). | RN-CAP-008 |
| V4 | Horario de 14:00 a 22:00 (por confirmar, D-04). | RN-CAP-010 |
| V5 | Descuento del personal: 25 % sobre el pedido, sin combos ni promociones. | RN-CAP-036 |
| V6 | Tolerancia de reservas: 15 minutos. | RN-CAP-032 |
| V7 | Vida útil de las donas: aviso a las 10 horas, alerta a las 12. | RN-CAP-092 |
| V8 | Puntos: 1 por cada S/ 1 con cuenta. | NEC-CAP-036 |
| V9 | Zonas de reparto Z2, Z3, Z4, Z5 y Z7, con tarifas de 2 a 7 soles. | NEC-CAP-076 |

### Valores propuestos (sin fuente del cliente)

| # | Valor | Justificación |
| --- | --- | --- |
| V10 | Alta demanda: de 5 a 180 minutos extra, con atajos de 5 a 60. | Prototipo; RN-CAP-113 |
| V11 | Cupones: bloqueo de 5 intentos fallidos durante 5 minutos en la carta. | Seguridad de cupones, `analisis/cupones.md` |

## 8. Pendientes

| # | Qué falta | Recomendación |
| --- | --- | --- |
| D-01 | Tiempo de entrega prometido (13 minutos de la propuesta o 30 a 45 del bot actual). | Dejarlo configurable, empezar con un valor que el local cumpla hoy y bajarlo con la medición diaria de OBJ-CAP-001. |
| D-02 | Envío gratis: «más de S/ 70» o «desde S/ 70». | «Más de S/ 70», como el bot actual, para no cambiar lo que el cliente ya conoce. |
| D-03 | Pedido mínimo y tarifas de delivery vigentes. | Confirmar con Kevin la tabla de zonas y tarifas antes del piloto. |
| D-04 | Horario de atención y fechas especiales. | Cargar el horario real por día en Configuración del local. |
| D-05 | Plazo para atender un pedido «por confirmar» antes de avisar o anular. | Avisar a caja a los 5 minutos; nunca anular solo. |
| D-06 | Texto y plazo del Libro de Reclamaciones. | Revisión legal antes de publicar la carta. |
| D-07 | Boleta y factura electrónica. | Mantener el facturador actual y registrar solo los datos; integrar después. |
| D-08 | Costo de las plantillas de WhatsApp y acceso a la cuenta de Meta. | Que Kevin dé acceso a la cuenta y asuma el costo de las plantillas; medir cuántas se envían al mes. |
| D-09 | Si un trabajador, desde la carta con su usuario, puede cargar el pedido a su consumo del mes. | No en la primera versión: el crédito del personal se usa solo en el pedido del personal en el local. |
| D-10 | Si una promoción se acumula con descuentos y cupones. | «No acumula» por defecto: se aplica solo el beneficio mayor. |
| D-11 | Modo sin internet. | Cotizarlo aparte cuando el sistema en línea esté estable. |
| D-12 | Plataforma, lenguaje y hosting. | Decidir en ADR-001 con costo mensual estimado. |
| D-13 | Cómo se conecta la ticketera (red, USB o Bluetooth) y modelo. | Relevar las ticketeras del local y decidir en ADR-002. |
| D-14 | Ticket del tablero (R13) y nombres de PO, TL, QA y UX (R16). | **Nombres resueltos por DT-48.** Queda solo el ticket: mientras no exista, se usa `CAP-PENDIENTE`. |
| D-15 | Recetas, insumos con costos, proveedores, fotos y datos del negocio. | Pedirlos en tandas con `analisis/informacion-a-pedir-al-cliente.md`. |
| D-16 | Plano real del local (mesas, entrada) para dejarlo por defecto. | Que Kevin copie el diseño desde Plano del local ▸ «Copiar» (ver `analisis/plano-del-local.md`). |
| D-17 | Política de contraseñas del sistema real (caducidad de la inicial, intentos, recuperación). | Clave inicial que vence en 24 horas, bloqueo tras 5 intentos y recuperación por el administrador. |
| D-18 | Datos personales: consentimiento, retención y atención de derechos (Ley 29733). | Guardar DNI solo con aceptación, enmascararlo en listas y definir un plazo de conservación en ADR-005. |
| D-19 | Plazo del proyecto y fecha del piloto. | Fijar una fecha de piloto para la fase «Ahora» y recalcular el roadmap. |
| D-20 | Qué se mantiene de restaurant.pe y del bot actual durante la transición. | Convivir un mes: el sistema nuevo para pedidos y cocina; el actual solo para facturar. |

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
