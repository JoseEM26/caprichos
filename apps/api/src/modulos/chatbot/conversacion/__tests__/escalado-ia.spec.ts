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
import { IaHerramientasService, POLITICAS_DE_PAGO } from '../../ia/ia-herramientas.service';
import { PROMPT_SISTEMA_CAPRI } from '../../ia/prompt-sistema';
import { ChatbotConfiguracionService } from '../../configuracion/chatbot-configuracion.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from '../../puerto/whatsapp-mensajeria.puerto';
import { EventosGateway } from '../../../../comun/socket/eventos.gateway';
import { AlertasEsperaService } from '../../avisos-internos/alertas-espera.service';
import { detectarCasoAtascado } from '../escalado-ia.util';

const RESUMEN_PEDIDO = 'CP-0201 (COLA, DELIVERY) · total S/ 40 · pagado por Caja S/ 0 · saldo S/ 40 · envío NO sumado al total';

/** Conversación real pegada por el dueño (Yape parcial, delivery por pagar en efectivo). */
const CHAT = [
  'Ya pagué por yape una parte y quiero pagar lo restante en efectivo al recibir',
  'Esque ya cancelé pero no me sumaron el delivery',
  'No puedo volver a yapear',
  'La máquina no me entiende 😅',
];

describe('Escalado de la IA a una persona (caso Yape parcial + delivery en efectivo)', () => {
  let service: EjecutorConversacionService;
  let prisma: any;
  let ia: any;
  let mensajeria: any;
  let conv: any;
  let historial: any[];
  let notasCreadas: any[];

  const respuestaIa = (texto: string, extra: any = {}) => ({
    exito: true, respuestaTexto: texto, confianza: 0.9, necesitaDerivar: false, quierePedir: false,
    herramientasUsadas: ['estadoDePedido', 'politicasDePago'], tokensEntrada: 1, tokensSalida: 1, costoUsdEstimado: 0,
    resultadoRegistro: 'EXITO', ...extra,
  });

  beforeEach(async () => {
    notasCreadas = [];
    historial = [];
    conv = { id: 1n, telefono: '51987654321', tomado_por: null, ultima_actividad: new Date(), urgente: false, motivo_derivacion: null, duenio: 'BOT', estado: 'ABIERTA', flujo: { version: 2, estado: 'DUDA_IA', repreguntasFallidas: 0 } };
    prisma = {
      parametro: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: { findUnique: jest.fn(async () => conv), update: jest.fn().mockResolvedValue({}) },
      mensajeChat: {
        create: jest.fn(async ({ data }: any) => { if (data.contenido?.nota_asesor) notasCreadas.push(data); return { id: 1n }; }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(async () => [...historial].reverse()),
      },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 99n }) },
      pedido: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
      reserva: { findMany: jest.fn().mockResolvedValue([]) },
      solicitudReserva: { count: jest.fn().mockResolvedValue(0) },
    };
    mensajeria = {
      enviarTexto: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'm' }),
      enviarBotones: jest.fn().mockResolvedValue({ exito: true, waMessageId: 'm' }),
    };
    ia = {
      estaDisponible: jest.fn().mockResolvedValue(true),
      procesarConsulta: jest.fn().mockResolvedValue(respuestaIa('Tu saldo es S/ 40; puedes pagarlo en efectivo al recibir.')),
      resumenPedidoParaAsesor: jest.fn().mockResolvedValue(RESUMEN_PEDIDO),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EjecutorConversacionService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({ set: jest.fn().mockResolvedValue('OK'), get: jest.fn().mockResolvedValue(null), incr: jest.fn().mockResolvedValue(1) }) } },
        { provide: ConfigService, useValue: { get: (k: string, d?: any) => (k === 'CARTA_URL_PUBLICA' ? 'https://caprichos.pe/carta' : d) } },
        { provide: LocalService, useValue: { obtenerEstadoCarta: jest.fn().mockResolvedValue({ abierta: true, abre: '12:00', cierra: '23:00', texto: 'Abierto' }), obtenerDatosPublicosLocal: jest.fn().mockResolvedValue({ direccion: 'Campoy' }) } },
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
  });

  const cliente = async (texto: string) => {
    historial.push({ autor: 'CLIENTE', en: new Date(), contenido: { texto } });
    return service.procesarMensajeEntrante(1n, { texto });
  };
  const huboDerivacion = () => prisma.conversacion.update.mock.calls.some(([a]: any) => a.data?.urgente === true && a.data?.duenio === 'PERSONA');

  it('primeros mensajes: la IA responde y no deriva', async () => {
    await cliente(CHAT[0]);
    expect(ia.procesarConsulta).toHaveBeenCalledTimes(1);
    expect(huboDerivacion()).toBe(false);
    expect(notasCreadas).toHaveLength(0);
  });

  it('«La máquina no me entiende»: responde, deriva marcando Necesita asesor y deja el resumen para el asesor', async () => {
    historial.push({ autor: 'CLIENTE', en: new Date(), contenido: { texto: CHAT[0] } }, { autor: 'BOT', en: new Date(), contenido: { texto: 'Tu saldo es S/ 40' } });
    await cliente(CHAT[3]);
    expect(huboDerivacion()).toBe(true);
    const upd = prisma.conversacion.update.mock.calls.map(([a]: any) => a.data).find((d: any) => d.urgente);
    expect(upd.motivo_derivacion).toBe('FRUSTRACION');
    expect(upd.flujo.escalado_ia).toEqual({ en: expect.any(String), esperaEnviada: false });
    // una sola respuesta al cliente (sin mensajes extra) que menciona a una persona
    expect(mensajeria.enviarBotones).toHaveBeenCalledTimes(1);
    expect(mensajeria.enviarBotones.mock.calls[0][1]).toMatch(/persona|equipo/i);
    // nota interna con pedido, saldo y lo que la IA respondió; aviso al panel (no WhatsApp al equipo)
    expect(notasCreadas).toHaveLength(1);
    const nota = notasCreadas[0].contenido;
    expect(nota.nota_asesor).toBe(true);
    expect(nota.texto).toContain('saldo S/ 40');
    expect(nota.texto).toContain('envío NO sumado');
    expect(nota.texto).toContain('La máquina no me entiende');
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
  });

  it('la conversación completa: repite y se frustra → deriva en ese turno, no antes', async () => {
    for (const t of CHAT.slice(0, 3)) await cliente(t);
    // 3er mensaje: tema de pago ya van 2 mensajes → deriva
    expect(huboDerivacion()).toBe(true);
  });

  it('ya escalado y sin respuesta de persona: no repite aviso ni nota', async () => {
    conv.urgente = true;
    conv.duenio = 'PERSONA';
    conv.flujo = { version: 2, estado: 'DUDA_IA', repreguntasFallidas: 0, escalado_ia: { en: new Date().toISOString(), esperaEnviada: false } };
    await cliente(CHAT[3]);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
    expect(notasCreadas).toHaveLength(0);
  });

  it('chat tomado por un asesor: el bot no actúa', async () => {
    conv.tomado_por = 5n;
    conv.duenio = 'PERSONA';
    const r = await cliente(CHAT[3]);
    expect(r).toBe(false);
    expect(ia.procesarConsulta).not.toHaveBeenCalled();
    expect(mensajeria.enviarBotones).not.toHaveBeenCalled();
  });

  it('IA con error o sin presupuesto: deriva a una persona con el resumen', async () => {
    ia.procesarConsulta.mockResolvedValue(respuestaIa('Por el momento nuestra asistencia automática no está disponible. Te voy a transferir con un asesor.', { exito: false, necesitaDerivar: true, motivoDerivacion: 'tope mensual' }));
    await cliente(CHAT[0]);
    expect(huboDerivacion()).toBe(true);
    expect(notasCreadas).toHaveLength(1);
  });

  it('fuera de horario dice cuándo responderán', async () => {
    (service as any).localService.obtenerEstadoCarta.mockResolvedValue({ abierta: false, abre: '12:00', cierra: '23:00', texto: 'Cerrado' });
    await cliente(CHAT[3]);
    expect(mensajeria.enviarBotones.mock.calls[0][1]).toMatch(/fuera de horario.*12:00/);
  });
});

describe('detectarCasoAtascado', () => {
  it('frustración y pedido de persona', () => {
    for (const t of ['La máquina no me entiende', 'quiero un asesor', 'hablar con una persona', 'quiero hacer un reclamo']) {
      expect(detectarCasoAtascado(t, []).atascado).toBe(true);
    }
  });
  it('repetir la misma duda', () => {
    const h = [{ autor: 'CLIENTE', texto: 'no me sumaron el delivery en mi pedido' }];
    expect(detectarCasoAtascado('no me sumaron el delivery, mi pedido', h)).toEqual({ atascado: true, motivo: 'REPITE' });
  });
  it('una duda normal no deriva', () => {
    expect(detectarCasoAtascado('¿qué postres tienen?', [{ autor: 'CLIENTE', texto: 'hola' }]).atascado).toBe(false);
  });
});

describe('IA con datos reales del pedido y políticas', () => {
  it('ve saldo, plan, tarifa de la zona y si el envío no está sumado', async () => {
    const pedido = {
      codigo: 'CP-0201', estado: 'COLA', modalidad: 'DELIVERY', total: 40, propina: 0, envio: null, pago_estado: 'PENDIENTE',
      pago_metodo: 'EFECTIVO', paga_con: 50, cliente_telefono: '51987654321', creado_en: new Date(), lineas: [],
      planPago: [{ medio: 'YAPE', monto: 35 }, { medio: 'EFECTIVO', monto: 5 }], cobros: [], vouchers: [{ revisado_en: null }], zona: { tarifa: 5 },
    };
    const prisma: any = { pedido: { findFirst: jest.fn().mockResolvedValue(pedido), findUnique: jest.fn() } };
    const h = new IaHerramientasService(prisma);
    const r: any = await h.estadoDePedido('', '51987654321');
    expect(r.pago.saldoPorCobrar).toBe(40);
    expect(r.pago.montoPorCobrarAlRecibirSegunPlan).toBe(5);
    expect(r.pago.vouchersEnRevision).toBe(1);
    expect(r.delivery).toMatchObject({ envioIncluidoEnTotal: false, tarifaDeLaZona: 5 });
    const res = await h.resumenPedidoParaAsesor('51987654321');
    expect(res).toContain('envío NO sumado');
    expect(res).toContain('YAPE 35 + EFECTIVO 5');
  });

  it('las políticas reales incluyen efectivo al recibir en delivery y el prompt prohíbe inventar otra', async () => {
    const h = new IaHerramientasService({} as any);
    expect(h.obtenerDefinicionesHerramientas().map((d) => d.function.name)).toContain('politicasDePago');
    const r = await h.ejecutarHerramienta('politicasDePago', {}, {});
    expect(r.resultado).toBe(POLITICAS_DE_PAGO);
    expect(POLITICAS_DE_PAGO.delivery).toMatch(/efectivo al recibir/);
    expect(PROMPT_SISTEMA_CAPRI).toMatch(/NUNCA afirmes una política de pago/);
    expect(PROMPT_SISTEMA_CAPRI).toMatch(/NO lo hagas ni lo prometas hecho/);
    expect(PROMPT_SISTEMA_CAPRI).toMatch(/una persona del equipo lo confirmará/);
  });

  it('pasarAPersona lleva la solicitud (la IA no ejecuta cambios)', async () => {
    const h = new IaHerramientasService({} as any);
    const r = await h.ejecutarHerramienta('pasarAPersona', { motivo: 'pago', solicitud: 'cobrar S/ 5 en efectivo al recibir' }, {});
    expect(r.necesitaDerivar).toBe(true);
    expect(r.resultado.solicitud).toContain('S/ 5');
  });
});

describe('Vigilante de casos escalados por la IA: un solo mensaje de espera', () => {
  const crear = (opts: { personaRespondio?: boolean; abierta?: boolean; minutos?: number } = {}) => {
    const en = new Date(Date.now() - (opts.minutos ?? 12) * 60000).toISOString();
    const conv: any = { id: 7n, telefono: '51987654321', nombre_contacto: 'Ana', motivo_derivacion: 'FRUSTRACION', flujo: { escalado_ia: { en, esperaEnviada: false } } };
    const prisma: any = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: { findMany: jest.fn().mockResolvedValue([conv]), update: jest.fn(async ({ data }: any) => { conv.flujo = data.flujo; }) },
      mensajeChat: { findFirst: jest.fn().mockResolvedValue(opts.personaRespondio ? { id: 1n } : null) },
    };
    const outbox: any = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    const avisos: any = { enviarAvisoAdmin: jest.fn().mockResolvedValue({}) };
    const redis: any = { obtenerCliente: () => ({ set: jest.fn().mockResolvedValue('OK') }) };
    const local: any = { obtenerEstadoCarta: jest.fn().mockResolvedValue({ abierta: opts.abierta !== false, abre: '12:00' }) };
    const svc = new AlertasEsperaService(prisma, redis, avisos, outbox, undefined, local);
    return { svc, outbox, avisos, prisma, conv };
  };

  it('a los 10 min sin respuesta: un mensaje al cliente y un aviso por panel/correo sin WhatsApp al equipo; luego nada más', async () => {
    const { svc, outbox, avisos } = crear();
    expect(await svc.vigilarEscaladosIa(new Date())).toBe(1);
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).toMatch(/Ya avisé al equipo.*dejo anotada/);
    expect(avisos.enviarAvisoAdmin.mock.calls[0][5]).toEqual({ correo: true, sinWhatsapp: true });
    expect(await svc.vigilarEscaladosIa(new Date())).toBe(0);
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
    expect(avisos.enviarAvisoAdmin).toHaveBeenCalledTimes(1);
  });

  it('antes del plazo no envía nada', async () => {
    const { svc, outbox } = crear({ minutos: 3 });
    expect(await svc.vigilarEscaladosIa(new Date())).toBe(0);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('si un asesor ya respondió, no molesta al cliente', async () => {
    const { svc, outbox, avisos } = crear({ personaRespondio: true });
    expect(await svc.vigilarEscaladosIa(new Date())).toBe(0);
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(avisos.enviarAvisoAdmin).not.toHaveBeenCalled();
  });

  it('fuera de horario avisa cuándo responderán', async () => {
    const { svc, outbox } = crear({ abierta: false });
    await svc.vigilarEscaladosIa(new Date());
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).toMatch(/fuera de horario.*12:00/);
  });
});
