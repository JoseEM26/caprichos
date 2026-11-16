jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { AvisosManualesService } from '../servicios/avisos-manuales.service';
import { PoliticaEvolutionService } from '../evolution/politica-evolution.service';
import { EvolutionConfigService } from '../evolution/evolution-config.service';

// Paridad Meta/Evolution: la ventana de 24 h del aviso del pedido, lo que puede escribir una persona y los avisos pendientes
// de enviar a mano. Datos inventados.

const configEvolution = (proveedor: 'EVOLUTION' | 'META') => ({ proveedor: jest.fn(async () => proveedor) }) as unknown as EvolutionConfigService;

describe('Ventana24hService.puedeEscribirPersona', () => {
  const crear = (proveedor: 'EVOLUTION' | 'META', entrante: boolean) => {
    const prisma: any = { whatsappMensaje: { findFirst: jest.fn(async () => (entrante ? { id: 1n } : null)) }, mensajeChat: { findFirst: jest.fn(async () => null) } };
    return new Ventana24hService(prisma, {} as any, undefined, configEvolution(proveedor));
  };
  it('con Evolution una persona escribe siempre, aunque el cliente no haya escrito en 24 h', async () => {
    expect(await crear('EVOLUTION', false).puedeEscribirPersona('51900000001')).toBe(true);
  });
  it('con Meta sigue la ventana de 24 h (no se rompe Meta)', async () => {
    expect(await crear('META', false).puedeEscribirPersona('51900000001')).toBe(false);
    expect(await crear('META', true).puedeEscribirPersona('51900000001')).toBe(true);
  });
  it('sin servicio de Evolution cae a la ventana de Meta', async () => {
    const prisma: any = { whatsappMensaje: { findFirst: jest.fn(async () => null) }, mensajeChat: { findFirst: jest.fn(async () => null) } };
    expect(await new Ventana24hService(prisma, {} as any).puedeEscribirPersona('51900000001')).toBe(false);
  });
});

describe('Política Evolution: aviso del pedido solo dentro de la ventana de 24 h', () => {
  const DENTRO = new Date('2026-11-16T17:00:00Z'); // 12:00 Lima
  const crear = (proveedor: string, entrantes: number) => {
    const prisma: any = {
      parametro: { findMany: jest.fn(async () => [{ clave: 'whatsapp_proveedor', valor: proveedor }]), findUnique: jest.fn(async () => null) },
      whatsappMensaje: { count: jest.fn(async () => entrantes) },
      salienteWhatsapp: { count: jest.fn(async () => 0) },
    };
    return new PoliticaEvolutionService(prisma, new EvolutionConfigService(prisma));
  };
  const etapas = ['RECIBIDO', 'ACEPTADO', 'LISTO', 'SALIDA', 'LLEGADA', 'ENTREGADO'];

  it.each(etapas)('%s: con el cliente dentro de las 24 h sale', async () => {
    expect(await crear('EVOLUTION', 2).evaluar({ telefono_destino: '51900000001', origen: 'AVISO_PEDIDO' }, DENTRO)).toEqual({ accion: 'ENVIAR' });
  });
  it.each(etapas)('%s: fuera de las 24 h NO sale y queda el motivo', async () => {
    const r: any = await crear('EVOLUTION', 0).evaluar({ telefono_destino: '51900000001', origen: 'AVISO_PEDIDO' }, DENTRO);
    expect(r.accion).toBe('DESCARTAR');
    expect(r.codigo).toBe('FUERA_DE_VENTANA_24H');
    expect(r.motivo).toMatch(/Enviar confirmación por WhatsApp/);
  });
  it('con Meta la política no hace nada', async () => {
    expect(await crear('META', 0).evaluar({ telefono_destino: '51900000001', origen: 'AVISO_PEDIDO' }, DENTRO)).toEqual({ accion: 'ENVIAR' });
  });
});

describe('AvisosManualesService', () => {
  const fila = (id: number, etapa: string, extra: any = {}) => ({
    id: BigInt(id), pedido_id: 7n, telefono_destino: '51900000001', creado_en: new Date('2026-11-16T15:00:00Z'),
    carga: { etapa, textoLibre: `Hola, tu pedido C-007 (${etapa}) por S/ 35.00` }, ultimo_error: '[FUERA_DE_VENTANA_24H] Fuera de las 24 h: envíalo tú',
    motivo_descarte: 'Fuera de las 24 h: envíalo tú', ...extra,
  });
  const crear = (filas: any[], escribio = 0, vivo = true) => {
    const prisma: any = {
      pedido: { findMany: jest.fn(async () => (vivo ? [{ id: 7n }] : [])) },
      salienteWhatsapp: { findMany: jest.fn(async () => filas) },
      mensajeChat: { count: jest.fn(async () => escribio) },
    };
    return { svc: new AvisosManualesService(prisma), prisma };
  };

  it('devuelve el mensaje ya escrito y el motivo, una vez por etapa (el más reciente)', async () => {
    const { svc } = crear([fila(9, 'RECIBIDO'), fila(5, 'RECIBIDO'), fila(6, 'LISTO')]);
    const r = await svc.pendientes(['7']);
    expect(r['7'].map((a) => a.etapa)).toEqual(['RECIBIDO', 'LISTO']);
    expect(r['7'][0]).toMatchObject({ id: '9', telefono: '900000001', motivo: 'Fuera de las 24 h: envíalo tú' });
    expect(r['7'][0].texto).toContain('C-007');
  });
  it('no aparece si una persona ya le escribió al cliente después', async () => {
    expect(await crear([fila(9, 'RECIBIDO')], 1).svc.pendientes(['7'])).toEqual({});
  });
  it('no aparece si el cliente pidió BAJA, si el pedido está anulado o el celular es anónimo', async () => {
    expect(await crear([fila(9, 'RECIBIDO', { ultimo_error: '[CLIENTE_BAJA] baja' })]).svc.pendientes(['7'])).toEqual({});
    expect(await crear([fila(9, 'RECIBIDO')], 0, false).svc.pendientes(['7'])).toEqual({});
    expect(await crear([fila(9, 'RECIBIDO', { telefono_destino: '123456789012@lid' })]).svc.pendientes(['7'])).toEqual({});
  });
  it('ignora ids que no son números', async () => {
    const { svc, prisma } = crear([]);
    expect(await svc.pendientes(['x', ''])).toEqual({});
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
  });
});
