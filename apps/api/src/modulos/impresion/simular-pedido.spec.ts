jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));
jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { ImpresionService } from './impresion.service';
import { configAFila } from './equipo-config';
import { CONFIG_EQUIPO_NUEVO } from './ruteo-impresion';
import { construirPedidoSimulado } from './simulacion-pedido';
import { construirEtiquetasBebida, construirEtiquetaGeneral } from './constructor-etiquetas';

const areas = [
  { id: 1n, nombre: 'Bebidas' },
  { id: 2n, nombre: 'Dulces' },
  { id: 3n, nombre: 'Salados' },
];
const caja = {
  ...CONFIG_EQUIPO_NUEVO,
  configurado: true,
  ticketera: true,
  etiquetera: true,
  ticketPago: true,
  comandaSalon: true,
  stickerGeneral: true,
  stickerAreas: ['2', '3'],
  stickerBebidaAreas: ['1'],
};
const dev = (id: number, nombre: string, config: any, extra: any = {}) => ({
  id: BigInt(id),
  nombre,
  tipo: 'AGENTE',
  activo: true,
  area_id: null,
  ultimo_latido: new Date(),
  configImpresion: { device_key_id: BigInt(id), ...configAFila(config) },
  ...extra,
});

function armar(devices: any[]) {
  const creados: any[] = [];
  const prisma: any = {
    deviceKey: { findMany: async () => devices },
    areaCocina: { findMany: async () => areas },
    parametro: { findUnique: async () => null, findMany: async () => [] },
    equipoImpresionConfig: { create: async () => ({}) },
    printJob: {
      create: async ({ data }: any) => {
        creados.push(data);
        return { id: BigInt(creados.length) };
      },
    },
    pedido: { create: jest.fn(), findUnique: jest.fn() },
    cobro: { create: jest.fn() },
    stockMovimiento: { create: jest.fn() },
  };
  const auditoria = { registrar: jest.fn() };
  return { svc: new ImpresionService(prisma, auditoria as any), creados, auditoria, prisma };
}
const admin: any = { partyId: 1n, rol: 'ADMIN', roles: ['ADMIN'] };

describe('simular un pedido completo', () => {
  it('Para llevar: encola exactamente lo que dice la configuración, marcado como simulación y sin pedido', async () => {
    const { svc, creados, auditoria, prisma } = armar([dev(1, 'Caja', caja)]);
    const r = await svc.simularPedido('LLEVAR', admin, '1.1.1.1');
    const tipos = creados.map((j) => j.tipo).sort();
    expect(tipos).toEqual(
      ['ETIQUETA_AREA', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'ETIQUETA_BEBIDA', 'ETIQUETA_GENERAL', 'TICKET_PAGO'].sort(),
    );
    expect(creados.every((j) => j.pedido_id === null && j.payload.simulacion === true && j.destino_equipo_id === 1n)).toBe(true);
    expect(r.total).toBe(6);
    expect(r.mensaje).toContain('Se enviaron 6 trabajos');
    expect(r.enviados.find((g) => g.maquina === 'Ticketera')?.trabajos).toEqual(['boleta']);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'SIMULAR_PEDIDO' }));
    // nada de una venta real
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.cobro.create).not.toHaveBeenCalled();
    expect(prisma.stockMovimiento.create).not.toHaveBeenCalled();
  });

  it('En mesa: sin sticker general (regla vigente) y con comanda de salón', async () => {
    const { svc, creados } = armar([dev(1, 'Caja', caja)]);
    await svc.simularPedido('MESA', admin);
    const tipos = creados.map((j) => j.tipo);
    expect(tipos).not.toContain('ETIQUETA_GENERAL');
    expect(tipos).toContain('TICKET_COMANDA_SALON');
    expect(creados.find((j) => j.tipo === 'TICKET_PAGO').payload.entrega).toBe('Mesa 4');
  });

  it('respeta el destino por PC y las PC sin configurar no reciben nada (se dice por qué)', async () => {
    const barra = { ...CONFIG_EQUIPO_NUEVO, configurado: true, etiquetera: true, stickerBebidaAreas: ['1'] };
    const { svc, creados } = armar([
      dev(1, 'Caja', { ...caja, stickerBebidaAreas: [] }),
      dev(2, 'Barra', barra),
      dev(3, 'Nueva', CONFIG_EQUIPO_NUEVO),
    ]);
    const r = await svc.simularPedido('LLEVAR', admin);
    expect(creados.filter((j) => j.tipo === 'ETIQUETA_BEBIDA').every((j) => j.destino_equipo_id === 2n)).toBe(true);
    expect(creados.every((j) => j.destino_equipo_id !== 3n)).toBe(true);
    expect(r.noRecibieron).toEqual([expect.objectContaining({ equipo: 'Nueva', motivo: 'sin configurar' })]);
  });

  it('sin ninguna PC configurada no encola nada y lo dice', async () => {
    const { svc, creados } = armar([dev(3, 'Nueva', CONFIG_EQUIPO_NUEVO)]);
    const r = await svc.simularPedido('LLEVAR', admin);
    expect(creados).toHaveLength(0);
    expect(r.mensaje).toContain('No se envió nada');
    expect(r.sinReceptor).toContain('boleta');
  });

  it('solo ADMIN o CAJERO; modalidad inválida se rechaza', async () => {
    const { svc } = armar([dev(1, 'Caja', caja)]);
    await expect(svc.simularPedido('LLEVAR', { rol: 'MOZO', roles: ['MOZO'] } as any)).rejects.toMatchObject({ response: { codigo: 'SIN_PERMISO_DESCARTAR' } });
    await expect(svc.simularPedido('X', admin)).rejects.toMatchObject({ response: { codigo: 'MODALIDAD_INVALIDA' } });
    await expect(svc.simularPedido('LLEVAR', { rol: 'CAJERO', roles: ['CAJERO'] } as any)).resolves.toMatchObject({ ok: true });
  });

  it('el ejemplo lleva PRUEBA en el nombre (el nombre manda en el sticker) y usa las mismas etiquetas que una venta', () => {
    const p = construirPedidoSimulado('DELIVERY', areas);
    expect(p.cliente_nombre).toBe('PRUEBA · Miguel');
    expect(p.codigo).toBe('PRUEBA');
    const bebidas = construirEtiquetasBebida(p);
    expect(bebidas).toHaveLength(2);
    expect(bebidas[0]).toMatchObject({ bebidaNombre: 'Cappuccino', tamano: '12 oz', contiene: 'Leche de almendras, Canela' });
    const g = construirEtiquetaGeneral(p);
    expect(g.direccion).toContain('Ficticia');
    expect(g.who).toContain('PRUEBA');
  });
});
