jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test } from '@nestjs/testing';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';

/** Combo por tamaño: cantidad, descripción y foto propias de cada tamaño (Personal = 7, Familiar = 8). */
describe('Combo por tamaño: cantidades, descripción y fotos', () => {
  let service: OfertasService;
  const parte = {
    id: 1n, tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: [17n, 37n], reemplazos: [], tamano_id: null, tamano: null,
    paquete_grupo: null, paquete_nombre: null, sabores_ids: [], productos_excluidos_ids: [], cupos_producto: null,
    mostrar_imagenes: true, cantidad_por_tamano: { '8': 4 },
  };
  const combo = {
    id: 4n, tipo: 'COMBO', nombre: 'Combo Juguetes', descripcion: 'Del combo', lleva: null, paga: null, alcance_categoria_id: null,
    alcance_producto_id: 19n, descuento_tipo: null, descuento_valor: null, compra_minima: null, dias: [], hora_desde: null,
    hora_hasta: null, fecha_desde: null, fecha_hasta: null, canales: ['CARTA'], limite_usos: null, usos_actuales: 0,
    no_suma_beneficios: false, orden: 1, activo: true, creado_en: new Date(), categoria: null, producto: { id: 19n, nombre: 'CAJA' },
    imagen_archivo_id: null, imagen_archivo: null, mostrar_en_saludo_bot: false, solo_primera_compra: false, visible_carta: true,
    combosPrecio: [
      { tamano_valor_id: 7n, tamano_valor: { nombre: 'Personal' }, precio: 30, descripcion: null, foto_archivo_id: null, foto_archivo: null },
      { tamano_valor_id: 8n, tamano_valor: { nombre: 'Familiar' }, precio: 60, descripcion: 'Para 4', foto_archivo_id: 9n, foto_archivo: { ruta: 'familiar.jpg' } },
    ],
    combosParte: [parte],
  };
  const prod = (id: bigint, nombre: string, ruta: string | null) => ({
    id, nombre, categoria_id: 8n, oculto: false, agotado_hasta: null, controla_stock: false, stocks: [], sabores: [],
    foto_archivo: ruta ? { ruta } : null,
    categoria: { nombre: 'Juguetes', area_id: 1n, area: { nombre: 'Salon' } },
  });
  const productos = [prod(17n, 'OSO', 'oso.jpg'), prod(37n, 'AUTO', null)];

  beforeEach(async () => {
    const prisma: any = {
      oferta: { findMany: jest.fn().mockResolvedValue([combo]), findUnique: jest.fn().mockResolvedValue(combo) },
      producto: { findMany: jest.fn().mockImplementation(({ select }: any) => (select?.grupos ? Promise.resolve([]) : Promise.resolve(productos))) },
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

  const el = (id: string) => ({ parteId: '1', productoId: id });
  const elegir = (n: number) => Array.from({ length: n }, (_, i) => el(i % 2 ? '37' : '17'));

  it('Familiar pide 4 juguetes: 4 se aceptan y 2 se rechazan', async () => {
    await expect(service.resolverPartesCombo(4, elegir(4), 1, undefined, 8)).resolves.toBeDefined();
    await expect(service.resolverPartesCombo(4, elegir(2), 1, undefined, 8)).rejects.toMatchObject({ response: { codigo: 'COMBO_ELECCION_INCOMPLETA' } });
  });

  it('Personal (sin cantidad propia) y sin tamaño siguen pidiendo la cantidad de la parte', async () => {
    await expect(service.resolverPartesCombo(4, elegir(2), 1, undefined, 7)).resolves.toBeDefined();
    await expect(service.resolverPartesCombo(4, elegir(2))).resolves.toBeDefined();
    await expect(service.resolverPartesCombo(4, elegir(4), 1, undefined, 7)).rejects.toBeDefined();
  });

  it('los cupos se validan con la cantidad del tamaño: un producto de 4 lugares llena Familiar y no cabe en Personal', async () => {
    parte.cupos_producto = { '37': 4 } as any;
    try {
      await expect(service.resolverPartesCombo(4, [el('37')], 1, undefined, 8)).resolves.toBeDefined();
      await expect(service.resolverPartesCombo(4, [el('37')], 1, undefined, 7)).rejects.toMatchObject({ response: { codigo: 'COMBO_ELECCION_INCOMPLETA' } });
    } finally {
      parte.cupos_producto = null;
    }
  });

  it('la carta expone descripción, foto, cantidades por tamaño y el interruptor de la parte', async () => {
    const [o] = await service.listarOfertas('COMBO');
    const personal = o.combosPrecio!.find((t) => t.tamanoNombre === 'Personal')!;
    const familiar = o.combosPrecio!.find((t) => t.tamanoNombre === 'Familiar')!;
    expect(familiar).toMatchObject({ descripcion: 'Para 4', fotoUrl: '/archivos/familiar.jpg', cantidades: { '1': 4 } });
    // Sin datos propios el tamaño queda con null y sin cantidades: la carta usa lo del combo
    expect(personal).toMatchObject({ descripcion: null, fotoUrl: null, cantidades: {} });
    expect(o.combosParte![0]).toMatchObject({ mostrarImagenes: true, cantidad: 2, cantidadPorTamano: { '8': 4 } });
  });

  it('los elegibles de la parte traen la foto del producto y los que no la tienen, sin fotoUrl', async () => {
    const [o] = await service.listarOfertas('COMBO');
    const det = o.combosParte![0].opcionesDetalle!;
    expect(det.find((x) => x.id === '17')?.fotoUrl).toBe('/archivos/oso.jpg');
    expect(det.find((x) => x.id === '37')?.fotoUrl).toBeUndefined();
  });
});
