// Mock de EventosGateway
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ComprobantesReintentosService } from './comprobantes-reintentos.service';

describe('ComprobantesReintentosService (tarea de reenvío)', () => {
  const comprobantes = { barrerPedidosSinComprobante: jest.fn().mockResolvedValue({ creados: 0, encontrados: 0 }), reintentarPendientes: jest.fn().mockResolvedValue({ revisados: 2 }) };

  beforeEach(() => jest.clearAllMocks());

  it('con el candado tomado por otro contenedor no reenvía', async () => {
    const redis = { obtenerCliente: () => ({ set: jest.fn().mockResolvedValue(null), eval: jest.fn() }) } as any;
    const svc = new ComprobantesReintentosService(comprobantes as any, redis);
    expect(await svc.ejecutar()).toEqual({ revisados: 0, motivo: 'OTRO_CONTENEDOR' });
    expect(comprobantes.reintentarPendientes).not.toHaveBeenCalled();
  });

  it('con el candado libre revisa los pendientes y libera el candado', async () => {
    const eval_ = jest.fn().mockResolvedValue(1);
    const redis = { obtenerCliente: () => ({ set: jest.fn().mockResolvedValue('OK'), eval: eval_ }) } as any;
    const svc = new ComprobantesReintentosService(comprobantes as any, redis);
    expect(await svc.ejecutar()).toEqual({ revisados: 2 });
    expect(comprobantes.reintentarPendientes).toHaveBeenCalledTimes(1);
    expect(eval_).toHaveBeenCalled();
  });
});
