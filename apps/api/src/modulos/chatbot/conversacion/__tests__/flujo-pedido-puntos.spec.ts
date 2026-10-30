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
const ctx = (p: Partial<NonNullable<ContextoConversacion['puntos']>> = {}): ContextoConversacion => ({
  ...base,
  puntos: { porcentaje: 5, cuentaTelefono: null, busqueda: null, ...p },
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
const texto = (r: any) => r.acciones.map((a: any) => a.texto ?? '').join('\n');
const botones = (r: any) => r.acciones.flatMap((a: any) => (a.botones ?? []).map((b: any) => b.id));
/** Sin cuenta: la bienvenida ofrece crearla; «Tengo otro número» lleva a dictar el número. */
const aNumero = (c: ContextoConversacion) => {
  const r = transicionarEstado(flujoAlCierre(), dni(), c);
  return transicionarEstado(r.nuevoFlujo, btn('puntos_otro'), c);
};
const crear = (flujo: FlujoConversacion, c: ContextoConversacion) =>
  transicionarEstado({ ...flujo, estado: 'PEDIDO_RESUMEN_CONFIRMAR', pedido: { ...flujo.pedido!, estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR' } }, btn('ped_confirmar'), c)
    .acciones.find((a) => a.tipo === 'crearPedido') as any;

describe('Puntos en el pedido por WhatsApp', () => {
  it('sin servicio de puntos no pregunta nada y va al resumen', () => {
    const r = transicionarEstado(flujoAlCierre(), dni(), base);
    expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    expect(crear(r.nuevoFlujo, base).puntos).toBeUndefined();
  });

  it('propio SÍ: pregunta con el primer nombre, suma ~0.75 y muestra el saldo', () => {
    const c = ctx({ cuentaTelefono: propia });
    let r = transicionarEstado(flujoAlCierre(), dni(), c);
    expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_PREGUNTA');
    expect(texto(r)).toContain('¡Hola, José! 💛');
    expect(botones(r)).toEqual(['puntos_si', 'puntos_no', 'puntos_otro']);
    r = transicionarEstado(r.nuevoFlujo, btn('puntos_si'), c);
    expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    expect(texto(r)).toContain('~0.75 puntos');
    expect(texto(r)).toContain('(tienes 12.30)');
    expect(crear(r.nuevoFlujo, c).puntos).toEqual({ modo: 'TELEFONO_PROPIO', partyId: '7' });
  });

  it('propio NO: invitado de verdad, sin línea de puntos', () => {
    const c = ctx({ cuentaTelefono: propia });
    let r = transicionarEstado(flujoAlCierre(), dni(), c);
    r = transicionarEstado(r.nuevoFlujo, btn('puntos_no'), c);
    expect(texto(r)).not.toContain('puntos cuando Caja');
    expect(crear(r.nuevoFlujo, c).puntos).toEqual({ modo: 'NINGUNO', partyId: undefined });
  });

  it('propio OTRO: pide el número', () => {
    const c = ctx({ cuentaTelefono: propia });
    let r = transicionarEstado(flujoAlCierre(), dni(), c);
    r = transicionarEstado(r.nuevoFlujo, btn('puntos_otro'), c);
    expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
    expect(texto(r)).toContain('9 dígitos');
  });

  it('número dictado encontrado: no revela nombre, confirma y no muestra saldo', () => {
    const c0 = ctx();
    let r = aNumero(c0);
    expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
    const c = ctx({ busqueda: { telefono: '912345123', partyId: '9', terminacion: '123' } });
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ texto: '912 345 123', textoOriginal: '912 345 123' }), c);
    expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_PREGUNTA');
    expect(texto(r)).toContain('***123');
    expect(botones(r)).toEqual(['puntos_si', 'puntos_otro', 'puntos_sin']);
    r = transicionarEstado(r.nuevoFlujo, btn('puntos_si'), c);
    expect(texto(r)).toContain('~0.75 puntos');
    expect(texto(r)).not.toContain('tienes');
    expect(crear(r.nuevoFlujo, c).puntos).toEqual({ modo: 'TELEFONO_DICTADO', partyId: '9' });
  });

  it('número dictado no encontrado: da la URL de la carta y deja reintentar', () => {
    let r = aNumero(ctx());
    const c = ctx({ busqueda: { telefono: '911111111', partyId: null, terminacion: '111' } });
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ texto: '911111111', textoOriginal: '911111111' }), c);
    expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
    expect(texto(r)).toContain('https://carta.caprichos.pe');
    expect(botones(r)).toEqual(['puntos_otro', 'puntos_sin']);
  });

  it('tope de 3 números: sigue como invitado y avisa', () => {
    let r = aNumero(ctx());
    for (let i = 1; i <= 3; i++) {
      const num = `91111111${i}`;
      const c = ctx({ busqueda: { telefono: num, partyId: null, terminacion: num.slice(-3) } });
      r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ texto: num, textoOriginal: num }), c);
    }
    expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    expect(texto(r)).toContain('tres números');
    expect(crear(r.nuevoFlujo, ctx()).puntos?.modo).toBe('NINGUNO');
    expect(r.nuevoFlujo.puntosIntentos).toBe(3);
  });

  it('texto que no es número se repite sin gastar intentos', () => {
    let r = aNumero(ctx());
    r = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ texto: 'hola', textoOriginal: 'hola' }), ctx());
    expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
    expect(r.nuevoFlujo.puntosIntentos).toBeUndefined();
  });

  it('recordatorio breve en el siguiente pedido (propio y dictado)', () => {
    const c = ctx({ cuentaTelefono: propia });
    const memoria = { modo: 'TELEFONO_PROPIO' as const, partyId: '7', primerNombre: 'José', en: Date.now() - 86400000 };
    let r = transicionarEstado(flujoAlCierre({ puntos: memoria }), dni(), c);
    expect(texto(r)).toContain('Sumo tus puntos a la cuenta de José como antes');
    expect(botones(r)).toEqual(['puntos_si', 'puntos_otro', 'puntos_sin']);
    r = transicionarEstado(r.nuevoFlujo, btn('puntos_si'), c);
    expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');

    const dictado = { modo: 'TELEFONO_DICTADO' as const, partyId: '9', terminacion: '123', en: Date.now() };
    const r2 = transicionarEstado(flujoAlCierre({ puntos: dictado }), dni(), ctx());
    expect(texto(r2)).toContain('***123');
    expect(texto(r2)).not.toContain('José');
  });

  it('decisión NINGUNO recordada: no vuelve a preguntar; una vencida (31 días) sí', () => {
    const c = ctx({ cuentaTelefono: propia });
    const no = { modo: 'NINGUNO' as const, en: Date.now() };
    expect(transicionarEstado(flujoAlCierre({ puntos: no }), dni(), c).nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    const vieja = { ...no, en: Date.now() - 31 * 86400000 };
    expect(transicionarEstado(flujoAlCierre({ puntos: vieja }), dni(), c).nuevoEstado).toBe('PEDIDO_PUNTOS_PREGUNTA');
  });

  it('con cupón el resumen dice que no suma', () => {
    const c = ctx({ cuentaTelefono: propia });
    const f = flujoAlCierre();
    f.pedido!.cuponCodigo = 'ABC';
    let r = transicionarEstado(f, dni(), c);
    r = transicionarEstado(r.nuevoFlujo, btn('puntos_si'), c);
    expect(texto(r)).toContain('no suma puntos');
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
