jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
import 'reflect-metadata';
import { HistorialImpresionService } from './historial-impresion.service';
import { HistorialImpresionController } from './historial-impresion.controller';
import { datosOrigen, deducirOrigen, etiquetaTipoImpresion } from './origen-impresion';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

const base = { copia: false, estado: 'IMPRESO', intentos: 1, error: null, impresora: null, creado_en: new Date('2026-11-10T15:00:00Z'), impreso_en: null, device_key_id: null, destino_equipo_id: null, motivo_origen: null, solicitado_por_party_id: null, origen: null, pedido: null, payload: {} };
const fila = (o: any) => ({ ...base, id: 1n, pedido_id: 5n, tipo: 'ETIQUETA_BEBIDA', pedido: { codigo: 'CP-W021', cliente_nombre: 'SECRETO', total: 99 }, ...o });

function armar(filas: any[], extra: any = {}) {
  const prisma: any = {
    printJob: { count: jest.fn().mockResolvedValue(filas.length), findMany: jest.fn().mockResolvedValue(filas) },
    auditoria: { findMany: jest.fn().mockResolvedValue(extra.auditoria ?? []) },
    person: { findMany: jest.fn().mockResolvedValue([{ party_id: 9n, nombres: 'Ana', apellidos: 'Ruiz' }]) },
    userAccount: { findMany: jest.fn().mockResolvedValue([{ party_id: 9n, rol: 'CAJERO' }]) },
    deviceKey: { findMany: jest.fn().mockResolvedValue([{ id: 3n, nombre: 'Caja 1' }]) },
  };
  return { prisma, svc: new HistorialImpresionService(prisma) };
}

describe('deducirOrigen (filas anteriores a la columna)', () => {
  it('copia → REIMPRESION; sin pedido → PRUEBA; con pedido → AUTOMATICA; cierre → REIMPRESION', () => {
    expect(deducirOrigen({ copia: true, pedido_id: 1n })).toBe('REIMPRESION');
    expect(deducirOrigen({ copia: false, pedido_id: null, tipo: 'TICKET_PAGO', payload: { prueba: {} } })).toBe('PRUEBA');
    expect(deducirOrigen({ copia: false, pedido_id: 1n })).toBe('AUTOMATICA');
    expect(deducirOrigen({ copia: false, pedido_id: null, tipo: 'TICKET_CIERRE' })).toBe('REIMPRESION');
  });
  it('lo guardado manda sobre lo deducido', () => {
    expect(deducirOrigen({ origen: 'REINTENTO', copia: true, pedido_id: 1n })).toBe('REINTENTO');
  });
  it('datosOrigen guarda quién (o nada si fue el sistema)', () => {
    expect(datosOrigen('REIMPRESION', { partyId: 7n })).toEqual({ origen: 'REIMPRESION', solicitado_por_party_id: 7n, motivo_origen: null });
    expect(datosOrigen('AUTOMATICA').solicitado_por_party_id).toBeNull();
  });
  it('etiqueta legible', () => {
    expect(etiquetaTipoImpresion('ETIQUETA_BEBIDA')).toBe('Sticker · Bebida');
    expect(etiquetaTipoImpresion('TICKET_COMANDA_SALON')).toBe('Ticket · Comanda salón');
  });
});

describe('HistorialImpresionService.listar', () => {
  it('arma la fila con origen deducido, equipo y solo campos de impresión', async () => {
    const { svc } = armar([fila({ copia: true, destino_equipo_id: 3n, solicitado_por_party_id: 9n })]);
    const r = await svc.listar({});
    expect(r.datos[0]).toMatchObject({
      id: '1', pedidoId: '5', pedidoCodigo: 'CP-W021', tipo: 'ETIQUETA_BEBIDA', etiqueta: 'Sticker · Bebida', origen: 'REIMPRESION',
      solicitadoPor: { partyId: '9', nombre: 'Ana Ruiz', rol: 'CAJERO' }, equipo: { id: '3', nombre: 'Caja 1' }, copia: true,
    });
    expect(JSON.stringify(r.datos)).not.toMatch(/SECRETO|cliente|99/);
  });

  it('fila vieja de prueba: el quién sale de la auditoría; sin auditoría queda null', async () => {
    const vieja = fila({ id: 7n, pedido_id: null, pedido: null, tipo: 'ETIQUETA_GENERAL' });
    const { svc } = armar([vieja], { auditoria: [{ accion: 'IMPRESION_PRUEBA', entidad_id: 7n, despues: {}, party_id: 9n }] });
    expect((await svc.listar({})).datos[0]).toMatchObject({ origen: 'PRUEBA', solicitadoPor: { nombre: 'Ana Ruiz' } });
    const { svc: s2 } = armar([vieja]);
    expect((await s2.listar({})).datos[0].solicitadoPor).toBeNull();
  });

  it('reimpresión vieja: quién por trabajoIds de REIMPRIMIR_PEDIDO', async () => {
    const { svc } = armar([fila({ id: 8n, copia: true })], { auditoria: [{ accion: 'REIMPRIMIR_PEDIDO', entidad_id: 5n, despues: { trabajoIds: ['8', '9'] }, party_id: 9n }] });
    expect((await svc.listar({})).datos[0].solicitadoPor?.partyId).toBe('9');
  });

  it('automática no busca quién', async () => {
    const { svc, prisma } = armar([fila({})]);
    expect((await svc.listar({})).datos[0].solicitadoPor).toBeNull();
    expect(prisma.auditoria.findMany).not.toHaveBeenCalled();
  });

  it('filtros: día Lima, origen, tipo, estado, equipo y código sin tildes llegan al where', async () => {
    const { svc, prisma } = armar([]);
    await svc.listar({ desde: '2026-11-10', hasta: '2026-11-10', origen: 'reimpresion,prueba,basura', tipo: 'TICKET_PAGO', estado: ['FALLIDO'], equipoId: '3', q: 'cp-w021' });
    const w = JSON.stringify(prisma.printJob.findMany.mock.calls[0][0].where, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(w).toContain('2026-11-10T05:00:00.000Z'); // 00:00 Lima
    expect(w).toContain('2026-11-11T04:59:59.999Z'); // 23:59:59 Lima
    expect(w).toContain('"origen":"REIMPRESION"');
    expect(w).toContain('"origen":"PRUEBA"');
    expect(w).not.toContain('basura');
    expect(w).toContain('"tipo":{"in":["TICKET_PAGO"]}');
    expect(w).toContain('"estado":{"in":["FALLIDO"]}');
    expect(w).toContain('cp-w021');
  });

  it('paginación: límites permitidos, página mínima 1 y total de páginas', async () => {
    const { svc, prisma } = armar([]);
    prisma.printJob.count.mockResolvedValue(120);
    const r = await svc.listar({ pagina: '3', limite: '50' });
    expect(prisma.printJob.findMany.mock.calls[0][0]).toMatchObject({ skip: 100, take: 50 });
    expect(r).toMatchObject({ pagina: 3, limite: 50, paginas: 3, total: 120 });
    await svc.listar({ pagina: '-4', limite: '7' });
    expect(prisma.printJob.findMany.mock.calls[1][0]).toMatchObject({ skip: 0, take: 25 });
  });

  it('resumen por origen y por estado', async () => {
    const { svc, prisma } = armar([]);
    prisma.printJob.count.mockResolvedValue(2);
    const r = await svc.listar({});
    expect(Object.keys(r.resumen.origen)).toEqual(['AUTOMATICA', 'REIMPRESION', 'PRUEBA', 'REINTENTO']);
    expect(r.resumen.estado.FALLIDO).toBe(2);
  });

  it('id de equipo no válido → 400', async () => {
    const { svc } = armar([]);
    await expect(svc.listar({ equipoId: 'x' })).rejects.toMatchObject({ response: { codigo: 'ID_INVALIDO' } });
  });
});

describe('HistorialImpresionService.deUnPedido', () => {
  it('lista las impresiones del pedido', async () => {
    const { svc, prisma } = armar([fila({ origen: 'REINTENTO', motivo_origen: 'era AUTOMATICA' })]);
    const r = await svc.deUnPedido('5');
    expect(prisma.printJob.findMany.mock.calls[0][0].where).toEqual({ pedido_id: 5n });
    expect(r.datos[0]).toMatchObject({ origen: 'REINTENTO', motivo: 'era AUTOMATICA' });
    await expect(svc.deUnPedido('zz')).rejects.toBeDefined();
  });
});

describe('permisos', () => {
  it('ambas rutas piden pedidos/ver, igual que la cola', () => {
    for (const m of ['listar', 'deUnPedido'] as const) {
      expect(Reflect.getMetadata(CLAVE_PERMISO, HistorialImpresionController.prototype[m])).toEqual({ modulo: 'pedidos', accion: 'ver' });
    }
  });
});
