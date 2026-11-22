import { correrDocil, Objetivo } from './cliente-docil';
import { CTX_BASE, Simulador as SimPedido } from './simulador-pedido';
import { Simulador as SimConversacion } from './simulador-conversacion';

/**
 * Local CERRADO (decisión del dueño 22/11): el bot siempre contesta, avisa que no atiende para ahora y deja PROGRAMAR
 * un pedido (hoy más tarde, mañana o días después) pagado con Yape/Plin (voucher) o pendiente de pago.
 * Motor real (transicionarEstado); solo se simula la base y WhatsApp.
 */
const lima = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00.000-05:00`).toISOString();
const horas = (fecha: string, hs: string[]) => hs.map((h) => ({ hora: h, iso: lima(fecha, h) }));
// «Hoy» es 2027-03-01 a las 08:00 (antes de abrir a las 15:00); el 03-03 es feriado (no sale en la lista)
const PROGRAMACION = {
  hoy: '2027-03-01',
  dias: [
    { fecha: '2027-03-01', abre: '15:00', horas: horas('2027-03-01', ['15:00', '15:30', '16:00']) },
    { fecha: '2027-03-02', abre: '10:00', horas: horas('2027-03-02', ['10:00', '10:30']) },
    { fecha: '2027-03-04', abre: '10:00', horas: horas('2027-03-04', ['10:00']) },
  ],
};
const CERRADO = { ...CTX_BASE.datosLocal!, abierta: false, abre: '15:00', cierra: '22:00', textoEstado: 'Lunes a Domingo de 15:00 a 22:00' };
const ctxCerrado = (extra: any = {}) => ({ soloProgramar: true, programacion: PROGRAMACION, datosLocal: CERRADO, ...extra });
const obj = (p: Partial<Objetivo> = {}): Objetivo => ({ items: [{ producto: 'moka', tamano: 'grande', cantidad: 1 }], modalidad: 'RECOGER', pago: 'YAPE', ...p });
const dto = (s: SimPedido) => s.pedidos[0]?.dto ?? {};

describe('Bot con el local cerrado: programar pedidos', () => {
  it('«hola» de noche: UN mensaje que dice fuera de horario, cuándo abrimos y ofrece programar / horario / persona', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    const r = s.decir('hola');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain('fuera de horario');
    expect(r[0].texto).toContain('abrimos hoy a las 15:00');
    expect(r[0].texto).toContain('no podemos atender pedidos para ahora');
    expect(r[0].texto).toMatch(/Programar pedido/);
    expect(r[0].texto).toMatch(/Ver horario/);
    expect(r[0].texto).toMatch(/Hablar con persona/);
  });

  it('si abrimos mañana lo dice («mañana a las 10:00») y no ofrece el menú de pedido normal', () => {
    const s = new SimPedido({ ctx: ctxCerrado({ programacion: { hoy: '2027-03-01', dias: PROGRAMACION.dias.slice(1) } }) });
    const r = s.decir('hola');
    expect(r[0].texto).toContain('abrimos mañana a las 10:00');
    expect(r[0].texto).not.toMatch(/Hacer pedido/);
  });

  it('segundo mensaje: respuesta corta, no el mismo texto, y sigue ofreciendo programar', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    const a = s.decir('hola');
    const b = s.decir('buenas tardes');
    expect(b).toHaveLength(1);
    expect(b[0].texto).not.toBe(a[0].texto);
    expect(b[0].texto.length).toBeLessThan(a[0].texto.length);
    expect(b[0].texto).toContain('Seguimos fuera de horario');
    expect(b[0].texto).toMatch(/Programar pedido/);
  });

  it('«¿a qué hora abren?» da el horario y vuelve a ofrecer programar', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    s.decir('hola');
    const r = s.decir('a que hora abren');
    expect(r).toHaveLength(1);
    expect(r[0].texto).toMatch(/horario/i);
    expect(r[0].texto).toMatch(/Programar pedido/);
  });

  it('programar para mañana 10:00 y pagar ahora con Yape: el pedido sale con la hora pactada y el camino de voucher', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    s.decir('hola');
    s.decir('1'); // Programar pedido
    s.pulsar('ped_prog_dia_2027-03-02');
    const ok = s.pulsar('ped_prog_hora_10:00');
    expect(ok[0].texto).toContain('martes 2 de marzo a las 10:00');
    correrDocil(s, obj({ modalidad: 'RECOGER', pago: 'YAPE' }));
    expect(s.pedidos).toHaveLength(1);
    expect(s.pedidos[0].programadoPara).toBe(lima('2027-03-02', '10:00'));
    expect(dto(s).programadoPara).toBe(lima('2027-03-02', '10:00'));
    expect(dto(s).pago.metodo).toBe('YAPE');
    expect(s.pedidos[0].esPagoDigital).toBe(true);
    expect(s.ultimo).toMatch(/programado/i);
  });

  it('hoy más tarde: antes de abrir pide para las 15:00 de HOY y paga al recibir (pendiente de pago)', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    s.decir('hola');
    s.pulsar('pedir');
    s.pulsar('ped_prog_dia_2027-03-01');
    s.pulsar('ped_prog_hora_15:00');
    correrDocil(s, obj({ modalidad: 'RECOGER', pago: 'EFECTIVO' }));
    expect(s.pedidos).toHaveLength(1);
    expect(s.pedidos[0].programadoPara).toBe(lima('2027-03-01', '15:00'));
    expect(s.pedidos[0].esPagoDigital).toBeFalsy();
  });

  it('pedido en una frase después de elegir día y hora («2 frappé moka grande»)', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    s.pulsar('pedir');
    s.pulsar('ped_prog_dia_2027-03-02');
    s.pulsar('ped_prog_hora_10:30');
    s.decir('para llevar');
    s.decir('2 frappé moka grande');
    expect(s.ultimo).toContain('Frappé Moka'); // armó el pedido de una vez y sigue con lo que falta (nombre del envase)
    expect(s.carrito?.programadoPara).toBe(lima('2027-03-02', '10:30'));
  });

  it('día cerrado o feriado: no se ofrece y uno inventado se rechaza', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    s.pulsar('pedir');
    const lista = s.menu!.opciones.map((o) => o.id);
    expect(lista).toEqual(['ped_prog_dia_2027-03-01', 'ped_prog_dia_2027-03-02', 'ped_prog_dia_2027-03-04']);
    const r = s.pulsar('ped_prog_dia_2027-03-03');
    expect(r[0].texto).toContain('Elige uno de la lista');
  });

  it('un solo día disponible: no pregunta el día, va directo a la hora', () => {
    const s = new SimPedido({ ctx: ctxCerrado({ programacion: { hoy: '2027-03-01', dias: [PROGRAMACION.dias[1]] } }) });
    const r = s.pulsar('pedir');
    expect(r[0].texto).toContain('¿A qué hora');
    expect(r[0].texto).not.toContain('¿Para qué día');
  });

  it('pedir una persona fuera de horario sigue su camino (no se queda en el aviso)', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    s.decir('hola');
    const r = s.decir('quiero hablar con una persona');
    expect(r.some((m) => m.tipo === 'persona')).toBe(true);
  });

  it('«Hablar con persona» de noche: «Te escribiremos cuando abramos…», urgente y SIN campanita', () => {
    const s = new SimPedido({ ctx: ctxCerrado() });
    const r = s.decir('quiero hablar con una persona');
    expect(r.map((m) => m.texto).join(' ')).toContain('Te escribiremos cuando abramos hoy a las 15:00 💛');
    const motor = require('../maquina-estados');
    const t = motor.transicionarEstado(null, require('../normalizador-entrada.util').normalizarEntrada({ texto: 'hablar con una persona' }), { ...CTX_BASE, ...ctxCerrado() });
    expect(t.acciones.find((a: any) => a.tipo === 'pasarAPersona')).toMatchObject({ motivo: 'FUERA_DE_HORARIO', esUrgente: true, sinCampanita: true });
  });
});

describe('IA con el local cerrado', () => {
  it('contesta una pregunta libre (después del aviso) y no toma el pedido para ahora: «pedir» lleva a programar', () => {
    const s = new SimConversacion({
      contexto: ctxCerrado() as any,
      ia: () => ({ texto: 'Tenemos tortas de chocolate 🍫', accion: { tipo: 'EMPEZAR_PEDIDO' } as any }),
    });
    const a = s.di('hola');
    expect(a[0].texto).toContain('fuera de horario');
    expect(s.preguntasIa).toHaveLength(0); // el primer mensaje siempre es el aviso, no la IA
    const b = s.di('tienen tortas de chocolate para mañana?');
    expect(s.preguntasIa).toHaveLength(1);
    expect(b.map((m) => m.texto).join(' ')).toContain('tortas de chocolate');
    s.di('1');
    expect(String(s.flujo?.estado)).toMatch(/PEDIDO_PROG_(DIA|HORA)/);
  });
});
