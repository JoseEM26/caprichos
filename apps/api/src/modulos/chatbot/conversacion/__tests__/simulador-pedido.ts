import { aTextoNumerado, resolverRespuesta, MenuNumerado } from '../../evolution/menu-numerado.util';
import { unirCarruselConBotones } from '../../servicios/carrusel.util';
import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { BOTON_VOLVER_MENU, TEXTOS_BOT, TEXTOS_SOLO_MENUS } from '../textos-bot';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

/**
 * Simulador de conversaciones de punta a punta con el motor REAL (transicionarEstado + el texto numerado de Evolution).
 * Solo se simula lo de afuera: la base (carta, envío por zona, creación del pedido) y WhatsApp (se registra cada mensaje).
 */
export const prod = (id: string, nombre: string, precio: number, extra: any = {}) => ({
  id, nombre, precio, disponible: true, oculto: false, noSumaBeneficios: false, ...extra,
});
const leches = {
  id: 'g_leche', nombre: 'Tipo de leche', minimo: 1, maximo: 1, obligatorio: true,
  opciones: [
    { id: 'l_entera', nombre: 'Entera', precioExtra: 0, disponible: true },
    { id: 'l_alm', nombre: 'Almendra', precioExtra: 3, disponible: true },
  ],
};
const tams = (a: number, b: number, c: number) => [
  { id: 't_ch', nombre: 'Chico', precio: a }, { id: 't_me', nombre: 'Mediano', precio: b }, { id: 't_gr', nombre: 'Grande', precio: c },
];
export const CARTA = [
  { id: 'c_cal', nombre: 'Bebidas calientes', descripcion: 'Café y más', productos: [
    prod('p_amer', 'Café Americano', 8, { categoria_id: 'c_cal' }),
    prod('p_capu', 'Cappuccino', 10, { categoria_id: 'c_cal', tamanos: tams(10, 12, 14), grupos: [leches] }),
    prod('p_late', 'Latte', 11, { categoria_id: 'c_cal', tamanos: tams(11, 13, 15) }),
    prod('p_chai', 'Chai Latte', 12, { categoria_id: 'c_cal', tamanos: tams(12, 14, 16), grupos: [
      { id: 'g_dulce', nombre: 'Endulzante', minimo: 0, maximo: 1, obligatorio: false, opciones: [{ id: 'd_az', nombre: 'Azúcar', precioExtra: 0, disponible: true }, { id: 'd_ste', nombre: 'Stevia', precioExtra: 0, disponible: true }] },
      { id: 'g_top', nombre: 'Topping', minimo: 0, maximo: 1, obligatorio: false, opciones: [{ id: 't_can', nombre: 'Canela', precioExtra: 0, disponible: true }] },
    ] }),
  ] },
  { id: 'c_fra', nombre: 'Frappés', descripcion: 'Fríos', productos: [
    prod('p_moka', 'Frappé Moka', 16, { categoria_id: 'c_fra', tamanos: tams(16, 18, 20) }),
    prod('p_oreo', 'Frappé Oreo', 17, { categoria_id: 'c_fra', tamanos: tams(17, 19, 21) }),
  ] },
  { id: 'c_pos', nombre: 'Postres', descripcion: 'Dulces', productos: [
    prod('p_chee', 'Cheesecake', 14, { categoria_id: 'c_pos' }),
    prod('p_carr', 'Carrot Cake', 13, { categoria_id: 'c_pos' }),
    prod('p_agot', 'Tiramisú', 15, { categoria_id: 'c_pos', disponible: false }),
  ] },
  { id: 'c_san', nombre: 'Sándwiches', descripcion: 'Salados', productos: [
    prod('p_club', 'Club Sándwich', 22, { categoria_id: 'c_san' }),
    prod('p_pavo', 'Sándwich de Pavo', 19, { categoria_id: 'c_san' }),
  ] },
];

export const CTX_BASE: ContextoConversacion = {
  nombreCliente: 'Ana Torres',
  telefonoCliente: '987654321',
  cartaUrlPublica: 'https://carta.caprichos.pe',
  datosLocal: {
    abierta: true, abre: '12:00', cierra: '23:00', direccion: 'Campoy, SJL', enlaceMapa: 'https://maps.google.com',
    telefono: '999888777', pausaAltaDemanda: false, altaDemandaMinutosExtra: 0,
  },
  datosLocalPublicos: {
    tiempo_base: 25, tiempo_maximo: 35,
    mediosPagoVisibles: { yape: { activo: true, numero: '999 888 777', titular: 'Caprichos' }, pos: { activo: true }, efectivo: { activo: true } },
  },
  categoriasCarta: CARTA,
  ofertas: [],
};

export interface MensajeBot { tipo: string; texto: string }
export interface Turno { cliente: string; bot: MensajeBot[] }

export interface OpcionesSim {
  ctx?: Partial<ContextoConversacion>;
  flujo?: FlujoConversacion | null;
  /** Zona de reparto simulada: dentro de ese radio (en grados) del centro hay cobertura con tarifa. */
  zona?: { lat: number; lng: number; radio: number; tarifa: number };
}

export class Simulador {
  flujo: FlujoConversacion | null;
  menu: MenuNumerado | null = null;
  turnos: Turno[] = [];
  pedidos: any[] = [];
  pedidoActivo: any = null;
  private n = 0;

  constructor(private readonly o: OpcionesSim = {}) {
    this.flujo = o.flujo ?? null;
  }

  get botMensajes(): MensajeBot[] { return this.turnos.flatMap((t) => t.bot); }
  get botTextos(): string[] { return this.botMensajes.map((m) => m.texto); }
  get ultimo(): string { return this.botMensajes[this.botMensajes.length - 1]?.texto ?? ''; }
  get estado(): string { return String(this.flujo?.estado ?? ''); }
  get carrito(): any { return (this.flujo as any)?.pedido ?? null; }

  /** El cliente escribe (texto o número de opción) o manda ubicación/imagen/sticker. */
  decir(entrada: string | { tipo: string; texto?: string; ubicacion?: any }): MensajeBot[] {
    const raw: any = typeof entrada === 'string' ? { texto: entrada } : entrada;
    const textoCliente = typeof entrada === 'string' ? entrada : (entrada.texto ?? `[${entrada.tipo}]`);
    const elegida = typeof entrada === 'string' ? resolverRespuesta(entrada, this.menu) : null;
    const norm = elegida
      ? normalizarEntrada({ texto: elegida.titulo, ...(this.menu!.tipo === 'lista' ? { listReplyId: elegida.id } : { buttonPayload: elegida.id }), tipo: 'interactive' })
      : normalizarEntrada(raw);
    return this.procesar(norm, textoCliente);
  }

  /** Pulsa un id directo (p. ej. «Pedir este» de la carta). */
  pulsar(id: string, titulo = id): MensajeBot[] {
    return this.procesar(normalizarEntrada({ texto: titulo, buttonPayload: id, tipo: 'button' }), `[botón ${id}]`);
  }

  private contexto(norm: any): ContextoConversacion {
    const c: ContextoConversacion = { ...CTX_BASE, ...(this.o.ctx || {}), pedidoActivo: this.pedidoActivo ?? this.o.ctx?.pedidoActivo };
    c.sinBienvenida = c.sinBienvenida ?? this.turnos.length > 0;
    const ped: any = (this.flujo as any)?.pedido;
    let envio: any = null;
    const z = this.o.zona;
    if (norm.ubicacion && z) {
      const d = Math.hypot(norm.ubicacion.latitud - z.lat, norm.ubicacion.longitud - z.lng);
      envio = d <= z.radio ? { cubierto: true, zona: { id: 'z1', nombre: 'San Juan de Lurigancho' }, tarifa: z.tarifa } : { cubierto: false };
      c.resultadoEnvio = envio;
    }
    const tarifa = envio?.tarifa ?? ped?.entrega?.tarifaZona ?? null;
    if (envio?.cubierto && !ped?.items?.length) c.vistaPreviaPedido = { subtotal: 0, descuento: 0, descuentoNombre: null, envio: envio.tarifa, envioGratis: false };
    if (ped?.items?.length) {
      const subtotal = ped.items.reduce((s: number, i: any) => s + i.subtotal, 0);
      c.vistaPreviaPedido = { subtotal, descuento: 0, descuentoNombre: null, envio: ped.modalidad === 'DELIVERY' ? tarifa : 0, envioGratis: false };
    }
    return c;
  }

  private procesar(norm: any, textoCliente: string): MensajeBot[] {
    const r = transicionarEstado(this.flujo, norm, this.contexto(norm));
    this.flujo = r.nuevoFlujo;
    const bot: MensajeBot[] = [];
    for (const a of unirCarruselConBotones(r.acciones as any[]) as any[]) {
      if (a.tipo === 'enviarTexto') bot.push({ tipo: 'texto', texto: a.texto });
      else if (a.tipo === 'enviarBotones' || a.tipo === 'enviarLista' || a.tipo === 'enviarCarrusel') {
        const rp = a.tipo === 'enviarCarrusel' ? a.carga.respaldo : null;
        const items = a.tipo === 'enviarBotones' ? a.botones : a.tipo === 'enviarLista' ? a.filas : [...(rp?.filas ?? a.carga.tarjetas.map((t: any) => ({ id: t.boton.id, titulo: t.nombre }))), ...(rp?.botones ?? [])];
        const texto = a.tipo === 'enviarCarrusel' ? (rp?.texto ?? a.carga.cuerpo) : a.texto;
        const num = aTextoNumerado(texto, items, a.tipo === 'enviarBotones' ? 'boton' : 'lista');
        this.menu = num.menu;
        bot.push({ tipo: a.tipo, texto: num.texto });
      } else if (a.tipo === 'crearPedido') {
        this.n += 1;
        const codigo = `CP-${String(this.n).padStart(4, '0')}`;
        this.pedidos.push({ ...a, codigo });
        this.pedidoActivo = { id: BigInt(this.n), codigo, estado: 'COLA', modalidad: a.dto?.modalidad ?? a.dto?.entrega?.modalidad, pago_estado: 'PENDIENTE', eta_min: a.tiempoEstimadoMin, eta_max: a.tiempoEstimadoMax };
        const texto = (a.programadoPara ? `Pedido ${codigo} programado` : TEXTOS_BOT.pedidoConfirmadoExito({
          codigo, tiempoMin: a.tiempoEstimadoMin, tiempoMax: a.tiempoEstimadoMax, esPagoDigital: a.esPagoDigital,
          capturas: ((a.dto?.pago?.plan ?? []) as any[]).filter((f) => ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(f.medio)), datosPago: a.datosPagoTexto,
        })) + `\n\n${TEXTOS_SOLO_MENUS.lineaCartaConfirmacion(CTX_BASE.cartaUrlPublica!)}`;
        const num = aTextoNumerado(texto, [BOTON_VOLVER_MENU], 'boton');
        this.menu = num.menu;
        bot.push({ tipo: 'confirmacion', texto: num.texto });
      } else if (a.tipo === 'pasarAPersona') bot.push({ tipo: 'persona', texto: '(pasa a una persona)' });
      else if (a.tipo === 'consultarIa') bot.push({ tipo: 'ia', texto: '(consulta a la IA)' });
    }
    this.turnos.push({ cliente: textoCliente, bot });
    return bot;
  }

  /** Transcripción legible, para depurar y para el informe. */
  transcripcion(): string {
    return this.turnos.map((t) => `CLIENTE: ${t.cliente}\n${t.bot.map((b) => `  BOT[${b.tipo}]: ${b.texto.replace(/\n/g, '\n        ')}`).join('\n')}`).join('\n');
  }
}
