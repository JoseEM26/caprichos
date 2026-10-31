import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

const base: ContextoConversacion = {
  nombreCliente: 'Carlos Test',
  telefonoCliente: '987654321',
  cartaUrlPublica: 'https://carta.caprichos.pe',
  datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'x', enlaceMapa: 'x', telefono: '1' } as any,
  datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: {} },
};
const propia = { partyId: '7', primerNombre: 'José', saldo: 12.3 };
const ctx = (p: Partial<NonNullable<ContextoConversacion['puntos']>> = {}, extra: Partial<ContextoConversacion> = {}): ContextoConversacion => ({
  ...base,
  ...extra,
  puntos: { porcentaje: 5, cuentaTelefono: null, ...p },
});

const flujoAlCierre = (extra: Partial<FlujoConversacion> = {}): FlujoConversacion => ({
  version: 1,
  estado: 'PEDIDO_COMPROBANTE_DNI',
  repreguntasFallidas: 0,
  ...extra,
  pedido: {
    estadoInterno: 'PEDIDO_COMPROBANTE_DNI',
    modalidad: 'RECOGER',
    cliente: { nombre: 'Carlos', telefono: '987654321' },
    pago: { metodo: 'EFECTIVO', pagaCon: 50 },
    comprobante: { tipo: 'BOLETA' },
    idempotenciaPaso: 's1',
    cuponPreguntado: true,
    items: [
      { lineaId: 'l1', productoId: 'p1', productoNombre: 'Frappe', categoriaId: 'c', categoriaNombre: 'C', cantidad: 1, precioUnitario: 15, subtotal: 15, opciones: [], noSumaBeneficios: false },
    ],
  },
});

const dni = () => normalizarEntrada({ texto: '12345678', textoOriginal: '12345678' });
const btn = (id: string) => normalizarEntrada({ buttonPayload: id });
const txt = (t: string) => normalizarEntrada({ texto: t, textoOriginal: t });
const texto = (r: any) => r.acciones.map((a: any) => a.texto ?? '').join('\n');
const botones = (r: any) => r.acciones.flatMap((a: any) => (a.botones ?? []).map((b: any) => b.id));
/** Pedido llegado a la pregunta de puntos (sin cuenta identificada). */
const aPreguntaPuntos = (c: ContextoConversacion) => transicionarEstado(flujoAlCierre(), dni(), c);
const crear = (flujo: FlujoConversacion, c: ContextoConversacion) =>
  transicionarEstado({ ...flujo, estado: 'PEDIDO_RESUMEN_CONFIRMAR', pedido: { ...flujo.pedido!, estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR' } }, btn('ped_confirmar'), c)
    .acciones.find((a) => a.tipo === 'crearPedido') as any;

describe('Puntos en el pedido por WhatsApp', () => {
  it('sin servicio de puntos no pregunta nada y va al resumen', () => {
    const r = transicionarEstado(flujoAlCierre(), dni(), base);
    expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    expect(crear(r.nuevoFlujo, base).puntos).toBeUndefined();
  });

  describe('cliente ya identificado por su celular', () => {
    it('no pregunta: suma a su cuenta y muestra el saldo en el resumen', () => {
      const c = ctx({ cuentaTelefono: propia });
      const r = aPreguntaPuntos(c);
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(texto(r)).not.toContain('¿Quieres sumar puntos');
      expect(texto(r)).toContain('~0.75 puntos');
      expect(texto(r)).toContain('(tienes 12.30)');
      expect(crear(r.nuevoFlujo, c).puntos).toEqual({ modo: 'TELEFONO_PROPIO', partyId: '7' });
    });

    it('con cupón el resumen dice que no suma', () => {
      const c = ctx({ cuentaTelefono: propia });
      const f = flujoAlCierre();
      f.pedido!.cuponCodigo = 'ABC';
      expect(texto(transicionarEstado(f, dni(), c))).toContain('no suma puntos');
    });
  });

  describe('sin cuenta: pregunta por el celular', () => {
    it('pregunta con «Este número», «Otro número» y «No, gracias», sin pedir nombre ni contraseña', () => {
      const r = aPreguntaPuntos(ctx());
      expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_PREGUNTA');
      expect(texto(r)).toContain('¿A qué número los sumo?');
      expect(botones(r)).toEqual(['puntos_este', 'puntos_otro', 'puntos_no']);
      expect(texto(r)).not.toMatch(/tu nombre|cómo te llamas/i);
    });

    it('Este número: suma al celular de quien escribe, sin nombre ni contraseña', () => {
      const c = ctx();
      const r = transicionarEstado(aPreguntaPuntos(c).nuevoFlujo, btn('puntos_este'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(texto(r)).toContain('Listo, sumarás puntos con el ***321.');
      expect(r.acciones.some((a) => a.tipo === 'crearCuentaCliente')).toBe(false);
      expect(crear(r.nuevoFlujo, c).puntos).toEqual({ modo: 'TELEFONO_DICTADO', telefono: '987654321' });
    });

    it('Este número no se ofrece si quien escribe no tiene celular de 9 dígitos (identificador de WhatsApp)', () => {
      const c = ctx({}, { telefonoCliente: 'bsuid:user123' });
      const r = aPreguntaPuntos(c);
      expect(botones(r)).toEqual(['puntos_otro', 'puntos_no']);
    });

    it('Otro número válido: suma a ese celular (acepta el prefijo 51)', () => {
      const c = ctx();
      let r = transicionarEstado(aPreguntaPuntos(c).nuevoFlujo, btn('puntos_otro'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
      expect(texto(r)).toContain('9 dígitos');
      r = transicionarEstado(r.nuevoFlujo, txt('51 912 345 678'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(texto(r)).toContain('Listo, sumarás puntos con el ***678.');
      expect(crear(r.nuevoFlujo, c).puntos).toEqual({ modo: 'TELEFONO_DICTADO', telefono: '912345678' });
    });

    it('Otro número inválido: repite la pregunta con un mensaje claro y deja salir con «No, gracias»', () => {
      const c = ctx();
      let r = transicionarEstado(aPreguntaPuntos(c).nuevoFlujo, btn('puntos_otro'), c);
      r = transicionarEstado(r.nuevoFlujo, txt('12345'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
      expect(texto(r)).toContain('no es válido');
      expect(botones(r)).toEqual(['puntos_no']);
      r = transicionarEstado(r.nuevoFlujo, txt('hola'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
      expect(texto(r)).toContain('no es válido');
      r = transicionarEstado(r.nuevoFlujo, btn('puntos_no'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(crear(r.nuevoFlujo, c).puntos?.modo).toBe('NINGUNO');
    });

    it('No, gracias: invitado de verdad, sin oferta de cuenta', () => {
      const c = ctx();
      const r = transicionarEstado(aPreguntaPuntos(c).nuevoFlujo, btn('puntos_no'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(texto(r)).not.toContain('Listo, sumarás');
      expect(r.acciones.some((a) => a.tipo === 'crearCuentaCliente')).toBe(false);
      expect(crear(r.nuevoFlujo, c).puntos).toEqual({ modo: 'NINGUNO', partyId: undefined, telefono: undefined });
    });

    it('texto que no es botón se repite la pregunta', () => {
      const c = ctx();
      const r = transicionarEstado(aPreguntaPuntos(c).nuevoFlujo, txt('quizás'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_PREGUNTA');
      expect(texto(r)).toContain('¿A qué número los sumo?');
    });
  });

  describe('memoria de la elección (30 días)', () => {
    it('elegido un celular: en el siguiente pedido es recordatorio breve, no pregunta de nuevo', () => {
      const c = ctx();
      const memoria = { modo: 'TELEFONO_DICTADO' as const, telefono: '912345678', terminacion: '678', en: Date.now() - 86400000 };
      let r = transicionarEstado(flujoAlCierre({ puntos: memoria }), dni(), c);
      expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_PREGUNTA');
      expect(texto(r)).toContain('tu número que termina en ***678 como antes');
      expect(botones(r)).toEqual(['puntos_si', 'puntos_otro', 'puntos_sin']);
      r = transicionarEstado(r.nuevoFlujo, btn('puntos_si'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(crear(r.nuevoFlujo, c).puntos).toEqual({ modo: 'TELEFONO_DICTADO', partyId: undefined, telefono: '912345678' });
    });

    it('recordatorio de cuenta propia (memoria antigua con partyId) sigue funcionando', () => {
      const c = ctx();
      const memoria = { modo: 'TELEFONO_PROPIO' as const, partyId: '7', primerNombre: 'José', en: Date.now() - 86400000 };
      const r = transicionarEstado(flujoAlCierre({ puntos: memoria }), dni(), c);
      expect(texto(r)).toContain('Sumo tus puntos a la cuenta de José como antes');
    });

    it('«Cambiar» en el recordatorio lleva a escribir otro número', () => {
      const c = ctx();
      const memoria = { modo: 'TELEFONO_DICTADO' as const, telefono: '912345678', terminacion: '678', en: Date.now() };
      const r = transicionarEstado(flujoAlCierre({ puntos: memoria }), dni(), c);
      const cambio = transicionarEstado(r.nuevoFlujo, btn('puntos_otro'), c);
      expect(cambio.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
      expect(cambio.nuevoFlujo.puntos).toBeUndefined();
    });

    it('decisión «No, gracias» recordada: no vuelve a preguntar; una vencida (31 días) sí', () => {
      const c = ctx();
      const no = { modo: 'NINGUNO' as const, en: Date.now() };
      expect(transicionarEstado(flujoAlCierre({ puntos: no }), dni(), c).nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      const vieja = { ...no, en: Date.now() - 31 * 86400000 };
      expect(transicionarEstado(flujoAlCierre({ puntos: vieja }), dni(), c).nuevoEstado).toBe('PEDIDO_PUNTOS_PREGUNTA');
    });
  });
});

describe('Intención «¿Cuántos puntos tengo?»', () => {
  it('con cuenta del propio número muestra el saldo', () => {
    const r = transicionarEstado(null, normalizarEntrada({ texto: 'cuantos puntos tengo', textoOriginal: 'cuántos puntos tengo' }), ctx({ cuentaTelefono: propia }));
    expect(texto(r)).toContain('12.30 puntos');
  });
  it('sin cuenta indica cómo crearla', () => {
    const r = transicionarEstado(null, normalizarEntrada({ listRowId: 'mispuntos' }), ctx());
    expect(texto(r)).toContain('https://carta.caprichos.pe');
    expect(texto(r)).not.toContain('12.30');
  });
});
