# Grafo de Conocimiento de Documentación - Panel Administrativo

Este documento contiene la representación del grafo de conocimiento derivado automáticamente de los manuales Markdown oficiales en `apps/api/src/modulos/ayuda-admin/manuales/`.

Generado mediante el comando:
```bash
pnpm --filter @caprichos/api ayuda:grafo
```

## Métricas del Grafo

- **Nodos totales**: 354
  - Módulos: 41
  - Tareas (`## Como se hace`): 278
  - Roles del sistema: 7
  - Permisos requeridos: 28
- **Aristas tipadas totales**: 1218

## Diagrama Mermaid de Módulos y Relaciones

```mermaid
flowchart TD
  almacen["Almacén (/admin/almacen)"]
  apertura["Apertura del dia (conteo de productos terminados) (/admin/apertura)"]
  asistencia_pantalla["Pantalla de asistencia (QR) (/admin/asistencia/pantalla)"]
  asistencia["Asistencia del personal (/admin/asistencia)"]
  caja["Pedidos y caja (/admin/caja)"]
  cierre["Caja y cierres (/admin/cierre)"]
  clientes["Clientes (/admin/clientes)"]
  cocina["Cocina (/admin/cocina)"]
  compras["Compras (/admin/compras)"]
  comprobantes["Comprobantes (/admin/comprobantes)"]
  creditos["Créditos del personal (/admin/creditos)"]
  destacadas["Destacadas de la carta (/admin/destacadas)"]
  disenador["Diseño de la carta (/admin/disenador)"]
  escritorio["Escritorio (/admin)"]
  historial["Historial de acciones (/admin/historial)"]
  indicadores["Indicadores (/admin/indicadores)"]
  informes["Informes (/admin/informes)"]
  iniciativas["Iniciativas (/admin/iniciativas)"]
  listas["Listas y categorías (/admin/listas)"]
  mapa["Mapa de entregas (/admin/mapa)"]
  mascota["Mascota Capri (/admin/mascota)"]
  mensajes["Mensajes de WhatsApp (/admin/mensajes)"]
  mi_asistencia["Mi asistencia (/admin/mi-asistencia)"]
  mirest["Configuración del local (/admin/mirest)"]
  mis_pedidos["Mis pedidos (mozo) (/admin/mis-pedidos)"]
  notificaciones["Notificaciones (/admin/notificaciones)"]
  novedades["Novedades y publicidad (/admin/novedades)"]
  ofertas["Ofertas y descuentos (/admin/ofertas)"]
  paleta["Paleta de colores (/admin/paleta)"]
  pantallas["Pantallas (/admin/pantallas)"]
  plano["Plano del local (/admin/plano)"]
  productos["Productos (/admin/productos)"]
  propinas["Propinas (/admin/propinas)"]
  recetas["Recetas (/admin/recetas)"]
  reclamos["Libro de reclamaciones (/admin/reclamos)"]
  repartos["Repartos (/admin/repartos)"]
  reservas["Reservas (/admin/reservas)"]
  stock["Stock y recetas (/admin/stock)"]
  supervisor_codigo["Código del supervisor (/admin/supervisor-codigo)"]
  usuarios["Usuarios (/admin/usuarios)"]
  zonas["Zonas de reparto (/admin/zonas)"]
  almacen -->|relacionado_con| stock
  stock -->|relacionado_con| almacen
  almacen -->|relacionado_con| compras
  compras -->|relacionado_con| almacen
  almacen -->|relacionado_con| cocina
  cocina -->|relacionado_con| almacen
  almacen -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|relacionado_con| almacen
  almacen -->|relacionado_con| apertura
  apertura -->|relacionado_con| almacen
  almacen -->|relacionado_con| productos
  productos -->|relacionado_con| almacen
  almacen -->|relacionado_con| recetas
  almacen -->|relacionado_con| informes
  almacen -->|relacionado_con| historial
  almacen -->|relacionado_con| cierre
  almacen -->|antes| stock
  almacen -->|despues| cocina
  almacen -->|requiere| supervisor_codigo
  almacen -->|ver_tambien| informes
  almacen -->|antes| recetas
  almacen -->|despues| stock
  almacen -->|ver_tambien| cocina
  almacen -->|ver_tambien| historial
  almacen -->|despues| cierre
  almacen -->|ver_tambien| stock
  almacen -->|ver_tambien| compras
  almacen -->|despues| apertura
  apertura -->|relacionado_con| productos
  productos -->|relacionado_con| apertura
  apertura -->|relacionado_con| stock
  stock -->|relacionado_con| apertura
  apertura -->|relacionado_con| cocina
  cocina -->|relacionado_con| apertura
  apertura -->|relacionado_con| caja
  caja -->|relacionado_con| apertura
  apertura -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| apertura
  apertura -->|antes| productos
  apertura -->|despues| cocina
  asistencia_pantalla -->|relacionado_con| asistencia
  asistencia -->|relacionado_con| asistencia_pantalla
  asistencia_pantalla -->|relacionado_con| mi_asistencia
  mi_asistencia -->|relacionado_con| asistencia_pantalla
  asistencia_pantalla -->|relacionado_con| pantallas
  pantallas -->|relacionado_con| asistencia_pantalla
  asistencia_pantalla -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| asistencia_pantalla
  asistencia_pantalla -->|despues| mi_asistencia
  asistencia_pantalla -->|ver_tambien| asistencia
  asistencia -->|relacionado_con| mi_asistencia
  mi_asistencia -->|relacionado_con| asistencia
  asistencia -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| asistencia
  asistencia -->|relacionado_con| propinas
  propinas -->|relacionado_con| asistencia
  asistencia -->|relacionado_con| historial
  historial -->|relacionado_con| asistencia
  asistencia -->|ver_tambien| usuarios
  asistencia -->|ver_tambien| historial
  asistencia -->|ver_tambien| mi_asistencia
  caja -->|relacionado_con| cierre
  cierre -->|relacionado_con| caja
  caja -->|relacionado_con| cocina
  cocina -->|relacionado_con| caja
  caja -->|relacionado_con| comprobantes
  comprobantes -->|relacionado_con| caja
  caja -->|relacionado_con| repartos
  repartos -->|relacionado_con| caja
  caja -->|relacionado_con| plano
  plano -->|relacionado_con| caja
  caja -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|relacionado_con| caja
  caja -->|relacionado_con| mensajes
  mensajes -->|relacionado_con| caja
  caja -->|relacionado_con| propinas
  propinas -->|relacionado_con| caja
  caja -->|relacionado_con| informes
  informes -->|relacionado_con| caja
  caja -->|relacionado_con| historial
  caja -->|antes| supervisor_codigo
  caja -->|antes| cocina
  caja -->|despues| comprobantes
  caja -->|ver_tambien| cierre
  caja -->|antes| mensajes
  caja -->|despues| cocina
  caja -->|requiere| supervisor_codigo
  caja -->|ver_tambien| historial
  caja -->|antes| plano
  caja -->|ver_tambien| repartos
  caja -->|ver_tambien| cocina
  caja -->|ver_tambien| informes
  caja -->|ver_tambien| mensajes
  cierre -->|relacionado_con| repartos
  repartos -->|relacionado_con| cierre
  cierre -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|relacionado_con| cierre
  cierre -->|relacionado_con| comprobantes
  comprobantes -->|relacionado_con| cierre
  cierre -->|relacionado_con| mensajes
  mensajes -->|relacionado_con| cierre
  cierre -->|relacionado_con| propinas
  propinas -->|relacionado_con| cierre
  cierre -->|relacionado_con| informes
  informes -->|relacionado_con| cierre
  cierre -->|relacionado_con| plano
  cierre -->|antes| caja
  cierre -->|ver_tambien| caja
  cierre -->|antes| mensajes
  cierre -->|antes| repartos
  cierre -->|ver_tambien| repartos
  cierre -->|despues| informes
  cierre -->|ver_tambien| comprobantes
  cierre -->|requiere| supervisor_codigo
  cierre -->|ver_tambien| supervisor_codigo
  cierre -->|ver_tambien| propinas
  clientes -->|relacionado_con| caja
  caja -->|relacionado_con| clientes
  clientes -->|relacionado_con| ofertas
  ofertas -->|relacionado_con| clientes
  clientes -->|relacionado_con| mensajes
  mensajes -->|relacionado_con| clientes
  clientes -->|relacionado_con| zonas
  zonas -->|relacionado_con| clientes
  clientes -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| clientes
  clientes -->|despues| caja
  clientes -->|ver_tambien| mensajes
  clientes -->|ver_tambien| caja
  clientes -->|ver_tambien| ofertas
  clientes -->|ver_tambien| zonas
  cocina -->|relacionado_con| stock
  stock -->|relacionado_con| cocina
  cocina -->|relacionado_con| pantallas
  pantallas -->|relacionado_con| cocina
  cocina -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|relacionado_con| cocina
  cocina -->|relacionado_con| productos
  productos -->|relacionado_con| cocina
  cocina -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| cocina
  cocina -->|relacionado_con| repartos
  cocina -->|relacionado_con| mirest
  cocina -->|antes| caja
  cocina -->|despues| repartos
  cocina -->|ver_tambien| pantallas
  cocina -->|ver_tambien| caja
  cocina -->|ver_tambien| mirest
  cocina -->|despues| productos
  cocina -->|ver_tambien| stock
  cocina -->|requiere| supervisor_codigo
  cocina -->|despues| almacen
  cocina -->|despues| apertura
  compras -->|relacionado_con| stock
  stock -->|relacionado_con| compras
  compras -->|relacionado_con| cierre
  cierre -->|relacionado_con| compras
  compras -->|relacionado_con| comprobantes
  comprobantes -->|relacionado_con| compras
  compras -->|antes| stock
  compras -->|despues| almacen
  compras -->|ver_tambien| cierre
  comprobantes -->|antes| caja
  comprobantes -->|ver_tambien| cierre
  creditos -->|relacionado_con| caja
  caja -->|relacionado_con| creditos
  creditos -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| creditos
  creditos -->|relacionado_con| informes
  creditos -->|ver_tambien| caja
  creditos -->|antes| caja
  creditos -->|ver_tambien| usuarios
  creditos -->|ver_tambien| informes
  destacadas -->|relacionado_con| novedades
  novedades -->|relacionado_con| destacadas
  destacadas -->|relacionado_con| disenador
  disenador -->|relacionado_con| destacadas
  destacadas -->|relacionado_con| productos
  productos -->|relacionado_con| destacadas
  destacadas -->|relacionado_con| historial
  destacadas -->|antes| productos
  destacadas -->|ver_tambien| disenador
  destacadas -->|ver_tambien| novedades
  destacadas -->|ver_tambien| historial
  disenador -->|relacionado_con| paleta
  paleta -->|relacionado_con| disenador
  disenador -->|relacionado_con| productos
  productos -->|relacionado_con| disenador
  disenador -->|relacionado_con| listas
  listas -->|relacionado_con| disenador
  disenador -->|relacionado_con| novedades
  novedades -->|relacionado_con| disenador
  disenador -->|relacionado_con| historial
  disenador -->|ver_tambien| paleta
  disenador -->|antes| listas
  disenador -->|ver_tambien| productos
  disenador -->|antes| productos
  disenador -->|ver_tambien| novedades
  disenador -->|ver_tambien| destacadas
  disenador -->|ver_tambien| historial
  escritorio -->|relacionado_con| caja
  caja -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| cocina
  cocina -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| repartos
  repartos -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| compras
  compras -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| informes
  informes -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| reservas
  reservas -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| plano
  plano -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| notificaciones
  notificaciones -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| stock
  escritorio -->|ver_tambien| informes
  escritorio -->|despues| compras
  escritorio -->|ver_tambien| stock
  escritorio -->|ver_tambien| caja
  escritorio -->|ver_tambien| cocina
  escritorio -->|ver_tambien| repartos
  escritorio -->|ver_tambien| supervisor_codigo
  historial -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| historial
  historial -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|relacionado_con| historial
  historial -->|relacionado_con| caja
  historial -->|relacionado_con| cierre
  cierre -->|relacionado_con| historial
  historial -->|relacionado_con| informes
  informes -->|relacionado_con| historial
  historial -->|ver_tambien| informes
  historial -->|ver_tambien| usuarios
  indicadores -->|relacionado_con| informes
  informes -->|relacionado_con| indicadores
  indicadores -->|relacionado_con| caja
  caja -->|relacionado_con| indicadores
  indicadores -->|relacionado_con| productos
  productos -->|relacionado_con| indicadores
  indicadores -->|relacionado_con| cocina
  cocina -->|relacionado_con| indicadores
  indicadores -->|relacionado_con| repartos
  repartos -->|relacionado_con| indicadores
  indicadores -->|relacionado_con| disenador
  indicadores -->|relacionado_con| ofertas
  indicadores -->|ver_tambien| informes
  indicadores -->|ver_tambien| cocina
  indicadores -->|ver_tambien| repartos
  indicadores -->|ver_tambien| productos
  indicadores -->|despues| productos
  indicadores -->|ver_tambien| disenador
  indicadores -->|antes| ofertas
  informes -->|relacionado_con| comprobantes
  comprobantes -->|relacionado_con| informes
  informes -->|relacionado_con| mapa
  mapa -->|relacionado_con| informes
  informes -->|relacionado_con| propinas
  propinas -->|relacionado_con| informes
  informes -->|ver_tambien| indicadores
  informes -->|ver_tambien| cierre
  informes -->|ver_tambien| historial
  informes -->|ver_tambien| comprobantes
  iniciativas -->|relacionado_con| historial
  historial -->|relacionado_con| iniciativas
  iniciativas -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| iniciativas
  iniciativas -->|ver_tambien| historial
  iniciativas -->|ver_tambien| usuarios
  iniciativas -->|despues| historial
  listas -->|relacionado_con| productos
  productos -->|relacionado_con| listas
  listas -->|relacionado_con| recetas
  recetas -->|relacionado_con| listas
  listas -->|despues| productos
  listas -->|ver_tambien| disenador
  listas -->|ver_tambien| recetas
  listas -->|ver_tambien| productos
  mapa -->|relacionado_con| repartos
  repartos -->|relacionado_con| mapa
  mapa -->|relacionado_con| zonas
  zonas -->|relacionado_con| mapa
  mapa -->|relacionado_con| caja
  caja -->|relacionado_con| mapa
  mapa -->|ver_tambien| zonas
  mapa -->|antes| zonas
  mapa -->|ver_tambien| repartos
  mapa -->|ver_tambien| informes
  mapa -->|despues| zonas
  mascota -->|relacionado_con| disenador
  disenador -->|relacionado_con| mascota
  mascota -->|relacionado_con| novedades
  novedades -->|relacionado_con| mascota
  mascota -->|relacionado_con| paleta
  paleta -->|relacionado_con| mascota
  mascota -->|ver_tambien| paleta
  mascota -->|antes| novedades
  mascota -->|ver_tambien| disenador
  mensajes -->|relacionado_con| reclamos
  reclamos -->|relacionado_con| mensajes
  mensajes -->|relacionado_con| cocina
  cocina -->|relacionado_con| mensajes
  mensajes -->|relacionado_con| repartos
  repartos -->|relacionado_con| mensajes
  mensajes -->|relacionado_con| reservas
  reservas -->|relacionado_con| mensajes
  mensajes -->|relacionado_con| notificaciones
  mensajes -->|relacionado_con| ofertas
  mensajes -->|ver_tambien| caja
  mensajes -->|ver_tambien| clientes
  mensajes -->|ver_tambien| reclamos
  mensajes -->|ver_tambien| notificaciones
  mensajes -->|despues| cocina
  mensajes -->|ver_tambien| repartos
  mi_asistencia -->|relacionado_con| propinas
  propinas -->|relacionado_con| mi_asistencia
  mi_asistencia -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| mi_asistencia
  mi_asistencia -->|relacionado_con| escritorio
  escritorio -->|relacionado_con| mi_asistencia
  mi_asistencia -->|antes| asistencia_pantalla
  mi_asistencia -->|ver_tambien| asistencia
  mi_asistencia -->|ver_tambien| propinas
  mirest -->|relacionado_con| zonas
  zonas -->|relacionado_con| mirest
  mirest -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|relacionado_con| mirest
  mirest -->|relacionado_con| cocina
  mirest -->|relacionado_con| historial
  historial -->|relacionado_con| mirest
  mirest -->|relacionado_con| caja
  caja -->|relacionado_con| mirest
  mirest -->|relacionado_con| asistencia
  asistencia -->|relacionado_con| mirest
  mirest -->|relacionado_con| pantallas
  pantallas -->|relacionado_con| mirest
  mirest -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| mirest
  mis_pedidos -->|relacionado_con| plano
  plano -->|relacionado_con| mis_pedidos
  mis_pedidos -->|relacionado_con| caja
  caja -->|relacionado_con| mis_pedidos
  mis_pedidos -->|relacionado_con| cocina
  cocina -->|relacionado_con| mis_pedidos
  mis_pedidos -->|relacionado_con| reservas
  reservas -->|relacionado_con| mis_pedidos
  mis_pedidos -->|relacionado_con| notificaciones
  notificaciones -->|relacionado_con| mis_pedidos
  mis_pedidos -->|relacionado_con| propinas
  mis_pedidos -->|ver_tambien| cocina
  mis_pedidos -->|antes| plano
  mis_pedidos -->|despues| caja
  notificaciones -->|relacionado_con| cocina
  cocina -->|relacionado_con| notificaciones
  notificaciones -->|relacionado_con| caja
  caja -->|relacionado_con| notificaciones
  notificaciones -->|relacionado_con| stock
  stock -->|relacionado_con| notificaciones
  notificaciones -->|relacionado_con| mensajes
  notificaciones -->|relacionado_con| repartos
  repartos -->|relacionado_con| notificaciones
  notificaciones -->|relacionado_con| reservas
  reservas -->|relacionado_con| notificaciones
  notificaciones -->|relacionado_con| historial
  notificaciones -->|despues| cocina
  notificaciones -->|ver_tambien| caja
  notificaciones -->|ver_tambien| historial
  notificaciones -->|ver_tambien| reservas
  novedades -->|relacionado_con| ofertas
  ofertas -->|relacionado_con| novedades
  novedades -->|relacionado_con| productos
  productos -->|relacionado_con| novedades
  novedades -->|relacionado_con| historial
  novedades -->|antes| productos
  novedades -->|ver_tambien| disenador
  novedades -->|ver_tambien| ofertas
  novedades -->|ver_tambien| destacadas
  novedades -->|ver_tambien| historial
  ofertas -->|relacionado_con| productos
  productos -->|relacionado_con| ofertas
  ofertas -->|relacionado_con| caja
  caja -->|relacionado_con| ofertas
  ofertas -->|relacionado_con| comprobantes
  comprobantes -->|relacionado_con| ofertas
  ofertas -->|relacionado_con| cocina
  cocina -->|relacionado_con| ofertas
  ofertas -->|relacionado_con| indicadores
  ofertas -->|antes| productos
  ofertas -->|despues| caja
  ofertas -->|ver_tambien| novedades
  ofertas -->|ver_tambien| cocina
  ofertas -->|ver_tambien| caja
  ofertas -->|ver_tambien| clientes
  ofertas -->|ver_tambien| indicadores
  paleta -->|relacionado_con| mirest
  mirest -->|relacionado_con| paleta
  paleta -->|ver_tambien| disenador
  paleta -->|despues| disenador
  paleta -->|ver_tambien| mirest
  pantallas -->|relacionado_con| notificaciones
  notificaciones -->|relacionado_con| pantallas
  pantallas -->|despues| cocina
  pantallas -->|ver_tambien| mirest
  pantallas -->|antes| cocina
  pantallas -->|ver_tambien| cocina
  plano -->|relacionado_con| reservas
  reservas -->|relacionado_con| plano
  plano -->|relacionado_con| cocina
  cocina -->|relacionado_con| plano
  plano -->|relacionado_con| pantallas
  pantallas -->|relacionado_con| plano
  plano -->|relacionado_con| cierre
  plano -->|despues| caja
  plano -->|ver_tambien| cocina
  plano -->|ver_tambien| cierre
  productos -->|relacionado_con| stock
  stock -->|relacionado_con| productos
  productos -->|relacionado_con| recetas
  recetas -->|relacionado_con| productos
  productos -->|relacionado_con| caja
  productos -->|antes| listas
  productos -->|despues| recetas
  productos -->|ver_tambien| stock
  productos -->|antes| stock
  productos -->|ver_tambien| cocina
  productos -->|ver_tambien| disenador
  productos -->|despues| apertura
  productos -->|ver_tambien| ofertas
  propinas -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| propinas
  propinas -->|relacionado_con| historial
  historial -->|relacionado_con| propinas
  propinas -->|ver_tambien| caja
  propinas -->|despues| cierre
  propinas -->|antes| asistencia
  recetas -->|relacionado_con| stock
  stock -->|relacionado_con| recetas
  recetas -->|relacionado_con| almacen
  recetas -->|relacionado_con| cocina
  cocina -->|relacionado_con| recetas
  recetas -->|relacionado_con| caja
  recetas -->|relacionado_con| indicadores
  recetas -->|antes| productos
  recetas -->|antes| stock
  recetas -->|despues| caja
  recetas -->|ver_tambien| cocina
  recetas -->|antes| listas
  recetas -->|ver_tambien| productos
  recetas -->|ver_tambien| stock
  recetas -->|ver_tambien| indicadores
  reclamos -->|relacionado_con| caja
  caja -->|relacionado_con| reclamos
  reclamos -->|relacionado_con| clientes
  clientes -->|relacionado_con| reclamos
  reclamos -->|relacionado_con| historial
  reclamos -->|ver_tambien| caja
  reclamos -->|ver_tambien| clientes
  reclamos -->|despues| historial
  reclamos -->|ver_tambien| mensajes
  repartos -->|relacionado_con| cocina
  repartos -->|relacionado_con| zonas
  zonas -->|relacionado_con| repartos
  repartos -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| repartos
  repartos -->|relacionado_con| asistencia
  asistencia -->|relacionado_con| repartos
  repartos -->|relacionado_con| mi_asistencia
  repartos -->|antes| cocina
  repartos -->|despues| caja
  repartos -->|ver_tambien| caja
  repartos -->|ver_tambien| mensajes
  reservas -->|relacionado_con| caja
  caja -->|relacionado_con| reservas
  reservas -->|relacionado_con| clientes
  clientes -->|relacionado_con| reservas
  reservas -->|antes| plano
  reservas -->|ver_tambien| clientes
  reservas -->|antes| mensajes
  reservas -->|despues| caja
  stock -->|relacionado_con| supervisor_codigo
  stock -->|despues| compras
  stock -->|ver_tambien| productos
  stock -->|despues| recetas
  stock -->|ver_tambien| compras
  stock -->|ver_tambien| almacen
  stock -->|despues| almacen
  stock -->|ver_tambien| supervisor_codigo
  supervisor_codigo -->|relacionado_con| usuarios
  usuarios -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|relacionado_con| compras
  compras -->|relacionado_con| supervisor_codigo
  supervisor_codigo -->|despues| caja
  supervisor_codigo -->|ver_tambien| usuarios
  supervisor_codigo -->|ver_tambien| historial
  supervisor_codigo -->|ver_tambien| escritorio
  usuarios -->|relacionado_con| mensajes
  usuarios -->|relacionado_con| reclamos
  usuarios -->|ver_tambien| historial
  usuarios -->|requiere| supervisor_codigo
  usuarios -->|ver_tambien| mensajes
  usuarios -->|ver_tambien| reclamos
  zonas -->|relacionado_con| caja
  caja -->|relacionado_con| zonas
  zonas -->|antes| mirest
  zonas -->|despues| caja
  zonas -->|ver_tambien| repartos
  zonas -->|ver_tambien| mapa
  mirest -->|relacionado_con| mensajes
  mirest -->|relacionado_con| repartos
  mirest -->|relacionado_con| comprobantes
  mirest -->|relacionado_con| propinas
  mirest -->|relacionado_con| stock
  mirest -->|relacionado_con| recetas
  mirest -->|relacionado_con| notificaciones
  mirest -->|relacionado_con| mapa
  mirest -->|relacionado_con| reservas
  mirest -->|relacionado_con| plano
  mirest -->|relacionado_con| reclamos
  mirest -->|relacionado_con| clientes
```

## Listado de Módulos y Rutas

| Módulo | Título | Ruta |
| :--- | :--- | :--- |
| `almacen` | Almacén | `/admin/almacen` |
| `apertura` | Apertura del dia (conteo de productos terminados) | `/admin/apertura` |
| `asistencia-pantalla` | Pantalla de asistencia (QR) | `/admin/asistencia/pantalla` |
| `asistencia` | Asistencia del personal | `/admin/asistencia` |
| `caja` | Pedidos y caja | `/admin/caja` |
| `cierre` | Caja y cierres | `/admin/cierre` |
| `clientes` | Clientes | `/admin/clientes` |
| `cocina` | Cocina | `/admin/cocina` |
| `compras` | Compras | `/admin/compras` |
| `comprobantes` | Comprobantes | `/admin/comprobantes` |
| `creditos` | Créditos del personal | `/admin/creditos` |
| `destacadas` | Destacadas de la carta | `/admin/destacadas` |
| `disenador` | Diseño de la carta | `/admin/disenador` |
| `escritorio` | Escritorio | `/admin` |
| `historial` | Historial de acciones | `/admin/historial` |
| `indicadores` | Indicadores | `/admin/indicadores` |
| `informes` | Informes | `/admin/informes` |
| `iniciativas` | Iniciativas | `/admin/iniciativas` |
| `listas` | Listas y categorías | `/admin/listas` |
| `mapa` | Mapa de entregas | `/admin/mapa` |
| `mascota` | Mascota Capri | `/admin/mascota` |
| `mensajes` | Mensajes de WhatsApp | `/admin/mensajes` |
| `mi-asistencia` | Mi asistencia | `/admin/mi-asistencia` |
| `mirest` | Configuración del local | `/admin/mirest` |
| `mis-pedidos` | Mis pedidos (mozo) | `/admin/mis-pedidos` |
| `notificaciones` | Notificaciones | `/admin/notificaciones` |
| `novedades` | Novedades y publicidad | `/admin/novedades` |
| `ofertas` | Ofertas y descuentos | `/admin/ofertas` |
| `paleta` | Paleta de colores | `/admin/paleta` |
| `pantallas` | Pantallas | `/admin/pantallas` |
| `plano` | Plano del local | `/admin/plano` |
| `productos` | Productos | `/admin/productos` |
| `propinas` | Propinas | `/admin/propinas` |
| `recetas` | Recetas | `/admin/recetas` |
| `reclamos` | Libro de reclamaciones | `/admin/reclamos` |
| `repartos` | Repartos | `/admin/repartos` |
| `reservas` | Reservas | `/admin/reservas` |
| `stock` | Stock y recetas | `/admin/stock` |
| `supervisor-codigo` | Código del supervisor | `/admin/supervisor-codigo` |
| `usuarios` | Usuarios | `/admin/usuarios` |
| `zonas` | Zonas de reparto | `/admin/zonas` |
