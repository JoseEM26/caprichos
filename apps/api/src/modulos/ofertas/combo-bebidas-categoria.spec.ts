jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test } from '@nestjs/testing';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { esGrupoBebidaDuplicado } from './combo-disponibilidad.util';

/** Combo Dúo de producción: «Bebida 1/2» = Frappes + Iced + Calientes (A_ELECCION por categorías) y complemento con paquetes. */
describe('Combo con bebidas por categoría (Bebida 1..N)', () => {
  let service: OfertasService;
  let prisma: any;

  const parte = (id: bigint, cantidad: number, categorias: bigint[], productos: bigint[], paquete?: [string, string]) => ({
    id, tipo: 'A_ELECCION', cantidad, categorias, productos, reemplazos: [], tamano_id: null, tamano: null,
    paquete_grupo: paquete?.[0] ?? null, paquete_nombre: paquete?.[1] ?? null, sabores_ids: [], productos_excluidos: [],
  });
  const duo = {
    id: 4n, tipo: 'COMBO', nombre: 'Combo Dúo Para Compartir', descripcion: null, lleva: null, paga: null,
    alcance_categoria_id: null, alcance_producto_id: 19n, descuento_tipo: null, descuento_valor: null, compra_minima: null,
    dias: [], hora_desde: null, hora_hasta: null, fecha_desde: null, fecha_hasta: null, canales: ['CARTA'], limite_usos: null,
    usos_actuales: 0, no_suma_beneficios: false, orden: 1, activo: true, creado_en: new Date(), categoria: null,
    producto: { id: 19n, nombre: 'DÚO' }, imagen_archivo_id: null, imagen_archivo: null, combosPrecio: [],
    mostrar_en_saludo_bot: false, solo_primera_compra: false, visible_carta: true,
    combosParte: [
      parte(1n, 2, [4n, 6n, 1n], []),
      parte(2n, 2, [], [17n], ['Complemento', '2 donas artesanales']),
      parte(3n, 2, [], [37n], ['Complemento', '2 galleta chocochips']),
    ],
  };
  const prod = (id: bigint, nombre: string, cat: bigint, catNombre: string, extra: any = {}) => ({
    id, nombre, categoria_id: cat, oculto: false, agotado_hasta: null, controla_stock: false, stocks: [], sabores: [],
    categoria: { nombre: catNombre, area_id: 1n, area: { nombre: catNombre === 'Donas' ? 'Panadería' : 'Barra' } }, ...extra,
  });
  const tam = (valor: bigint, nombre: string) => ({ tamano_valor_id: valor, unidades: 1, tamano_valor: { nombre } });
  const productos = [
    prod(101n, 'FRAPPE OREO', 4n, 'Frappes', { tamanos: [tam(1n, 'Regular 12 oz'), tam(2n, 'Grande 16 oz'), tam(3n, 'Extra 21 oz')] }),
    prod(102n, 'ICED COFFE', 6n, 'Iced'),
    prod(103n, 'CAPUCCINO', 1n, 'Calientes', { tamanos: [tam(1n, 'Regular 12 oz'), tam(2n, 'Grande 16 oz')] }),
    prod(104n, 'FROZEN FRESA', 5n, 'Frozen'),
    prod(105n, 'CAFÉ OCULTO', 1n, 'Calientes', { oculto: true }),
    prod(17n, 'DONA', 8n, 'Donas'),
    prod(37n, 'GALLETA', 9n, 'Galletas'),
  ];

  beforeEach(async () => {
    prisma = {
      oferta: { findMany: jest.fn().mockResolvedValue([duo]), findUnique: jest.fn().mockResolvedValue(duo) },
      producto: {
        findMany: jest.fn().mockImplementation(({ where, select }: any) => {
          if (select?.grupos) return Promise.resolve([]);
          const cats = (where?.OR ?? []).flatMap((c: any) => (c.categoria_id?.in ?? []).map(String));
          const ids = (where?.OR ?? []).flatMap((c: any) => (c.id?.in ?? []).map(String));
          return Promise.resolve(productos.filter((p) => cats.includes(String(p.categoria_id)) || ids.includes(String(p.id))));
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
  });

  it('la carta ofrece Frappes + Iced + Calientes visibles (sin Frozen ni ocultos) en la parte de bebidas', async () => {
    const [oferta] = await service.listarOfertas('COMBO');
    const bebidas = oferta.combosParte!.find((p) => p.id === '1')!;
    expect(bebidas.bebidas).toBe(true);
    expect((bebidas.opcionesDetalle ?? []).map((o) => o.nombre)).toEqual(['FRAPPE OREO', 'ICED COFFE', 'CAPUCCINO']);
  });

  it('cada opción de bebida trae el nombre de su categoría (la carta arma chips Frappes / Iced / Calientes)', async () => {
    const [oferta] = await service.listarOfertas('COMBO');
    const bebidas = oferta.combosParte!.find((p) => p.id === '1')!;
    const categorias = (bebidas.opcionesDetalle ?? []).map((o) => o.categoria);
    expect(categorias.every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
    expect(new Set(categorias).size).toBeGreaterThanOrEqual(2);
  });

  it('conserva el complemento con paquetes y no marca sus piezas como bebidas', async () => {
    const [oferta] = await service.listarOfertas('COMBO');
    const piezas = oferta.combosParte!.filter((p) => p.paqueteGrupo);
    expect(piezas.map((p) => p.paqueteNombre)).toEqual(['2 donas artesanales', '2 galleta chocochips']);
    expect(piezas.every((p) => !p.bebidas)).toBe(true);
    expect(piezas[0].opcionesDetalle?.map((o) => o.nombre)).toEqual(['DONA']);
  });

  const el = (parteId: string, productoId: string) => ({ parteId, productoId });

  it('acepta 2 bebidas de las categorías y las vuelve líneas hijas', async () => {
    const res = await service.resolverPartesCombo(4, [el('1', '101'), el('1', '103'), el('2', '17'), el('2', '17')]);
    expect(res.conBebidas).toBe(true);
    expect(res.partes.filter((p) => p.parteId === 1n).map((p) => [p.productoId, p.cantidad])).toEqual([[101n, 1], [103n, 1]]);
  });

  it('pedido en Grande: cada bebida hija lleva SU tamaño Grande (y sin tamaño de combo no lleva ninguno)', async () => {
    const elecs = [el('1', '101'), el('1', '103'), el('2', '17'), el('2', '17')];
    const grande = await service.resolverPartesCombo(4, elecs, 1, undefined, 2n);
    expect(grande.partes.filter((p) => p.parteId === 1n).map((p) => [p.productoId, p.tamano, p.unidadesTamano])).toEqual([
      [101n, 'Grande 16 oz', 1],
      [103n, 'Grande 16 oz', 1],
    ]);
    expect(grande.partes.find((p) => p.productoId === 17n)?.tamano).toBeUndefined();
    // Extra: solo el frappé lo tiene; el capuccino queda sin tamaño en vez de inventar uno
    const extra = await service.resolverPartesCombo(4, elecs, 1, undefined, '3');
    expect(extra.partes.filter((p) => p.parteId === 1n).map((p) => [p.productoId, p.tamano ?? null])).toEqual([[101n, 'Extra 21 oz'], [103n, null]]);
    const sin = await service.resolverPartesCombo(4, elecs);
    expect(sin.partes.every((p) => p.tamano === undefined)).toBe(true);
  });

  it('rechaza una bebida fuera de las categorías (Frozen) y un producto oculto', async () => {
    await expect(service.resolverPartesCombo(4, [el('1', '101'), el('1', '104'), el('2', '17'), el('2', '17')])).rejects.toMatchObject({
      response: { codigo: 'COMBO_PARTE_NO_PERMITIDA' },
    });
    await expect(service.resolverPartesCombo(4, [el('1', '101'), el('1', '105'), el('2', '17'), el('2', '17')])).rejects.toBeDefined();
  });

  it('exige elegir las bebidas: sin elecciones o con menos de las pedidas se rechaza', async () => {
    await expect(service.resolverPartesCombo(4, [el('2', '17'), el('2', '17')])).rejects.toMatchObject({
      response: { codigo: 'COMBO_ELECCION_INCOMPLETA' },
    });
    await expect(service.resolverPartesCombo(4, [el('1', '101'), el('2', '17'), el('2', '17')])).rejects.toMatchObject({
      response: { codigo: 'COMBO_ELECCION_INCOMPLETA' },
    });
  });

  it('oculta solo los grupos del anfitrión que repiten la bebida', () => {
    expect(['Bebida 1 · Sabor', 'Bebida 2 · Bebida', 'Bebida 1', 'bebida 2 · sabor'].every(esGrupoBebidaDuplicado)).toBe(true);
    expect(['Bebida 1 · Tipo de leche', 'Endulzante', 'Tamaño', 'Nota'].some(esGrupoBebidaDuplicado)).toBe(false);
  });
});
