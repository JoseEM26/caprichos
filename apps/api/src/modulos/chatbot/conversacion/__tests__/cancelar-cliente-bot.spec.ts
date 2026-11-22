import { atenderCancelarCliente } from '../flujos/cambios/cancelar-cliente-bot';

const flujo: any = { version: 1, estado: 'MENU', repreguntasFallidas: 0 };
const entrada = (texto: string, id?: string): any => ({ tipo: id ? 'boton' : 'texto', texto, textoOriginal: texto, id });
const ctx = (lista: any[]): any => ({ cancelablesCliente: lista });

describe('bot: cancelar pedido sin pagar', () => {
  it('ofrece el botón «Cancelar CP-XXX» si es cancelable', () => {
    const r = atenderCancelarCliente(flujo, entrada('ya no lo quiero'), ctx([{ codigo: 'CP-0001', cancelable: true }]))!;
    const a: any = r.acciones[0];
    expect(a.botones[0]).toEqual({ id: 'cx_si:CP-0001', titulo: 'Cancelar CP-0001' });
  });

  it('confirmado: emite la acción de cancelar solo si sigue cancelable', () => {
    const l = ctx([{ codigo: 'CP-0001', cancelable: true }]);
    expect(atenderCancelarCliente(flujo, entrada('cancelar cp-0001', 'cx_si:CP-0001'), l)!.acciones[0]).toEqual({ tipo: 'cancelarPedidoCliente', pedidoCodigo: 'CP-0001' });
    const ajeno = atenderCancelarCliente(flujo, entrada('x', 'cx_si:CP-9999'), l)!;
    expect(ajeno.acciones[0].tipo).toBe('enviarBotones');
  });

  it('pago en revisión: lo explica y ofrece una persona', () => {
    const r = atenderCancelarCliente(flujo, entrada('cancelar pedido'), ctx([{ codigo: 'CP-0002', cancelable: false, mensaje: 'Tu pago está en revisión, escríbenos.' }]))!;
    const a: any = r.acciones[0];
    expect(a.texto).toMatch(/en revisión/);
    expect(a.botones.map((b: any) => b.id)).toContain('persona');
  });

  it('«No»: no cancela; sin pedidos o sin intención: null (sigue el flujo de siempre)', () => {
    expect((atenderCancelarCliente(flujo, entrada('no', 'cx_no'), ctx([{ codigo: 'CP-0001', cancelable: true }]))!.acciones[0] as any).tipo).toBe('enviarBotones');
    expect(atenderCancelarCliente(flujo, entrada('cancelar'), ctx([]))).toBeNull();
    expect(atenderCancelarCliente(flujo, entrada('hola'), ctx([{ codigo: 'CP-0001', cancelable: true }]))).toBeNull();
    expect(atenderCancelarCliente(flujo, entrada('cancelar mi reserva'), ctx([{ codigo: 'CP-0001', cancelable: true }]))).toBeNull();
  });
});
