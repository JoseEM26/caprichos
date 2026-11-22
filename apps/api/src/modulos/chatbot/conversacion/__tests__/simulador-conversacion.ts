import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { aTextoNumerado, resolverRespuesta, MenuNumerado } from '../../evolution/menu-numerado.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';

/**
 * Simulador de conversaciones de punta a punta con el motor real (transicionarEstado). Imita lo que hace el ejecutor
 * alrededor: texto numerado de Evolution (sin botones nativos), silencio con una persona atendiendo, bienvenida solo
 * en el primer contacto o tras un día, y la IA como un reemplazo fijo. Registra cada mensaje que el bot envía.
 */
export const LOCAL_ABIERTO = {
  abierta: true,
  abre: '17:00',
  cierra: '23:00',
  textoEstado: 'Lunes a Domingo de 17:00 a 23:00',
  direccion: 'Av. Las Flores 456',
  referencia: 'Frente al parque',
  enlaceMapa: 'https://maps.google.com/?q=-12.0196,-76.9632',
  telefono: '987 654 321',
};

export const CONTEXTO_BASE: ContextoConversacion = {
  nombreCliente: 'Carlos',
  telefonoCliente: '51987654321',
  cartaUrlPublica: 'https://carta.caprichos.pe',
  datosLocal: LOCAL_ABIERTO,
  datosLocalPublicos: {
    direccion: 'Av. Las Flores 456',
    telefono: '987 654 321',
    pedidoMinimo: 14.5,
    envioGratisDesde: 70,
    mediosPago: {
      yape: { nombre: 'Yape', activo: true },
      plin: { nombre: 'Plin', activo: true },
      efectivo: { nombre: 'Efectivo', activo: true },
    },
  },
  categoriasCarta: [
    {
      id: '1',
      nombre: 'Frappes',
      descripcion: 'Bebidas heladas',
      productos: [
        { id: 'p1', nombre: 'Frappe Oreo', precio: 14.5, disponible: true },
        { id: 'p2', nombre: 'Frappe Fresa', precio: 15, disponible: true },
      ],
    },
    {
      id: '2',
      nombre: 'Calientes',
      descripcion: 'Cafés y chocolates',
      productos: [
        { id: 'p3', nombre: 'Mocaccino', precio: 12, disponible: true },
        { id: 'p4', nombre: 'Capuccino', precio: 11, disponible: true },
      ],
    },
  ],
  ofertas: [{ nombre: '2x1 Frappe Oreo', descripcion: 'Paga 1 y lleva 2', vigenteAhora: true, compraMinima: 14.5 }],
};

export interface MensajeBot {
  tipo: 'texto' | 'botones' | 'lista' | 'otro';
  /** Texto como lo ve el cliente (con las opciones numeradas). */
  texto: string;
}

export interface OpcionesSimulador {
  contexto?: Partial<ContextoConversacion>;
  /** Conversación nueva (sin mensajes del bot en las últimas 24 h). */
  primerContacto?: boolean;
  /** Respuesta fija de la IA cuando el motor la consulta. */
  respuestaIa?: string;
}

export class Simulador {
  flujo: FlujoConversacion | null = null;
  menu: MenuNumerado | null = null;
  /** Todo lo que el bot dijo, en orden. */
  bot: MensajeBot[] = [];
  derivaciones: string[] = [];
  preguntasIa: string[] = [];
  quejas: string[] = [];
  chatTomado = false;
  private sinBienvenida: boolean;
  private ctx: ContextoConversacion;

  constructor(private op: OpcionesSimulador = {}) {
    this.ctx = { ...CONTEXTO_BASE, ...(op.contexto || {}) };
    this.sinBienvenida = !op.primerContacto;
  }

  /** Pasó un día: el próximo mensaje vuelve a recibir la bienvenida completa. */
  nuevoDia(): this {
    this.sinBienvenida = false;
    this.menu = null;
    if (this.flujo?.estado !== 'ATENCION_PERSONA') this.flujo = { ...(this.flujo as any), estado: 'MENU' };
    return this;
  }

  /** Una persona suelta el chat («Devolver al bot»). */
  personaDevuelveAlBot(): this {
    this.chatTomado = false;
    this.flujo = { ...(this.flujo as any), estado: 'MENU', repreguntasFallidas: 0 };
    return this;
  }

  /** El cliente escribe un texto (un número se resuelve contra el último menú, como en Evolution). */
  di(texto: string, extra: { tipo?: string } = {}): MensajeBot[] {
    const marca = this.bot.length;
    const opcion = resolverRespuesta(texto, this.menu);
    const entrada = opcion
      ? normalizarEntrada({
          texto: opcion.titulo,
          textoOriginal: opcion.titulo,
          ...(this.menu!.tipo === 'lista' ? { listReplyId: opcion.id, tipo: 'interactive' } : { buttonPayload: opcion.id, tipo: 'button' }),
        })
      : normalizarEntrada({ texto, ...extra });
    this.procesar(entrada);
    return this.bot.slice(marca);
  }

  private procesar(entrada: ReturnType<typeof normalizarEntrada>) {
    const r = transicionarEstado(this.flujo, entrada, {
      ...this.ctx,
      sinBienvenida: this.sinBienvenida,
      chatTomado: this.chatTomado,
    } as ContextoConversacion);
    this.flujo = r.nuevoFlujo;
    for (const a of r.acciones as any[]) {
      switch (a.tipo) {
        case 'enviarTexto':
          this.decir('texto', a.texto);
          break;
        case 'enviarBotones': {
          const n = aTextoNumerado(a.texto, a.botones, 'boton');
          this.menu = n.menu;
          this.decir('botones', n.texto);
          break;
        }
        case 'enviarLista': {
          const n = aTextoNumerado(a.texto, a.filas, 'lista');
          this.menu = n.menu;
          this.decir('lista', n.texto);
          break;
        }
        case 'pasarAPersona':
          this.derivaciones.push(a.motivo);
          if (a.crearQueja) this.quejas.push(a.quejaTexto);
          this.chatTomado = true;
          break;
        case 'consultarIa':
          this.preguntasIa.push(a.pregunta);
          this.decir('texto', this.op.respuestaIa ?? 'Respuesta de la IA.');
          break;
        default:
          this.decir('otro', `[${a.tipo}]`);
      }
    }
    if (r.acciones.length) this.sinBienvenida = true;
  }

  private decir(tipo: MensajeBot['tipo'], texto: string) {
    this.bot.push({ tipo, texto });
  }

  /** Transcripción legible para depurar. */
  transcripcion(): string {
    return this.bot.map((m, i) => `BOT ${i + 1} [${m.tipo}]: ${m.texto}`).join('\n---\n');
  }
}

/** Mensajes con el mismo texto uno tras otro. */
export function repetidosSeguidos(msgs: MensajeBot[]): number {
  let n = 0;
  for (let i = 1; i < msgs.length; i++) if (msgs[i].texto === msgs[i - 1].texto) n++;
  return n;
}
