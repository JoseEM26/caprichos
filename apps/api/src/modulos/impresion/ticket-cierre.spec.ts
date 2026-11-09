jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import 'reflect-metadata';
import { ImpresionService } from './impresion.service';
import { CierreController } from '../cierre/cierre.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

const ticket: any = { codigo: 'CZ-0012', local: { nombre: 'Caprichos' } };

describe('encolarTicketCierre', () => {
  const armar = (destino: { destino_equipo_id: bigint | null; destino_area_id: bigint | null }) => {
    const crear = jest.fn().mockResolvedValue({ id: 99n });
    const auditoria = { registrar: jest.fn() };
    const ctx: any = {
      prisma: { printJob: { count: jest.fn().mockResolvedValue(0), create: crear } },
      auditoria,
      eventos: { emitirAdmin: jest.fn() },
      reimpresionesRecientes: new Map(),
      contextoRuteo: jest.fn().mockResolvedValue({ equipos: [] }),
      destinoJob: jest.fn().mockReturnValue(destino),
    };
    return { ctx, crear, auditoria, llamar: () => ImpresionService.prototype.encolarTicketCierre.call(ctx, 12n, ticket, { partyId: 1n } as any, '1.1.1.1') };
  };

  it('encola un TICKET_CIERRE sin pedido, en la PC de Caja, y lo audita', async () => {
    const { llamar, crear, auditoria } = armar({ destino_equipo_id: 5n, destino_area_id: null });
    await llamar();
    expect(crear.mock.calls[0][0].data).toMatchObject({ pedido_id: null, tipo: 'TICKET_CIERRE', destino_equipo_id: 5n, copia: false });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REIMPRIMIR_TICKET_CIERRE' }));
  });

  it('sin PC que lo imprima avisa en vez de dejarlo perdido', async () => {
    const { llamar, crear } = armar({ destino_equipo_id: null, destino_area_id: null });
    await expect(llamar()).rejects.toMatchObject({ response: { codigo: 'SIN_IMPRESORA_CAJA' } });
    expect(crear).not.toHaveBeenCalled();
  });

  it('limita a 5 impresiones por minuto del mismo cierre', async () => {
    const { llamar } = armar({ destino_equipo_id: 5n, destino_area_id: null });
    for (let i = 0; i < 5; i++) await llamar();
    await expect(llamar()).rejects.toMatchObject({ response: { codigo: 'MUCHAS_REIMPRESIONES' } });
  });

  it('la ruta pide caja/ver (el servicio exige además administrador)', () => {
    expect(Reflect.getMetadata(CLAVE_PERMISO, CierreController.prototype.imprimir)).toEqual({ modulo: 'caja', accion: 'ver' });
  });
});
