jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { transicionarEstado } from '../conversacion/maquina-estados';
import { normalizarEntrada } from '../conversacion/normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../conversacion/tipos-conversacion';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { AutorespuestaWhatsappService } from '../servicios/autorespuesta-whatsapp.service';

/** Bot con el local cerrado y «Pedidos programados fuera de horario» encendido: solo atiende para programar (llevar o delivery). */
const iso = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00.000-05:00`).toISOString();
const PROGRAMACION = {
  dias: [
    { fecha: '2027-03-01', horas: [{ hora: '10:00', iso: iso('2027-03-01', '10:00') }, { hora: '10:30', iso: iso('2027-03-01', '10:30') }] },
    { fecha: '2027-03-02', horas: [{ hora: '10:00', iso: iso('2027-03-02', '10:00') }] },
  ],
};
const ctx = (extra: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
  nombreCliente: 'Cliente Prueba',
  telefonoCliente: '999000111',
  cartaUrlPublica: 'https://carta.prueba.test',
  datosLocal: { abierta: false, abre: '10:00', cierra: '12:00', textoEstado: 'Abrimos mañana a las 10:00', direccion: 'x', enlaceMapa: 'm' } as any,
  datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, envioGratis: 1 },
  categoriasCarta: [],
  ofertas: [],
  ...extra,
});
const programando = (): ContextoConversacion => ctx({ soloProgramar: true, programacion: PROGRAMACION });
const base = (estado: string, pedido?: any): FlujoConversacion => ({ version: 2, repreguntasFallidas: 0, estado: estado as any, ...(pedido ? { pedido } : {}) }) as any;
const paso = (f: FlujoConversacion, e: any, c: ContextoConversacion) => transicionarEstado(f, normalizarEntrada(e), c);
const ids = (r: any) => (r.acciones.flatMap((a: any) => [...(a.botones ?? []), ...(a.filas ?? [])]) as any[]).map((b) => b.id);
const textos = (r: any) => r.acciones.map((a: any) => a.texto).join('\n');
const tipos = (r: any) => r.acciones.map((a: any) => a.tipo);

describe('Bot cerrado: solo programar', () => {
  describe('saludo y otros temas', () => {
    it('un «hola» explica que estamos cerrados y ofrece SOLO programar (sin el menú completo)', () => {
      const r = paso(base('INICIO'), { texto: 'hola' }, programando());
      expect(tipos(r)).toEqual(['enviarBotones']);
      expect(textos(r)).toContain('Ahora estamos cerrados');
      expect(textos(r)).toContain('programarte tu pedido para llevar o delivery dentro de nuestro horario');
      expect(ids(r)).toEqual(['pedir']);
    });

    it('cualquier otro tema recibe el mismo aviso de cerrado con la oferta de programar', () => {
      const r = paso(base('MENU'), { texto: 'tienen tortas de chocolate hoy' }, programando());
      expect(textos(r)).toContain('Ahora estamos cerrados');
      expect(ids(r)).toEqual(['pedir']);
    });

    it('pedir una persona o preguntar por su pedido sigue su camino de siempre', () => {
      const persona = paso(base('MENU'), { texto: 'quiero hablar con una persona' }, programando());
      expect(persona.nuevoEstado).toBe('ATENCION_PERSONA');
      const miPedido = paso(base('MENU'), { texto: 'cual es el estado de mi pedido' }, programando());
      expect(ids(miPedido)).not.toEqual(['pedir']);
    });

    it('parámetro apagado (sin soloProgramar): el bot queda como hoy — el menú de siempre y «no tomamos pedidos fuera de horario»', () => {
      const saludo = paso(base('INICIO'), { texto: 'hola' }, ctx());
      expect(saludo.acciones[0].tipo).toBe('enviarLista');
      expect(textos(saludo)).not.toContain('programarte');
      const pedir = paso(base('MENU'), { buttonPayload: 'pedir' }, ctx());
      expect(textos(pedir)).toContain('No tomamos pedidos fuera de horario');
      expect(pedir.nuevoEstado).toBe('MENU');
    });
  });

  describe('flujo de pedido: día y hora primero', () => {
    it('«Programar mi pedido» abre la lista de días (numerada en Evolution) con los días ofrecidos', () => {
      const r = paso(base('MENU'), { buttonPayload: 'pedir' }, programando());
      expect(r.nuevoEstado).toBe('PEDIDO_PROG_DIA');
      expect(ids(r)).toEqual(['ped_prog_dia_2027-03-01', 'ped_prog_dia_2027-03-02']);
      expect(textos(r)).toContain('¿Para qué día');
    });

    it('elegir un día muestra solo las horas de ese día dentro del horario', () => {
      const f = paso(base('MENU'), { buttonPayload: 'pedir' }, programando()).nuevoFlujo;
      const r = paso(f, { listReplyId: 'ped_prog_dia_2027-03-01' }, programando());
      expect(r.nuevoEstado).toBe('PEDIDO_PROG_HORA');
      expect(ids(r)).toEqual(['ped_prog_hora_10:00', 'ped_prog_hora_10:30', 'ped_prog_otro_dia']);
    });

    it('un día que no se ofreció se rechaza con amabilidad y se vuelve a preguntar', () => {
      const f = paso(base('MENU'), { buttonPayload: 'pedir' }, programando()).nuevoFlujo;
      const r = paso(f, { listReplyId: 'ped_prog_dia_2027-03-09' }, programando());
      expect(r.nuevoEstado).toBe('PEDIDO_PROG_DIA');
      expect(textos(r)).toContain('Elige uno de la lista');
    });

    it('elegir la hora guarda el instante pactado y sigue con llevar o delivery', () => {
      let f = paso(base('MENU'), { buttonPayload: 'pedir' }, programando()).nuevoFlujo;
      f = paso(f, { listReplyId: 'ped_prog_dia_2027-03-01' }, programando()).nuevoFlujo;
      const r = paso(f, { listReplyId: 'ped_prog_hora_10:30' }, programando());
      expect(r.nuevoEstado).toBe('PEDIDO_MODALIDAD');
      expect(r.nuevoFlujo.pedido?.programadoPara).toBe(iso('2027-03-01', '10:30'));
      expect(ids(r)).toEqual(['ped_mod_delivery', 'ped_mod_recojer']); // sin «comer aquí»
      expect(textos(r)).toContain('tu pedido será para el');
    });

    it('«Pedir este» de un producto con el local cerrado ofrece programar el pedido (no dice «no tomamos pedidos»)', () => {
      const r = paso(base('MENU'), { buttonPayload: 'ped_prod_12' }, programando());
      expect(ids(r)).toEqual(['pedir']);
      expect(textos(r)).toContain('programarte tu pedido');
      expect(textos(r)).not.toContain('No tomamos pedidos');
    });

    it('«Elegir otro día» vuelve a la lista de días', () => {
      let f = paso(base('MENU'), { buttonPayload: 'pedir' }, programando()).nuevoFlujo;
      f = paso(f, { listReplyId: 'ped_prog_dia_2027-03-01' }, programando()).nuevoFlujo;
      expect(paso(f, { listReplyId: 'ped_prog_otro_dia' }, programando()).nuevoEstado).toBe('PEDIDO_PROG_DIA');
    });

    it('sin horarios disponibles no deja pedir: avisa y vuelve al menú', () => {
      const r = paso(base('MENU'), { buttonPayload: 'pedir' }, ctx({ soloProgramar: true, programacion: { dias: [] } }));
      expect(textos(r)).toContain('no tengo horarios disponibles');
      expect(r.nuevoEstado).toBe('MENU');
    });
  });

  describe('pago de un pedido programado', () => {
    const mediosTodos = { efectivo: { activo: true }, yape: { activo: true }, plin: { activo: true }, tarjeta: { activo: true }, transferencia: { activo: true } };
    const contextoPago = () => ctx({ soloProgramar: true, programacion: PROGRAMACION, datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPago: mediosTodos } });
    const pedido = (extra: any = {}) => ({
      estadoInterno: 'PEDIDO_COMPROBANTE_TIPO', modalidad: 'RECOGER', programadoPara: iso('2027-03-01', '10:30'),
      items: [{ lineaId: 'a', productoId: 'a', productoNombre: 'Dona', categoriaId: 'c', categoriaNombre: 'C', cantidad: 2, precioUnitario: 10, subtotal: 20, opciones: [], noSumaBeneficios: false }],
      cliente: { nombre: 'Cliente Prueba', telefono: '999000111' }, telefonoSugerido: '999000111',
      comprobante: { tipo: 'NINGUNO' },
      ...extra,
    });

    it('antes de elegir el medio pregunta el camino: pagar al recibir o dejarlo pagado', () => {
      const r = paso(base('PEDIDO_COMPROBANTE_TIPO', pedido()), { buttonPayload: 'ped_comp_simple' }, contextoPago());
      expect(r.nuevoEstado).toBe('PEDIDO_PAGO_CAMINO');
      expect(ids(r)).toEqual(['ped_camino_recibir', 'ped_camino_pagado']);
    });

    it('«Pagar al recibir» ofrece los medios habilitados (sin Culqi ni pago dividido)', () => {
      const r = paso(base('PEDIDO_PAGO_CAMINO', pedido({ estadoInterno: 'PEDIDO_PAGO_CAMINO' })), { buttonPayload: 'ped_camino_recibir' }, contextoPago());
      expect(r.nuevoEstado).toBe('PEDIDO_MEDIO_PAGO');
      expect(ids(r)).toEqual(expect.arrayContaining(['ped_pago_efectivo', 'ped_pago_yape', 'ped_pago_plin', 'ped_pago_tarjeta', 'ped_pago_transf']));
      expect(ids(r)).not.toContain('ped_pago_dividir');
    });

    it('«Dejarlo pagado» ofrece solo Yape, Plin y transferencia', () => {
      const r = paso(base('PEDIDO_PAGO_CAMINO', pedido({ estadoInterno: 'PEDIDO_PAGO_CAMINO' })), { buttonPayload: 'ped_camino_pagado' }, contextoPago());
      expect(r.nuevoEstado).toBe('PEDIDO_MEDIO_PAGO');
      expect(ids(r).sort()).toEqual(['ped_pago_plin', 'ped_pago_transf', 'ped_pago_yape']);
    });

    it('«Dejarlo pagado» rechaza efectivo aunque lo escriban', () => {
      const f = base('PEDIDO_MEDIO_PAGO', pedido({ estadoInterno: 'PEDIDO_MEDIO_PAGO', pagoCamino: 'DEJAR_PAGADO' }));
      const r = paso(f, { texto: 'pago en efectivo' }, contextoPago());
      expect(r.nuevoEstado).toBe('PEDIDO_MEDIO_PAGO');
      expect(r.nuevoFlujo.pedido?.pago?.metodo).toBeUndefined();
    });

    it('al confirmar, el pedido sale con programadoPara en el DTO y en la acción', () => {
      const f = base('PEDIDO_RESUMEN_CONFIRMAR', pedido({ estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR', pagoCamino: 'DEJAR_PAGADO', pago: { metodo: 'YAPE' } }));
      const r = paso(f, { buttonPayload: 'ped_confirmar' }, contextoPago());
      const crear: any = r.acciones.find((a: any) => a.tipo === 'crearPedido');
      expect(crear.dto.programadoPara).toBe(iso('2027-03-01', '10:30'));
      expect(crear.programadoPara).toBe(iso('2027-03-01', '10:30'));
      expect(crear.dto.pago.metodo).toBe('YAPE');
      expect(crear.esPagoDigital).toBe(true);
    });

    it('sin programar (local abierto), el pedido no lleva programadoPara y el pago no pregunta camino', () => {
      const sinProg = pedido();
      delete (sinProg as any).programadoPara;
      const r = paso(base('PEDIDO_COMPROBANTE_TIPO', sinProg), { buttonPayload: 'ped_comp_simple' }, { ...contextoPago(), soloProgramar: false, datosLocal: { abierta: true } as any });
      expect(r.nuevoEstado).toBe('PEDIDO_MEDIO_PAGO');
      expect(ids(r)).toContain('ped_pago_dividir');
    });
  });
});

/** Fuera de horario, la cortesía automática deja pasar al bot solo si el parámetro está encendido. */
describe('Autorespuesta con el local cerrado', () => {
  function montar(fueraHorario: boolean) {
    const enviados: any[] = [];
    const prisma: any = {
      parametro: {
        findMany: jest.fn(async ({ where }: any) => {
          const claves: string[] = where?.clave?.in ?? [];
          return [
            { clave: 'whatsapp_proveedor', valor: 'EVOLUTION' },
            ...(claves.includes('pedidos_programados_fuera_horario') ? [{ clave: 'pedidos_programados_fuera_horario', valor: fueraHorario ? 'si' : 'no' }] : []),
          ];
        }),
        findUnique: jest.fn(async ({ where }: any) => (where.clave === 'chatbot_activo' ? { valor: 'si' } : null)),
      },
      pedido: { count: jest.fn(async () => 0) },
      salienteWhatsapp: { findFirst: jest.fn(async () => null) },
      horarioDia: { findUnique: jest.fn(async () => ({ cerrado: false, abre: '09:00' })) },
    };
    const outbox: any = { encolar: jest.fn(async (a: any) => { enviados.push(a); return true; }), despertar: jest.fn() };
    const cerrado = { abierta: false, motivo: 'HORARIO', abre: '14:00' };
    const local: any = { obtenerEstadoCarta: jest.fn(async () => cerrado), obtenerEstadoCartaSeguro: jest.fn(async () => cerrado) };
    const svc = new AutorespuestaWhatsappService(prisma, outbox, {} as any, { get: () => undefined } as any, new EvolutionConfigService(prisma), local);
    const hablar = () => svc.atender({ telefono: '51999000111', nombre: 'Cliente Prueba', texto: 'Hola', puedeProcesarMotor: true, conversacion: { id: 1n, flujo: { estado: 'MENU' }, estado: 'ABIERTA', duenio: 'BOT', tomado_por: null } });
    return { hablar, enviados };
  }

  it('parámetro encendido: no manda el aviso fijo, deja que el bot ofrezca programar', async () => {
    const { hablar, enviados } = montar(true);
    expect(await hablar()).toBe(false);
    expect(enviados).toHaveLength(0);
  });

  it('parámetro apagado: el aviso único de cerrado de siempre', async () => {
    const { hablar, enviados } = montar(false);
    expect(await hablar()).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].carga.textoLibre).toContain('Ahora estamos cerrados');
  });
});
