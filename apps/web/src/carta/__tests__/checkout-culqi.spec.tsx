import { describe, it, expect } from 'vitest';
import { METODO_CULQI } from '../pagos/culqiApi';
import { guardarPedido, leerPedidosGuardados } from '../seguimiento';

describe('medio en línea', () => {
  it('el nombre del medio es CULQI', () => expect(METODO_CULQI).toBe('CULQI'));
  it('el pedido guardado conserva id y enLinea para «Mi pedido»', () => {
    guardarPedido({ id: 'p9', enLinea: true, codigo: 'Z9', token: 't', modalidad: 'RECOGER', nombre: 'N', creadoEn: new Date().toISOString() });
    const g = leerPedidosGuardados().find((p) => p.codigo === 'Z9');
    expect(g?.id).toBe('p9');
    expect(g?.enLinea).toBe(true);
  });
});
