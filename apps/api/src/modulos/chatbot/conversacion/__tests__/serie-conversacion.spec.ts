jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EjecutorConversacionService } from '../ejecutor-conversacion.service';
import { PrismaService } from '../../../../comun/prisma/prisma.service';
import { RedisService } from '../../../../comun/redis/redis.service';
import { EventosGateway } from '../../../../comun/socket/eventos.gateway';
import { LocalService } from '../../../local/local.service';
import { CatalogoService } from '../../../catalogo/catalogo.service';
import { OfertasService } from '../../../ofertas/ofertas.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from '../../puerto/whatsapp-mensajeria.puerto';
import { ejecutarEnSerie } from '../../utilidades/candado-serie.util';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Procesamiento en serie por conversación', () => {
  it('un trabajo que llega mientras otro corre espera y no se pierde (orden conservado)', async () => {
    const orden: string[] = [];
    const a = ejecutarEnSerie('k', null, async () => { orden.push('a1'); await esperar(40); orden.push('a2'); });
    const b = ejecutarEnSerie('k', null, async () => { orden.push('b1'); });
    const otra = ejecutarEnSerie('otra', null, async () => { orden.push('x'); });
    await Promise.all([a, b, otra]);
    expect(orden).toEqual(['a1', 'x', 'a2', 'b1']);
  });

  it('un fallo no bloquea al siguiente', async () => {
    await expect(ejecutarEnSerie('f', null, async () => { throw new Error('x'); })).rejects.toThrow();
    await expect(ejecutarEnSerie('f', null, async () => 7)).resolves.toBe(7);
  });

  describe('incidente 29/10: cupón y luego «Sí, es correcto» casi simultáneos', () => {
    let servicio: EjecutorConversacionService;
    let flujo: any;
    let eventos: string[];
    let mensajeria: any;
    let redisMem: Map<string, string>;

    const conversacion = () => ({ id: 1n, telefono: '+51987654321', duenio: 'BOT', tomado_por: null, estado: 'ABIERTA', flujo });

    beforeEach(async () => {
      redisMem = new Map();
      eventos = [];
      flujo = {
        version: 2, repreguntasFallidas: 0, estado: 'PEDIDO_PREGUNTA_CUPON', nombre_perfil_wa: 'Kevin Rosales',
        pedido: {
          estadoInterno: 'PEDIDO_PREGUNTA_CUPON', cuponPreguntado: true, modalidad: 'RECOJO', items: [
            { productoId: 'p1', nombre: 'Frappe Oreo', cantidad: 1, precioUnitario: 14.5, subtotal: 14.5, opciones: [] },
          ], cliente: { telefono: '987654321' },
        },
      };
      const redis = {
        incr: jest.fn(async (k: string) => { const v = Number(redisMem.get(k) || 0) + 1; redisMem.set(k, String(v)); return v; }),
        expire: jest.fn(), get: jest.fn(async (k: string) => redisMem.get(k) || null),
        set: jest.fn(async (k: string, v: string) => { redisMem.set(k, v); return 'OK'; }), exists: jest.fn(async () => 0),
      };
      const prisma: any = {
        conversacion: {
          findUnique: jest.fn(async () => { await esperar(5); return JSON.parse(JSON.stringify(conversacion(), (_, v) => (typeof v === 'bigint' ? `${v}n` : v)), (k, v) => (typeof v === 'string' && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v)); }),
          update: jest.fn(async ({ data }: any) => { if (data.flujo) { flujo = data.flujo; eventos.push(`guardar:${data.flujo.estado}`); } return {}; }),
        },
        parametro: { findUnique: jest.fn(async ({ where }: any) => (where.clave === 'chatbot_activo' ? { valor: 'si' } : null)) },
        mensajeChat: { create: jest.fn(async () => ({ id: 1n })), findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
        notificacion: { create: jest.fn(async () => ({ id: 1n })) },
        pedido: { findUnique: jest.fn(), findFirst: jest.fn(async () => null), count: jest.fn(async () => 0) },
        solicitudReserva: { count: jest.fn(async () => 0) }, solicitudCambio: { count: jest.fn(async () => 0) },
        reserva: { findMany: jest.fn(async () => []) },
      };
      const enviar = (tipo: string) => jest.fn(async () => { eventos.push(`enviar:${tipo}`); await esperar(30); return { exito: true, waMessageId: 'w' + Math.random() }; });
      mensajeria = { enviarTexto: enviar('texto'), enviarBotones: enviar('botones'), enviarLista: enviar('lista'), enviarImagen: enviar('imagen') };
      const mod = await Test.createTestingModule({
        providers: [
          EjecutorConversacionService,
          { provide: PrismaService, useValue: prisma },
          { provide: LocalService, useValue: { obtenerEstadoCarta: async () => ({ abierta: true, abre: '12:00', cierra: '23:00', texto: 'Abierto' }), obtenerDatosPublicosLocal: async () => ({ direccion: 'x', telefono: '9' }) } },
          { provide: CatalogoService, useValue: { obtenerCarta: async () => [] } },
          { provide: OfertasService, useValue: { listarOfertas: async () => [] } },
          { provide: ConfigService, useValue: { get: (_k: string, d?: any) => d } },
          { provide: RedisService, useValue: { obtenerCliente: () => redis } },
          { provide: WHATSAPP_MENSAJERIA_PUERTO, useValue: mensajeria },
          { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        ],
      }).compile();
      servicio = mod.get(EjecutorConversacionService);
    });

    const cupon = () => servicio.procesarMensajeEntrante(1n, { texto: 'No tengo cupón', buttonPayload: 'ped_cupon_no', tipo: 'interactive', waMessageId: 'w1' });
    const nombre = () => servicio.procesarMensajeEntrante(1n, { texto: 'Sí, es correcto', buttonPayload: 'ped_nombre_ok', tipo: 'interactive', waMessageId: 'w2' });

    it('con candado: el nombre queda confirmado y el bot avanza al siguiente paso', async () => {
      await Promise.all([ejecutarEnSerie('c', null, cupon), ejecutarEnSerie('c', null, nombre)]);
      expect(flujo.pedido.cliente.nombre).toBe('Kevin Rosales');
      expect(flujo.estado).not.toBe('PEDIDO_CONFIRMAR_NOMBRE');
      // el estado nuevo se guarda ANTES de enviar los mensajes de ese paso
      expect(eventos.indexOf('guardar:PEDIDO_CONFIRMAR_NOMBRE')).toBeLessThan(eventos.indexOf('enviar:botones'));
    });

    it('un toque de un paso que ya pasó re-muestra el paso actual en vez de callar', async () => {
      const prisma: any = (servicio as any).prisma;
      prisma.mensajeChat.findMany.mockResolvedValue([{ contenido: { texto: '¿Qué medio?', botones: [{ id: 'ped_pago_efectivo', titulo: 'Efectivo' }] } }]);
      const r = await servicio.procesarMensajeEntrante(1n, { texto: 'No tengo cupón', buttonPayload: 'ped_cupon_no', tipo: 'interactive', waMessageId: 'w9' });
      expect(r).toBe(true);
      expect(mensajeria.enviarBotones).toHaveBeenCalledWith('51987654321', expect.stringContaining('paso anterior'), expect.any(Array), expect.anything());
      expect(flujo.estado).toBe('PEDIDO_PREGUNTA_CUPON');
    });

    it('un silencio queda registrado con su motivo en el chat', async () => {
      const prisma: any = (servicio as any).prisma;
      prisma.parametro.findUnique.mockResolvedValue({ valor: 'no' });
      expect(await cupon()).toBe(false);
      expect(prisma.mensajeChat.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'SISTEMA', contenido: expect.objectContaining({ silencio: true }) }) }),
      );
    });
  });
});
