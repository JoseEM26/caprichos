jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));

import { HttpStatus } from '@nestjs/common';
import { ImpresionService } from './impresion.service';
import { AdminImpresionController } from './admin-impresion.controller';
import { empaquetarDetalleLatido, estadoPorRol, leerCandidatasLatido, claveSeleccion } from './estado-impresion';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const candidatas = [
  { id: 'TSC 4B-2054TH|123', nombre: 'TSC 4B-2054TH', sugerido: 'ETIQUETERA' },
  { id: 'POS-80', nombre: 'POS-80', sugerido: 'TICKETERA' },
];

describe('pruebas dirigidas y elección de impresora', () => {
  let service: ImpresionService;
  let prisma: any;
  let auditoria: any;
  const usuario = { partyId: 7n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
  const agente = (extra: any = {}) => ({
    id: 5n,
    area_id: null,
    ultimo_latido: new Date(),
    latido_detalle: empaquetarDetalleLatido(null, [], candidatas as any),
    ...extra,
  });

  beforeEach(() => {
    prisma = {
      printJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(async ({ data }) => ({ id: 42n, ...data })),
      },
      deviceKey: { findFirst: jest.fn().mockResolvedValue(agente()), findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      parametro: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      party: { findUnique: jest.fn().mockResolvedValue({ persona: { nombres: 'Ana' } }) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new ImpresionService(prisma, auditoria);
  });

  it('encola una prueba dirigida con la impresora concreta y la audita', async () => {
    await service.encolarPrueba('TICKETERA', usuario as any, '1.1.1.1', 'POS-80');
    const data = prisma.printJob.create.mock.calls[0][0].data;
    expect(data.tipo).toBe('TICKET_PAGO');
    expect(data.pedido_id).toBeNull();
    expect(data.payload.prueba).toEqual({ impresoraId: 'POS-80', nombre: 'POS-80' });
    expect(auditoria.registrar.mock.calls[0][0].despues).toEqual({ rol: 'TICKETERA', impresora: 'POS-80' });
  });

  it('rechaza la prueba dirigida si el programa no está conectado', async () => {
    prisma.deviceKey.findFirst.mockResolvedValue(agente({ ultimo_latido: new Date(Date.now() - 5 * 60 * 1000) }));
    await expect(service.encolarPrueba('ETIQUETERA', usuario as any, undefined, 'POS-80')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    expect(prisma.printJob.create).not.toHaveBeenCalled();
  });

  it('rechaza si el programa es viejo (no informa impresoras) para no imprimir en otra por error', async () => {
    prisma.deviceKey.findFirst.mockResolvedValue(agente({ latido_detalle: null }));
    await expect(service.encolarPrueba('ETIQUETERA', usuario as any, undefined, 'POS-80')).rejects.toMatchObject({
      response: { codigo: 'PROGRAMA_SIN_LISTA' },
    });
  });

  it('rechaza una impresora que no está en la lista del equipo', async () => {
    await expect(service.encolarPrueba('ETIQUETERA', usuario as any, undefined, 'FAX')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
  });

  it('elegirImpresora guarda por equipo y por rol, conserva la otra y audita', async () => {
    prisma.parametro.findUnique.mockResolvedValue({ valor: { TICKETERA: 'POS-80' } });
    const r = await service.elegirImpresora('ETIQUETERA', 'TSC 4B-2054TH|123', usuario as any, '1.1.1.1');
    const llamada = prisma.parametro.upsert.mock.calls[0][0];
    expect(llamada.where.clave).toBe(claveSeleccion(5n));
    expect(llamada.update.valor).toEqual({ TICKETERA: 'POS-80', ETIQUETERA: 'TSC 4B-2054TH|123' });
    expect(r.mensaje).toContain('TSC 4B-2054TH');
    expect(auditoria.registrar.mock.calls[0][0].accion).toBe('IMPRESORA_ELEGIDA');
  });

  it('elegirImpresora rechaza una impresora que el programa no ve', async () => {
    await expect(service.elegirImpresora('ETIQUETERA', 'otra', usuario as any)).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(prisma.parametro.upsert).not.toHaveBeenCalled();
  });

  it('el latido guarda las candidatas y responde con lo elegido', async () => {
    prisma.parametro.findUnique.mockResolvedValue({ valor: { ETIQUETERA: 'x' } });
    const r = await service.registrarLatido(
      { version: '1', impresora: 'lista', impresoras: [{ rol: 'ETIQUETERA', estado: 'lista', id: 'x', nombre: 'X' }], candidatas: candidatas as any },
      5n,
    );
    expect(r).toMatchObject({ seleccion: { ETIQUETERA: 'x' } });
    const guardado = prisma.deviceKey.update.mock.calls[0][0].data.latido_detalle;
    expect(leerCandidatasLatido(guardado)).toHaveLength(2);
  });

  it('un latido sin elección solo trae la configuración de la PC (una PC sin configurar no imprime)', async () => {
    expect(await service.registrarLatido({ version: '1', impresora: 'lista' }, 5n)).toEqual({
      equipo: { ticketera: false, etiquetera: false, pausado: false, configurado: false, tamanoGeneral: null, tamanoBebida: null },
    });
  });

  it('una prueba dirigida que falla pasa a FALLIDO de inmediato con su motivo (no se reintenta sola)', async () => {
    prisma.printJob.findUnique.mockResolvedValue({ id: 9n, estado: 'IMPRIMIENDO', intentos: 0, payload: { prueba: { impresoraId: 'POS-80' } } });
    await service.registrarResultado({ id: '9', ok: false, error: 'Impresora no encontrada: POS-80' } as any);
    expect(prisma.printJob.update.mock.calls[0][0].data).toMatchObject({ estado: 'FALLIDO', error: 'Impresora no encontrada: POS-80' });
  });

  it('el estado por rol trae qué impresora se usa', () => {
    const e = estadoPorRol({
      ultimo_latido: new Date(),
      latido_impresora: 'lista',
      latido_detalle: empaquetarDetalleLatido(null, [{ rol: 'ETIQUETERA', estado: 'lista', id: 'a', nombre: 'A' }]),
    });
    expect(e.ETIQUETERA).toMatchObject({ conectada: true, impresoraId: 'a', impresoraNombre: 'A' });
  });

  it('con equipoId apunta a ESA computadora (PC de bebidas) y la prueba espera en la cola de su área', async () => {
    prisma.deviceKey.findFirst.mockResolvedValue(agente({ id: 8n, area_id: 3n }));
    await service.encolarPrueba('ETIQUETERA', usuario as any, undefined, 'TSC 4B-2054TH|123', '8');
    expect(prisma.deviceKey.findFirst.mock.calls[0][0].where).toMatchObject({ id: 8n });
    expect(prisma.printJob.create.mock.calls[0][0].data.destino_area_id).toBe(3n);
  });

  it('el estado trae cada computadora con su cola y avisa la que está apagada', async () => {
    prisma.deviceKey.findFirst.mockResolvedValue(agente());
    prisma.deviceKey.findMany = jest.fn().mockResolvedValue([
      agente({ id: 1n, nombre: 'PC Caja' }),
      agente({ id: 2n, nombre: 'PC Bebidas', area_id: 3n, area: { nombre: 'Bebidas' }, ultimo_latido: new Date(Date.now() - 10 * 60 * 1000) }),
    ]);
    prisma.printJob.count = jest.fn().mockResolvedValue(4);
    const e = await service.obtenerEstadoAdmin();
    expect(e.equipos).toHaveLength(2);
    expect(e.equipos![0]).toMatchObject({ nombre: 'PC Caja', conectado: true });
    expect(e.equipos![1]).toMatchObject({ nombre: 'PC Bebidas', areaNombre: 'Bebidas', conectado: false, candidatas: [], pendientes: 4 });
    expect(e.equipos![1].impresoras.ETIQUETERA.estado).toBe('sin_programa');
  });

  it('el controlador exige configuracion/editar para elegir y pasa la impresora a la prueba', async () => {
    const meta = Reflect.getMetadata('permiso', AdminImpresionController.prototype.elegirImpresora);
    expect(meta).toEqual({ modulo: 'configuracion', accion: 'editar' });
    const prueba = jest.fn().mockResolvedValue({ ok: true });
    await new AdminImpresionController({ encolarPrueba: prueba } as any).pruebaImpresion(
      { rol: 'ETIQUETERA', impresoraId: 'a' },
      { usuario, ip: '1' },
    );
    expect(prueba).toHaveBeenCalledWith('ETIQUETERA', usuario, '1', 'a', undefined);
  });
});

describe('probar TODAS', () => {
  const usuario = { partyId: 7n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
  const conAgente = (lista: any[], printJob: any) => ({
    printJob,
    deviceKey: { findFirst: jest.fn().mockResolvedValue({ id: 5n, area_id: null, ultimo_latido: new Date(), latido_detalle: empaquetarDetalleLatido(null, [], lista as any) }) },
    parametro: { findUnique: jest.fn().mockResolvedValue(null) },
  });

  it('encola una hoja por impresora con su número; la de rol desconocido recibe etiqueta y ticket', async () => {
    const lista = [
      { id: 'A', nombre: 'A', sugerido: 'ETIQUETERA' },
      { id: 'B', nombre: 'B', sugerido: 'TICKETERA' },
      { id: 'C', nombre: 'C' },
    ];
    const prisma: any = conAgente(lista, {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => ({ id: 1n, ...data })),
    });
    const auditoria = { registrar: jest.fn() };
    const r = await new ImpresionService(prisma, auditoria as any).encolarPruebaTodas(usuario as any);
    const datos = prisma.printJob.create.mock.calls.map((c: any) => c[0].data);
    expect(r.total).toBe(3);
    expect(datos.map((d: any) => d.tipo)).toEqual(['ETIQUETA_GENERAL', 'TICKET_PAGO', 'ETIQUETA_GENERAL', 'TICKET_PAGO']);
    expect(datos[1].payload.prueba).toEqual({ impresoraId: 'B', nombre: 'B', marca: 'Impresora 2 de 3' });
    expect(auditoria.registrar.mock.calls[0][0].accion).toBe('IMPRESION_PRUEBA_TODAS');
  });

  it('limita la frecuencia y exige un programa conectado', async () => {
    const prisma: any = conAgente([{ id: 'A', nombre: 'A' }], { findFirst: jest.fn().mockResolvedValue({ id: 1n }), create: jest.fn() });
    await expect(new ImpresionService(prisma, undefined as any).encolarPruebaTodas(usuario as any)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    prisma.deviceKey.findFirst.mockResolvedValue(null);
    await expect(new ImpresionService(prisma, undefined as any).encolarPruebaTodas(usuario as any)).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
  });
});
