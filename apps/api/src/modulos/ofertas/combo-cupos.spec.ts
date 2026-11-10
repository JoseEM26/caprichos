jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test } from '@nestjs/testing';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ComboParteDto } from './dto/crear-oferta.dto';

/** Parte «Elige 2: dona, galleta o torta» donde la torta ocupa 2 lugares. */
describe('Cupos por producto en una parte A_ELECCION', () => {
  let service: OfertasService;
  const parte = (cupos: any) => ({
    id: 1n, tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: [17n, 37n, 50n], reemplazos: [], tamano_id: null, tamano: null,
    paquete_grupo: null, paquete_nombre: null, sabores_ids: [], productos_excluidos_ids: [], cupos_producto: cupos,
  });
  const combo = (cupos: any) => ({
    id: 4n, tipo: 'COMBO', nombre: 'Combo Prueba', descripcion: null, lleva: null, paga: null, alcance_categoria_id: null,
    alcance_producto_id: 19n, descuento_tipo: null, descuento_valor: null, compra_minima: null, dias: [], hora_desde: null,
    hora_hasta: null, fecha_desde: null, fecha_hasta: null, canales: ['CARTA'], limite_usos: null, usos_actuales: 0,
    no_suma_beneficios: false, orden: 1, activo: true, creado_en: new Date(), categoria: null, producto: { id: 19n, nombre: 'CAJA' },
    imagen_archivo_id: null, imagen_archivo: null, combosPrecio: [], mostrar_en_saludo_bot: false, solo_primera_compra: false,
    visible_carta: true, combosParte: [parte(cupos)],
  });
  const prod = (id: bigint, nombre: string) => ({
    id, nombre, categoria_id: 8n, oculto: false, agotado_hasta: null, controla_stock: false, stocks: [], sabores: [],
    categoria: { nombre: 'Postres', area_id: 1n, area: { nombre: 'Panadería' } },
  });
  const productos = [prod(17n, 'DONA'), prod(37n, 'GALLETA'), prod(50n, 'TORTA')];

  const armar = async (cupos: any) => {
    const oferta = combo(cupos);
    const prisma: any = {
      oferta: { findMany: jest.fn().mockResolvedValue([oferta]), findUnique: jest.fn().mockResolvedValue(oferta) },
      producto: {
        findMany: jest.fn().mockImplementation(({ select }: any) => (select?.grupos ? Promise.resolve([]) : Promise.resolve(productos))),
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
  };
  const el = (id: string) => ({ parteId: '1', productoId: id });
  const mensaje = async (elecs: any[]) => {
    try {
      await service.resolverPartesCombo(4, elecs);
    } catch (e: any) {
      return e.getResponse().mensaje as string;
    }
    return null;
  };

  beforeEach(() => armar({ '50': 2 }));

  it('dona + galleta, 2 donas y la torta sola completan los 2 lugares', async () => {
    for (const elecs of [[el('17'), el('37')], [el('17'), el('17')], [el('50')]]) {
      await expect(service.resolverPartesCombo(4, elecs)).resolves.toBeDefined();
    }
  });

  it('la torta es UNA unidad de torta (no se duplica en las líneas hijas)', async () => {
    const res = await service.resolverPartesCombo(4, [el('50')]);
    expect(res.partes.map((p) => [p.productoId, p.cantidad])).toEqual([[50n, 1]]);
  });

  it('torta + galleta (3 lugares) se rechaza con mensaje claro', async () => {
    expect(await mensaje([el('50'), el('37')])).toContain('TORTA ocupa 2 lugares');
  });

  it('2 tortas (4 lugares) se rechaza y 1 dona sola (1 lugar) también', async () => {
    expect(await mensaje([el('50'), el('50')])).toContain('ocupa 2 lugares');
    expect(await mensaje([el('17')])).toContain('Elige exactamente 2');
  });

  it('la carta marca «cupos» solo en la torta y devuelve el mapa al editor', async () => {
    const [o] = await service.listarOfertas('COMBO');
    const p = o.combosParte![0];
    expect(p.cuposProducto).toEqual({ '50': 2 });
    expect(p.opcionesDetalle!.map((x) => [x.nombre, x.cupos])).toEqual([['DONA', undefined], ['GALLETA', undefined], ['TORTA', 2]]);
  });

  it('sin mapa todo se comporta como antes (cada producto ocupa 1)', async () => {
    await armar(null);
    await expect(service.resolverPartesCombo(4, [el('17'), el('50')])).resolves.toBeDefined();
    expect(await mensaje([el('50')])).toContain('Elige exactamente 2');
    const [o] = await service.listarOfertas('COMBO');
    expect(o.combosParte![0].cuposProducto).toBeUndefined();
  });

  describe('DTO', () => {
    const errores = async (cantidad: number, cupos: any) =>
      (await validate(plainToInstance(ComboParteDto, { tipo: 'A_ELECCION', cantidad, cuposProducto: cupos }))).length;
    it('acepta enteros de 1 a la cantidad y rechaza el resto', async () => {
      expect(await errores(2, { '50': 2 })).toBe(0);
      expect(await errores(2, undefined)).toBe(0);
      expect(await errores(2, { '50': 3 })).toBe(1);
      expect(await errores(2, { '50': 0 })).toBe(1);
      expect(await errores(2, { '50': 1.5 })).toBe(1);
      expect(await errores(2, { torta: 2 })).toBe(1);
      expect(await errores(2, [2])).toBe(1);
    });
  });
});
