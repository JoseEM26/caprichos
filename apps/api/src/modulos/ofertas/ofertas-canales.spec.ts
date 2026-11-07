jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { TEXTOS_BOT } from '../chatbot/conversacion/textos-bot';
import { BadRequestException } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { calcularEnvioDelivery, promoEnvioGratisVigente } from './envio-gratis-promo';
import { canalesPorDefecto, canalOferta, estaVigente, ofertaIncluyeCanal } from './ofertas.util';
import { vistaPreviaPedidoBot } from '../chatbot/conversacion/vista-previa-pedido.util';

// Miércoles 4 de noviembre de 2026, hora de Lima = UTC-5
const MIE_14H = new Date('2026-11-04T19:00:00.000Z');
const MIE_18H = new Date('2026-11-04T23:00:00.000Z');
const MARTES_14H = new Date('2026-11-03T19:00:00.000Z');

const base = (extra: Record<string, unknown> = {}) => ({
  id: 77n, nombre: 'Delivery gratis de 2 a 6 pm', tipo: 'ENVIO_GRATIS', activo: true, orden: 0,
  dias: [3], hora_desde: new Date('1970-01-01T14:00:00.000Z'), hora_hasta: new Date('1970-01-01T18:00:00.000Z'),
  fecha_desde: null, fecha_hasta: null, canales: ['CARTA', 'ADMIN', 'BOT'], limite_usos: null, usos_actuales: 0, compra_minima: null,
  ...extra,
});
const prismaCon = (ofertas: unknown[]) =>
  ({
    oferta: { findMany: jest.fn().mockResolvedValue(ofertas) },
    parametro: { findUnique: jest.fn().mockResolvedValue(null) },
  }) as any;

describe('canal de oferta: una sola regla para carta, local y bot', () => {
  it('normaliza el canal del pedido', () => {
    expect(['CARTA', 'WEB', 'MOZO', 'CAJA', 'ADMIN', 'WHATSAPP', 'BOT'].map(canalOferta)).toEqual(['CARTA', 'CARTA', 'ADMIN', 'ADMIN', 'ADMIN', 'BOT', 'BOT']);
  });

  it('cada canal solo vale si su casilla está marcada (TODOS y vacío nunca incluyen el bot)', () => {
    expect(ofertaIncluyeCanal(['CARTA'], 'CARTA')).toBe(true);
    expect(ofertaIncluyeCanal(['CARTA'], 'ADMIN')).toBe(false);
    expect(ofertaIncluyeCanal(['CARTA'], 'BOT')).toBe(false);
    expect(ofertaIncluyeCanal(['CARTA', 'ADMIN'], 'BOT')).toBe(false);
    expect(ofertaIncluyeCanal(['TODOS'], 'BOT')).toBe(false);
    expect(ofertaIncluyeCanal([], 'BOT')).toBe(false);
    expect(ofertaIncluyeCanal([], 'CARTA')).toBe(true);
    expect(ofertaIncluyeCanal(['ADMIN', 'BOT'], 'BOT')).toBe(true);
  });

  it('acepta valores históricos: WHATSAPP = BOT, CAJA/MOZO = local', () => {
    expect(ofertaIncluyeCanal(['WHATSAPP'], 'BOT')).toBe(true);
    expect(ofertaIncluyeCanal(['CARTA', 'CAJA'], 'ADMIN')).toBe(true);
  });

  it.each(['DESCUENTO', 'LLEVA_PAGA', 'ENVIO_GRATIS', 'COMBO'])('estaVigente de %s respeta el canal de pedido (mozo y caja cuentan como local)', () => {
    const o = { activo: true, canales: ['ADMIN'] };
    expect(estaVigente(o, 'MOZO')).toBe(true);
    expect(estaVigente(o, 'CAJA')).toBe(true);
    expect(estaVigente(o, 'CARTA')).toBe(false);
    expect(estaVigente(o, 'WHATSAPP')).toBe(false);
    expect(estaVigente({ activo: true, canales: ['BOT'] }, 'WHATSAPP')).toBe(true);
  });

  it('valores por defecto de una oferta nueva: WhatsApp solo donde el bot ya aplica el tipo', () => {
    expect(canalesPorDefecto('ENVIO_GRATIS')).toEqual(['CARTA', 'ADMIN', 'BOT']);
    expect(canalesPorDefecto('DESCUENTO')).toEqual(['CARTA', 'ADMIN', 'BOT']);
    expect(canalesPorDefecto('LLEVA_PAGA')).toEqual(['CARTA', 'ADMIN', 'BOT']);
    expect(canalesPorDefecto('COMBO')).toEqual(['CARTA', 'ADMIN', 'BOT']);
  });

  it('los datos existentes siguen igual: lo que tenía BOT lo conserva, lo que no, no', () => {
    expect(ofertaIncluyeCanal(['CARTA', 'ADMIN', 'BOT'], 'BOT')).toBe(true);
    expect(ofertaIncluyeCanal(['CARTA', 'ADMIN'], 'BOT')).toBe(false);
    expect(ofertaIncluyeCanal(['CARTA', 'ADMIN'], 'CARTA') && ofertaIncluyeCanal(['CARTA', 'ADMIN'], 'ADMIN')).toBe(true);
  });
});

describe('Envío gratis en el bot de WhatsApp', () => {
  it('vigente (miércoles 14:00 Lima, hora de Lima y día): el envío del bot es 0 con la promo', async () => {
    const r = await calcularEnvioDelivery(prismaCon([base()]), { subtotal: 30, tarifaZona: 5, canal: 'WHATSAPP', ahora: MIE_14H });
    expect(r.envio).toBe(0);
    expect(r.promo?.nombre).toBe('Delivery gratis de 2 a 6 pm');
  });

  it('18:00 ya no (hora hasta exclusiva) y otro día tampoco: se cobra la zona', async () => {
    expect((await calcularEnvioDelivery(prismaCon([base()]), { subtotal: 30, tarifaZona: 5, canal: 'WHATSAPP', ahora: MIE_18H })).envio).toBe(5);
    expect((await calcularEnvioDelivery(prismaCon([base()]), { subtotal: 30, tarifaZona: 5, canal: 'BOT', ahora: MARTES_14H })).envio).toBe(5);
  });

  it('con WhatsApp apagado el bot cobra el envío aunque la carta no', async () => {
    const o = base({ canales: ['CARTA', 'ADMIN'] });
    expect((await calcularEnvioDelivery(prismaCon([o]), { subtotal: 30, tarifaZona: 5, canal: 'WHATSAPP', ahora: MIE_14H })).envio).toBe(5);
    expect((await calcularEnvioDelivery(prismaCon([o]), { subtotal: 30, tarifaZona: 5, canal: 'CARTA', ahora: MIE_14H })).envio).toBe(0);
  });

  it('con WhatsApp encendido y carta apagada, solo el bot lo aplica', async () => {
    const o = base({ canales: ['BOT'] });
    expect(await promoEnvioGratisVigente(prismaCon([o]), 'WHATSAPP', MIE_14H)).not.toBeNull();
    expect(await promoEnvioGratisVigente(prismaCon([o]), 'CARTA', MIE_14H)).toBeNull();
  });

  it('compra mínima: por debajo se cobra; al alcanzarla es gratis', async () => {
    const p = prismaCon([base({ compra_minima: 50 })]);
    expect((await calcularEnvioDelivery(p, { subtotal: 40, tarifaZona: 5, canal: 'WHATSAPP', ahora: MIE_14H })).envio).toBe(5);
    expect((await calcularEnvioDelivery(p, { subtotal: 50, tarifaZona: 5, canal: 'WHATSAPP', ahora: MIE_14H })).envio).toBe(0);
  });

  it('límite de pedidos agotado: no aplica', async () => {
    const p = prismaCon([base({ limite_usos: 3, usos_actuales: 3 })]);
    expect((await calcularEnvioDelivery(p, { subtotal: 40, tarifaZona: 5, canal: 'WHATSAPP', ahora: MIE_14H })).envio).toBe(5);
  });

  describe('resumen del bot (vista previa del servidor)', () => {
    const pedido = (subtotal: number, modalidad = 'DELIVERY') =>
      ({ modalidad, items: [{ productoId: '1', cantidad: 1, subtotal, precioUnitario: subtotal }] }) as any;
    beforeAll(() => jest.useFakeTimers({ now: MIE_14H, doNotFake: ['nextTick', 'setImmediate'] }));
    afterAll(() => jest.useRealTimers());

    it('con la promo vigente: envío 0, nombre de la promo y, sin zona aún, igual queda gratis al ubicar', async () => {
      const v = await vistaPreviaPedidoBot({ prisma: prismaCon([base()]) }, pedido(30), null);
      expect(v).toMatchObject({ envio: 0, envioGratis: true, envioPromoNombre: 'Delivery gratis de 2 a 6 pm', envioGratisFalta: null });
    });

    it('sin promo y sin zona: el envío queda por confirmar', async () => {
      const v = await vistaPreviaPedidoBot({ prisma: prismaCon([base({ canales: ['CARTA'] })]) }, pedido(30), null);
      expect(v).toMatchObject({ envio: null, envioPromoNombre: null });
    });

    it('con compra mínima: avisa cuánto falta; al alcanzarla ya es gratis', async () => {
      const p = prismaCon([base({ compra_minima: 50 })]);
      expect(await vistaPreviaPedidoBot({ prisma: p }, pedido(38), 5)).toMatchObject({ envio: 5, envioGratisFalta: 12 });
      expect(await vistaPreviaPedidoBot({ prisma: p }, pedido(50), 5)).toMatchObject({ envio: 0, envioGratisFalta: null });
    });

    it('recojo: no hay envío ni aviso', async () => {
      expect(await vistaPreviaPedidoBot({ prisma: prismaCon([base()]) }, pedido(30, 'RECOGER'), 5)).toMatchObject({ envio: 0, envioGratis: false, envioPromoNombre: null });
    });
  });
});

describe('OfertasService: canal WhatsApp, stock y desactivación', () => {
  let service: OfertasService;
  let prisma: any;
  let auditoria: any;
  const dbOferta = (id: bigint, extra: Record<string, unknown> = {}) => ({
    id, tipo: 'DESCUENTO', nombre: `Oferta ${id}`, dias: [], canales: ['CARTA', 'ADMIN', 'BOT'], activo: true, creado_en: new Date(),
    combosPrecio: [], combosParte: [], ...extra,
  });
  const combo = (id: bigint, extra: Record<string, unknown> = {}) =>
    dbOferta(id, { tipo: 'COMBO', combosParte: [{ id: 300n, tipo: 'FIJO', cantidad: 1, categorias: [], productos: [5n], reemplazos: [] }], ...extra });
  const producto = (saldo: number) => ({ id: 5n, nombre: 'NUGGETS', categoria_id: 1n, oculto: false, agotado_hasta: null, controla_stock: true, stocks: [{ cantidad: saldo }], sabores: [], categoria: { nombre: 'X', area: { nombre: 'Y' } } });

  beforeEach(async () => {
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      oferta: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), update: jest.fn() },
      producto: { findMany: jest.fn().mockResolvedValue([]) },
      opcionRequiere: { findMany: jest.fn().mockResolvedValue([]) },
      auditoria: { findMany: jest.fn().mockResolvedValue([]) },
      person: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    const mod = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({}) } },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = mod.get(OfertasService);
  });

  it('el bot solo lista las ofertas con WhatsApp encendido', async () => {
    prisma.oferta.findMany.mockResolvedValue([dbOferta(1n), dbOferta(2n, { canales: ['CARTA', 'ADMIN'] }), dbOferta(3n, { tipo: 'ENVIO_GRATIS', canales: ['BOT'] })]);
    const lista = await service.listarOfertas(undefined, true, 'WHATSAPP');
    expect(lista.map((o) => o.id)).toEqual(['1', '3']);
    const carta = await service.listarOfertas(undefined, true, 'CARTA');
    expect(carta).toHaveLength(3);
  });

  it('un combo agotado por stock no se ofrece en el bot y vuelve solo al reponer el stock, sin tocar activo', async () => {
    prisma.oferta.findMany.mockResolvedValue([combo(10n)]);
    prisma.producto.findMany.mockResolvedValue([producto(0)]);
    const agotado = await service.listarOfertas(undefined, true, 'WHATSAPP');
    expect(agotado).toHaveLength(0);
    // el panel y la carta sí lo ven, como no disponible, y activo sigue en true
    const panel = await service.listarOfertas();
    expect(panel[0]).toMatchObject({ activo: true, disponible: false });
    expect(panel[0].motivoAgotado).toMatch(/NUGGETS/);
    // vuelve el stock
    prisma.producto.findMany.mockResolvedValue([producto(8)]);
    const repuesto = await service.listarOfertas(undefined, true, 'WHATSAPP');
    expect(repuesto.map((o) => o.id)).toEqual(['10']);
    expect(repuesto[0].disponible).toBe(true);
    expect(prisma.oferta.update).not.toHaveBeenCalled();
  });

  it('una oferta desactivada a propósito sigue desactivada aunque haya stock', async () => {
    prisma.oferta.findMany.mockResolvedValue([combo(11n, { activo: false })]);
    prisma.producto.findMany.mockResolvedValue([producto(8)]);
    const [o] = await service.listarOfertas();
    expect(o).toMatchObject({ activo: false, disponible: true });
    expect(prisma.oferta.update).not.toHaveBeenCalled();
    // con soloActivas (lo que lee el bot) ni siquiera se consulta
    expect(prisma.oferta.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {} }));
  });

  it('en el panel, una desactivada trae cuándo y quién la desactivó (de la auditoría)', async () => {
    prisma.oferta.findMany.mockResolvedValue([dbOferta(12n, { activo: false })]);
    const cuando = new Date('2026-11-01T15:00:00.000Z');
    prisma.auditoria.findMany.mockResolvedValue([{ entidad_id: 12n, en: cuando, party_id: 9n }]);
    prisma.person.findMany.mockResolvedValue([{ party_id: 9n, nombres: 'Ana', apellidos: 'Ruiz' }]);
    const [o] = await service.listarOfertas();
    expect(o.desactivadaEn).toBe(cuando.toISOString());
    expect(o.desactivadaPor).toBe('Ana Ruiz');
  });

  it('canales del combo: solo WhatsApp no sale en la carta web ni en el local; solo carta o solo local no se ofrece en el bot', async () => {
    prisma.producto.findMany.mockResolvedValue([producto(8)]);
    const todos = [
      combo(30n, { nombre: 'Solo bot', canales: ['BOT'] }),
      combo(31n, { nombre: 'Solo carta', canales: ['CARTA'] }),
      combo(32n, { nombre: 'Solo local', canales: ['ADMIN'] }),
      combo(33n, { nombre: 'Todos', canales: ['CARTA', 'ADMIN', 'BOT'] }),
    ];
    prisma.oferta.findMany.mockResolvedValue(todos);
    const carta = await service.listarOfertas(undefined, false, 'CARTA', true);
    expect(carta.map((o) => o.nombre)).toEqual(['Solo carta', 'Solo local', 'Todos']);
    const bot = await service.listarOfertas(undefined, true, 'WHATSAPP');
    expect(bot.map((o) => o.nombre)).toEqual(['Solo bot', 'Todos']);
    // y el servidor no deja venderlo por un canal apagado aunque llegue el id
    for (const [id, canal, ok] of [[30n, 'CARTA', false], [30n, 'MOZO', false], [31n, 'WHATSAPP', false], [32n, 'CARTA', false], [32n, 'WHATSAPP', false], [32n, 'MOZO', true], [30n, 'WHATSAPP', true]] as const) {
      prisma.oferta.findUnique.mockResolvedValue(todos.find((t) => t.id === id));
      const r = service.resolverPartesCombo(id, [], 1, canal);
      if (ok) await expect(r).resolves.toBeDefined();
      else await expect(r).rejects.toMatchObject({ response: { codigo: 'OFERTA_NO_APLICA_CANAL' } });
    }
  });

  it('un combo con WhatsApp apagado rechaza el id si llega desde el bot, y con WhatsApp encendido lo resuelve', async () => {
    prisma.oferta.findUnique.mockResolvedValue(combo(13n, { canales: ['CARTA', 'ADMIN'] }));
    prisma.producto.findMany.mockResolvedValue([producto(8)]);
    await expect(service.resolverPartesCombo(13, [], 1, 'WHATSAPP')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resolverPartesCombo(13, [], 1, 'WHATSAPP')).rejects.toMatchObject({ response: { codigo: 'OFERTA_NO_APLICA_CANAL' } });
    await expect(service.resolverPartesCombo(13, [], 1, 'CARTA')).resolves.toBeDefined();
    prisma.oferta.findUnique.mockResolvedValue(combo(13n, { canales: ['CARTA', 'ADMIN', 'BOT'] }));
    await expect(service.resolverPartesCombo(13, [], 1, 'WHATSAPP')).resolves.toBeDefined();
  });

  it('descuentos por canal: el bot solo aplica el descuento con WhatsApp encendido', async () => {
    const d = (canales: string[]) => ({ ...dbOferta(20n, { descuento_tipo: 'PORCENTAJE', descuento_valor: 10, hora_desde: null, hora_hasta: null, fecha_desde: null, fecha_hasta: null, limite_usos: null, usos_actuales: 0, compra_minima: null, alcance_categoria_id: null, alcance_producto_id: null, solo_primera_compra: false, no_suma_beneficios: false, canales }) });
    prisma.reglaAcumulacion = { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({ id: 1, cupon_con_descuento: false, promo_con_descuento: false, cupones_por_comprobante: 1, texto_pie: null }), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() };
    const lineas = [{ productoId: 1n, categoriaId: 1n, cantidad: 1, subtotal: 100, precioUnitario: 100 }];
    prisma.oferta.findMany.mockResolvedValueOnce([d(['CARTA', 'ADMIN'])]).mockResolvedValueOnce([]);
    const sinBot = await service.calcularDescuentosParaPedido({ subtotal: 100, lineas, canal: 'WHATSAPP' });
    expect(sinBot.descuentoTotal).toBe(0);
    prisma.oferta.findMany.mockResolvedValueOnce([d(['CARTA', 'ADMIN', 'BOT'])]).mockResolvedValueOnce([]);
    const conBot = await service.calcularDescuentosParaPedido({ subtotal: 100, lineas, canal: 'WHATSAPP' });
    expect(conBot.descuentoTotal).toBe(10);
    prisma.oferta.findMany.mockResolvedValueOnce([d(['CARTA', 'ADMIN'])]).mockResolvedValueOnce([]);
    const mozo = await service.calcularDescuentosParaPedido({ subtotal: 100, lineas, canal: 'MOZO' });
    expect(mozo.descuentoTotal).toBe(10);
  });
});

describe('ninguna tarea apaga ofertas por stock', () => {
  it('fuera de ofertas.service (edición y activar/desactivar manual) nadie escribe `activo` en una oferta', () => {
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) recorrer(p);
        else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) archivos.push(p);
      }
    };
    recorrer(join(__dirname, '..', '..'));
    const culpables = archivos.filter((p) => {
      if (p.endsWith('ofertas.service.ts')) return false;
      const t: string = readFileSync(p, 'utf8');
      return /\.oferta\.(update|updateMany)\(\s*\{[^}]*\{[^}]*activo/s.test(t) || /UPDATE\s+"?regla_acumulacion"?\s+SET[^;]*activo/i.test(t);
    });
    expect(culpables).toEqual([]);
  });
});

describe('textos del bot de envío gratis', () => {
  it('usa el texto por defecto y acepta uno configurado con {promo}', () => {
    expect(TEXTOS_BOT.lineaEnvioGratisBot('Delivery gratis de 2 a 6 pm')).toBe('🛵 Envío gratis por «Delivery gratis de 2 a 6 pm»');
    expect(TEXTOS_BOT.lineaEnvioGratisBot('Dulce', 'Sin envío: {promo}')).toBe('Sin envío: Dulce');
    expect(TEXTOS_BOT.lineaFaltaEnvioGratisBot(12)).toBe('Te faltan S/ 12.00 para envío gratis 🛵');
  });
  it('el resumen final reemplaza «Envío: …» por la línea de la promo', () => {
    const t = TEXTOS_BOT.pedidoResumenFinal({ lineasTexto: '1 x Dona', envioTexto: 'gratis', envioLinea: '🛵 Envío gratis por «X»', faltaEnvioTexto: undefined, total: 10, modalidad: 'Delivery', pagoTexto: 'Efectivo', tiempoMin: 20, tiempoMax: 30 });
    expect(t).toContain('🛵 Envío gratis por «X»');
    expect(t).not.toContain('Envío: gratis');
  });
});
