jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin = jest.fn(); } }));
import { BadRequestException } from '@nestjs/common';
import { CONFIG_EQUIPO_NUEVO } from './ruteo-impresion';
import { ImpresionService } from './impresion.service';
import { construirEtiquetasBebida } from './constructor-etiquetas';

const bebida = (id: bigint, nombre: string) => ({
  id, cantidad: 1, nombre, area_id: 7n, area: { nombre: 'Bebidas' }, producto: { categoria_id: 11n, categoria: { nombre: 'Frappes' } },
  opcionesElegidas: [], sabores: [], subtotal: 10, precio_unit: 10,
});
// Dos vasos de línea + un combo con 2 bebidas (en combos bebidaIndex nace en 0: debe quedar único)
const combo = { id: 3n, cantidad: 1, nombre: 'Combo', area_id: 7n, area: { nombre: 'Bebidas' }, producto: { categoria_id: 9n, categoria: { nombre: 'Combos' } }, opcionesElegidas: [], sabores: [], subtotal: 10, precio_unit: 10 };
const pedido = () => ({
  id: 9n, codigo: 'PED-9', estado: 'ENTREGADO', modalidad: 'LLEVAR', total: 20, subtotal: 20, cliente_nombre: 'Lucía', creado_en: new Date(), planPago: [], cobros: [],
  lineas: [bebida(1n, 'Frappe Maracuyá'), bebida(2n, 'Frappe Maracuyá')],
});

describe('reimprimir etiquetas: solo las elegidas', () => {
  let prisma: any;
  let service: ImpresionService;
  let auditoria: any;
  const creados = () => prisma.printJob.create.mock.calls.map((c: any) => c[0].data.payload.bebidaIndex);

  beforeEach(() => {
    let n = 100n;
    prisma = {
      printJob: { create: jest.fn(async () => ({ id: n++ })), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()) },
      areaCocina: { findMany: jest.fn().mockResolvedValue([{ id: 7n, nombre: 'Bebidas' }]) },
      deviceKey: { findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Caja' }]), findFirst: jest.fn().mockResolvedValue(null) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
      comprobante: { findFirst: jest.fn().mockResolvedValue(null) },
      cuponEmitido: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    auditoria = { registrar: jest.fn() };
    service = new ImpresionService(prisma, auditoria);
    (service as any).equipos = { contexto: jest.fn(async () => ({ equipos: [{ id: 1n, areaId: null, conectado: true, config: { ...CONFIG_EQUIPO_NUEVO, configurado: true, etiquetera: true, stickerBebidaAreas: ['7'] } }], areaBebidasId: 7n })) };
  });

  it('con claves imprime solo esos vasos y audita lo pedido', async () => {
    const r: any = await service.reimprimirEtiqueta('9', { tipo: 'bebida', claves: ['BEBIDA:2'] } as any, { partyId: '3' } as any, '1.1.1.1');
    expect(creados()).toEqual([2]);
    expect(r.cantidad).toBe(1);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REIMPRIMIR_PEDIDO', despues: expect.objectContaining({ clavesPedidas: ['BEBIDA:2'], encoladas: ['BEBIDA:2'] }) }));
  });

  it('clave inexistente: se rechaza y no se imprime nada', async () => {
    await expect(service.reimprimirEtiqueta('9', { tipo: 'bebida', claves: ['BEBIDA:1', 'BEBIDA:9'] } as any)).rejects.toThrow(BadRequestException);
    expect(prisma.printJob.create).not.toHaveBeenCalled();
  });

  it('lo que ya está en cola no se duplica', async () => {
    prisma.printJob.findMany.mockResolvedValue([{ tipo: 'ETIQUETA_BEBIDA', payload: { bebidaIndex: 1 } }]);
    const r: any = await service.reimprimirEtiqueta('9', { tipo: 'bebida', claves: ['BEBIDA:1', 'BEBIDA:2'] } as any);
    expect(creados()).toEqual([2]);
    expect(r.omitidas).toBe(1);
  });

  it('sin claves sigue imprimiendo todos los vasos', async () => {
    await service.reimprimirEtiqueta('9', { tipo: 'bebida' } as any);
    expect(creados()).toEqual([1, 2]);
  });

  it('en combos reales (2 bebidas elegidas por unidad) las claves son únicas y se elige una', async () => {
    const op = (grupo: string, nombre: string) => ({ grupo_nombre: grupo, opcion_nombre: nombre });
    const linea = { ...combo, cantidad: 2, nombres_persona: ['Ana', 'Beto', 'Caro', 'Dani'], opcionesElegidas: [op('Paso 2 · Bebida 1', 'Frappe Fresa'), op('Paso 3 · Bebida 2', 'Café')] };
    const p: any = { ...pedido(), lineas: [linea] };
    const bs = construirEtiquetasBebida(p);
    expect(bs.map((b) => b.bebidaIndex)).toEqual([1, 2, 3, 4]);
    prisma.pedido.findUnique.mockResolvedValue(p);
    await service.reimprimirEtiqueta('9', { tipo: 'bebida', claves: ['BEBIDA:3'] } as any);
    expect(prisma.printJob.create.mock.calls.map((c: any) => c[0].data.payload.persona)).toEqual(['Caro']);
  });

  describe('reimprimirPedido (diálogo rápido de Caja)', () => {
    it('con claves imprime solo esos vasos y audita clavesPedidas', async () => {
      const r: any = await service.reimprimirPedido(9, { tipo: 'stickers', sub: 'bebida', claves: ['BEBIDA:1'] }, { partyId: '3' } as any, '1.1.1.1');
      expect(creados()).toEqual([1]);
      expect(r.papeles[0].clave).toBe('BEBIDA:1');
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REIMPRIMIR_PEDIDO', despues: expect.objectContaining({ clavesPedidas: ['BEBIDA:1'], stickers: 1 }) }));
    });
    it('clave inexistente: 400 y no encola', async () => {
      await expect(service.reimprimirPedido(9, { tipo: 'stickers', sub: 'bebida', claves: ['BEBIDA:7'] })).rejects.toThrow(BadRequestException);
      expect(prisma.printJob.create).not.toHaveBeenCalled();
    });
    it('lo que ya está en cola no se duplica', async () => {
      prisma.printJob.findMany.mockResolvedValue([{ tipo: 'ETIQUETA_BEBIDA', payload: { bebidaIndex: 2 } }]);
      await service.reimprimirPedido(9, { tipo: 'stickers', sub: 'bebida', claves: ['BEBIDA:1', 'BEBIDA:2'] });
      expect(creados()).toEqual([1]);
    });
  });
});
