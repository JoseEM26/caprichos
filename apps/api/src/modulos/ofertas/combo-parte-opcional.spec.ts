jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test } from '@nestjs/testing';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { construirTicketComandaArea } from '../impresion/constructor-etiquetas';

/** Dúo Irresistible: club sándwich fijo y papas nativas FIJO opcional (incluida 1, hasta 3, extra S/ 6.00). */
describe('Combo con parte FIJO opcional (papas)', () => {
  let service: OfertasService;
  const base = { reemplazos: [], tamano_id: null, tamano: null, paquete_grupo: null, paquete_nombre: null, sabores_ids: [], productos_excluidos_ids: [] };
  const papas = (extra: any = {}) => ({
    ...base, id: 2n, tipo: 'FIJO', cantidad: 1, categorias: [], productos: [51n],
    opcional: true, cantidad_min: 0, cantidad_max: 3, incluida_por_defecto: true, precio_extra: 6, ...extra,
  });
  const club = { ...base, id: 1n, tipo: 'FIJO', cantidad: 1, categorias: [], productos: [50n], opcional: false, cantidad_min: 0, cantidad_max: null, incluida_por_defecto: true, precio_extra: null };
  const oferta = (partePapas: any) => ({
    id: 4n, tipo: 'COMBO', nombre: 'Dúo Irresistible', descripcion: null, lleva: null, paga: null,
    alcance_categoria_id: null, alcance_producto_id: 19n, descuento_tipo: null, descuento_valor: null, compra_minima: null,
    dias: [], hora_desde: null, hora_hasta: null, fecha_desde: null, fecha_hasta: null, canales: ['CARTA'], limite_usos: null,
    usos_actuales: 0, no_suma_beneficios: false, orden: 1, activo: true, creado_en: new Date(), categoria: null,
    producto: { id: 19n, nombre: 'DÚO' }, imagen_archivo_id: null, imagen_archivo: null, combosPrecio: [],
    mostrar_en_saludo_bot: false, solo_primera_compra: false, visible_carta: true, combosParte: [club, partePapas],
  });
  const prod = (id: bigint, nombre: string, extra: any = {}) => ({
    id, nombre, categoria_id: 1n, oculto: false, agotado_hasta: null, controla_stock: false, stocks: [], sabores: [], tamanos: [],
    categoria: { nombre: 'Salados', area_id: 1n, area: { nombre: 'Salados' } }, ...extra,
  });

  async function montar(partePapas: any, productos = [prod(50n, 'CLUB SANDWICH'), prod(51n, 'PAPAS NATIVAS')]) {
    const o = oferta(partePapas);
    const prisma: any = {
      oferta: { findMany: jest.fn().mockResolvedValue([o]), findUnique: jest.fn().mockResolvedValue(o) },
      producto: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          const ids = (where?.OR ?? []).flatMap((c: any) => (c.id?.in ?? []).map(String));
          return Promise.resolve(productos.filter((p) => ids.includes(String(p.id))));
        }),
      },
      categoria: { findMany: jest.fn().mockResolvedValue([]) },
      opcionRequiere: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const mod = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() }) } },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = mod.get(OfertasService);
  }
  const el = (parteId: string, productoId: string, cantidad?: number) => ({ parteId, productoId, ...(cantidad !== undefined ? { cantidad } : {}) });

  beforeEach(() => montar(papas()));

  it('sin elección explícita lleva las incluidas (como una parte siempre incluida) y sin cobro extra', async () => {
    const res = await service.resolverPartesCombo(4, [el('1', '50')]);
    expect(res.partes.map((p) => [p.productoId, p.cantidad])).toEqual([[50n, 1], [51n, 1]]);
    expect(res.recargoPorCombo).toBeUndefined();
    expect(res.nota).toBe('');
  });

  it('cantidad 0: no hay línea de papas, la nota dice SIN y el precio no cambia', async () => {
    const res = await service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 0)]);
    expect(res.partes.map((p) => p.productoId)).toEqual([50n]);
    expect(res.partes[0].nota).toBe('SIN PAPAS NATIVAS · Combo: Dúo Irresistible');
    expect(res.nota).toBe('Dúo Irresistible · SIN PAPAS NATIVAS');
    expect(res.recargoPorCombo).toBeUndefined();
  });

  it('1 extra: la línea lleva 2 con la marca EXTRA y el servidor calcula S/ 6.00 por combo', async () => {
    const res = await service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 2)]);
    const p = res.partes.find((x) => x.productoId === 51n)!;
    expect(p.cantidad).toBe(2);
    expect(p.extras).toBe(1);
    expect(p.nota).toBe('EXTRA +1 · Combo: Dúo Irresistible');
    expect(res.recargoPorCombo).toBe(6);
  });

  it('con 2 combos la cantidad de la línea hija se multiplica; el recargo queda por combo', async () => {
    const res = await service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 3)], 2);
    expect(res.partes.find((x) => x.productoId === 51n)!.cantidad).toBe(6);
    expect(res.recargoPorCombo).toBe(12); // 2 extras × S/ 6 por combo (la línea multiplica por su cantidad)
  });

  it('extra sin precio: lleva más pero no cobra', async () => {
    await montar(papas({ precio_extra: null }));
    const res = await service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 2)]);
    expect(res.partes.find((x) => x.productoId === 51n)!.cantidad).toBe(2);
    expect(res.recargoPorCombo).toBeUndefined();
  });

  it('rechaza más del máximo, negativos y no enteros (no confía en el cliente)', async () => {
    for (const n of [4, -1, 1.5]) {
      await expect(service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', n)])).rejects.toMatchObject({ response: { codigo: 'COMBO_CANTIDAD_INVALIDA' } });
    }
  });

  it('sin máximo configurado el tope son las incluidas', async () => {
    await montar(papas({ cantidad_max: null }));
    await expect(service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 2)])).rejects.toMatchObject({ response: { codigo: 'COMBO_CANTIDAD_INVALIDA' } });
  });

  it('no marcada por defecto: sin elección explícita no lleva papas', async () => {
    await montar(papas({ incluida_por_defecto: false }));
    const res = await service.resolverPartesCombo(4, [el('1', '50')]);
    expect(res.partes.map((p) => p.productoId)).toEqual([50n]);
  });

  it('papas agotadas: con 0 el combo sale; con 1 o más, 409', async () => {
    await montar(papas(), [prod(50n, 'CLUB SANDWICH'), prod(51n, 'PAPAS NATIVAS', { agotado_hasta: new Date(Date.now() + 3600_000) })]);
    const res = await service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 0)]);
    expect(res.partes.map((p) => p.productoId)).toEqual([50n]);
    await expect(service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 1)])).rejects.toMatchObject({ response: { codigo: 'COMBO_PARTE_NO_DISPONIBLE' } });
  });

  it('la carta expone los campos y el combo sigue disponible aunque las papas estén agotadas (opcional)', async () => {
    await montar(papas(), [prod(50n, 'CLUB SANDWICH'), prod(51n, 'PAPAS NATIVAS', { agotado_hasta: new Date(Date.now() + 3600_000) })]);
    const [o] = await service.listarOfertas('COMBO');
    expect(o.disponible).toBe(true);
    const p = o.combosParte!.find((x) => x.id === '2')!;
    expect(p).toMatchObject({ opcional: true, cantidadMin: 0, cantidadMax: 3, incluidaPorDefecto: true, precioExtra: 6 });
  });

  it('FIJO sin opcional se comporta como siempre: ignora cantidad y lleva las incluidas', async () => {
    await montar(papas({ opcional: false, precio_extra: null }));
    const res = await service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 0)]);
    expect(res.partes.find((x) => x.productoId === 51n)!.cantidad).toBe(1);
  });

  it('la comanda del área no trae la línea quitada y marca SIN / EXTRA', async () => {
    const sin = await service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 0)]);
    const extra = await service.resolverPartesCombo(4, [el('1', '50'), el('2', '51', 2)]);
    const pedido = (partes: any[]) => ({
      codigo: 'P-1', creado_en: new Date(), canal: 'CARTA',
      lineas: [
        { id: 1n, producto_id: null, area_id: null, nombre: 'Dúo Irresistible', cantidad: 1, nota: 'x', subtotal: 0 },
        ...partes.map((p, i) => ({ id: BigInt(10 + i), linea_combo_id: 1n, producto_id: p.productoId, area_id: 1n, area: { nombre: 'Salados' }, nombre: p.nombre, cantidad: p.cantidad, nota: p.nota, subtotal: 0 })),
      ],
    });
    const tSin = construirTicketComandaArea(pedido(sin.partes), 1n);
    expect(tSin.lineas).toHaveLength(1);
    expect(JSON.stringify(tSin)).toContain('SIN PAPAS NATIVAS');
    const tExtra = construirTicketComandaArea(pedido(extra.partes), 1n);
    expect(JSON.stringify(tExtra)).toContain('EXTRA +1');
  });
});

describe('opcionalDeParte (validación del editor)', () => {
  const svc: any = Object.create(OfertasService.prototype);
  it('máx ≥ incluidas, mínimo ≤ incluidas, extra ≥ 0 y solo FIJO', () => {
    expect(svc.opcionalDeParte('FIJO', { cantidad: 1 }).opcional).toBe(false);
    expect(svc.opcionalDeParte('FIJO', { cantidad: 1, opcional: true, cantidadMax: 3, precioExtra: 6 })).toMatchObject({ opcional: true, cantidad_max: 3 });
    expect(() => svc.opcionalDeParte('FIJO', { cantidad: 2, opcional: true, cantidadMax: 1 })).toThrow();
    expect(() => svc.opcionalDeParte('FIJO', { cantidad: 1, opcional: true, cantidadMin: 2 })).toThrow();
    expect(() => svc.opcionalDeParte('FIJO', { cantidad: 1, opcional: true, precioExtra: -1 })).toThrow();
    expect(() => svc.opcionalDeParte('A_ELECCION', { cantidad: 1, opcional: true })).toThrow();
  });
});
