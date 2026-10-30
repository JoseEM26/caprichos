import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { TEXTOS_BOT } from '../textos-bot';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

const base: ContextoConversacion = {
  nombreCliente: 'Carlos Test',
  telefonoCliente: '987654321',
  cartaUrlPublica: 'https://carta.caprichos.pe/carta',
  datosLocal: { abierta: true, abre: '12:00', cierra: '23:00', direccion: 'x', enlaceMapa: 'x', telefono: '1' } as any,
  datosLocalPublicos: { tiempo_base: 25, tiempo_maximo: 35, mediosPagoVisibles: {} },
};
const ctx = (cuenta: boolean, busqueda: any = null): ContextoConversacion => ({
  ...base,
  puntos: { porcentaje: 5, cuentaTelefono: cuenta ? { partyId: '7', primerNombre: 'José', saldo: 10 } : null, busqueda },
});
const flujoAlCierre = (): FlujoConversacion => ({
  version: 1,
  estado: 'PEDIDO_COMPROBANTE_DNI',
  repreguntasFallidas: 0,
  pedido: {
    estadoInterno: 'PEDIDO_COMPROBANTE_DNI',
    modalidad: 'RECOGER',
    cliente: { nombre: 'Carlos', telefono: '987654321' },
    pago: { metodo: 'EFECTIVO', pagaCon: 50 },
    comprobante: { tipo: 'BOLETA' },
    idempotenciaPaso: 's1',
    cuponPreguntado: true,
    items: [{ lineaId: 'l1', productoId: 'p1', productoNombre: 'Frappe', categoriaId: 'c', categoriaNombre: 'C', cantidad: 1, precioUnitario: 15, subtotal: 15, opciones: [], noSumaBeneficios: false }],
  },
});
const btn = (id: string) => normalizarEntrada({ buttonPayload: id });
const txt = (t: string) => normalizarEntrada({ texto: t, textoOriginal: t });
const texto = (r: any) => r.acciones.map((a: any) => a.texto ?? '').join('\n');
const botones = (r: any) => r.acciones.flatMap((a: any) => (a.botones ?? []).map((b: any) => b.titulo));
const crear = (r: any, c: ContextoConversacion) =>
  transicionarEstado({ ...r.nuevoFlujo, estado: 'PEDIDO_RESUMEN_CONFIRMAR' }, btn('ped_confirmar'), c).acciones.find((a) => a.tipo === 'crearPedido') as any;
const inicio = (c: ContextoConversacion) => transicionarEstado(flujoAlCierre(), txt('omitir'), c);

describe('Bienvenida y cuenta por celular en el bot', () => {
  describe('número CON cuenta', () => {
    it('saluda por el primer nombre con 3 botones', () => {
      const r = inicio(ctx(true));
      expect(texto(r)).toBe('¡Hola, José! 💛 Qué bueno verte de nuevo. ¿Sumamos los puntos de hoy a tu cuenta o prefieres seguir como invitado?');
      expect(botones(r)).toEqual(['Sumar puntos', 'Seguir como invitado', 'Usar otro número']);
    });
    it('Sumar puntos: suma a su cuenta', () => {
      const c = ctx(true);
      const r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_si'), c);
      expect(crear(r, c).puntos).toEqual({ modo: 'TELEFONO_PROPIO', partyId: '7' });
    });
    it('Seguir como invitado: invitado real', () => {
      const c = ctx(true);
      const r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_no'), c);
      expect(crear(r, c).puntos?.modo).toBe('NINGUNO');
    });
    it('Usar otro número: pide el número, encuentra ***123 sin revelar nombre y suma ahí', () => {
      const c = ctx(true);
      let r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_otro'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
      const c2 = ctx(true, { telefono: '912345123', partyId: '9', terminacion: '123' });
      r = transicionarEstado(r.nuevoFlujo, txt('912345123'), c2);
      expect(texto(r)).toBe('Encontré una cuenta que termina en ***123, ¿sumo ahí?');
      r = transicionarEstado(r.nuevoFlujo, btn('puntos_si'), c2);
      expect(crear(r, c2).puntos).toEqual({ modo: 'TELEFONO_DICTADO', partyId: '9' });
    });
    it('una sola bienvenida: con la decisión recordada solo hay recordatorio breve', () => {
      const c = ctx(true);
      let r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_si'), c);
      const segundo = transicionarEstado({ ...flujoAlCierre(), puntos: r.nuevoFlujo.puntos }, txt('omitir'), c);
      expect(texto(segundo)).toContain('como antes');
      expect(texto(segundo)).not.toContain('Qué bueno verte');
      const inv = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_no'), c);
      const tercero = transicionarEstado({ ...flujoAlCierre(), puntos: inv.nuevoFlujo.puntos }, txt('omitir'), c);
      expect(tercero.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
    });
  });

  describe('número SIN cuenta', () => {
    const c = ctx(false);
    it('ofrece crear la cuenta con este número', () => {
      const r = inicio(c);
      expect(texto(r)).toBe('¡Hola! 👋 Este número todavía no tiene cuenta en Caprichos. ¿Quieres crearla con este mismo número para sumar puntos, o prefieres seguir como invitado?');
      expect(botones(r)).toEqual(['Crear mi cuenta', 'Seguir como invitado', 'Tengo otro número']);
      expect(botones(r).every((t: string) => t.length <= 20)).toBe(true);
    });
    it('Crear mi cuenta: pide solo el nombre, valida 2+ letras, muestra consentimiento con enlaces y botones', () => {
      let r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_crear'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_CUENTA_NOMBRE');
      r = transicionarEstado(r.nuevoFlujo, txt('A'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_CUENTA_NOMBRE');
      expect(texto(r)).toContain('2 letras');
      r = transicionarEstado(r.nuevoFlujo, txt('Ana Pérez'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_CUENTA_CONSENT');
      expect(texto(r)).toContain('https://carta.caprichos.pe/legal/terminos');
      expect(texto(r)).toContain('https://carta.caprichos.pe/legal/privacidad');
      expect(botones(r)).toEqual(['Acepto', 'No, gracias']);
    });
    it('Acepto: emite crearCuentaCliente (sin contraseña) y sigue con puntos a la cuenta nueva', () => {
      let r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_crear'), c);
      r = transicionarEstado(r.nuevoFlujo, txt('Ana Pérez'), c);
      r = transicionarEstado(r.nuevoFlujo, btn('cuenta_acepto'), c);
      expect(r.acciones[0]).toEqual({ tipo: 'crearCuentaCliente', nombre: 'Ana Pérez' });
      expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
      expect(crear(r, c).puntos).toEqual({ modo: 'TELEFONO_PROPIO', partyId: undefined });
    });
    it('No, gracias: invitado y no se crea nada', () => {
      let r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_crear'), c);
      r = transicionarEstado(r.nuevoFlujo, txt('Ana'), c);
      r = transicionarEstado(r.nuevoFlujo, btn('cuenta_no'), c);
      expect(r.acciones.some((a) => a.tipo === 'crearCuentaCliente')).toBe(false);
      expect(crear(r, c).puntos?.modo).toBe('NINGUNO');
    });
    it('Seguir como invitado: invitado real', () => {
      const r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_no'), c);
      expect(crear(r, c).puntos?.modo).toBe('NINGUNO');
    });
    it('Tengo otro número: usa el flujo del número dictado', () => {
      const r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_otro'), c);
      expect(r.nuevoEstado).toBe('PEDIDO_PUNTOS_NUMERO');
    });
    it('tras crear la cuenta el siguiente pedido ya es recordatorio, no bienvenida', () => {
      const cc = ctx(true);
      let r = transicionarEstado(inicio(c).nuevoFlujo, btn('puntos_crear'), c);
      r = transicionarEstado(r.nuevoFlujo, txt('Ana'), c);
      r = transicionarEstado(r.nuevoFlujo, btn('cuenta_acepto'), c);
      const otro = transicionarEstado({ ...flujoAlCierre(), puntos: r.nuevoFlujo.puntos }, txt('omitir'), cc);
      expect(texto(otro)).toContain('como antes');
    });
  });

  it('textos: nunca piden contraseña y no mencionan DNI de la cuenta', () => {
    const todos = [
      TEXTOS_BOT.puntosCuentaPropia('José'),
      TEXTOS_BOT.puntosSinCuentaBienvenida(),
      TEXTOS_BOT.puntosPedirNumero(),
      TEXTOS_BOT.puntosEncontrado('123'),
      TEXTOS_BOT.cuentaPedirNombre(),
      TEXTOS_BOT.cuentaNombreInvalido(),
      TEXTOS_BOT.cuentaConsentimiento('Ana', TEXTOS_BOT.cuentaEnlacesLegales('t', 'p')),
      TEXTOS_BOT.puntosSinCuenta('https://x'),
      TEXTOS_BOT.puntosNoEncontrado('https://x'),
      TEXTOS_BOT.puntosTopeIntentos('https://x'),
    ].join('\n');
    expect(todos).not.toMatch(/dni/i);
    expect(todos).not.toMatch(/escribe.*contraseña|tu contraseña es|envía.*contraseña/i);
    expect(TEXTOS_BOT.cuentaCreada('Ana')).toBe('¡Listo, Ana! Tu cuenta quedó creada con este número. Para entrar en caprichos.pe define tu contraseña con “¿Olvidaste tu contraseña?”; te llegará un código por aquí.');
    expect(TEXTOS_BOT.pedidoComprobanteDni()).toContain('solo para tu comprobante');
  });
});
