import { HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { Ventana24hService } from '../chatbot/servicios/ventana-24h.service';
import { MensajeEnviado, WHATSAPP_GATEWAY, WhatsAppGateway } from './whatsapp.gateway';
import { pulirMensaje } from './pulir.util';
import {
  esRemitenteSinTelefono,
  obtenerNombreMostrar,
} from './utilidades/nombre-contacto.util';
import { enmascararTelefono } from '../chatbot/utilidades/enmascarar.util';
import { mapearErrorWhatsApp } from './utilidades/error-whatsapp.util';
import { EditarNombreContactoDto } from './dto/mensajes.dto';

export type EstadoChat = 'bot' | 'atencion' | 'validar' | 'atendido' | 'pausado';
export type FiltroChat = 'todos' | 'atender' | 'bot' | 'atendidos';

const GRUPOS: Record<Exclude<FiltroChat, 'todos'>, EstadoChat[]> = {
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

/** Estado que ve la consola, derivado de las columnas de `conversacion` (la tabla no tiene «pausado»). */
export function estadoDe(c: { estado: string; duenio: string; urgente: boolean }): EstadoChat {
  if (c.estado === 'ATENDIDA') return 'atendido';
  if (c.estado === 'VALIDAR_PAGO') return 'validar';
  if (c.urgente) return 'atencion';
  return c.duenio === 'PERSONA' ? 'pausado' : 'bot';
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
@Injectable()
export class MensajesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGateway,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly ventana24hService?: Ventana24hService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

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

  async listar(filtro: FiltroChat = 'todos', q = '') {
    const todas = await this.prisma.conversacion.findMany({
      orderBy: { ultima_actividad: 'desc' },
      include: { ...this.incluir, mensajes: { orderBy: { en: 'desc' }, take: 20 } },
    });
    const filas = todas.map((c) => {
      const estado = estadoDe(c);
      const ult = c.mensajes[0];
      let sinLeer = 0;
      if (estado === 'atencion' || estado === 'validar') {
        for (const m of c.mensajes) { if (m.autor !== 'CLIENTE') break; sinLeer++; }
      }
      const prefijo = !ult ? '' : ult.autor === 'CLIENTE' ? '' : ult.autor === 'BOT' ? 'Bot: ' : 'Tú: ';
      return {
        id: c.id.toString(),
        nombre: obtenerNombreMostrar(c),
        telefono: esRemitenteSinTelefono(c) ? enmascararTelefono(c.telefono) : c.telefono,
        identificador_tipo: c.identificador_tipo,
        nombre_contacto: c.nombre_contacto,
        nombre_editado: c.nombre_editado,
        estado,
        urgente: c.urgente,
        ultimo: ult ? prefijo + (ult.tipo === 'IMAGEN' ? 'Foto' : textoDe(ult)) : '',
        hora: ult ? hora(ult.en) : hora(c.ultima_actividad),
        sinLeer,
      };
    });
    const cuenta = (g: Exclude<FiltroChat, 'todos'>) => filas.filter((f) => GRUPOS[g].includes(f.estado)).length;
    const termino = q.toLowerCase().trim();
    const digitos = termino.replace(/\D/g, '');
    const chats = filas.filter(
      (f) =>
        (filtro === 'todos' || GRUPOS[filtro].includes(f.estado)) &&
        (!termino ||
          f.nombre.toLowerCase().includes(termino) ||
          (f.nombre_contacto && f.nombre_contacto.toLowerCase().includes(termino)) ||
          (!esRemitenteSinTelefono(f) && digitos !== '' && f.telefono.replace(/\D/g, '').includes(digitos))),
    );
    return {
      conteos: { todos: filas.length, atender: cuenta('atender'), bot: cuenta('bot'), atendidos: cuenta('atendidos') },
      chats,
    };
  }

  async detalle(id: string, usuario: UsuarioAutenticado) {
    const c = await this.cargar(id);
    const mensajes = await this.prisma.mensajeChat.findMany({
      where: { conversacion_id: c.id },
      include: { whatsappMensaje: true },
      orderBy: { en: 'asc' },
    });

    // Relación adicional por meta_id si whatsapp_mensaje_id aún no está enlazado
    const metaIdsSinRelacion = mensajes
      .filter((m) => !m.whatsappMensaje && m.meta_id)
      .map((m) => m.meta_id as string);

    const waPorMetaId = new Map<string, any>();
    if (metaIdsSinRelacion.length > 0) {
      const encontrados = await this.prisma.whatsappMensaje.findMany({
        where: { wa_message_id: { in: metaIdsSinRelacion } },
      });
      for (const item of encontrados) {
        if (item.wa_message_id) {
          waPorMetaId.set(item.wa_message_id, item);
        }
      }
    }

    const estado = estadoDe(c);
    const condicion: any[] = [{ cliente_telefono: c.telefono }];
    if (c.party_id) condicion.push({ party_id: c.party_id });
    const pedido = await this.prisma.pedido.findFirst({
      where: { OR: condicion, estado: { notIn: ['ANULADO', 'ENTREGADO'] }, es_personal: false },
      orderBy: { creado_en: 'desc' },
      include: { lineas: { orderBy: { id: 'asc' } } },
    });
    const solicitud = pedido
      ? await this.prisma.solicitudCambio.findFirst({ where: { pedido_id: pedido.id, estado: 'PENDIENTE' }, orderBy: { id: 'desc' } })
      : null;
    const parametro = await this.prisma.parametro.findUnique({ where: { clave: 'tiempo_prometido_min' } });
    const base = Number(parametro?.valor) || null;
    const alta = await this.prisma.altaDemanda.findFirst({ where: { hasta: null }, orderBy: { id: 'desc' } });
    const yo = await this.yo(usuario);

    const estadoConexion = this.gateway.estaConectado ? this.gateway.estaConectado() : { modo: 'simulado' as const };
    const modo = estadoConexion.modo;
    const simulado = modo === 'simulado';

    let ventanaAbierta = true;
    if (this.ventana24hService) {
      ventanaAbierta = await this.ventana24hService.esVentanaAbierta(c.telefono, c.id);
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
      dueno: this.dueno(c),
      esMio: !!c.tomado_por && c.tomado_por === yo,
      ocupado: !!c.tomado_por && c.tomado_por !== yo,
      ventanaAbierta,
      modo,
      simulado,
      mensajes: mensajes.map((m) => {
        const wa = m.whatsappMensaje || (m.meta_id ? waPorMetaId.get(m.meta_id) : null);
        const contenido = (m.contenido as any) || {};
        const estadoMsg =
          wa?.estado ||
          contenido.estado ||
          (m.direccion === 'SALE' ? (m.meta_id ? 'ENVIADO' : 'SIMULADO') : undefined);
        const errorCodigo = wa?.error_codigo || contenido.errorCodigo || null;
        const errorDetalle = wa?.error_detalle || contenido.errorDetalle || null;
        const motivoFallo =
          estadoMsg === 'FALLIDO' ? mapearErrorWhatsApp(errorCodigo, errorDetalle) : null;

        return {
          id: m.id.toString(),
          autor: m.autor,
          saliente: m.direccion === 'SALE',
          imagen: m.tipo === 'IMAGEN',
          texto: textoDe(m),
          hora: hora(m.en),
          estado: estadoMsg,
          errorCodigo,
          errorDetalle,
          motivoFallo,
        };
      }),
      pedido: pedido
        ? {
            id: pedido.id.toString(),
            codigo: pedido.codigo,
            medio: pedido.pago_preferido ?? pedido.pago_metodo ?? null,
            total: pedido.total.toString(),
            lineas: pedido.lineas.map((l: any) => {
              const op = (Array.isArray(l.opciones) ? l.opciones : []).map((o: any) => (typeof o === 'string' ? o : o?.nombre ?? o?.opcion_nombre)).filter(Boolean);
              return [`${l.cantidad} x ${l.nombre}${l.tamano ? ' ' + l.tamano : ''}`, ...op].join(' · ');
            }),
          }
        : null,
      solicitud: solicitud && pedido
        ? {
            tipo: TIPOS_CAMBIO[solicitud.tipo] ?? solicitud.tipo,
            detalle: solicitud.detalle ?? '',
            pedido: pedido.codigo,
            pedidoId: pedido.id.toString(),
            estadoPedido: pedido.estado,
            hora: hora(solicitud.creado_en),
          }
        : null,
      tiempoPrometidoMin: base === null ? null : base + (alta?.minutos ?? 0),
      altaDemanda: !!alta,
    };
  }

  async respuestasRapidas() {
    const filas = await this.prisma.respuestaRapida.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
    return filas.map((r) => ({ id: r.id.toString(), titulo: r.titulo, texto: r.texto }));
  }

  async enviar(id: string, texto: string, usuario: UsuarioAutenticado, ip?: string) {
    const limpio = String(texto ?? '').trim();
    if (!limpio) throw error(HttpStatus.BAD_REQUEST, 'MENSAJE_VACIO', 'Escribe un mensaje');
    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para escribir.');
    if (!this.tieneIdentificador(c)) {
      throw error(
        HttpStatus.CONFLICT,
        'CONTACTO_SIN_IDENTIFICADOR',
        'Este contacto no tiene ningun identificador: no se puede responder',
      );
    }

    // Límite de 20 mensajes por minuto por usuario
    await this.verificarLimiteTasaUsuario(usuario.partyId);

    // Verificación de ventana de 24 horas
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

    const m = await this.gateway.enviarTexto(c.id, c.telefono, limpio, 'PERSONA');
    // al escribir una persona, el bot calla: el chat deja de ser urgente y queda a cargo de la persona
    await this.tocar(c.id, { duenio: 'PERSONA', urgente: false, estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado });
    await this.auditar(usuario, 'ENVIAR', c.id, { mensajeId: m.id, estado: m.estado }, ip);

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

    return { id: m.id };
  }

  async reabrirConPlantilla(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para enviar la plantilla.');

    if (!this.tieneIdentificador(c)) {
      throw error(
        HttpStatus.CONFLICT,
        'CONTACTO_SIN_IDENTIFICADOR',
        'Este contacto no tiene ningun identificador: no se puede responder',
      );
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
    await this.tocar(c.id, { tomado_por: null, tomado_en: null });
    await this.auditar(usuario, 'SOLTAR', c.id, undefined, ip);
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
    await this.tocar(c.id, { duenio: 'BOT', urgente: false, tomado_por: null, tomado_en: null });
    await this.auditar(usuario, 'REANUDAR_BOT', c.id, undefined, ip);
    return { ok: true };
  }

  async marcarAtendido(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para cerrarlo.');
    await this.tocar(c.id, { estado: 'ATENDIDA', duenio: 'BOT', urgente: false, tomado_por: null, tomado_en: null });
    await this.auditar(usuario, 'MARCAR_ATENDIDO', c.id, undefined, ip);
    return { ok: true };
  }

  private async pedidoDelChat(c: any) {
    const d = await this.detalle(c.id.toString(), { partyId: 0n, rol: 'ADMIN', debeCambiar: false });
    return d;
  }

  /** Aprueba el pago coordinado (DT-57: el pedido ya está en cocina; no se reenvía). */
  async aprobarPago(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    if (c.estado !== 'VALIDAR_PAGO') throw error(HttpStatus.CONFLICT, 'SIN_PAGO_POR_REVISAR', 'Este chat no tiene un pago por revisar');
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para decidir tú.');
    const d = await this.pedidoDelChat(c);
    if (!d.pedido) throw error(HttpStatus.CONFLICT, 'SIN_PEDIDO', 'No hay un pedido abierto para este chat');
    const ahora = new Date();
    await this.prisma.pedido.update({
      where: { id: BigInt(d.pedido.id) },
      data: { pago_estado: 'COORDINADO', pago_coordinado_en: ahora, pago_coordinado_por: usuario.partyId },
    });
    const min = d.tiempoPrometidoMin;
    await this.gateway.enviarTexto(
      c.id, c.telefono,
      `Pago verificado. Tu pedido ${d.pedido.codigo} ya entró a preparación${min ? ` y llega en unos ${min} minutos` : ''}.`,
      'BOT',
    );
    await this.tocar(c.id, { estado: 'ATENDIDA', duenio: 'BOT', urgente: false, tomado_por: null, tomado_en: null });
    await this.auditar(usuario, 'APROBAR_PAGO', c.id, { pedido: d.pedido.codigo }, ip);
    return { ok: true };
  }

  async rechazarPago(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const c = await this.cargar(id);
    if (c.estado !== 'VALIDAR_PAGO') throw error(HttpStatus.CONFLICT, 'SIN_PAGO_POR_REVISAR', 'Este chat no tiene un pago por revisar');
    await this.exigirLibreOMio(c, usuario, 'Toca «Tomar el chat» para decidir tú.');
    await this.gateway.enviarTexto(
      c.id, c.telefono, 'No pudimos verificar tu pago con esa captura. ¿Puedes enviarnos otra, por favor?', 'BOT',
    );
    await this.tocar(c.id, { estado: 'ABIERTA', duenio: 'BOT', urgente: false, tomado_por: null, tomado_en: null });
    await this.auditar(usuario, 'RECHAZAR_PAGO', c.id, undefined, ip);
    return { ok: true };
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
}
