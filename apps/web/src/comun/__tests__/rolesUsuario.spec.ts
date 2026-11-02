import { describe, it, expect } from 'vitest';
import { esSoloMozoUsuario, tieneRolUsuario } from '../rolesUsuario';

describe('rolesUsuario', () => {
  it('pertenencia cuenta extras y sin roles usa el principal', () => {
    expect(tieneRolUsuario({ rol: 'CAJERO', roles: ['CAJERO', 'MOZO'] }, 'MOZO')).toBe(true);
    expect(tieneRolUsuario({ rol: 'CAJERO' }, 'MOZO')).toBe(false);
  });

  it('solo mozo: el rol de alcance amplio manda', () => {
    expect(esSoloMozoUsuario({ rol: 'MOZO', roles: ['MOZO', 'COCINA'] })).toBe(true);
    expect(esSoloMozoUsuario({ rol: 'CAJERO', roles: ['CAJERO', 'MOZO'] })).toBe(false);
    expect(esSoloMozoUsuario({ rol: 'MOZO', roles: ['MOZO', 'SUPERVISOR'] })).toBe(false);
  });
});
