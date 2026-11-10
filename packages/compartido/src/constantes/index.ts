export const ROLES_SISTEMA = {
  ADMIN: 'ADMIN',
  CAJERO: 'CAJERO',
  MOZO: 'MOZO',
  COCINA: 'COCINA',
  BARRA: 'BARRA',
  REPARTIDOR: 'REPARTIDOR',
  SUPERVISOR: 'SUPERVISOR',
} as const;

export type RolSistema = (typeof ROLES_SISTEMA)[keyof typeof ROLES_SISTEMA];

export * from './etiquetas.js';


export * from './impresion.js';
export * from './cocina.js';
export * from './tamanosEtiqueta.js';
export * from './tamanoPc.js';
export * from './modulos-rol.js';
