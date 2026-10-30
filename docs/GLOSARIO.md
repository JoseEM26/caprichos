# Glosario de herramientas y conceptos tecnicos

Este glosario explica en lenguaje sencillo las herramientas y terminos tecnicos que hacen funcionar la plataforma digital de Caprichos. Esta pensado para el dueno del negocio y el equipo administrativo, evitando la jerga innecesaria.

---

## 1. Traefik y Nginx

### Que es Traefik
Traefik actua como el anfitrion en la puerta principal del servidor. Es un proxy inverso dinamico: cada vez que un cliente abre la carta en internet o un mozo entra al panel administrativo, Traefik recibe la solicitud, verifica el certificado de seguridad HTTPS (el candado verde que renueva solo con Let's Encrypt sin costo) y dirige a la persona hacia el servicio correcto.

Su mayor ventaja en Caprichos es que reconoce automaticamente cuando se enciende una nueva version de la aplicacion mediante etiquetas de Docker, sin necesidad de reiniciar el servidor ni interrumpir la atencion.

### Que es Nginx
Nginx es un despachador de archivos web de alto rendimiento. En Caprichos no esta en la puerta de entrada, sino dentro del contenedor de la web (`caprichos-web`). Su unica labor es servir de inmediato los archivos visuales (imagenes, estilos, scripts de la carta y el panel) a los navegadores de los clientes y del personal.

### Diferencia clave para el negocio
- Traefik vigila la calle y reparte el trafico exterior hacia los contenedores.
- Nginx despacha los contenidos visuales desde el interior del contenedor web.
- Juntos garantizan que la pagina cargue rapido y que los cambios de version no requieran apagar el sistema.

---

## 2. GHCR (GitHub Container Registry)

GHCR es el almacen privado y seguro de GitHub donde se guardan las imagenes de la aplicacion empaquetadas y listas para usar.

En lugar de copiar archivos de codigo fuente sueltos al servidor de la cafeteria, el sistema compila todo en un paquete cerrado (llamado imagen de contenedor), lo sella con una etiqueta de version unica (por ejemplo `v0.3.0` o el codigo del cambio) y lo guarda en GHCR. Cuando el servidor necesita actualizarse, solo descarga ese paquete precintado y verificado.

Beneficio para el negocio: ningun cambio no autorizado o codigo a medio terminar puede llegar al servidor de atencion.

---

## 3. caprichos-api y caprichos-web

La aplicacion de Caprichos esta dividida en dos grandes componentes independientes que trabajan en equipo:

### caprichos-api (El cerebro operativo)
Es el servidor backend construido con NestJS. Se encarga de toda la logica de negocio:
- Procesa pedidos, cobros, cierres de caja y stock de recetas.
- Se conecta con la base de datos PostgreSQL y la memoria rapida de Redis.
- Conecta con la API de WhatsApp Cloud de Meta y procesa las respuestas del chatbot.
- Analiza con inteligencia artificial las fotos de vouchers de Yape y Plin.
- Responde las consultas de los mozos, comandas de cocina y el panel de administracion en tiempo real mediante WebSockets.

### caprichos-web (La vitrina y panel interactivo)
Es la interfaz grafica que ven las personas en sus pantallas:
- La carta virtual interactiva que abren los clientes en sus celulares para pedir o ver promociones.
- El panel de administracion con 34 modulos para caja, salon, cocina, almacen, repartos y reportes.
- El asistente visual Capri con la guia interactiva del sistema.

---

## 4. docker-rollout (Despliegue sin corte)

### Que problema resuelve
En sistemas tradicionales, para actualizar un programa hay que apagar la version vieja y prender la nueva. Durante esos 30 a 60 segundos de corte, si un cliente estaba pagando un pedido de cafe o un mozo enviaba una comanda, la pantalla mostraba error o la operacion se perdia.

### Como funciona el relevo continuo
docker-rollout es una herramienta que aplica la tecnica de relevo continuo:
1. Mantiene encendida y atendiendo a la version vieja.
2. Enciende la version nueva en paralelo.
3. Consulta continuamente a la version nueva a traves de su chequeo de salud (`/api/salud`).
4. Cuando la version nueva responde que esta 100 % lista y conectada a la base de datos, Traefik empieza a mandar los nuevos pedidos a la version nueva.
5. Da un margen de 30 segundos de gracia a la version vieja para que termine de procesar cualquier pedido que tuviera abierto.
6. Apaga la version vieja sin que ningun usuario note una interrupcion.

### Leccion aprendida con el comando del sistema
Durante las pruebas de despliegue se descubrio que el comando de prueba `docker rollout --version` devolvia un mensaje de exito falso aunque el complemento no estuviera integrado en el Docker del sistema operativo. Por esta razon, los scripts de Caprichos llaman directamente al archivo ejecutable vendorizado (`infra/compose/scripts/docker-rollout`), evitando depender de complementos externos del servidor.

---

## 5. BullMQ (Cola de tareas en segundo plano)

BullMQ es un gestor de colas de mensajes que opera sobre la memoria rapida de Redis.

### Para que se utiliza en Caprichos
Se encarga principalmente de gestionar las notificaciones y mensajes que entran desde el webhook de WhatsApp:
- Si entran 40 mensajes al mismo tiempo, el servidor no colapsa ni responde con lentitud a las cajas. BullMQ los organiza en una fila ordenada.
- Asigna un identificador unico a cada mensaje (mediante un resumen criptografico sha256) para evitar procesar dos veces el mismo mensaje si WhatsApp lo reenvia.
- Procesa hasta 5 mensajes en paralelo de forma controlada.
- Si una comunicacion falla por un parpadeo de internet, reintenta hasta 5 veces de forma automatica con esperas progresivas.
- Si por algun motivo Redis no estuviera disponible, el sistema tiene una via de escape para procesar los mensajes en linea directamente sin perder la atencion.

---

## 6. GitHub Actions y sus pasos principales

GitHub Actions es el robot automatizado que trabaja en la nube de GitHub. Cada vez que el equipo de desarrollo sube una mejora o aprueba un cambio, este robot ejecuta una serie de pasos ordenados para certificar la calidad antes de publicar.

Los pasos principales que realiza son:

### actions/checkout
Es la accion que descarga una copia limpia y exacta del codigo del proyecto dentro de la computadora virtual temporal donde se realizara la prueba.

### actions/cache (y configuracion de cache)
Guarda en memoria temporal las dependencias y librerias externas que no han cambiado desde la ultima vez. En lugar de volver a descargar cientos de megabytes por internet en cada prueba, las toma de la memoria intermedia, reduciendo el tiempo de preparacion de 5 minutos a pocos segundos.

### docker/setup-buildx-action
Instala y prepara Buildx, el motor moderno de construccion de Docker. Permite compilar las imagenes optimizando el uso de capas y aprovechando la memoria de compilaciones anteriores.

### docker/login-action
Inicia sesion de forma segura en el registro de contenedores (GHCR). Utiliza llaves secretas temporales generadas por la plataforma para que nadie ajeno pueda subir ni alterar las imagenes de Caprichos.

### docker/build-push-action
Toma el codigo probado, empaqueta los contenedores definitivos de la API y de la Web, los somete a un escaneo riguroso de seguridad (con el detector de vulnerabilidades Trivy) y, si todo esta limpio, publica la imagen oficial en el almacen privado GHCR.

---

## 7. El aviso sobre Node 20 en GitHub Actions

En los reportes de ejecucion de GitHub Actions puede observarse ocasionalmente una advertencia que menciona a Node.js 20 (por ejemplo indicando que ciertas acciones migraran a versiones superiores como Node 24).

### Que significa para el dueno del negocio
- Es un simple aviso informativo para los creadores de las herramientas de automatizacion, notificando el calendario de soporte de los servidores de GitHub.
- No es un error ni una falla del sistema.
- No afecta las ventas, no detiene la aplicacion, no perjudica la seguridad ni requiere ningun gasto o intervencion por parte del dueno del local.
- Las aplicaciones en el servidor de Caprichos corren de forma totalmente aislada dentro de sus propios contenedores Docker con sus versiones estables garantizadas.
