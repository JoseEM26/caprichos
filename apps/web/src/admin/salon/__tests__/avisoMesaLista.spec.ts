import { describe, expect, it } from 'vitest';
import { debeAvisarMesaLista } from '../avisoMesaLista';

const ses = (rol: string, partyId: string, permisos: string[] = []) => ({
  usuario: { partyId, rol, roles: [rol] },
  tiene: (p: string) => permisos.includes(p),
});

describe('debeAvisarMesaLista', () => {
  it('el mozo dueño de la mesa sí; otro mozo no', () => {
    expect(debeAvisarMesaLista('5', ses('MOZO', '5'))).toBe(true);
    expect(debeAvisarMesaLista('5', ses('MOZO', '6'))).toBe(false);
  });
  it('admin, supervisor y caja siguen el salón; sin mozo asignado avisa a todos', () => {
    expect(debeAvisarMesaLista('5', ses('ADMIN', '1'))).toBe(true);
    expect(debeAvisarMesaLista('5', ses('SUPERVISOR', '2'))).toBe(true);
    expect(debeAvisarMesaLista('5', ses('CAJERO', '3', ['caja/ver']))).toBe(true);
    expect(debeAvisarMesaLista(undefined, ses('MOZO', '6'))).toBe(true);
  });
});
