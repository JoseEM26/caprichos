import { ConflictException, NotFoundException } from '@nestjs/common';
import { DespachoService } from './despacho.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

const usuario = { partyId: 7n, rol: 'COCINA' } as UsuarioAutenticado;
const linea = (id: bigint, area: bigint, nombre: string) => ({
  id, nombre, cantidad: 1, listas: 0, despachadas: 0, area_id: area, producto: null, opcionesElegidas: [], sabores: [],
});
const pedido = (extra: any = {}) => ({
  id: 1n, codigo: 'P-1', modalidad: 'MESA', estado: 'COLA', cliente_nombre: 'Ana', creado_en: new Date(Date.now() - 10 * 60000),
  atendido_despacho_en: null, atendido_despacho_por: null,
  comandas: [
    { area_id: 1n, estado: 'DESPEJADA', area: { nombre: 'Cocina' } },
    { area_id: 2n, estado: 'EN_COCINA', area: { nombre: 'Bar' } },
  ],
  lineas: [linea(10n, 1n, 'Pizza'), linea(11n, 2n, 'Jugo')],
  ...extra,
});

describe('DespachoService', () => {
  let prisma: any, auditoria: any, eventos: any, comandas: any, service: DespachoService;
  beforeEach(() => {
    prisma = {
      pedido: { findMany: jest.fn().mockResolvedValue([pedido()]), findUnique: jest.fn(), update: jest.fn() },
      person: { findMany: jest.fn().mockResolvedValue([{ party_id: 7n, nombres: 'Luis', apellidos: 'P' }]) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(true) };
    eventos = { emitirAdmin: jest.fn() };
    comandas = { sincronizarPendientes: jest.fn(), obtenerUmbrales: jest.fn().mockResolvedValue({ naranjaMin: 35, rojoMin: 50 }) };
    service = new DespachoService(prisma, auditoria, comandas, eventos);
  });

  it('agrupa por área; con un área pendiente el pedido NO está completo', async () => {
    const r = await service.listar();
    const p = r.pedidos[0];
    expect(p.areas.map((a) => [a.areaNombre, a.listo, a.lineas.map((l) => l.nombre)])).toEqual([
      ['Cocina', true, ['Pizza']],
      ['Bar', false, ['Jugo']],
    ]);
    expect(p.completo).toBe(false);
    expect(p.minutos).toBeGreaterThanOrEqual(10);
  });

  it('la mesa del pedido viaja en el listado de despacho', async () => {
    prisma.pedido.findMany.mockResolvedValue([pedido({ mesa_nombre: 'Mesas 4 y 5' })]);
    expect((await service.listar()).pedidos[0].mesa).toBe('Mesas 4 y 5');
  });

  it('completo cuando todas las áreas están listas', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      pedido({
        comandas: [
          { area_id: 1n, estado: 'DESPEJADA', area: { nombre: 'Cocina' } },
          { area_id: 2n, estado: 'DESPEJADA', area: { nombre: 'Bar' } },
        ],
      }),
    ]);
    expect((await service.listar()).pedidos[0].completo).toBe(true);
  });

  it('por defecto solo lista pedidos En despacho (COLA/PREPARANDO); con el filtro suma los ya despachados', async () => {
    await service.listar();
    expect(prisma.pedido.findMany.mock.calls[0][0].where.estado).toEqual({ in: ['COLA', 'PREPARANDO'] });
    prisma.pedido.findMany.mockResolvedValue([pedido({ estado: 'LISTO', listo_en: new Date() })]);
    const r = await service.listar(true);
    expect(prisma.pedido.findMany.mock.calls[1][0].where.estado).toEqual({ notIn: ['ANULADO', 'RECHAZADO'] });
    expect(r.pedidos[0]).toMatchObject({ despachado: true, estado: 'LISTO', atendido: true });
  });

  it('un área con todas sus líneas despachadas (despacho parcial) viene marcada despachada', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      pedido({ lineas: [{ ...linea(10n, 1n, 'Pizza'), despachadas: 1 }, linea(11n, 2n, 'Jugo')] }),
    ]);
    const p = (await service.listar()).pedidos[0];
    expect(p.areas.map((a) => [a.areaNombre, a.despachada])).toEqual([['Cocina', true], ['Bar', false]]);
    expect(p.despachado).toBe(false);
  });

  it('marcar atendido guarda quién/cuándo, audita y avisa', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'P-1', estado: 'COLA', atendido_despacho_en: null });
    const r = await service.marcarAtendido('1', true, usuario);
    expect(r).toMatchObject({ ok: true, atendido: true, cambio: true });
    expect(prisma.pedido.update.mock.calls[0][0].data.atendido_despacho_por).toBe(7n);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DESPACHO_ATENDIDO', partyId: 7n }));
    expect(eventos.emitirAdmin).toHaveBeenCalled();
  });

  it('es idempotente: repetir no cambia ni audita', async () => {
    const antes = new Date();
    prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'P-1', estado: 'COLA', atendido_despacho_en: antes });
    const r = await service.marcarAtendido('1', true, usuario);
    expect(r).toMatchObject({ cambio: false, atendido_en: antes });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('desmarcar limpia quién y cuándo', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'P-1', estado: 'COLA', atendido_despacho_en: new Date() });
    await service.marcarAtendido('1', false, usuario);
    expect(prisma.pedido.update.mock.calls[0][0].data).toEqual({ atendido_despacho_en: null, atendido_despacho_por: null });
  });

  it('pedido inexistente o anulado: error', async () => {
    prisma.pedido.findUnique.mockResolvedValue(null);
    await expect(service.marcarAtendido('9', true, usuario)).rejects.toThrow(NotFoundException);
    await expect(service.marcarAtendido('abc', true, usuario)).rejects.toThrow(NotFoundException);
    prisma.pedido.findUnique.mockResolvedValue({ id: 1n, estado: 'ANULADO', atendido_despacho_en: null });
    await expect(service.marcarAtendido('1', true, usuario)).rejects.toThrow(ConflictException);
  });
});
