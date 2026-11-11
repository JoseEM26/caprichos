import { textoTiempoPedido } from '../repartos/eta-entrega';
import { exigirDeliveryUbicado } from '../pedidos/delivery-ubicacion.util';
import { pedidoEsperandoVoucher } from '../chatbot/servicios/pedido-esperando-voucher.util';
import { HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { Ventana24hService } from '../chatbot/servicios/ventana-24h.service';
import { MensajeEnviado, WHATSAPP_GATEWAY, WhatsAppGateway } from './whatsapp.gateway';
import { pulirMensaje } from './pulir.util';
import { EnvioEncoladoService, MOTIVO_REVISAR } from './envio-encolado.service';
import {
  esRemitenteSinTelefono,
  obtenerNombreMostrar,
} from './utilidades/nombre-contacto.util';
import { flujoLiberadoParaBot } from '../chatbot/conversacion/flujo-liberado.util';
import { enmascararTelefono } from '../chatbot/utilidades/enmascarar.util';
import { esErrorVentana24h, mapearErrorWhatsApp } from './utilidades/error-whatsapp.util';
import { separarDetalleTecnico } from '../chatbot/utilidades/meta-errores.util';
import { EditarNombreContactoDto } from './dto/mensajes.dto';
import { MATRIZ } from '../acceso/permisos';
import { BOTONES_PAGO_RECHAZADO, TEXTOS_PAGO } from '../chatbot/conversacion/flujos/pago/textos-pago';
import { TEXTOS_CAMBIOS } from '../chatbot/conversacion/flujos/cambios/textos-cambios';
import { NumerosWhatsappService } from '../chatbot/servicios/numeros-whatsapp.service';
import { exigirCajaAbiertaHoy } from '../caja/caja.calculo';
import { leerBloqueosSpam } from '../chatbot/configuracion/bloqueo-spam.util';
import { MOTIVO_BLOQUEO_SPAM } from '../chatbot/configuracion/chatbot-configuracion.service';
import { lineasDeCuenta } from '../pedidos/lineas-combo.util';
import { ArchivosService } from '../archivos/archivos.service';
import { StockService } from '../stock/stock.service';
import { PuntosService } from '../clientes/puntos.service';
import { cerrarRutaTrasAnular } from '../repartos/rutas-reparto';
import sharp from 'sharp';
import {
  MAX_DOCUMENTO_ENVIO_BYTES,
  contenidoCoincide,
  sanearNombreDocumento,
  validarDocumento,
} from '../../comun/documentos-whatsapp.util';
import {
  PosChat,
  faltaProcesar,
  inicioHoyLima,
  pedidoLigadoDelFlujo,
  reabiertoTrasAtendido,
  resolverPos,
  ultimos9,
} from './utilidades/pos-chat.util';

/** Día calendario de Lima (AAAA-MM-DD) de una fecha. */
const FORMATO_DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }); // crearlo por llamada era lo más caro de la lista
export const diaLima = (d: Date): string => FORMATO_DIA_LIMA.format(d);

export type EstadoChat = 'bot' | 'atencion' | 'validar' | 'atendido' | 'pausado';
export type FiltroChat = 'todos' | 'atender' | 'bot' | 'atendidos' | 'novistos' | 'reprogramar';
export type FiltroPos = 'faltan' | 'procesados';

const GRUPOS: Record<Exclude<FiltroChat, 'todos' | 'novistos' | 'reprogramar'>, EstadoChat[]> = {
  atender: ['atencion', 'validar'],
  bot: ['bot', 'pausado'],
  atendidos: ['atendido'],
};
const TIPOS_CAMBIO: Record<string, string> = {
  DIRECCION: 'Cambiar la dirección',
  PEDIDO: 'Cambiar el pedido',
  CANCELAR: 'Cancelar el pedido',
};
const MODALIDADES: Record<string, string> = { DELIVERY: 'Delivery', RECOJO: 'Para llevar', LLEVAR: 'Para llevar', SALON: 'En el local' };

const error = (status: HttpStatus, codigo: string, mensaje: string) =>
  new HttpException({ codigo, mensaje }, status);

const hora = (d: Date) =>
  new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(d);

/** Un chat está «sin ver» si el cliente escribió después de la última vez que se abrió, o si alguien lo marcó a mano. */
const sinVer = (f: { sinLeer: number; marcadoNoVisto: boolean }) => f.sinLeer > 0 || f.marcadoNoVisto;

/** Estado que ve la consola, derivado de las columnas de `conversacion` (la tabla no tiene «pausado»). */
export function estadoDe(
  c: { estado: string; duenio: string; urgente: boolean; atendido_en?: Date | null },
  reabierto = false,
): EstadoChat {
  // Archivado con «Atendido»: vuelve a «Por atender» cuando el cliente escribe de nuevo
  if (c.atendido_en) return !reabierto ? 'atendido' : c.estado === 'VALIDAR_PAGO' ? 'validar' : 'atencion';
  if (c.estado === 'ATENDIDA') return 'atendido';
  if (c.estado === 'VALIDAR_PAGO') return 'validar';
  if (c.urgente) return 'atencion';
  return c.duenio === 'PERSONA' ? 'pausado' : 'bot';
}

const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

export const MAX_IMAGEN_SUBIDA_BYTES = 16 * 1024 * 1024;

/** Tipo real por los primeros bytes (no por lo que diga el navegador): JPG, PNG y WebP. */
export function tipoImagenReal(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 7 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'image/png';
  return null;
}

/**
 * WhatsApp solo acepta JPG/PNG de hasta 5 MB: WebP y lo que pasa del límite se pasa a JPEG
 * (máx. 2048 px, calidad bajando hasta caber). JPG/PNG que ya cumplen se envían tal cual.
 */
export async function prepararImagenWhatsApp(bytes: Buffer, tipo: string): Promise<{ buffer: Buffer; mimetype: string }> {
  if (tipo !== 'image/webp' && bytes.length <= MAX_IMAGEN_BYTES) return { buffer: bytes, mimetype: tipo };
  try {
    for (const [lado, calidad] of [[2048, 85], [2048, 70], [1600, 60], [1200, 50]]) {
      const out = await sharp(bytes)
        .rotate()
        .flatten({ background: '#ffffff' })
        .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: calidad })
        .toBuffer();
      if (out.length <= MAX_IMAGEN_BYTES) return { buffer: out, mimetype: 'image/jpeg' };
    }
  } catch {
    // imagen corrupta: cae al mismo mensaje de error
  }
  throw error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'IMAGEN_TIPO', 'No se pudo preparar la foto: prueba con otra imagen JPG o PNG');
}

const textoDe = (m: { tipo: string; contenido: any }): string => {
  const t = m.contenido?.texto ?? '';
  return m.tipo === 'IMAGEN' ? String(t).replace(/^\[Imagen:\s*/, '').replace(/\]$/, '') : String(t);
};
const nombreUsuario = (p: any, fallback: string): string =>
  p?.persona ? `${p.persona.nombres} ${p.persona.apellidos ?? ''}`.trim() : fallback;

/**
 * Consola de chats con dueño único (FT-ATN-01..02). Todo sale de `conversacion`, `mensaje_chat`
 * y `respuesta_rapida`; los mensajes salientes pasan por la pasarela `WhatsAppGateway`.
 */
/** Dentro de este tiempo no se envía otra plantilla de reapertura sin confirmación (cada una cuesta en Meta). */
const VENTANA_PLANTILLA_RECIENTE_MS = 60 * 60 * 1000;

type FilaClasificada = Awaited<ReturnType<MensajesService['clasificar']>>[number];

@Injectable()
export class MensajesService {
  private readonly logger = new Logger(MensajesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGateway,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly ventana24hService?: Ventana24hService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly archivos?: ArchivosService,
    @Optional() private readonly stockService?: StockService,
    @Optional() private readonly puntosService?: PuntosService,
    @Optional() private readonly numeros?: NumerosWhatsappService,
    @Optional() private readonly cola?: EnvioEncoladoService,
  ) {}

  /** Escribir a mano al número del negocio o a uno bloqueado no se permite: los bots se contestarían entre sí. */
  private async exigirNumeroEnviable(c: { telefono: string }) {
    const motivo = await this.numeros?.motivoOmision(c.telefono);
    if (motivo === 'DESTINO_NUMERO_PROPIO') {
      throw error(HttpStatus.BAD_REQUEST, 'NUMERO_PROPIO', 'Ese número es del propio negocio: no se le envía nada');
    }
    if (motivo === 'DESTINO_BLOQUEADO') throw error(HttpStatus.BAD_REQUEST, 'NUMERO_BLOQUEADO', 'Número bloqueado: no se le envía nada. Desbloquéalo para escribirle');
  }

  /** Límite de 20 mensajes por minuto por usuario para evitar abusos (Redis). */
  private async verificarLimiteTasaUsuario(partyId: bigint): Promise<void> {
    if (!this.redisService) return;
    try {
      const redis = this.redisService.obtenerCliente();
      const clave = `ratelimit:mensajes:usuario:${partyId}`;
      const cuenta = await redis.incr(clave);
      if (cuenta === 1) {
        await redis.expire(clave, 60);
      }
      if (cuenta > 20) {
        throw error(
          HttpStatus.TOO_MANY_REQUESTS,
          'LIMITE_ENVIO',
          'Superaste el limite de 20 mensajes por minuto. Espera un momento',
        );
      }
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      // Si Redis no está disponible o falla por red, no interrumpir la atención del operador
    }
  }

  private readonly incluir = {
    party: { include: { persona: true } },
    tomadoPorUsuario: { include: { party: { include: { persona: true } } } },
  };

  private async yo(usuario: UsuarioAutenticado) {
    const cuenta = await this.prisma.userAccount.findUnique({ where: { party_id: usuario.partyId } });
    return cuenta ? cuenta.id : null;
  }

  private async cargar(id: string) {
    let n: bigint;
    try {
      n = BigInt(id);
    } catch {
      throw new NotFoundException({ codigo: 'CHAT_NO_ENCONTRADO', mensaje: 'No se encontró el chat' });
    }
    const c = await this.prisma.conversacion.findUnique({ where: { id: n }, include: this.incluir });
    if (!c) throw new NotFoundException({ codigo: 'CHAT_NO_ENCONTRADO', mensaje: 'No se encontró el chat' });
    return c;
  }

  private dueno(c: any): string | null {
    return c.tomado_por ? nombreUsuario(c.tomadoPorUsuario?.party, 'otra persona') : null;
  }

  /** Quien no es dueño no puede escribir ni decidir sin tomar el chat (RN-CAP-102). */
  private async exigirLibreOMio(c: any, usuario: UsuarioAutenticado, texto: string) {
    if (c.tomado_por && c.tomado_por !== (await this.yo(usuario))) {
      throw error(HttpStatus.CONFLICT, 'CHAT_TOMADO', `Este chat lo atiende ${this.dueno(c)}. ${texto}`);
    }
  }

  private aviso(id: bigint) {
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: id.toString() });
  }

  private async tocar(id: bigint, data: Record<string, unknown>) {
    await this.prisma.conversacion.update({ where: { id }, data: { ...data, ultima_actividad: new Date() } });
    this.aviso(id);
  }

  private async auditar(usuario: UsuarioAutenticado, accion: string, id: bigint, despues?: unknown, ip?: string) {
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'mensajes', accion, entidad: 'conversacion', entidadId: id,
      partyId: usuario.partyId, despues, ip,
    });
  }

  private tieneIdentificador(c: { telefono?: string | null }): boolean {
    if (!c.telefono) return false;
    const limpio = c.telefono.trim();
    if (!limpio || limpio === 'wa-user:') return false;
    return true;
  }

  /**
   * Estado real del bloqueo por spam: el que dice Redis (caduca solo por TTL). null si Redis no responde.
   * La marca motivo_derivacion=BLOQUEADO_SPAM es solo informativa: si el bloqueo caducó, se limpia aquí.
   */
  private async bloqueosSpam(convs: { id: bigint; telefono: string; motivo_derivacion?: string | null }[]) {
    const mapa = await leerBloqueosSpam(this.redisService?.obtenerCliente(), convs.map((c) => c.telefono));
    if (mapa) {
      const caducados = convs.filter((c) => c.motivo_derivacion === MOTIVO_BLOQUEO_SPAM && !mapa.get(c.telefono)?.activo);
      if (caducados.length) {
        void this.prisma.conversacion
          .updateMany({ where: { id: { in: caducados.map((c) => c.id) }, motivo_derivacion: MOTIVO_BLOQUEO_SPAM }, data: { motivo_derivacion: null } })
          .catch(() => undefined);
      }
    }
    return mapa;
  }

  /** Pedidos que pueden ligarse a estos chats, en UNA consulta: los de hoy con celular y los ligados por el flujo. */
  private async posDeChats(chats: { id: bigint; telefono: string; flujo?: unknown }[]): Promise<Map<bigint, PosChat>> {
    const ligados = chats.map((c) => pedidoLigadoDelFlujo(c.flujo)).filter((x): x is bigint => x != null);
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        es_personal: false,
        OR: [
          { creado_en: { gte: inicioHoyLima() }, cliente_telefono: { not: null } },
          ...(ligados.length ? [{ id: { in: ligados } }] : []),
        ],
      },
      select: { id: true, codigo: true, estado: true, pago_estado: true, cliente_telefono: true, creado_en: true },
    });
    return resolverPos(chats, pedidos);
  }

  /** Nombres de quienes archivaron chats, en UNA consulta. */
  private async nombresDe(ids: (bigint | null)[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter((x): x is bigint => x != null))];
    if (!unicos.length) return new Map();
    const cuentas = await this.prisma.userAccount.findMany({
      where: { id: { in: unicos } },
      include: { party: { include: { persona: true } } },
    });
    return new Map(cuentas.map((u) => [u.id.toString(), nombreUsuario(u.party, 'otra persona')]));
  }

  /**
   * Celulares (últimos 9 dígitos) con un pedido que el cliente aceptó reprogramar y el admin aún no reenvió a reparto.
   * OJO: el sistema NO guarda una fecha de reprogramación ni de entrega (ni «mañana»): solo este estado.
   */
  private async celularesPorReprogramar(): Promise<Set<string>> {
    const filas = await this.prisma.mensajeReparto.findMany({
      where: { numero: 5 /* pregunta de reprogramar (reprogramacion.service) */, estado: 'REPROGRAMAR', pedido: { estado: 'LISTO' } },
      select: { pedido: { select: { cliente_telefono: true } } },
    });
    return new Set(filas.map((f) => ultimos9(f.pedido.cliente_telefono)).filter(Boolean));
  }

  /**
   * Últimos `n` mensajes de cada chat (más nuevo primero) en UNA consulta con LATERAL + el índice (conversacion_id, id).
   * Antes `include: { mensajes: { take: 20 } }` hacía que Prisma leyera TODOS los mensajes de TODOS los chats y recortara en memoria.
   */
  private async ultimosMensajesPorChat(ids: bigint[], n = 20, liviano = false): Promise<Map<bigint, any[]>> {
    const mapa = new Map<bigint, any[]>();
    if (!ids.length) return mapa;
    // liviano: solo lo que decide pestaña, orden y «sin leer» (sin el contenido ni el id de Meta)
    const filas = liviano
      ? await this.prisma.$queryRaw<any[]>`
      SELECT m.id, m.conversacion_id, m.direccion, m.autor, m.en
      FROM unnest(${ids}::bigint[]) AS c(id)
      CROSS JOIN LATERAL (
        SELECT id, conversacion_id, direccion, autor, en
        FROM mensaje_chat WHERE conversacion_id = c.id ORDER BY id DESC LIMIT ${n}
      ) m
      ORDER BY m.conversacion_id, m.id DESC`
      : await this.prisma.$queryRaw<any[]>`
      SELECT m.id, m.conversacion_id, m.direccion, m.autor, m.tipo, m.contenido, m.meta_id, m.en
      FROM unnest(${ids}::bigint[]) AS c(id)
      CROSS JOIN LATERAL (
        SELECT id, conversacion_id, direccion, autor, tipo, contenido, meta_id, en
        FROM mensaje_chat WHERE conversacion_id = c.id ORDER BY id DESC LIMIT ${n}
      ) m
      ORDER BY m.conversacion_id, m.id DESC`;
    for (const f of filas) {
      const lista = mapa.get(f.conversacion_id) ?? [];
      lista.push(f);
      mapa.set(f.conversacion_id, lista);
    }
    return mapa;
  }

  /** Columnas que necesita la clasificación de TODOS los chats (sin `include`: ni usuario que lo tomó ni mensajes completos). */
  private static readonly SELECCION_LISTA = {
    id: true, telefono: true, estado: true, duenio: true, urgente: true, tomado_por: true, atendido_en: true, atendido_por: true,
    visto_en: true, marcado_no_visto: true, ultima_actividad: true, motivo_derivacion: true, nombre_contacto: true,
    nombre_editado: true, identificador_tipo: true, flujo: true,
    party: { select: { persona: { select: { nombres: true, apellidos: true } } } },
  } as const;

  /** Tamaño de página de la lista de chats. */
  static readonly PAGINA_CHATS = 40;

  /**
   * Lo mínimo de cada chat para decidir pestaña, contadores, orden y búsqueda: sale de UNA lectura de `conversacion` (sin include),
   * los últimos 20 mensajes con solo autor/dirección/hora, los pedidos de hoy, los bloqueos y las reprogramaciones.
   * Los mensajes completos, los nombres de quienes archivaron y el estado del número se piden SOLO para la página que se muestra.
   */
  async clasificar(todas: any[]) {
    const [mensajesPorChat, bloqueos, posMapa, porReprogramar] = await Promise.all([
      // (si la fila ya trae `mensajes`, p. ej. en pruebas con datos armados, no se vuelve a pedir)
      this.ultimosMensajesPorChat(todas.filter((c) => !c.mensajes).map((c) => c.id), 20, true),
      this.bloqueosSpam(todas),
      this.posDeChats(todas),
      this.celularesPorReprogramar(),
    ]);
    const hoy0 = inicioHoyLima();
    return todas.map((c) => {
      const mensajes: any[] = c.mensajes ?? mensajesPorChat.get(c.id) ?? [];
      const estado = estadoDe(c, reabiertoTrasAtendido(c.atendido_en, mensajes));
      const ult = mensajes[0];
      const posChat = posMapa.get(c.id) as PosChat;
      let sinLeer = 0;
      if (estado === 'atencion' || estado === 'validar') {
        for (const m of mensajes) {
          if (m.autor !== 'CLIENTE') break;
          if (c.visto_en && m.en <= c.visto_en) break;
          sinLeer++;
        }
      }
      const esperando = !!ult && ult.direccion === 'ENTRA' && !c.tomado_por;
      const fecha: Date = ult ? ult.en : c.ultima_actividad;
      return {
        c,
        ult,
        estado,
        sinLeer,
        marcadoNoVisto: c.marcado_no_visto as boolean,
        pos: posChat,
        faltaProcesar: faltaProcesar(posChat, mensajes.some((m: any) => m.autor === 'CLIENTE' && m.en >= hoy0)),
        porReprogramar: porReprogramar.has(ultimos9(c.telefono)),
        bloqueoSpam: bloqueos?.get(c.telefono) ?? null,
        nombre: obtenerNombreMostrar(c),
        esperando,
        fecha,
        dia: diaLima(fecha),
      };
    });
  }

  private conteosDe(base: { estado: EstadoChat; sinLeer: number; marcadoNoVisto: boolean; porReprogramar: boolean; bloqueoSpam: any; faltaProcesar: boolean }[]) {
    const cuenta = (g: Exclude<FiltroChat, 'todos' | 'novistos' | 'reprogramar'>) => base.filter((f) => GRUPOS[g].includes(f.estado)).length;
    return {
      todos: base.filter((f) => f.estado !== 'atendido').length,
      atender: cuenta('atender'),
      bot: cuenta('bot'),
      atendidos: cuenta('atendidos'),
      sinVer: base.filter(sinVer).length,
      reprogramar: base.filter((f) => f.porReprogramar).length,
      bloqueadosSpam: base.filter((f) => f.bloqueoSpam?.activo).length,
      faltanProcesar: base.filter((f) => f.faltaProcesar).length,
    };
  }

  /** Pestaña, «procesados», búsqueda y «solo bloqueados» (todo menos el día). */
  private pasaFiltros(f: FilaClasificada, filtro: FiltroChat, q: string, pos?: FiltroPos, soloBloqueados = false): boolean {
    const termino = q.toLowerCase().trim();
    const digitos = termino.replace(/\D/g, '');
    const c = f.c;
    return (
      // «Todos» no trae los archivados: esos viven en «Atendidos» hasta que alguien vuelva a escribir
      (filtro === 'todos'
        ? f.estado !== 'atendido'
        : filtro === 'novistos'
          ? sinVer(f)
          : filtro === 'reprogramar'
            ? f.porReprogramar
            : GRUPOS[filtro].includes(f.estado)) &&
      (!pos || (pos === 'faltan' ? f.faltaProcesar : f.pos.estado !== 'SIN_PEDIDO')) &&
      (!soloBloqueados || !!f.bloqueoSpam?.activo) &&
      (!termino ||
        f.nombre.toLowerCase().includes(termino) ||
        (c.nombre_contacto && c.nombre_contacto.toLowerCase().includes(termino)) ||
        (!esRemitenteSinTelefono(c) && digitos !== '' && c.telefono.replace(/\D/g, '').includes(digitos)))
    );
  }

  /**
   * Clave de orden de cada chat (texto que se compara con < y >). «Por atender»: día más reciente, urgentes, el que más espera.
   * Resto: última actividad más reciente. Siempre desempata por id, así el cursor es estable y no repite ni salta chats.
   */
  private claveOrden(f: FilaClasificada, filtro: FiltroChat): string {
    const inv = (n: number | bigint, ancho: number) => (10n ** BigInt(ancho) - BigInt(n)).toString().padStart(ancho, '0');
    const ua = new Date(f.c.ultima_actividad).getTime();
    const id = inv(f.c.id, 19);
    if (filtro !== 'atender') return inv(ua, 14) + id;
    const espera = f.esperando ? new Date(f.ult.en).getTime().toString().padStart(14, '0') : inv(ua, 14);
    return inv(Number(f.dia.replace(/-/g, '')), 8) + (f.c.urgente ? '0' : '1') + (f.esperando ? '0' : '1') + espera + id;
  }

  /** Completa con lo costoso (texto del último mensaje, quién archivó, estado del número) SOLO los chats que se van a mostrar. */
  private async filasDe(items: FilaClasificada[], claves: Map<bigint, string>) {
    const [completos, quienes, motivosNumero] = await Promise.all([
      this.ultimosMensajesPorChat(items.filter((f) => !f.c.mensajes).map((f) => f.c.id), 1),
      this.nombresDe(items.map((f) => f.c.atendido_por)),
      Promise.all(items.map(async (f) => [f.c.telefono, await this.numeros?.motivoOmision(f.c.telefono)] as const)).then((e) => new Map(e)),
    ]);
    return items.map((f) => {
      const c = f.c;
      const estado = f.estado;
      const ult = c.mensajes ? f.ult : completos.get(c.id)?.[0] ?? f.ult;
      const prefijo = !ult ? '' : ult.autor === 'CLIENTE' ? '' : ult.autor === 'BOT' ? 'Bot: ' : 'Tú: ';
      return {
        id: c.id.toString(),
        nombre: f.nombre,
        telefono: esRemitenteSinTelefono(c) ? enmascararTelefono(c.telefono) : c.telefono,
        identificador_tipo: c.identificador_tipo,
        nombre_contacto: c.nombre_contacto,
        nombre_editado: c.nombre_editado,
        estado,
        urgente: c.urgente,
        ultimo: ult ? prefijo + (ult.tipo === 'IMAGEN' ? 'Foto' : textoDe(ult)) : '',
        hora: ult ? hora(ult.en) : hora(c.ultima_actividad),
        fecha: f.fecha.toISOString(),
        marcadoNoVisto: c.marcado_no_visto,
        ultimaActividadDate: c.ultima_actividad,
        sinLeer: f.sinLeer,
        // El último mensaje es del cliente y nadie lo tomó: minutos que lleva sin respuesta (null si no aplica)
        sinRespuestaMin: f.esperando ? Math.max(0, Math.floor((Date.now() - new Date(ult.en).getTime()) / 60000)) : null,
        bloqueoSpam: f.bloqueoSpam,
        numeroBloqueado: motivosNumero.get(c.telefono) === 'DESTINO_BLOQUEADO',
        numeroPropio: motivosNumero.get(c.telefono) === 'DESTINO_NUMERO_PROPIO',
        pos: f.pos,
        faltaProcesar: f.faltaProcesar,
        atendidoEn: estado === 'atendido' && c.atendido_en ? c.atendido_en.toISOString() : null,
        atendidoPor: estado === 'atendido' && c.atendido_por ? quienes.get(c.atendido_por.toString()) ?? null : null,
        // Archivado y el cliente volvió a escribir: ya está en «Por atender» con este indicador
        volvioAEscribir: !!c.atendido_en && estado !== 'atendido',
        porReprogramar: f.porReprogramar,
        /** Posición en el orden de la lista: la web reordena por ella sin recalcular reglas. */
        clave: claves.get(c.id) as string,
      };
    });
  }

  private diaPedido(dia?: string): string | null {
    const d = (ms: number) => diaLima(new Date(Date.now() + ms));
    return dia === 'hoy' ? d(0) : dia === 'ayer' ? d(-86_400_000) : dia === 'manana' ? d(86_400_000) : dia && dia !== 'todos' ? dia : null;
  }

  /**
   * Lista de chats por PÁGINAS con cursor. `conteos` (de las pestañas) y `dias` salen de todos los chats con la lectura liviana,
   * sin traer mensajes completos; solo los chats de la página llevan texto del último mensaje, quién archivó y estado del número.
   * Compatible: sin cursor ni límite devuelve la primera página (40) con los mismos campos de siempre.
   */
  async listar(
    filtro: FiltroChat = 'todos',
    q = '',
    pos?: FiltroPos,
    opciones: { cursor?: string; limite?: number; dia?: string; soloBloqueados?: boolean } = {},
  ) {
    const todas: any[] = await this.prisma.conversacion.findMany({
      orderBy: [{ ultima_actividad: 'desc' }, { id: 'desc' }],
      select: MensajesService.SELECCION_LISTA,
    });
    const base = await this.clasificar(todas);
    const conteos = this.conteosDe(base);
    const limite = Math.min(Math.max(Math.trunc(opciones.limite ?? MensajesService.PAGINA_CHATS) || MensajesService.PAGINA_CHATS, 1), 100);

    const candidatos = base.filter((f) => this.pasaFiltros(f, filtro, q, pos, opciones.soloBloqueados));
    // Contadores por día de lo que muestra la pestaña (antes de elegir el día)
    const hoy = this.diaPedido('hoy')!;
    const dias = {
      hoy: candidatos.filter((f) => f.dia === hoy).length,
      ayer: candidatos.filter((f) => f.dia === this.diaPedido('ayer')).length,
      manana: candidatos.filter((f) => f.dia === this.diaPedido('manana')).length,
      anteriores: candidatos.filter((f) => f.dia < hoy).length,
      total: candidatos.length,
    };
    const dia = this.diaPedido(opciones.dia);
    const delDia = dia ? candidatos.filter((f) => f.dia === dia) : candidatos;

    const claves = new Map(delDia.map((f) => [f.c.id, this.claveOrden(f, filtro)] as const));
    const ordenados = delDia.sort((a, b) => (claves.get(a.c.id)! < claves.get(b.c.id)! ? -1 : 1));
    const cursor = opciones.cursor ?? '';
    const restantes = cursor ? ordenados.filter((f) => claves.get(f.c.id)! > cursor) : ordenados;
    const pagina = restantes.slice(0, limite);
    const hayMas = restantes.length > limite;
    const chats = await this.filasDe(pagina, claves);
    return {
      conteos,
      dias,
      chats,
      hayMas,
      siguienteCursor: hayMas ? claves.get(pagina[pagina.length - 1].c.id)! : null,
    };
  }

  /** Solo los contadores de las pestañas (para refrescarlos con un evento en vivo sin recargar ninguna página). */
  async conteos() {
    const todas: any[] = await this.prisma.conversacion.findMany({ select: MensajesService.SELECCION_LISTA });
    return this.conteosDe(await this.clasificar(todas));
  }

  /**
   * UNA fila de la lista con las mismas reglas que `listar` (para una actualización en vivo): `chat` es null si el chat ya no
   * cumple pestaña/búsqueda/día; `dentro` dice si por su orden cae entre lo ya cargado (hasta `hasta`, la clave del último cargado).
   */
  async fila(
    id: string,
    filtro: FiltroChat = 'todos',
    q = '',
    pos?: FiltroPos,
    opciones: { hasta?: string; dia?: string; soloBloqueados?: boolean } = {},
  ) {
    let n: bigint;
    try {
      n = BigInt(id);
    } catch {
      return { chat: null, dentro: false };
    }
    const fila: any = await this.prisma.conversacion.findUnique({ where: { id: n }, select: MensajesService.SELECCION_LISTA });
    if (!fila) return { chat: null, dentro: false };
    const [f] = await this.clasificar([fila]);
    const dia = this.diaPedido(opciones.dia);
    if (!this.pasaFiltros(f, filtro, q, pos, opciones.soloBloqueados) || (dia && f.dia !== dia)) return { chat: null, dentro: false };
    const clave = this.claveOrden(f, filtro);
    const [chat] = await this.filasDe([f], new Map([[f.c.id, clave]]));
    return { chat, dentro: !opciones.hasta || clave <= opciones.hasta };
  }

  /** Tamaño de la primera página del historial de un chat; «Cargar anteriores» trae páginas de este mismo tamaño. */
  static readonly PAGINA_MENSAJES = 60;

  private esAdminDe(usuario: UsuarioAutenticado): boolean {
    return (usuario?.roles ?? [usuario?.rol ?? '']).some((r) => String(r || '').toUpperCase() === 'ADMIN');
  }

  /**
   * Una página del historial: los `limite` mensajes más recientes (o los anteriores a `antes`, un id de mensaje),
   * ya en orden cronológico, con el estado de entrega de WhatsApp. Usa el índice (conversacion_id, id).
   */
  private async paginaMensajes(c: any, modo: string, esAdmin: boolean, antes?: bigint, limite = MensajesService.PAGINA_MENSAJES) {
    const filas = await this.prisma.mensajeChat.findMany({
      where: { conversacion_id: c.id, ...(antes ? { id: { lt: antes } } : {}) },
      include: { whatsappMensaje: true },
      orderBy: { id: 'desc' },
      take: limite + 1,
    });
    const hayMasAnteriores = filas.length > limite;
    const mensajes = filas.slice(0, limite).reverse();

    // Relación adicional por meta_id si whatsapp_mensaje_id aún no está enlazado
    const metaIdsSinRelacion = mensajes.filter((m) => !m.whatsappMensaje && m.meta_id).map((m) => m.meta_id as string);
    const waPorMetaId = new Map<string, any>();
    if (metaIdsSinRelacion.length > 0) {
      const encontrados = await this.prisma.whatsappMensaje.findMany({ where: { wa_message_id: { in: metaIdsSinRelacion } } });
      for (const item of encontrados) if (item.wa_message_id) waPorMetaId.set(item.wa_message_id, item);
    }
    return { crudos: mensajes, hayMasAnteriores, mensajes: this.formatearMensajes(mensajes, c, waPorMetaId, modo, esAdmin) };
  }

  private formatearMensajes(mensajes: any[], c: any, waPorMetaId: Map<string, any>, modo: string, esAdmin: boolean) {
    return mensajes.map((m: any) => {
        const wa = m.whatsappMensaje || (m.meta_id ? waPorMetaId.get(m.meta_id) : null);
        const contenido = (m.contenido as any) || {};
        const estadoMsg =
          wa?.estado ||
          contenido.estado ||
          (m.direccion === 'SALE' ? (m.meta_id ? 'ENVIADO' : modo === 'simulado' ? 'SIMULADO' : undefined) : undefined);
        const errorCodigo = wa?.error_codigo || contenido.errorCodigo || null;
        const errorDetalle = wa?.error_detalle || contenido.errorDetalle || null;
        const motivoFallo =
          estadoMsg === 'REVISAR' ? MOTIVO_REVISAR : estadoMsg === 'FALLIDO' ? mapearErrorWhatsApp(errorCodigo, errorDetalle) : null;
        // Detalle técnico (código de Meta y texto original): solo ADMIN
        const tecnico = esAdmin && estadoMsg === 'FALLIDO' ? separarDetalleTecnico(errorCodigo, errorDetalle) : null;

        return {
          id: m.id.toString(),
          autor: m.autor,
          saliente: m.direccion === 'SALE',
          imagen: m.tipo === 'IMAGEN',
          imagenId:
            m.tipo === 'IMAGEN'
              ? String(contenido.archivoId || (c.flujo as any)?.pago?.comprobanteArchivoId || '') || null
              : null,
          texto: textoDe(m),
          plantilla: m.tipo === 'PLANTILLA',
          // Nota de voz guardada: se escucha con GET /admin/archivos/:id (siempre la escucha una persona)
          audioId: m.tipo === 'AUDIO' && contenido.audio?.archivoId ? String(contenido.audio.archivoId) : null,
          documento:
            m.tipo === 'DOCUMENTO' && contenido.documento?.archivoId
              ? {
                  nombre: sanearNombreDocumento(contenido.documento.nombre),
                  bytes: Number(contenido.documento.bytes) || 0,
                  mime: String(contenido.documento.mime || ''),
                  url: `/admin/mensajes/documentos/${m.id.toString()}`,
                }
              : null,
          ubicacion: contenido.ubicacion ?? null,
          // el que mandó la web: con él la bandeja reemplaza su mensaje «Enviando…» por el real sin duplicarlo
          idCliente: typeof contenido.idCliente === 'string' ? contenido.idCliente : undefined,
          hora: hora(m.en),
          fecha: m.en.toISOString(),
          estado: estadoMsg,
          errorCodigo: esAdmin ? errorCodigo : null,
          errorDetalle: esAdmin ? tecnico?.original ?? null : null,
          metaCodigo: esAdmin ? tecnico?.codigoMeta ?? null : null,
          motivoFallo,
          puedeReintentar:
            estadoMsg === 'FALLIDO' || estadoMsg === 'REVISAR'
              ? m.tipo !== 'IMAGEN' && m.tipo !== 'DOCUMENTO' && !esErrorVentana24h(errorCodigo, errorDetalle)
              : undefined,
        };
      });
  }

  /** Solo el historial anterior a `antes` (botón «Cargar anteriores»): sin recalcular pedido, voucher ni pagos. */
  async mensajesAnteriores(id: string, antes: string, usuario: UsuarioAutenticado) {
    const c = await this.cargar(id);
    let desde: bigint;
    try {
      desde = BigInt(antes);
    } catch {
      throw error(HttpStatus.BAD_REQUEST, 'CURSOR_INVALIDO', 'Cursor de mensajes inválido');
    }
    const modo = (this.gateway.estaConectado ? this.gateway.estaConectado() : { modo: 'simulado' as const }).modo;
    const { mensajes, hayMasAnteriores } = await this.paginaMensajes(c, modo, this.esAdminDe(usuario), desde);
    return { mensajes, hayMasAnteriores };
  }

  async detalle(id: string, usuario: UsuarioAutenticado) {
    const c = await this.cargar(id);
    const estadoConexion = this.gateway.estaConectado ? this.gateway.estaConectado() : { modo: 'simulado' as const };
    const modo = estadoConexion.modo;
    const simulado = modo === 'simulado';
    // Cualquiera de sus roles (principal o extra) con permiso; ADMIN solo como principal
    const rolesUsuario = (usuario?.roles ?? [usuario?.rol ?? '']).map((r) => String(r || '').toUpperCase());
    const esAdmin = rolesUsuario.includes('ADMIN');
    const tienePermisoVerVouchers = esAdmin || rolesUsuario.some((r) => Boolean(MATRIZ[r]) && MATRIZ[r].includes('vouchers/ver'));

    // El pedido del chat y lo que cuelga de él (solicitud, voucher) van en una cadena; el resto corre en paralelo con ella
    const cadenaPedido = (async () => {
      // El chat guarda 51XXXXXXXXX y el pedido puede traer solo los 9 dígitos: se compara por los últimos 9
      const ultimos9 = String(c.telefono || '').replace(/\D/g, '').slice(-9);
      const condicion: any[] = [{ cliente_telefono: c.telefono }];
      if (ultimos9.length === 9) condicion.push({ cliente_telefono: { endsWith: ultimos9 } });
      if (c.party_id) condicion.push({ party_id: c.party_id });
      // El pedido cuyo voucher llegó por este chat tiene prioridad
      const pedidoVoucherId = (c.flujo as any)?.pago?.pedidoId;
      if (pedidoVoucherId && /^\d+$/.test(String(pedidoVoucherId))) condicion.push({ id: BigInt(pedidoVoucherId) });
      // El pedido que espera pago en este chat; si no hay, el más reciente como antes (para datos del chat)
      const pedidoEnEspera = await pedidoEsperandoVoucher(this.prisma, c.flujo, c.telefono);
      const pedido = pedidoEnEspera
        ? await this.prisma.pedido.findFirst({ where: { id: pedidoEnEspera.id }, include: { lineas: { orderBy: { id: 'asc' } } } })
        : await this.prisma.pedido.findFirst({
            where: { OR: condicion, estado: { notIn: ['ANULADO', 'ENTREGADO'] }, es_personal: false },
            orderBy: { creado_en: 'desc' },
            include: { lineas: { orderBy: { id: 'asc' } } },
          });
      if (!pedido) return { pedido: null as any, solicitud: null as any, ultimoVoucher: null as any };
      const [solicitud, ultimoVoucher] = await Promise.all([
        this.prisma.solicitudCambio.findFirst({ where: { pedido_id: pedido.id, estado: 'PENDIENTE' }, orderBy: { id: 'desc' } }),
        // Solo vouchers del pedido en espera: nunca el último de la conversación ni de otro pedido
        tienePermisoVerVouchers
          ? this.prisma.voucherPago.findFirst({ where: { pedido_id: pedido.id, reemplazado_en: null }, orderBy: { creado_en: 'desc' } })
          : Promise.resolve(null),
      ]);
      return { pedido, solicitud, ultimoVoucher };
    })();

    const [pagina, pos, { pedido, solicitud, ultimoVoucher }, solicitudReserva, parametro, alta, yo, ventanaAbierta, bloqueos, motivoNumero, quienes] = await Promise.all([
      this.paginaMensajes(c, modo, esAdmin),
      this.posDeChats([c]).then((m) => m.get(c.id) as PosChat),
      cadenaPedido,
      this.prisma.solicitudReserva
        ? this.prisma.solicitudReserva.findFirst({ where: { conversacion_id: c.id, estado: 'PENDIENTE' }, orderBy: { id: 'desc' } })
        : Promise.resolve(null),
      this.prisma.parametro.findUnique({ where: { clave: 'tiempo_prometido_min' } }),
      this.prisma.altaDemanda.findFirst({ where: { hasta: null }, orderBy: { id: 'desc' } }),
      this.yo(usuario),
      this.ventana24hService ? this.ventana24hService.esVentanaAbierta(c.telefono, c.id) : Promise.resolve(true),
      this.bloqueosSpam([c]),
      this.numeros?.motivoOmision(c.telefono),
      this.nombresDe([c.atendido_por]),
    ]);
    const { mensajes, crudos, hayMasAnteriores } = pagina;
    // «Reabierto» = el cliente escribió después de archivar. Si la página no llega hasta esa fecha, se pregunta aparte
    let reabierto = reabiertoTrasAtendido(c.atendido_en, crudos);
    if (c.atendido_en && !reabierto && hayMasAnteriores && crudos[0]?.en > c.atendido_en) {
      reabierto = !!(await this.prisma.mensajeChat.findFirst({
        where: { conversacion_id: c.id, autor: 'CLIENTE', en: { gt: c.atendido_en } },
        select: { id: true },
      }));
    }
    const estado = estadoDe(c, reabierto);
    const base = Number(parametro?.valor) || null;

    let voucherDetalle: any = null;
    if (ultimoVoucher) {
      voucherDetalle = {
        id: ultimoVoucher.id.toString(),
        archivoId: ultimoVoucher.archivo_id?.toString() ?? null,
        semaforo: ultimoVoucher.semaforo,
        motivos: ultimoVoucher.motivos,
        extraido: ultimoVoucher.extraido,
        medio: ultimoVoucher.medio,
        pedidoTotal: pedido?.total ? pedido.total.toString() : null,
      };
    }

    return {
      id: c.id.toString(),
      nombre: obtenerNombreMostrar(c),
      telefono: esRemitenteSinTelefono(c) ? enmascararTelefono(c.telefono) : c.telefono,
      identificador_tipo: c.identificador_tipo,
      nombre_contacto: c.nombre_contacto,
      nombre_editado: c.nombre_editado,
      modalidad: pedido ? MODALIDADES[pedido.modalidad] ?? pedido.modalidad : null,
      estado,
      urgente: c.urgente,
      marcadoNoVisto: c.marcado_no_visto,
      pos,
      atendidoEn: estado === 'atendido' && c.atendido_en ? c.atendido_en.toISOString() : null,
      atendidoPor: estado === 'atendido' && c.atendido_por ? quienes.get(c.atendido_por.toString()) ?? null : null,
      dueno: this.dueno(c),
      esMio: !!c.tomado_por && c.tomado_por === yo,
      ocupado: !!c.tomado_por && c.tomado_por !== yo,
      ventanaAbierta,
      modo,
      simulado,
      numeroReceptor: c.numero_receptor ?? null,
      mensajes,
      hayMasAnteriores,
      pedido: pedido
        ? {
            id: pedido.id.toString(),
            codigo: pedido.codigo,
            medio: pedido.pago_preferido ?? pedido.pago_metodo ?? null,
            total: pedido.total.toString(),
            lineas: lineasDeCuenta(pedido.lineas).map((l: any) => {
              const op = (Array.isArray(l.opciones) ? l.opciones : []).map((o: any) => (typeof o === 'string' ? o : o?.nombre ?? o?.opcion_nombre)).filter(Boolean);
              return [`${l.cantidad} x ${l.nombre}${l.tamano ? ' ' + l.tamano : ''}`, ...op].join(' · ');
            }),
          }
        : null,
      solicitud: solicitud && pedido
        ? {
            id: solicitud.id.toString(),
            tipo: TIPOS_CAMBIO[solicitud.tipo] ?? solicitud.tipo,
            tipoRaw: solicitud.tipo,
            detalle: solicitud.detalle ?? '',
            nuevaDireccion: (solicitud as any).nueva_direccion ?? null,
            nuevaReferencia: (solicitud as any).nueva_referencia ?? null,
            nuevaZonaNombre: (solicitud as any).nueva_zona_nombre ?? null,
            nuevoEnvio: (solicitud as any).nuevo_envio != null ? Number((solicitud as any).nuevo_envio) : null,
            recargoEnvio: (solicitud as any).recargo_envio != null ? Number((solicitud as any).recargo_envio) : null,
            pedido: pedido.codigo,
            pedidoId: pedido.id.toString(),
            estadoPedido: pedido.estado,
            estadoSolicitud: solicitud.estado,
            hora: hora(solicitud.creado_en),
          }
        : null,
      motivoDerivacion:
        (c.motivo_derivacion !== MOTIVO_BLOQUEO_SPAM ? c.motivo_derivacion : null) || (c.flujo as any)?.motivoDerivacion || null,
      bloqueoSpam: bloqueos?.get(c.telefono) ?? null,
      numeroBloqueado: motivoNumero === 'DESTINO_BLOQUEADO',
      numeroPropio: motivoNumero === 'DESTINO_NUMERO_PROPIO',
      solicitudReserva: solicitudReserva
        ? {
            id: solicitudReserva.id.toString(),
            personas: solicitudReserva.personas,
            hora: solicitudReserva.hora ? hora(solicitudReserva.hora) : null,
            fecha: solicitudReserva.hora ? solicitudReserva.hora.toISOString().slice(0, 10) : null,
            nombre: solicitudReserva.nombre || c.nombre_contacto || null,
            telefono: solicitudReserva.telefono || c.telefono || null,
            nota: solicitudReserva.nota || null,
          }
        : null,
      tiempoPrometidoMin: base === null ? null : base + (alta?.minutos ?? 0),
      altaDemanda: !!alta,
      voucher: voucherDetalle,
    };
  }

  async respuestasRapidas() {
    const filas = await this.prisma.respuestaRapida.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
    return filas.map((r) => ({ id: r.id.toString(), titulo: r.titulo, texto: r.texto }));
  }

  /**
   * Idempotencia del envío: la web manda un `idCliente` por mensaje; si el mismo llega dos veces (doble clic, reintento
   * de red) el segundo NO vuelve a escribirle al cliente (Meta cobra por mensaje). Redis, 2 min. Sin Redis no hay control.
   * Devuelve true si este idCliente ya se estaba atendiendo o ya se envió.
   */
  private async yaEnviado(conversacionId: bigint, idCliente?: string): Promise<boolean> {
    if (!idCliente || !this.redisService) return false;
    try {
      const r = await this.redisService.obtenerCliente().set(`mensajes:idem:${conversacionId}:${idCliente}`, '1', 'EX', 120, 'NX');
      return r !== 'OK';
    } catch {
      return false;
    }
  }

  async enviar(id: string, texto: string, usuario: UsuarioAutenticado, ip?: string, idCliente?: string) {
    const limpio = String(texto ?? '').trim();
    if (!limpio) throw error(HttpStatus.BAD_REQUEST, 'MENSAJE_VACIO', 'Escribe un mensaje');
    const c = await this.cargar(id);
    // Las lecturas independientes arrancan juntas; los errores se evalúan en el mismo orden de siempre
    const ventana = this.ventana24hService ? this.ventana24hService.esVentanaAbierta(c.telefono, c.id) : Promise.resolve(true);
    ventana.catch(() => undefined);
    const numero = this.exigirNumeroEnviable(c);
    numero.catch(() => undefined);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para escribir.');
    if (!this.tieneIdentificador(c)) {
      throw error(
        HttpStatus.CONFLICT,
        'CONTACTO_SIN_IDENTIFICADOR',
        'Este contacto no tiene ningun identificador: no se puede responder',
      );
    }

    await numero;
    // Límite de 20 mensajes por minuto por usuario
    await this.verificarLimiteTasaUsuario(usuario.partyId);

    // Verificación de ventana de 24 horas
    if (this.ventana24hService) {
      const abierta = await ventana;
      if (!abierta) {
        throw new HttpException(
          {
            codigo: 'VENTANA_CERRADA',
            mensaje:
              'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada',
            plantillaReapertura: 'caprichos_reabrir_conversacion',
          },
          HttpStatus.CONFLICT,
        );
      }
    }

    // Mismo idCliente otra vez: ya se está enviando o ya salió; no se manda de nuevo
    const previo = await this.mensajeConIdCliente(c.id, idCliente);
    if (previo) return { id: previo, duplicado: true };
    if (await this.yaEnviado(c.id, idCliente)) return { id: '', duplicado: true };

    // Sin cola (pruebas o pasarela sin envío en segundo plano): el envío síncrono de siempre
    if (!this.cola || !this.gateway.transmitirTexto) return this.enviarSincrono(c, limpio, usuario, ip, idCliente);

    // Segundo plano: el mensaje queda guardado ENCOLADO y se responde YA; el servidor habla con Meta después
    const m = await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: c.id,
        direccion: 'SALE',
        autor: 'PERSONA',
        tipo: 'TEXTO',
        contenido: {
          texto: limpio,
          ...(idCliente ? { idCliente } : {}),
          estado: 'ENCOLADO',
          intentos: 0,
          listoEn: Date.now() + 10_000,
          origen: { partyId: usuario.partyId?.toString() ?? null, ip: ip ?? null, accion: 'ENVIAR' },
        },
      },
    });
    // al escribir una persona, el bot calla: el chat deja de ser urgente y queda a cargo de la persona
    await this.tocar(c.id, { duenio: 'PERSONA', urgente: false, estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado });
    this.cola.despertar(m.id);
    return { id: m.id.toString(), estado: 'ENCOLADO' };
  }

  /** Id del mensaje ya guardado con este idCliente en este chat (mira solo los últimos 30: es una repetición reciente). */
  private async mensajeConIdCliente(conversacionId: bigint, idCliente?: string): Promise<string | null> {
    if (!idCliente) return null;
    const ultimos = await this.prisma.mensajeChat.findMany({
      where: { conversacion_id: conversacionId },
      orderBy: { id: 'desc' },
      take: 30,
      select: { id: true, contenido: true },
    });
    const hallado = (ultimos ?? []).find((m: any) => m.contenido?.idCliente === idCliente);
    return hallado ? hallado.id.toString() : null;
  }

  private async enviarSincrono(c: any, limpio: string, usuario: UsuarioAutenticado, ip?: string, idCliente?: string) {
    const m = await this.gateway.enviarTexto(c.id, c.telefono, limpio, 'PERSONA', ...(idCliente ? [idCliente] : []));
    await Promise.all([
      this.tocar(c.id, { duenio: 'PERSONA', urgente: false, estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado }),
      this.auditar(usuario, 'ENVIAR', c.id, { mensajeId: m.id, estado: m.estado }, ip),
    ]);

    if (m.estado === 'FALLIDO') {
      const mensajeError = mapearErrorWhatsApp(m.errorCodigo, m.errorDetalle);
      throw new HttpException(
        { codigo: m.errorCodigo || 'ENVIO_FALLIDO', mensaje: mensajeError, mensajeId: m.id },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { id: m.id };
  }

  /** Foto del equipo al cliente: JPG, PNG o WebP (se comprime a ≤5 MB), con subtítulo opcional. Misma ventana de 24 h que el texto. */
  async enviarImagen(
    id: string,
    archivo: { buffer?: Buffer; mimetype?: string; size?: number } | undefined,
    subtitulo: string | undefined,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const bytes = archivo?.buffer;
    if (!archivo || !bytes?.length) throw error(HttpStatus.BAD_REQUEST, 'IMAGEN_REQUERIDA', 'Elige una foto para enviar');
    if (bytes.length > MAX_IMAGEN_SUBIDA_BYTES) {
      throw error(HttpStatus.PAYLOAD_TOO_LARGE, 'IMAGEN_GRANDE', 'La foto pesa más de 16 MB');
    }
    const tipoOriginal = tipoImagenReal(bytes);
    if (!tipoOriginal || tipoOriginal !== archivo.mimetype) {
      throw error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'IMAGEN_TIPO', 'Solo se pueden enviar fotos JPG, PNG o WebP');
    }
    const pie = String(subtitulo ?? '').trim().slice(0, 1024);

    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para escribir.');
    if (!this.tieneIdentificador(c)) {
      throw error(HttpStatus.CONFLICT, 'CONTACTO_SIN_IDENTIFICADOR', 'Este contacto no tiene ningun identificador: no se puede responder');
    }
    if (!this.gateway.enviarImagen || !this.archivos) {
      throw error(HttpStatus.NOT_IMPLEMENTED, 'IMAGEN_NO_DISPONIBLE', 'Este canal no permite enviar fotos');
    }
    await this.exigirNumeroEnviable(c);
    await this.verificarLimiteTasaUsuario(usuario.partyId);
    if (this.ventana24hService && !(await this.ventana24hService.esVentanaAbierta(c.telefono, c.id))) {
      throw new HttpException(
        {
          codigo: 'VENTANA_CERRADA',
          mensaje: 'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada',
          plantillaReapertura: 'caprichos_reabrir_conversacion',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Se prepara (WebP/pesadas a JPEG) antes de guardar: la copia privada es la misma que se envía
    const listo = await prepararImagenWhatsApp(bytes, tipoOriginal);
    const tipo = listo.mimetype;
    const guardado = await this.archivos.subirArchivo(
      { ...(archivo as Express.Multer.File), buffer: listo.buffer, mimetype: tipo, size: listo.buffer.length },
      true,
    );
    const m = await this.gateway.enviarImagen(c.id, c.telefono, listo.buffer, tipo, pie, 'PERSONA', String(guardado.id), c.phone_number_id ?? undefined);
    await this.tocar(c.id, { duenio: 'PERSONA', urgente: false, estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado });
    await this.auditar(usuario, 'ENVIAR_IMAGEN', c.id, { mensajeId: m.id, estado: m.estado }, ip);

    if (m.estado === 'FALLIDO') {
      throw new HttpException(
        { codigo: m.errorCodigo || 'ENVIO_FALLIDO', mensaje: mapearErrorWhatsApp(m.errorCodigo, m.errorDetalle), mensajeId: m.id },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { id: m.id };
  }

  /**
   * Documento del equipo al cliente (PDF, Word, Excel, PowerPoint o texto, hasta 16 MB). Se guarda en privado y se envía por
   * la Media API de Meta (media id). Misma ventana de 24 h que el texto: fuera de ella no se entrega y se avisa.
   */
  async enviarDocumento(
    id: string,
    archivo: { buffer?: Buffer; mimetype?: string; originalname?: string } | undefined,
    nombreCrudo: string | undefined,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const bytes = archivo?.buffer;
    if (!archivo || !bytes?.length) throw error(HttpStatus.BAD_REQUEST, 'DOCUMENTO_REQUERIDO', 'Elige un documento para enviar');
    if (bytes.length > MAX_DOCUMENTO_ENVIO_BYTES) {
      throw error(HttpStatus.PAYLOAD_TOO_LARGE, 'DOCUMENTO_GRANDE', 'El documento pesa más de 16 MB');
    }
    const nombre = sanearNombreDocumento(nombreCrudo || archivo.originalname);
    const v = validarDocumento(nombre, archivo.mimetype);
    if (!v.ok || !contenidoCoincide(bytes, v.ext)) {
      throw error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'DOCUMENTO_TIPO', 'Solo se pueden enviar documentos PDF, Word, Excel, PowerPoint o de texto');
    }

    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para escribir.');
    if (!this.tieneIdentificador(c)) {
      throw error(HttpStatus.CONFLICT, 'CONTACTO_SIN_IDENTIFICADOR', 'Este contacto no tiene ningun identificador: no se puede responder');
    }
    if (!this.gateway.enviarDocumento || !this.archivos) {
      throw error(HttpStatus.NOT_IMPLEMENTED, 'DOCUMENTO_NO_DISPONIBLE', 'Este canal no permite enviar documentos');
    }
    await this.exigirNumeroEnviable(c);
    await this.verificarLimiteTasaUsuario(usuario.partyId);
    if (this.ventana24hService && !(await this.ventana24hService.esVentanaAbierta(c.telefono, c.id))) {
      throw new HttpException(
        {
          codigo: 'VENTANA_CERRADA',
          mensaje: 'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada',
          plantillaReapertura: 'caprichos_reabrir_conversacion',
        },
        HttpStatus.CONFLICT,
      );
    }

    const guardado = await this.archivos.subirDocumento(bytes, v.mime, v.nombre);
    const m = await this.gateway.enviarDocumento(c.id, c.telefono, bytes, v.mime, v.nombre, 'PERSONA', String(guardado.id), c.phone_number_id ?? undefined);
    await this.tocar(c.id, { duenio: 'PERSONA', urgente: false, estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado });
    await this.auditar(usuario, 'ENVIAR_DOCUMENTO', c.id, { mensajeId: m.id, estado: m.estado, archivoId: guardado.id, mime: v.mime, bytes: bytes.length }, ip);

    if (m.estado === 'FALLIDO') {
      throw new HttpException(
        { codigo: m.errorCodigo || 'ENVIO_FALLIDO', mensaje: mapearErrorWhatsApp(m.errorCodigo, m.errorDetalle), mensajeId: m.id },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { id: m.id };
  }

  /** Ruta física y nombre original de un documento del chat (para la descarga). Solo lo que el mensaje dice que es un documento. */
  async documentoDeMensaje(mensajeId: string, usuario: UsuarioAutenticado, ip?: string, dispositivo?: string) {
    let n: bigint;
    try {
      n = BigInt(mensajeId);
    } catch {
      throw new NotFoundException({ codigo: 'DOCUMENTO_NO_ENCONTRADO', mensaje: 'No se encontró el documento' });
    }
    const m = await this.prisma.mensajeChat.findUnique({ where: { id: n } });
    const d = (m?.contenido as any)?.documento;
    if (!m || m.tipo !== 'DOCUMENTO' || !d?.archivoId || !this.archivos) {
      throw new NotFoundException({ codigo: 'DOCUMENTO_NO_ENCONTRADO', mensaje: 'No se encontró el documento' });
    }
    const f = await this.archivos.obtenerArchivoPrivado(String(d.archivoId), usuario, ip, dispositivo);
    return { ...f, nombre: sanearNombreDocumento(d.nombre) };
  }

  async reabrirConPlantilla(id: string, usuario: UsuarioAutenticado, ip?: string, forzar = false) {
    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para enviar la plantilla.');

    if (!this.tieneIdentificador(c)) {
      throw error(
        HttpStatus.CONFLICT,
        'CONTACTO_SIN_IDENTIFICADOR',
        'Este contacto no tiene ningun identificador: no se puede responder',
      );
    }

    await this.exigirNumeroEnviable(c);

    // Cada plantilla cuesta en Meta: otra dentro de la hora solo sale si quien atiende lo confirma (forzar)
    if (!forzar) {
      const previa = await this.prisma.mensajeChat.findFirst({
        where: { conversacion_id: c.id, direccion: 'SALE', tipo: 'PLANTILLA', en: { gte: new Date(Date.now() - VENTANA_PLANTILLA_RECIENTE_MS) } },
        orderBy: { en: 'desc' },
        select: { en: true },
      });
      if (previa) {
        throw new HttpException(
          { codigo: 'PLANTILLA_RECIENTE', mensaje: 'Ya se envió una plantilla hace poco: espera la respuesta del cliente', enviadaEn: previa.en.toISOString() },
          HttpStatus.CONFLICT,
        );
      }
    }
    await this.verificarLimiteTasaUsuario(usuario.partyId);

    const nombreCliente = c.nombre_contacto || (c.party as any)?.persona?.nombres || 'Cliente';
    const nombrePlantilla = 'caprichos_reabrir_conversacion';

    let m: MensajeEnviado;
    if (this.gateway.enviarPlantilla) {
      m = await this.gateway.enviarPlantilla(
        c.id,
        c.telefono,
        nombrePlantilla,
        [nombreCliente],
        'PERSONA',
      );
    } else {
      m = await this.gateway.enviarTexto(
        c.id,
        c.telefono,
        `Hola ${nombreCliente}, nos comunicamos de Caprichos para dar seguimiento a tu consulta. ¿En que podemos ayudarte?`,
        'PERSONA',
      );
    }

    await this.tocar(c.id, {
      duenio: 'PERSONA',
      urgente: false,
      estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado,
    });

    await this.auditar(
      usuario,
      'ENVIAR_PLANTILLA_REAPERTURA',
      c.id,
      {
        mensajeId: m.id,
        plantilla: nombrePlantilla,
        ...(forzar ? { forzado: true } : {}),
      },
      ip,
    );

    if (m.estado === 'FALLIDO') {
      const mensajeError = mapearErrorWhatsApp(m.errorCodigo, m.errorDetalle);
      throw new HttpException(
        {
          codigo: m.errorCodigo || 'ENVIO_FALLIDO',
          mensaje: mensajeError,
          mensajeId: m.id,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { ok: true, id: m.id };
  }

  async reintentarMensaje(id: string, mensajeId: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para reintentar el mensaje.');

    if (!this.tieneIdentificador(c)) {
      throw error(
        HttpStatus.CONFLICT,
        'CONTACTO_SIN_IDENTIFICADOR',
        'Este contacto no tiene ningun identificador: no se puede responder',
      );
    }

    await this.exigirNumeroEnviable(c);
    await this.verificarLimiteTasaUsuario(usuario.partyId);

    let nMensaje: bigint;
    try {
      nMensaje = BigInt(mensajeId);
    } catch {
      throw error(HttpStatus.NOT_FOUND, 'MENSAJE_NO_ENCONTRADO', 'No se encontró el mensaje a reintentar');
    }

    const mensajeAnterior = await this.prisma.mensajeChat.findUnique({
      where: { id: nMensaje },
    });

    if (!mensajeAnterior || mensajeAnterior.conversacion_id !== c.id) {
      throw error(HttpStatus.NOT_FOUND, 'MENSAJE_NO_ENCONTRADO', 'No se encontró el mensaje a reintentar');
    }

    const contenidoObj = (mensajeAnterior.contenido as any) || {};
    const texto = String(contenidoObj.texto || '');
    const esPlantilla = mensajeAnterior.tipo === 'PLANTILLA';

    // Texto: se REUSA el mismo mensaje (no se crea otro), se vuelve a poner en la cola y se responde YA
    if (!esPlantilla && mensajeAnterior.tipo === 'TEXTO' && this.cola && this.gateway.transmitirTexto) {
      if (this.ventana24hService && !(await this.ventana24hService.esVentanaAbierta(c.telefono, c.id))) {
        throw new HttpException(
          {
            codigo: 'VENTANA_CERRADA',
            mensaje: 'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada',
            plantillaReapertura: 'caprichos_reabrir_conversacion',
          },
          HttpStatus.CONFLICT,
        );
      }
      const wa = mensajeAnterior.whatsapp_mensaje_id
        ? await this.prisma.whatsappMensaje.findUnique({ where: { id: mensajeAnterior.whatsapp_mensaje_id }, select: { estado: true } })
        : null;
      const fallo = ['FALLIDO', 'REVISAR'].includes(String(contenidoObj.estado)) || wa?.estado === 'FALLIDO';
      const origen = { partyId: usuario.partyId?.toString() ?? null, ip: ip ?? null, accion: 'REINTENTAR_MENSAJE' };
      // Atómico: solo pasa a ENCOLADO si nadie más lo reintentó antes (mismo meta_id que se leyó)
      const n = fallo
        ? await this.prisma.$executeRaw`
            UPDATE mensaje_chat
            SET whatsapp_mensaje_id = NULL, meta_id = NULL, en = now(),
                contenido = (contenido - 'errorCodigo' - 'errorDetalle') || ${JSON.stringify({ estado: 'ENCOLADO', intentos: 0, listoEn: Date.now() + 10_000, origen })}::jsonb
            WHERE id = ${mensajeAnterior.id} AND COALESCE(contenido->>'estado', '') NOT IN ('ENCOLADO', 'ENVIANDO')
              AND meta_id IS NOT DISTINCT FROM ${mensajeAnterior.meta_id}::text`
        : 0;
      if (!n) throw error(HttpStatus.CONFLICT, 'REINTENTO_NO_APLICA', 'Este mensaje ya se está enviando o no necesita reintento');
      await this.tocar(c.id, { duenio: 'PERSONA', urgente: false, estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado });
      this.cola.despertar(mensajeAnterior.id);
      return { ok: true, id: mensajeAnterior.id.toString(), estado: 'ENCOLADO' };
    }

    let m: MensajeEnviado;
    if (esPlantilla && this.gateway.enviarPlantilla) {
      const plantilla = contenidoObj.plantilla || 'caprichos_reabrir_conversacion';
      const variables = contenidoObj.variables || [];
      m = await this.gateway.enviarPlantilla(c.id, c.telefono, plantilla, variables, 'PERSONA');
    } else {
      if (this.ventana24hService) {
        const abierta = await this.ventana24hService.esVentanaAbierta(c.telefono, c.id);
        if (!abierta) {
          throw new HttpException(
            {
              codigo: 'VENTANA_CERRADA',
              mensaje:
                'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada',
              plantillaReapertura: 'caprichos_reabrir_conversacion',
            },
            HttpStatus.CONFLICT,
          );
        }
      }
      m = await this.gateway.enviarTexto(c.id, c.telefono, texto, 'PERSONA');
    }

    const nuevoWhatsappMensajeId = m.whatsappMensajeId || null;
    await this.prisma.mensajeChat.update({
      where: { id: mensajeAnterior.id },
      data: {
        en: new Date(),
        meta_id: m.metaId || null,
        ...(nuevoWhatsappMensajeId ? { whatsapp_mensaje_id: nuevoWhatsappMensajeId } : {}),
        contenido: {
          ...contenidoObj,
          estado: m.estado,
          errorDetalle: m.errorDetalle || null,
          errorCodigo: m.errorCodigo || null,
        },
      },
    });

    await this.tocar(c.id, {
      duenio: 'PERSONA',
      urgente: false,
      estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado,
    });

    await this.auditar(
      usuario,
      'REINTENTAR_MENSAJE',
      c.id,
      {
        mensajeId: mensajeAnterior.id.toString(),
        nuevoEstado: m.estado,
      },
      ip,
    );

    if (m.estado === 'FALLIDO') {
      const mensajeError = mapearErrorWhatsApp(m.errorCodigo, m.errorDetalle);
      throw new HttpException(
        {
          codigo: m.errorCodigo || 'ENVIO_FALLIDO',
          mensaje: mensajeError,
          mensajeId: mensajeAnterior.id.toString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { ok: true, id: mensajeAnterior.id.toString() };
  }

  pulir(id: string, texto: string, nombre: string) {
    const crudo = String(texto ?? '').trim();
    if (!crudo) throw error(HttpStatus.BAD_REQUEST, 'MENSAJE_VACIO', 'Escribe primero tu mensaje y luego toca Pulir.');
    return { texto: pulirMensaje(crudo, nombre) };
  }

  async tomar(id: string, forzar: boolean, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    const yo = await this.yo(usuario);
    if (c.tomado_por && c.tomado_por !== yo && !forzar) {
      throw error(HttpStatus.CONFLICT, 'CHAT_TOMADO', `Lo atiende ${this.dueno(c)}. ¿Tomarlo?`);
    }
    await this.tocar(c.id, { duenio: 'PERSONA', tomado_por: yo, tomado_en: new Date() });
    await this.auditar(usuario, 'TOMAR', c.id, { anterior: c.tomado_por?.toString() ?? null }, ip);
    return { ok: true };
  }

  async soltar(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Solo quien lo atiende puede soltarlo.');
    await this.tocar(c.id, { duenio: 'BOT', tomado_por: null, tomado_en: null, urgente: false, atendido_en: null, atendido_por: null, flujo: flujoLiberadoParaBot(c.flujo) as any });
    await this.auditar(usuario, 'SOLTAR', c.id, undefined, ip);
    try {
      await this.gateway.enviarTexto(c.id, c.telefono, TEXTOS_CAMBIOS.botRetomaAtencion(), 'BOT');
    } catch {
      // opcional si falla gateway
    }
    return { ok: true };
  }

  async pausar(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.tocar(c.id, { duenio: 'PERSONA', urgente: false });
    await this.auditar(usuario, 'PAUSAR_BOT', c.id, undefined, ip);
    return { ok: true };
  }

  async reanudar(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.tocar(c.id, { duenio: 'BOT', urgente: false, tomado_por: null, tomado_en: null, atendido_en: null, atendido_por: null, flujo: flujoLiberadoParaBot(c.flujo) as any });
    await this.auditar(usuario, 'REANUDAR_BOT', c.id, undefined, ip);
    try {
      await this.gateway.enviarTexto(c.id, c.telefono, TEXTOS_CAMBIOS.botRetomaAtencion(), 'BOT');
    } catch {
      // opcional
    }
    return { ok: true };
  }

  /** Abrir el chat (o «Marcar como visto»): lo deja visto para todo el equipo. No mueve el chat en la lista. */
  async marcarVisto(id: string, _usuario: UsuarioAutenticado, _ip?: string) {
    const c = await this.cargar(id);
    await this.prisma.conversacion.update({ where: { id: c.id }, data: { visto_en: new Date(), marcado_no_visto: false } });
    this.aviso(c.id);
    return { ok: true };
  }

  /** «Marcar como no visto»: recordatorio compartido para volver al chat. Solo se limpia al abrirlo o al marcarlo visto. */
  async marcarNoVisto(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.prisma.conversacion.update({ where: { id: c.id }, data: { marcado_no_visto: true } });
    this.aviso(c.id);
    await this.auditar(usuario, 'MARCAR_NO_VISTO', c.id, undefined, ip);
    return { ok: true };
  }

  /**
   * «Atendido»: archiva el chat hasta que el cliente o el equipo vuelvan a escribir. NO toca duenio ni tomado_por
   * (el bot lo retoma a las 00:01 de Lima del día siguiente a partir de `atendido_en`; eso lo hace otro módulo).
   * Con un pago por revisar o un pedido sin cobrar pide confirmar (`confirmar`).
   */
  async marcarAtendido(id: string, usuario: UsuarioAutenticado, ip?: string, confirmar = false) {
    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para cerrarlo.');
    if (!confirmar) {
      const pos = (await this.posDeChats([c])).get(c.id);
      if (c.estado === 'VALIDAR_PAGO' || pos?.estado === 'SIN_COBRAR') {
        throw error(
          HttpStatus.CONFLICT,
          'ATENDIDO_REQUIERE_CONFIRMAR',
          c.estado === 'VALIDAR_PAGO'
            ? 'Este chat tiene un pago por revisar. ¿Archivarlo de todos modos?'
            : `El pedido ${pos?.codigo} de este chat aún no está cobrado. ¿Archivarlo de todos modos?`,
        );
      }
    }
    const ahora = new Date();
    await this.tocar(c.id, {
      atendido_en: ahora,
      atendido_por: await this.yo(usuario),
      urgente: false,
      visto_en: ahora,
      marcado_no_visto: false,
    });
    await this.auditar(usuario, 'MARCAR_ATENDIDO', c.id, undefined, ip);
    return { ok: true };
  }

  /** Saca el chat de «Atendidos» y lo devuelve a «Por atender» (queda como atención requerida). */
  async volverPorAtender(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.tocar(c.id, {
      atendido_en: null,
      atendido_por: null,
      urgente: true,
      estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado,
    });
    await this.auditar(usuario, 'VOLVER_POR_ATENDER', c.id, undefined, ip);
    return { ok: true };
  }

  private async pedidoDelChat(c: any) {
    const d = await this.detalle(c.id.toString(), { partyId: 0n, rol: 'ADMIN', debeCambiar: false });
    return d;
  }

  /** Aprueba el pago coordinado (HU-CAP-030, HU-CAP-132: pasa a cocina y notifica al cliente). */
  async aprobarPago(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    if (c.estado !== 'VALIDAR_PAGO') throw error(HttpStatus.CONFLICT, 'SIN_PAGO_POR_REVISAR', 'Este chat no tiene un pago por revisar');
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para decidir tú.');
    await exigirCajaAbiertaHoy(this.prisma);
    const d = await this.pedidoDelChat(c);
    if (!d.pedido) throw error(HttpStatus.CONFLICT, 'SIN_PEDIDO', 'No hay un pedido abierto para este chat');

    const ahora = new Date();
    const pedidoId = BigInt(d.pedido.id);
    if (this.prisma.pedido.findUnique) {
      const ubic = await this.prisma.pedido.findUnique({
        where: { id: pedidoId },
        select: { modalidad: true, entrega_lat: true, entrega_lng: true, zona_id: true },
      });
      if (ubic) exigirDeliveryUbicado(ubic);
    }
    const pedidoActual = this.prisma.pedido.findUnique
      ? await this.prisma.pedido.findUnique({
          where: { id: pedidoId },
          select: { id: true, estado: true, pasa_cocina_en: true, creado_en: true },
        })
      : null;

    const pasaCocinaEn = pedidoActual?.pasa_cocina_en ?? ahora;
    const nuevoEstado =
      pedidoActual?.estado === 'COLA' || !pedidoActual?.pasa_cocina_en
        ? 'PREPARANDO'
        : pedidoActual?.estado;

    await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        pago_estado: 'COORDINADO',
        pago_coordinado_en: ahora,
        pago_coordinado_por: usuario.partyId,
        pasa_cocina_en: pasaCocinaEn,
        estado: nuevoEstado,
      },
    });

    // La foto del chat queda como prueba del pedido aprobado (si aún no tenía pedido)
    // Solo fotos de esta conversación hechas después de abrir el pedido (no las de pedidos anteriores)
    await this.prisma.voucherPago.updateMany({
      where: { conversacion_id: c.id, pedido_id: null, reemplazado_en: null, creado_en: { gte: pedidoActual?.creado_en ?? new Date(0) } },
      data: { pedido_id: pedidoId },
    });

    // Notificar eventos por socket (cocina y pedidos)
    this.eventos?.emitirAdmin('cocina:comanda-actualizada', { pedidoId: d.pedido.id });
    this.eventos?.emitirAdmin('pedido:estado', {
      id: Number(d.pedido.id),
      codigo: d.pedido.codigo,
      estado: nuevoEstado,
    });

    // Tiempo estimado de la zona del pedido (rango); si no hay datos, el respaldo tiempo_prometido_min
    const tiempoTexto = await textoTiempoPedido(this.prisma as any, pedidoId).catch(() =>
      d.tiempoPrometidoMin != null ? String(d.tiempoPrometidoMin) : undefined,
    );
    const textoAprobado = TEXTOS_PAGO.pagoAprobadoCliente(d.pedido.codigo, tiempoTexto);
    await this.gateway.enviarTexto(c.id, c.telefono, textoAprobado, 'BOT');

    const flujoActual = (c.flujo as any) || {};
    await this.tocar(c.id, {
      estado: 'ATENDIDA',
      duenio: 'BOT',
      urgente: false,
      tomado_por: null,
      tomado_en: null,
      flujo: {
        ...flujoActual,
        estado: 'MENU',
        pago: null,
      },
    });
    await this.auditar(usuario, 'APROBAR_PAGO', c.id, { pedido: d.pedido.codigo, por: usuario.partyId?.toString() }, ip);
    return { ok: true };
  }

  async rechazarPago(
    id: string,
    motivoOUsuario?: string | UsuarioAutenticado,
    usuarioOIp?: UsuarioAutenticado | string,
    posibleIp?: string,
  ) {
    let motivo: string | undefined;
    let usuario: UsuarioAutenticado;
    let ip: string | undefined;

    if (typeof motivoOUsuario === 'string' || motivoOUsuario === undefined) {
      motivo = motivoOUsuario;
      usuario = usuarioOIp as UsuarioAutenticado;
      ip = posibleIp;
    } else {
      usuario = motivoOUsuario;
      ip = usuarioOIp as string | undefined;
    }

    const c = await this.cargar(id);
    if (c.estado !== 'VALIDAR_PAGO') throw error(HttpStatus.CONFLICT, 'SIN_PAGO_POR_REVISAR', 'Este chat no tiene un pago por revisar');
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para decidir tú.');

    const flujoActual = (c.flujo as any) || {};
    const flujoPago = flujoActual.pago || {};
    const intentosPrevios = Number(flujoPago.intentosRechazo || 0);
    const intentosNuevos = intentosPrevios + 1;

    // Si supera los 3 intentos: derivar a persona con urgencia
    if (intentosNuevos >= 3) {
      await this.gateway.enviarTexto(
        c.id,
        c.telefono,
        TEXTOS_PAGO.pagoRechazadoLimiteSuperado(),
        'BOT',
      );

      await this.tocar(c.id, {
        estado: 'ABIERTA',
        duenio: 'PERSONA',
        urgente: true,
        tomado_por: null,
        tomado_en: null,
        flujo: {
          ...flujoActual,
          estado: 'ATENCION_PERSONA',
          pago: {
            ...flujoPago,
            intentosRechazo: intentosNuevos,
            ultimoMotivoRechazo: motivo,
          },
        },
      });

      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'ATENCION_WHATSAPP',
          rol_destino: 'CAJERO',
          titulo: `Pago rechazado (3 intentos) - chat #${c.id}`,
          mensaje: `El cliente superó los 3 intentos de comprobante${motivo ? '. Motivo: ' + motivo : ''}. Requiere atención de Caja.`,
          enlace: '/admin/mensajes',
        },
      });
      this.eventos?.emitirAdmin('notificaciones:nueva', {
        id: notif.id.toString(),
        titulo: notif.titulo,
      });

      await this.auditar(usuario, 'RECHAZAR_PAGO_LIMITE', c.id, { intentos: intentosNuevos, motivo }, ip);
      return { ok: true, escalado: true };
    }

    // Menos de 3 intentos: enviar motivo con opciones interactivas
    const textoRechazo = TEXTOS_PAGO.pagoRechazadoCliente(motivo);
    if (this.gateway.enviarBotones) {
      await this.gateway.enviarBotones(
        c.id,
        c.telefono,
        textoRechazo,
        BOTONES_PAGO_RECHAZADO,
        'BOT',
      );
    } else {
      await this.gateway.enviarTexto(c.id, c.telefono, textoRechazo, 'BOT');
    }

    await this.tocar(c.id, {
      estado: 'ABIERTA',
      duenio: 'BOT',
      urgente: false,
      tomado_por: null,
      tomado_en: null,
      flujo: {
        ...flujoActual,
        estado: 'PAGO_RECHAZADO_OPCIONES',
        pago: {
          ...flujoPago,
          estadoInterno: 'PAGO_RECHAZADO_OPCIONES',
          intentosRechazo: intentosNuevos,
          ultimoMotivoRechazo: motivo,
        },
      },
    });

    await this.auditar(usuario, 'RECHAZAR_PAGO', c.id, { intentos: intentosNuevos, motivo }, ip);
    return { ok: true, escalado: false };
  }

  /**
   * Modifica o revierte el nombre de contacto asignado a una conversación.
   * Permiso: mensajes/tomar.
   * Auditoría: registra antes y después sin exponer el teléfono completo.
   * Evento: emite 'mensajes:actualizado' por socket para refrescar clientes.
   */
  async editarNombre(
    id: string,
    dto: EditarNombreContactoDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const c = await this.cargar(id);
    let nuevoNombre: string | null = null;
    let nuevoEditado = false;

    if (dto.revertir) {
      nuevoEditado = false;
      const flujoActual = (c.flujo as any) || {};
      nuevoNombre = flujoActual.nombre_perfil_wa ?? null;
    } else {
      const limpio = String(dto.nombre ?? '').trim();
      if (!limpio || limpio.length < 2 || limpio.length > 60) {
        throw error(
          HttpStatus.BAD_REQUEST,
          'NOMBRE_INVALIDO',
          'El nombre debe tener entre 2 y 60 caracteres y no puede consistir únicamente en espacios',
        );
      }
      nuevoEditado = true;
      nuevoNombre = limpio;
    }

    const actualizada = await this.prisma.conversacion.update({
      where: { id: c.id },
      data: {
        nombre_contacto: nuevoNombre,
        nombre_editado: nuevoEditado,
      },
      include: this.incluir,
    });

    // Auditoría sin registrar número telefónico completo
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mensajes',
      accion: dto.revertir ? 'REVERTIR_NOMBRE_CONTACTO' : 'EDITAR_NOMBRE_CONTACTO',
      resultado: 'OK',
      entidad: 'conversacion',
      entidadId: c.id,
      antes: {
        nombre_contacto: c.nombre_contacto,
        nombre_editado: c.nombre_editado,
        identificador_tipo: c.identificador_tipo,
      },
      despues: {
        nombre_contacto: nuevoNombre,
        nombre_editado: nuevoEditado,
        identificador_tipo: c.identificador_tipo,
      },
      partyId: usuario.partyId,
      ip,
    });

    this.aviso(c.id);

    return {
      ok: true,
      id: actualizada.id.toString(),
      nombre: obtenerNombreMostrar(actualizada),
      nombre_contacto: actualizada.nombre_contacto,
      nombre_editado: actualizada.nombre_editado,
      identificador_tipo: actualizada.identificador_tipo,
    };
  }

  /**
   * Aplica la solicitud de cambio pendiente sobre el pedido (HU-CAP-140).
   * Permiso: mensajes/enviar.
   * Reglas: actualiza pedido (dirección/zona o anulación), audita y notifica al cliente por WhatsApp.
   */
  async aplicarCambio(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para decidir tú.');
    const d = await this.pedidoDelChat(c);
    if (!d.pedido) throw error(HttpStatus.CONFLICT, 'SIN_PEDIDO', 'No hay un pedido abierto para este chat');

    const pedidoId = BigInt(d.pedido.id);
    const solicitud = await this.prisma.solicitudCambio.findFirst({
      where: { pedido_id: pedidoId, estado: 'PENDIENTE' },
      orderBy: { id: 'desc' },
    });

    if (!solicitud) {
      throw error(HttpStatus.CONFLICT, 'SIN_SOLICITUD', 'No hay una solicitud de cambio pendiente');
    }

    const ahora = new Date();
    const pedidoActual = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });
    if (!pedidoActual) throw error(HttpStatus.NOT_FOUND, 'PEDIDO_NO_ENCONTRADO', 'Pedido no encontrado');

    if (solicitud.tipo === 'DIRECCION') {
      const dataUpdate: any = {};
      if (solicitud.nueva_direccion) dataUpdate.entrega_direccion = solicitud.nueva_direccion;
      if (solicitud.nueva_referencia) dataUpdate.entrega_referencia = solicitud.nueva_referencia;
      if (solicitud.nueva_zona_id) dataUpdate.zona_id = solicitud.nueva_zona_id;
      if (solicitud.nuevo_envio != null) {
        dataUpdate.envio = solicitud.nuevo_envio;
        if (pedidoActual.pago_estado !== 'PAGADO') {
          const subtotal = Number(pedidoActual.subtotal);
          const desc = Number(pedidoActual.descuento);
          const nuevoTotal = (subtotal - desc + Number(solicitud.nuevo_envio)).toFixed(2);
          dataUpdate.total = nuevoTotal;
        }
      }
      if (solicitud.lat != null) dataUpdate.entrega_lat = solicitud.lat;
      if (solicitud.lng != null) dataUpdate.entrega_lng = solicitud.lng;

      await this.prisma.pedido.update({
        where: { id: pedidoId },
        data: dataUpdate,
      });

      await this.prisma.solicitudCambio.update({
        where: { id: solicitud.id },
        data: {
          estado: 'ACEPTADA',
          decidido_por: usuario.partyId,
          decidido_en: ahora,
        },
      });

      const dirFinal = solicitud.nueva_direccion || 'la nueva dirección indicada';
      const textoCliente = TEXTOS_CAMBIOS.cambioDireccionAplicadoCliente(pedidoActual.codigo, dirFinal);
      await this.gateway.enviarTexto(c.id, c.telefono, textoCliente, 'PERSONA');

      await this.auditar(usuario, 'APLICAR_CAMBIO_DIRECCION', c.id, {
        pedido: pedidoActual.codigo,
        solicitudId: solicitud.id.toString(),
        nuevaDireccion: solicitud.nueva_direccion,
      }, ip);
    } else if (solicitud.tipo === 'PEDIDO') {
      await this.prisma.solicitudCambio.update({
        where: { id: solicitud.id },
        data: {
          estado: 'ACEPTADA',
          decidido_por: usuario.partyId,
          decidido_en: ahora,
        },
      });

      const textoCliente = TEXTOS_CAMBIOS.cambioPedidoAplicadoCliente(pedidoActual.codigo);
      await this.gateway.enviarTexto(c.id, c.telefono, textoCliente, 'PERSONA');

      await this.auditar(usuario, 'APLICAR_CAMBIO_PEDIDO', c.id, {
        pedido: pedidoActual.codigo,
        solicitudId: solicitud.id.toString(),
        detalle: solicitud.detalle,
      }, ip);
    } else if (solicitud.tipo === 'CANCELAR') {
      await this.prisma.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: 'ANULADO',
          anulado_en: ahora,
          anulado_por: usuario.partyId,
          motivo_anulacion: solicitud.detalle || 'Cancelado por el cliente desde WhatsApp',
        },
      });
      // Un pedido anulado devuelve su stock y reversa sus puntos (idempotentes). Antes quedaba vendido para siempre.
      await this.devolverAlCancelar(pedidoId);

      await this.prisma.solicitudCambio.update({
        where: { id: solicitud.id },
        data: {
          estado: 'ACEPTADA',
          decidido_por: usuario.partyId,
          decidido_en: ahora,
        },
      });

      const textoCliente = TEXTOS_CAMBIOS.cancelacionAplicadaCliente(pedidoActual.codigo);
      await this.gateway.enviarTexto(c.id, c.telefono, textoCliente, 'PERSONA');

      this.eventos?.emitirAdmin('pedido:estado', {
        id: Number(pedidoActual.id),
        codigo: pedidoActual.codigo,
        estado: 'ANULADO',
      });
      await cerrarRutaTrasAnular(this.prisma, pedidoActual.repartidor_party_id, this.eventos, this.logger);

      await this.auditar(usuario, 'APLICAR_CANCELACION_PEDIDO', c.id, {
        pedido: pedidoActual.codigo,
        solicitudId: solicitud.id.toString(),
      }, ip);
    }

    this.eventos?.emitirAdmin('mensajes:actualizado', { id: c.id.toString() });
    return { ok: true };
  }

  /** Devuelve stock y puntos del pedido cancelado; si algo falla no deshace la cancelación (queda en el log para revisar). */
  private async devolverAlCancelar(pedidoId: bigint) {
    for (const [que, paso] of [
      ['los puntos', () => this.puntosService?.reversarPorPedido(pedidoId)],
      ['el stock', () => this.stockService?.revertirPorPedido(pedidoId)],
    ] as Array<[string, () => Promise<unknown> | undefined]>) {
      try {
        await paso();
      } catch (e) {
        this.logger.error(`Cancelado por WhatsApp, pero no se pudo devolver ${que} del pedido ${pedidoId}: ${String(e)}`);
      }
    }
  }

  /**
   * Rechaza la solicitud de cambio con motivo obligatorio (HU-CAP-140).
   * Notifica el motivo al cliente por WhatsApp y audita quién y cuándo.
   */
  async rechazarCambio(id: string, motivo: string, usuario: UsuarioAutenticado, ip?: string) {
    const motivoLimpio = String(motivo || '').trim();
    if (!motivoLimpio || motivoLimpio.length < 3) {
      throw error(HttpStatus.BAD_REQUEST, 'MOTIVO_REQUERIDO', 'Debes ingresar un motivo de rechazo (mínimo 3 caracteres)');
    }

    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para decidir tú.');
    const d = await this.pedidoDelChat(c);
    if (!d.pedido) throw error(HttpStatus.CONFLICT, 'SIN_PEDIDO', 'No hay un pedido abierto para este chat');

    const pedidoId = BigInt(d.pedido.id);
    const solicitud = await this.prisma.solicitudCambio.findFirst({
      where: { pedido_id: pedidoId, estado: 'PENDIENTE' },
      orderBy: { id: 'desc' },
    });

    if (!solicitud) {
      throw error(HttpStatus.CONFLICT, 'SIN_SOLICITUD', 'No hay una solicitud de cambio pendiente');
    }

    const ahora = new Date();
    await this.prisma.solicitudCambio.update({
      where: { id: solicitud.id },
      data: {
        estado: 'RECHAZADA',
        motivo: motivoLimpio,
        decidido_por: usuario.partyId,
        decidido_en: ahora,
      },
    });

    const textoCliente = TEXTOS_CAMBIOS.cambioRechazadoCliente(d.pedido.codigo, motivoLimpio);
    await this.gateway.enviarTexto(c.id, c.telefono, textoCliente, 'PERSONA');

    await this.auditar(usuario, 'RECHAZAR_CAMBIO', c.id, {
      pedido: d.pedido.codigo,
      solicitudId: solicitud.id.toString(),
      motivo: motivoLimpio,
    }, ip);

    this.eventos?.emitirAdmin('mensajes:actualizado', { id: c.id.toString() });
    return { ok: true };
  }
}
