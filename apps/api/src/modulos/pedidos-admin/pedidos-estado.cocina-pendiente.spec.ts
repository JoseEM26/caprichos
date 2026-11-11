// El gateway importa @nestjs/jwt (ESM): en las pruebas basta con un doble
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { readFileSync } from 'fs';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { PedidosEstadoService } from './pedidos-estado.service';
import { SalonService } from '../salon/salon.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { ComandasService } from '../cocina/comandas.service';

const admin: any = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };
const cajero: any = { partyId: 2n, rol: 'CAJERO', debeCambiar: false };
const cajeroConExtra: any = { partyId: 4n, rol: 'CAJERO', roles: ['CAJERO', 'MOZO'], debeCambiar: false };

const area = (id: bigint, nombre: string) => ({ area_id: id, area: { nombre } });

describe('Cocina manda: LISTO y ENTREGADO exigen comandas despejadas', () => {
  let service: PedidosEstadoService;
  let prisma: any;
  let auditoria: any;
  let comandas: any;
  let pedido: any;

  beforeEach(async () => {
    pedido = { id: 10n, codigo: 'CP-T001', modalidad: 'MESA', estado: 'COLA', repartidor_party_id: null, pasa_cocina_en: null };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: { findUnique: jest.fn(async () => pedido), update: jest.fn(async ({ data }: any) => ({ ...pedido, ...data })) },
      pedidoEstadoHistorial: { create: jest.fn() },
      comandaArea: { findMany: jest.fn().mockResolvedValue([]) },
      rolPermiso: { findFirst: jest.fn() },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    comandas = { despejar: jest.fn().mockResolvedValue({ ok: true }) };
    const m = await Test.createTestingModule({
      providers: [
        PedidosEstadoService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({}) } },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        { provide: SalonService, useValue: { avisarListo: jest.fn() } },
        { provide: ComandasService, useValue: comandas },
      ],
    }).compile();
    service = m.get(PedidosEstadoService);
  });

  const pendientes = (...a: Array<[bigint, string]>) => prisma.comandaArea.findMany.mockResolvedValue(a.map(([i, n]) => area(i, n)));

  it.each([
    ['MESA', 'COLA', 'LISTO'],
    ['LLEVAR', 'PREPARANDO', 'LISTO'],
    ['RECOGER', 'COLA', 'LISTO'],
    ['DELIVERY', 'PREPARANDO', 'LISTO'],
    ['MESA', 'LISTO', 'ENTREGADO'],
    ['RECOGER', 'LISTO', 'ENTREGADO'],
  ])('%s %s -> %s con áreas pendientes: 409 COCINA_PENDIENTE con áreas', async (modalidad, desde, hacia) => {
    Object.assign(pedido, { modalidad, estado: desde, zona_id: 1n, entrega_lat: -12, entrega_lng: -77 });
    pendientes([1n, 'Cocina caliente'], [2n, 'Bebidas']);
    const err: any = await service.cambiarEstado(10n, { estado: hacia }, cajero).catch((e) => e);
    expect(err.getStatus()).toBe(409);
    const cuerpo = err.getResponse();
    expect(cuerpo.codigo).toBe('COCINA_PENDIENTE');
    expect(cuerpo.areasPendientes).toEqual(['Cocina caliente', 'Bebidas']);
    expect(cuerpo.mensaje).toContain('faltan Cocina caliente y Bebidas');
    expect(cuerpo.mensaje).toContain('Pídele a Cocina que pulse “Listo”');
    expect(cuerpo.mensaje).not.toContain('administrador');
    expect(prisma.pedido.update).not.toHaveBeenCalled();
    expect(comandas.despejar).not.toHaveBeenCalled();
  });

  it('una sola área pendiente usa «falta» y una sola consulta', async () => {
    pendientes([2n, 'Bebidas']);
    const err: any = await service.cambiarEstado(10n, { estado: 'LISTO' }, cajero).catch((e) => e);
    expect(err.getResponse().mensaje).toContain('falta Bebidas');
    expect(prisma.comandaArea.findMany).toHaveBeenCalledTimes(1);
  });

  it('el mensaje al administrador añade la opción de forzar', async () => {
    pendientes([2n, 'Bebidas']);
    const err: any = await service.cambiarEstado(10n, { estado: 'LISTO' }, admin).catch((e) => e);
    expect(err.getResponse().mensaje).toContain('forzarlo');
    expect(err.getResponse().puedeForzar).toBe(true);
  });

  it('sin comandas (ningún producto va a cocina) no bloquea', async () => {
    const r = await service.cambiarEstado(10n, { estado: 'LISTO' }, cajero);
    expect(r.estado).toBe('LISTO');
  });

  it('con todas despejadas no bloquea (la consulta solo trae EN_COCINA)', async () => {
    pedido.estado = 'LISTO';
    await service.cambiarEstado(10n, { estado: 'ENTREGADO' }, cajero);
    expect(prisma.comandaArea.findMany.mock.calls[0][0].where).toEqual({ pedido_id: 10n, estado: 'EN_COCINA' });
    expect(prisma.pedido.update).toHaveBeenCalled();
  });

  it('un pedido anulado queda fuera de la regla', async () => {
    pendientes([1n, 'Cocina caliente']);
    await service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Cliente se fue' }, admin).catch(() => undefined);
    expect(prisma.comandaArea.findMany).not.toHaveBeenCalled();
  });

  it('PREPARANDO no se revisa (solo LISTO y ENTREGADO)', async () => {
    pendientes([1n, 'Cocina caliente']);
    const r = await service.cambiarEstado(10n, { estado: 'PREPARANDO' }, cajero);
    expect(r.estado).toBe('PREPARANDO');
  });

  describe('forzar como administrador', () => {
    it('con motivo: despeja las pendientes con la lógica de Cocina, cambia el estado y audita', async () => {
      pendientes([1n, 'Cocina caliente'], [2n, 'Bebidas']);
      const r = await service.cambiarEstado(10n, { estado: 'LISTO', forzar: true, motivo: 'Cocina se quedó sin pantalla' }, admin, '1.2.3.4');
      expect(r.estado).toBe('LISTO');
      expect(comandas.despejar).toHaveBeenCalledTimes(2);
      expect(comandas.despejar).toHaveBeenCalledWith(10n, 1n, admin, '1.2.3.4');
      expect(comandas.despejar).toHaveBeenCalledWith(10n, 2n, admin, '1.2.3.4');
      const forzado = auditoria.registrar.mock.calls.map((c: any[]) => c[0]).find((a: any) => a.accion === 'PEDIDO_FORZAR_SIN_COCINA');
      expect(forzado).toMatchObject({
        entidadId: 10n,
        partyId: 1n,
        motivo: 'Cocina se quedó sin pantalla',
        antes: { estado: 'COLA' },
        despues: { estado: 'LISTO', areasPendientes: ['Cocina caliente', 'Bebidas'] },
      });
    });

    it('sin motivo o con motivo corto: 400 y no cambia nada', async () => {
      pendientes([1n, 'Cocina caliente']);
      for (const motivo of [undefined, '', '  corto ']) {
        const err: any = await service.cambiarEstado(10n, { estado: 'LISTO', forzar: true, motivo }, admin).catch((e) => e);
        expect(err.getStatus()).toBe(400);
        expect(err.getResponse().codigo).toBe('MOTIVO_REQUERIDO');
      }
      expect(comandas.despejar).not.toHaveBeenCalled();
      expect(prisma.pedido.update).not.toHaveBeenCalled();
    });

    it('un no administrador con forzar:true recibe 403 aunque manipule la petición', async () => {
      pendientes([1n, 'Cocina caliente']);
      const err: any = await service.cambiarEstado(10n, { estado: 'LISTO', forzar: true, motivo: 'Motivo bien largo' }, cajero).catch((e) => e);
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse().codigo).toBe('FORZAR_SOLO_ADMIN');
      expect(comandas.despejar).not.toHaveBeenCalled();
      expect(prisma.pedido.update).not.toHaveBeenCalled();
    });

    it('roles combinados sin ADMIN (cajero + mozo) siguen bloqueados y no pueden forzar', async () => {
      pendientes([1n, 'Cocina caliente']);
      const e1: any = await service.cambiarEstado(10n, { estado: 'LISTO' }, cajeroConExtra).catch((e) => e);
      expect(e1.getResponse().codigo).toBe('COCINA_PENDIENTE');
      const e2: any = await service.cambiarEstado(10n, { estado: 'LISTO', forzar: true, motivo: 'Motivo bien largo' }, cajeroConExtra).catch((e) => e);
      expect(e2.getStatus()).toBe(403);
    });

    it('forzar sin pendientes no despeja ni deja auditoría de forzado', async () => {
      await service.cambiarEstado(10n, { estado: 'LISTO', forzar: true, motivo: 'Motivo bien largo' }, admin);
      expect(comandas.despejar).not.toHaveBeenCalled();
      expect(auditoria.registrar.mock.calls.some((c: any[]) => c[0].accion === 'PEDIDO_FORZAR_SIN_COCINA')).toBe(false);
    });
  });

  it('despejar sigue permitido con el pedido ya entregado (no pasa por esta regla)', async () => {
    // la regla vive solo en cambiarEstado: ComandasService.despejar no la llama
    const fuente = readFileSync(join(__dirname, '../cocina/comandas.service.ts'), 'utf8');
    expect(fuente).not.toContain('exigirCocinaDespejada');
  });
});
