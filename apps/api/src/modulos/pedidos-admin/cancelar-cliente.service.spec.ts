jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('./pedidos-estado.service', () => ({ PedidosEstadoService: class {} }));
import { CancelarClienteService } from './cancelar-cliente.service';
import { generarTokenSeguimiento } from '../pedidos/seguimiento.tokens';

const fila = (extra: any = {}) => ({
  id: 5n,
  codigo: 'CP-0005',
  estado: 'COLA',
  pago_estado: 'PENDIENTE',
  cobro_mozo_en: null,
  adelanto_total: 0,
  cliente_telefono: '+51987654321',
  _count: { cobros: 0, pagosOnline: 0, vouchers: 0, comandas: 0 },
  ...extra,
});

function montar(f = fila(), cambiar: jest.Mock = jest.fn().mockResolvedValue({})) {
  const prisma: any = {
    pedido: { findUnique: jest.fn().mockResolvedValue(f) },
    userAccount: { findFirst: jest.fn().mockResolvedValue({ party_id: 99n }) },
    notificacion: { create: jest.fn().mockResolvedValue({ id: 1n, titulo: 't' }) },
    pagoOnlineIntento: { updateMany: jest.fn().mockResolvedValue({}) },
  };
  const eventos: any = { emitirAdmin: jest.fn() };
  const servicio = new CancelarClienteService(prisma, { cambiarEstado: cambiar } as any, eventos);
  return { servicio, prisma, cambiar, eventos };
}
const token = generarTokenSeguimiento(5n);

describe('CancelarClienteService', () => {
  it('cancela con token válido, motivo «Cancelado por el cliente» y avisa a Caja', async () => {
    const { servicio, cambiar, eventos } = montar();
    const r = await servicio.cancelarPorToken('CP-0005', token, 'me equivoqué');
    expect(r.codigo).toBe('CP-0005');
    expect(cambiar).toHaveBeenCalledWith(5n, expect.objectContaining({ estado: 'ANULADO', motivo: 'Cancelado por el cliente: me equivoqué' }), expect.anything());
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.anything());
  });

  it('token ajeno: 404 y no anula', async () => {
    const { servicio, cambiar } = montar();
    await expect(servicio.cancelarPorToken('CP-0005', 'x'.repeat(64))).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_ENCONTRADO' } });
    expect(cambiar).not.toHaveBeenCalled();
  });

  it('celular distinto: 404', async () => {
    const { servicio, cambiar } = montar();
    await expect(servicio.cancelarPorTelefono('CP-0005', '51911111111')).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_ENCONTRADO' } });
    expect(cambiar).not.toHaveBeenCalled();
  });

  it('pagado o con voucher en revisión: 409 sin anular', async () => {
    for (const extra of [{ pago_estado: 'PAGADO' }, { _count: { cobros: 0, pagosOnline: 0, vouchers: 1, comandas: 0 } }]) {
      const { servicio, cambiar } = montar(fila(extra));
      await expect(servicio.cancelarPorToken('CP-0005', token)).rejects.toMatchObject({ response: { codigo: 'NO_CANCELABLE' } });
      expect(cambiar).not.toHaveBeenCalled();
    }
  });

  it('Caja lo aceptó justo antes (transición inválida): 409 claro', async () => {
    const cambiar = jest.fn().mockRejectedValue({ getResponse: () => ({ codigo: 'TRANSICION_INVALIDA' }) });
    const { servicio } = montar(fila(), cambiar);
    await expect(servicio.cancelarPorToken('CP-0005', token)).rejects.toMatchObject({ response: { codigo: 'NO_CANCELABLE', mensaje: expect.stringMatching(/Caja ya aceptó/) } });
  });
});
