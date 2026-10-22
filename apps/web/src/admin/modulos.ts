import React from 'react';
import { Escritorio } from './Escritorio';
import { Proximamente } from './Proximamente';

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
    componente: Escritorio,
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
    componente: crearProximamente('Pedidos y caja'),
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
    permisoMinimo: 'caja/cerrar',
    componente: crearProximamente('Caja y cierres'),
    icono: 'cierre',
  },
  {
    clave: 'cocina',
    nombre: 'Cocina',
    grupo: 'Operación',
    ruta: '/admin/cocina',
    permisoMinimo: 'cocina/ver',
    componente: crearProximamente('Cocina'),
    icono: 'cocina',
  },
  {
    clave: 'repartos',
    nombre: 'Repartos',
    grupo: 'Operación',
    ruta: '/admin/repartos',
    permisoMinimo: 'repartos/ver',
    componente: crearProximamente('Repartos'),
    icono: 'repartos',
  },
  {
    clave: 'reservas',
    nombre: 'Reservas',
    grupo: 'Operación',
    ruta: '/admin/reservas',
    permisoMinimo: 'pedidos/ver',
    componente: crearProximamente('Reservas'),
    icono: 'reservas',
  },

  // --- Clientes y ventas ---
  {
    clave: 'clientes',
    nombre: 'Clientes',
    grupo: 'Clientes y ventas',
    ruta: '/admin/clientes',
    permisoMinimo: 'catalogo/ver',
    componente: crearProximamente('Clientes'),
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
    componente: crearProximamente('Productos'),
    icono: 'productos',
  },
  {
    clave: 'listas',
    nombre: 'Listas y categorías',
    grupo: 'Clientes y ventas',
    ruta: '/admin/listas',
    permisoMinimo: 'catalogo/ver',
    componente: crearProximamente('Listas y categorías'),
    icono: 'listas',
  },
  {
    clave: 'ofertas',
    nombre: 'Ofertas y descuentos',
    grupo: 'Clientes y ventas',
    ruta: '/admin/ofertas',
    permisoMinimo: 'catalogo/ver',
    componente: crearProximamente('Ofertas y descuentos'),
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
    componente: crearProximamente('Stock y recetas'),
    icono: 'stock',
  },

  // --- Análisis ---
  {
    clave: 'informes',
    nombre: 'Informes',
    grupo: 'Análisis',
    ruta: '/admin/informes',
    permisoMinimo: 'auditoria/ver',
    componente: crearProximamente('Informes'),
    icono: 'informes',
  },
  {
    clave: 'mapa',
    nombre: 'Mapa de entregas',
    grupo: 'Análisis',
    ruta: '/admin/mapa',
    permisoMinimo: 'zonas/ver',
    componente: crearProximamente('Mapa de entregas'),
    icono: 'mapa',
  },
  {
    clave: 'indicadores',
    nombre: 'Indicadores',
    grupo: 'Análisis',
    ruta: '/admin/indicadores',
    permisoMinimo: 'auditoria/ver',
    componente: crearProximamente('Indicadores'),
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
    componente: crearProximamente('Configuración del local'),
    icono: 'mirest',
  },
  {
    clave: 'usuarios',
    nombre: 'Usuarios',
    grupo: 'Configuración',
    ruta: '/admin/usuarios',
    permisoMinimo: 'usuarios/ver',
    componente: crearProximamente('Usuarios'),
    icono: 'usuarios',
  },
  {
    clave: 'historial',
    nombre: 'Historial de acciones',
    grupo: 'Configuración',
    ruta: '/admin/historial',
    permisoMinimo: 'auditoria/ver',
    componente: crearProximamente('Historial de acciones'),
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
    permisoMinimo: 'local/ver',
    componente: crearProximamente('Plano del local'),
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
