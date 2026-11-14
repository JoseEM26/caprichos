jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test } from '@nestjs/testing';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { calcularDisponibilidadCombo, ParteDisp, ProductoDisp } from './combo-disponibilidad.util';

const futuro = new Date(Date.now() + 3600_000);
const pasado = new Date(Date.now() - 3600_000);
const pd = (id: string, extra: Partial<ProductoDisp> = {}): ProductoDisp => ({ id, nombre: `P${id}`, categoriaId: '1', oculto: false, agotadoHasta: null, ...extra });
const fijo = (id: string): ParteDisp => ({ tipo: 'FIJO', cantidad: 1, categorias: [], productos: [id], alternativas: [] });
const eleccion: ParteDisp = { tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['1', '2', '3'], alternativas: [] };

describe('regla única de combo agotado (admin, carta, bot y pedido)', () => {
  it('pieza FIJA agotada: el combo queda agotado', () => {
    expect(calcularDisponibilidadCombo([fijo('9')], [pd('9', { agotadoHasta: futuro })]).disponible).toBe(false);
    expect(calcularDisponibilidadCombo([fijo('9')], [pd('9', { controlaStock: true, saldo: 0 })]).disponible).toBe(false);
  });
  it('elección con 1 opción agotada: el combo sigue disponible', () => {
    const r = calcularDisponibilidadCombo([eleccion], [pd('1', { controlaStock: true, saldo: 0 }), pd('2'), pd('3')]);
    expect(r.disponible).toBe(true);
  });
  it('elección con todas las opciones agotadas: combo agotado', () => {
    const r = calcularDisponibilidadCombo([eleccion], [pd('1', { controlaStock: true, saldo: 0 }), pd('2', { agotadoHasta: futuro }), pd('3', { agotadoHasta: futuro })]);
    expect(r.disponible).toBe(false);
  });
  it('agotado_hasta vencido: vuelve solo', () => {
    expect(calcularDisponibilidadCombo([fijo('9')], [pd('9', { agotadoHasta: pasado })]).disponible).toBe(true);
  });
});

describe('servidor: pedir un combo agotado', () => {
  const prod = (id: bigint, extra: any = {}) => ({
    id, nombre: `P${id}`, categoria_id: 8n, oculto: false, agotado_hasta: null, controla_stock: false, stocks: [], sabores: [],
    categoria: { nombre: 'Juguetes', area_id: 1n, area: { nombre: 'Panadería' } }, ...extra,
  });
  const combo = {
    id: 4n, tipo: 'COMBO', nombre: 'Combo Caja', descripcion: null, lleva: null, paga: null, alcance_categoria_id: null,
    alcance_producto_id: 19n, descuento_tipo: null, descuento_valor: null, compra_minima: null, dias: [], hora_desde: null,
    hora_hasta: null, fecha_desde: null, fecha_hasta: null, canales: ['CARTA'], limite_usos: null, usos_actuales: 0,
    no_suma_beneficios: false, orden: 1, activo: true, creado_en: new Date(), categoria: null, producto: { id: 19n, nombre: 'CAJA' },
    imagen_archivo_id: null, imagen_archivo: null, combosPrecio: [], mostrar_en_saludo_bot: false, solo_primera_compra: false,
    visible_carta: true,
    combosParte: [{
      id: 1n, tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: [1n, 2n, 3n], reemplazos: [], tamano_id: null, tamano: null,
      paquete_grupo: null, paquete_nombre: null, sabores_ids: [], productos_excluidos_ids: [], cupos_producto: {},
    }],
  };
  const montar = async (productos: any[]) => {
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
    return mod.get(OfertasService);
  };
  const el = (id: string) => ({ parteId: '1', productoId: id });

  it('todas las opciones agotadas: se rechaza, el anfitrión figura agotado y la carta no pierde el motivo oculto', async () => {
    const s = await montar([1n, 2n, 3n].map((i) => prod(i, { agotado_hasta: futuro })));
    await expect(s.resolverPartesCombo(4, [el('1'), el('2')])).rejects.toMatchObject({ response: { codigo: 'COMBO_PARTE_NO_DISPONIBLE' } });
    expect([...(await s.anfitrionesAgotados())]).toEqual(['19']);
  });

  it('una opción agotada: no se puede elegir, las otras sí; el anfitrión sigue a la venta', async () => {
    const s = await montar([prod(1n, { agotado_hasta: futuro }), prod(2n), prod(3n)]);
    await expect(s.resolverPartesCombo(4, [el('1'), el('2')])).rejects.toBeDefined();
    await expect(s.resolverPartesCombo(4, [el('2'), el('3')])).resolves.toBeDefined();
    expect((await s.anfitrionesAgotados()).size).toBe(0);
  });
});
