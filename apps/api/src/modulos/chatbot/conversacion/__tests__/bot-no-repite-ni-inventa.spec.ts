jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EjecutorConversacionService } from '../ejecutor-conversacion.service';
import { PrismaService } from '../../../../comun/prisma/prisma.service';
import { RedisService } from '../../../../comun/redis/redis.service';
import { LocalService } from '../../../local/local.service';
import { CatalogoService } from '../../../catalogo/catalogo.service';
import { OfertasService } from '../../../ofertas/ofertas.service';
import { ZonasService } from '../../../zonas/zonas.service';
import { ReservasService } from '../../../reservas/reservas.service';
import { PedidosService } from '../../../pedidos/pedidos.service';
import { ChatbotIaService } from '../../ia/chatbot-ia.service';
import { ChatbotConfiguracionService } from '../../configuracion/chatbot-configuracion.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from '../../puerto/whatsapp-mensajeria.puerto';
import { EventosGateway } from '../../../../comun/socket/eventos.gateway';

const conversacion = () => ({
  telefono: '51987654321', tomado_por: null, ultima_actividad: new Date(), urgente: false, motivo_derivacion: null,
  id: 1n, duenio: 'BOT', estado: 'ABIERTA', flujo: { version: 2, estado: 'MENU', repreguntasFallidas: 0 },
});

describe('Ejecutor: sin repetir y sin inventar', () => {
  let service: EjecutorConversacionService;
  let enviados: any[];
  let ia: any;
  beforeEach(async () => {
    enviados = [];
    const prismaMock: any = {
      parametro: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: { findUnique: jest.fn().mockImplementation(() => Promise.resolve(conversacion())), update: jest.fn().mockResolvedValue({}) },
      mensajeChat: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          if (data.direccion === 'SALE') enviados.push(data.contenido);
          return Promise.resolve({ id: 1n });
        }),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(enviados.length ? { contenido: enviados[enviados.length - 1] } : null)),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 99n }) },
      pedido: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
      reserva: { findMany: jest.fn().mockResolvedValue([]) },
      solicitudReserva: { count: jest.fn().mockResolvedValue(0) },
      solicitudCambio: { count: jest.fn().mockResolvedValue(0) },
    };
    const ok = () => Promise.resolve({ exito: true, waMessageId: 'm' });
    const mensajeria = { enviarTexto: jest.fn(ok), enviarBotones: jest.fn(ok), enviarLista: jest.fn(ok), enviarCarrusel: jest.fn(ok), enviarImagen: jest.fn(ok) };
    ia = {
      estaDisponible: jest.fn().mockResolvedValue(true),
      procesarConsulta: jest.fn().mockResolvedValue({
        exito: true, respuestaTexto: 'Sí, hacemos tortas pequeñas desde S/ 40', necesitaDerivar: false, quierePedir: false, herramientasUsadas: [],
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EjecutorConversacionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: { obtenerCliente: () => ({ set: jest.fn().mockResolvedValue('OK'), get: jest.fn().mockResolvedValue(null), incr: jest.fn().mockResolvedValue(1) }) } },
        { provide: ConfigService, useValue: { get: (k: string, d?: any) => (k === 'CARTA_URL_PUBLICA' ? 'https://caprichos.pe/carta' : d) } },
        { provide: LocalService, useValue: { obtenerEstadoCarta: jest.fn().mockResolvedValue({ abierta: true, abre: '12:00', cierra: '23:00', texto: 'Abierto' }), obtenerDatosPublicosLocal: jest.fn().mockResolvedValue({ direccion: 'Campoy', whatsapp: '977' }) } },
        { provide: CatalogoService, useValue: { obtenerCarta: jest.fn().mockResolvedValue([]) } },
        { provide: OfertasService, useValue: { listarOfertas: jest.fn().mockResolvedValue([]) } },
        { provide: ZonasService, useValue: {} },
        { provide: ReservasService, useValue: {} },
        { provide: PedidosService, useValue: {} },
        { provide: ChatbotIaService, useValue: ia },
        { provide: ChatbotConfiguracionService, useValue: { verificarAntiSpam: jest.fn().mockResolvedValue({ permitido: true }), obtenerFuncionesActivas: jest.fn().mockResolvedValue({}), obtenerTextosBot: jest.fn().mockResolvedValue({}) } },
        { provide: WHATSAPP_MENSAJERIA_PUERTO, useValue: mensajeria },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = module.get(EjecutorConversacionService);
    jest.spyOn(service as any, 'estaChatbotActivo').mockResolvedValue(true);
    jest.spyOn(service as any, 'verificarRateLimit').mockResolvedValue(true);
    jest.spyOn(service as any, 'verificarIdempotencia').mockResolvedValue(true);
    jest.spyOn(service as any, 'verificarTopeEvolution').mockResolvedValue('OK');
  });

  it('nunca manda el mismo mensaje dos veces seguidas: el segundo es la oferta de asesor', async () => {
    ia.estaDisponible.mockResolvedValue(false);
    await service.procesarMensajeEntrante(1n, { texto: 'asdfghjk' });
    await service.procesarMensajeEntrante(1n, { texto: 'asdfghjk' });
    expect(enviados).toHaveLength(2);
    expect(enviados[0].texto).not.toEqual(enviados[1].texto);
    expect(enviados[1].texto).toContain('¿Quieres que te atienda una persona?');
    expect(enviados[1].botones.map((b: any) => b.id)).toEqual(['asesor_si', 'asesor_no']);
  });

  it('la IA que afirma precios sin herramientas se descarta y ofrece un asesor', async () => {
    await service.procesarMensajeEntrante(1n, { texto: 'tienen sillas para bebés' });
    expect(ia.procesarConsulta).toHaveBeenCalled();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].texto).not.toContain('S/ 40');
    expect(enviados[0].texto).toContain('asesor');
    expect(enviados[0].botones.map((b: any) => b.id)).toEqual(['asesor_si', 'asesor_no']);
  });
});
