import React from 'react';
import { EscritorioView } from './escritorio';
import { InformesView, IndicadoresView, MapaEntregasView } from './informes';
import { Proximamente } from './Proximamente';
import { UsuariosView, AuditoriaView } from './usuarios';
import { ConfiguracionLocalView, ZonasRepartoView } from './configuracion';
import { PedidosAdminView } from './pedidos';
import { CocinaAdminView } from './cocina';
import { RepartosView } from './repartos';
import { CierreView } from './cierre';
import { ComprobantesView, ReclamosAdminView } from './comprobantes';
import { PlanoView, ReservasView } from './salon';
import { StockView } from './stock';
import { ProductosView, ListasCategoriasView } from './catalogo';
import { ClientesAdminView } from './clientes';
import { OfertasAdminView } from './ofertas';

export type GrupoModulo =
  | 'Operación'
  | 'Clientes y ventas'
  | 'Compras y stock'
  | 'Análisis'
  | 'Configuración';

export interface DefinicionModulo {
  clave: string;
  nombre: string;
  grupo: GrupoModulo;
  ruta: string;
  permisoMinimo?: string;
  componente: React.ComponentType;
  icono?: string;
}

function crearProximamente(nombre: string): React.ComponentType {
  const ComponenteProximamente = () =>
    React.createElement(Proximamente, { nombre });
  ComponenteProximamente.displayName = `Proximamente_${nombre.replace(/\s+/g, '')}`;
  return ComponenteProximamente;
}

export const GRUPOS_MODULOS: readonly GrupoModulo[] = [
  'Operación',
  'Clientes y ventas',
  'Compras y stock',
  'Análisis',
  'Configuración',
] as const;

export const MODULOS: DefinicionModulo[] = [
  // --- Operación ---
  {
    clave: 'escritorio',
    nombre: 'Escritorio',
    grupo: 'Operación',
    ruta: '/admin',
    componente: EscritorioView,
    icono: 'escritorio',
  },
  {
    clave: 'iniciativas',
    nombre: 'Iniciativas',
    grupo: 'Operación',
    ruta: '/admin/iniciativas',
    permisoMinimo: 'usuarios/ver',
    componente: crearProximamente('Iniciativas'),
    icono: 'iniciativas',
  },
  {
    clave: 'caja',
    nombre: 'Pedidos y caja',
    grupo: 'Operación',
    ruta: '/admin/caja',
    permisoMinimo: 'caja/ver',
    componente: PedidosAdminView,
    icono: 'caja',
  },
  {
    clave: 'mensajes',
    nombre: 'Mensajes de WhatsApp',
    grupo: 'Operación',
    ruta: '/admin/mensajes',
    permisoMinimo: 'pedidos/ver',
    componente: crearProximamente('Mensajes de WhatsApp'),
    icono: 'mensajes',
  },
  {
    clave: 'cierre',
    nombre: 'Caja y cierres',
    grupo: 'Operación',
    ruta: '/admin/cierre',
    permisoMinimo: 'caja/ver',
    componente: CierreView,
    icono: 'cierre',
  },
  {
    clave: 'cocina',
    nombre: 'Cocina',
    grupo: 'Operación',
    ruta: '/admin/cocina',
    permisoMinimo: 'cocina/ver',
    componente: CocinaAdminView,
    icono: 'cocina',
  },
  {
    clave: 'repartos',
    nombre: 'Repartos',
    grupo: 'Operación',
    ruta: '/admin/repartos',
    permisoMinimo: 'repartos/ver',
    componente: RepartosView,
    icono: 'repartos',
  },
  {
    clave: 'reservas',
    nombre: 'Reservas',
    grupo: 'Operación',
    ruta: '/admin/reservas',
    permisoMinimo: 'reservas/ver',
    componente: ReservasView,
    icono: 'reservas',
  },

  // --- Clientes y ventas ---
  {
    clave: 'comprobantes',
    nombre: 'Comprobantes',
    grupo: 'Clientes y ventas',
    ruta: '/admin/comprobantes',
    permisoMinimo: 'comprobantes/ver',
    componente: ComprobantesView,
    icono: 'billete',
  },
  {
    clave: 'reclamos',
    nombre: 'Libro de reclamaciones',
    grupo: 'Clientes y ventas',
    ruta: '/admin/reclamos',
    permisoMinimo: 'reclamos/ver',
    componente: ReclamosAdminView,
    icono: 'mensajes',
  },
  {
    clave: 'clientes',
    nombre: 'Clientes',
    grupo: 'Clientes y ventas',
    ruta: '/admin/clientes',
    permisoMinimo: 'clientes/ver',
    componente: ClientesAdminView,
    icono: 'clientes',
  },
  {
    clave: 'creditos',
    nombre: 'Créditos del personal',
    grupo: 'Clientes y ventas',
    ruta: '/admin/creditos',
    permisoMinimo: 'usuarios/ver',
    componente: crearProximamente('Créditos del personal'),
    icono: 'creditos',
  },
  {
    clave: 'productos',
    nombre: 'Productos',
    grupo: 'Clientes y ventas',
    ruta: '/admin/productos',
    permisoMinimo: 'catalogo/ver',
    componente: ProductosView,
    icono: 'productos',
  },
  {
    clave: 'listas',
    nombre: 'Listas y categorías',
    grupo: 'Clientes y ventas',
    ruta: '/admin/listas',
    permisoMinimo: 'catalogo/ver',
    componente: ListasCategoriasView,
    icono: 'listas',
  },
  {
    clave: 'ofertas',
    nombre: 'Ofertas y descuentos',
    grupo: 'Clientes y ventas',
    ruta: '/admin/ofertas',
    permisoMinimo: 'ofertas/ver',
    componente: OfertasAdminView,
    icono: 'ofertas',
  },

  // --- Compras y stock ---
  {
    clave: 'compras',
    nombre: 'Compras',
    grupo: 'Compras y stock',
    ruta: '/admin/compras',
    permisoMinimo: 'stock/ver',
    componente: crearProximamente('Compras'),
    icono: 'compras',
  },
  {
    clave: 'almacen',
    nombre: 'Almacén',
    grupo: 'Compras y stock',
    ruta: '/admin/almacen',
    permisoMinimo: 'stock/ver',
    componente: crearProximamente('Almacén'),
    icono: 'almacen',
  },
  {
    clave: 'stock',
    nombre: 'Stock y recetas',
    grupo: 'Compras y stock',
    ruta: '/admin/stock',
    permisoMinimo: 'stock/ver',
    componente: StockView,
    icono: 'stock',
  },

  // --- Análisis ---
  {
    clave: 'informes',
    nombre: 'Informes',
    grupo: 'Análisis',
    ruta: '/admin/informes',
    permisoMinimo: 'auditoria/ver',
    componente: InformesView,
    icono: 'informes',
  },
  {
    clave: 'mapa',
    nombre: 'Mapa de entregas',
    grupo: 'Análisis',
    ruta: '/admin/mapa',
    permisoMinimo: 'zonas/ver',
    componente: MapaEntregasView,
    icono: 'mapa',
  },
  {
    clave: 'indicadores',
    nombre: 'Indicadores',
    grupo: 'Análisis',
    ruta: '/admin/indicadores',
    permisoMinimo: 'auditoria/ver',
    componente: IndicadoresView,
    icono: 'indicadores',
  },

  // --- Configuración ---
  {
    clave: 'disenador',
    nombre: 'Diseño de la carta',
    grupo: 'Configuración',
    ruta: '/admin/disenador',
    permisoMinimo: 'local/ver',
    componente: crearProximamente('Diseño de la carta'),
    icono: 'disenador',
  },
  {
    clave: 'novedades',
    nombre: 'Novedades y publicidad',
    grupo: 'Configuración',
    ruta: '/admin/novedades',
    permisoMinimo: 'catalogo/ver',
    componente: crearProximamente('Novedades y publicidad'),
    icono: 'novedades',
  },
  {
    clave: 'destacadas',
    nombre: 'Destacadas de la carta',
    grupo: 'Configuración',
    ruta: '/admin/destacadas',
    permisoMinimo: 'catalogo/ver',
    componente: crearProximamente('Destacadas de la carta'),
    icono: 'destacadas',
  },
  {
    clave: 'paleta',
    nombre: 'Paleta de colores',
    grupo: 'Configuración',
    ruta: '/admin/paleta',
    permisoMinimo: 'local/ver',
    componente: crearProximamente('Paleta de colores'),
    icono: 'paleta',
  },
  {
    clave: 'mirest',
    nombre: 'Configuración del local',
    grupo: 'Configuración',
    ruta: '/admin/mirest',
    permisoMinimo: 'local/ver',
    componente: ConfiguracionLocalView,
    icono: 'mirest',
  },
  {
    clave: 'zonas',
    nombre: 'Zonas de reparto',
    grupo: 'Configuración',
    ruta: '/admin/zonas',
    permisoMinimo: 'zonas/ver',
    componente: ZonasRepartoView,
    icono: 'mapa',
  },
  {
    clave: 'usuarios',
    nombre: 'Usuarios',
    grupo: 'Configuración',
    ruta: '/admin/usuarios',
    permisoMinimo: 'usuarios/ver',
    componente: UsuariosView,
    icono: 'usuarios',
  },
  {
    clave: 'historial',
    nombre: 'Historial de acciones',
    grupo: 'Configuración',
    ruta: '/admin/historial',
    permisoMinimo: 'auditoria/ver',
    componente: AuditoriaView,
    icono: 'historial',
  },
  {
    clave: 'pantallas',
    nombre: 'Pantallas',
    grupo: 'Configuración',
    ruta: '/admin/pantallas',
    permisoMinimo: 'local/ver',
    componente: crearProximamente('Pantallas'),
    icono: 'pantallas',
  },
  {
    clave: 'plano',
    nombre: 'Plano del local',
    grupo: 'Configuración',
    ruta: '/admin/plano',
    permisoMinimo: 'plano/ver',
    componente: PlanoView,
    icono: 'plano',
  },
  {
    clave: 'notificaciones',
    nombre: 'Notificaciones',
    grupo: 'Configuración',
    ruta: '/admin/notificaciones',
    permisoMinimo: 'local/ver',
    componente: crearProximamente('Notificaciones'),
    icono: 'notificaciones',
  },
];
