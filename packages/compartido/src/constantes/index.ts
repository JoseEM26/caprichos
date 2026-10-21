export const ROLES_SISTEMA = {
  ADMIN: 'ADMIN',
  CAJERO: 'CAJERO',
  MOZO: 'MOZO',
  COCINA: 'COCINA',
  BARRA: 'BARRA',
  REPARTIDOR: 'REPARTIDOR',
  CALLCENTER: 'CALLCENTER',
} as const;

export type RolSistema = (typeof ROLES_SISTEMA)[keyof typeof ROLES_SISTEMA];
