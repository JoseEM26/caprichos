import { describe, it, expect } from 'vitest';
import { movimientos } from '../movimientos';
import { pedido, salonEjemplo } from './datosEjemplo';

describe('movimientos', () => {
  it('sin foto anterior no dice nada', () => {
    expect(movimientos(null, salonEjemplo())).toEqual([]);
  });

  it('cuenta lo que cambió entre dos fotos', () => {
    const antes = salonEjemplo();
    const ahora = salonEjemplo();
    ahora.cocina = [antes.cocina[1], pedido('CP-W910', { mesas: ['Mesa 2'] })]; // salió el 901, entró el 910
    ahora.despacho = [...antes.despacho, pedido('CP-W901', { estado: 'LISTO' })];
    ahora.enReparto = [];
    ahora.mesas = [{ ...antes.mesas[0], estado: 'COMIENDO' }, { ...antes.mesas[1], estado: 'ESPERANDO' }];
    const m = movimientos(antes, ahora);
    expect(m).toContain('CP-W910 entró a cocina · Mesa 2');
    expect(m).toContain('CP-W901 completo en despacho 🔔 · Mesa 1');
    expect(m).toContain('CP-W904 entregado · Delivery');
    expect(m).toContain('Mesa 1 ya tiene su pedido');
    expect(m).toContain('Llegan clientes a Mesa 2');
  });

  it('avisa la cuenta, la salida del delivery y la mesa que se libera', () => {
    const antes = salonEjemplo();
    const ahora = salonEjemplo();
    antes.mesas[1].estado = 'COMIENDO';
    ahora.mesas[1].estado = 'POR_COBRAR';
    ahora.mesas[0].estado = 'LIBRE';
    ahora.enReparto = [...antes.enReparto, pedido('CP-W920', { modalidad: 'DELIVERY', estado: 'EN_CAMINO', mesas: [] })];
    const m = movimientos(antes, ahora);
    expect(m).toContain('Mesa 2 pide la cuenta 🙋');
    expect(m).toContain('Mesa 1 se liberó');
    expect(m).toContain('Salió el delivery: CP-W920 🛵');
  });
});
