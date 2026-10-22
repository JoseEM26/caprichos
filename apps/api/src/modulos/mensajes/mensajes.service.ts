import { HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { WHATSAPP_GATEWAY, WhatsAppGateway } from './whatsapp.gateway';
import { pulirMensaje } from './pulir.util';

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
const nombreDe = (p: any, telefono: string): string =>
  p?.persona ? `${p.persona.nombres} ${p.persona.apellidos ?? ''}`.trim() : telefono;

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
  ) {}

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
    return c.tomado_por ? nombreDe(c.tomadoPorUsuario?.party, 'otra persona') : null;
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
        nombre: nombreDe(c.party, c.telefono),
        telefono: c.telefono,
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
        (!termino || f.nombre.toLowerCase().includes(termino) || (digitos !== '' && f.telefono.replace(/\D/g, '').includes(digitos))),
    );
    return {
      conteos: { todos: filas.length, atender: cuenta('atender'), bot: cuenta('bot'), atendidos: cuenta('atendidos') },
      chats,
    };
  }

  async detalle(id: string, usuario: UsuarioAutenticado) {
    const c = await this.cargar(id);
    const mensajes = await this.prisma.mensajeChat.findMany({ where: { conversacion_id: c.id }, orderBy: { en: 'asc' } });
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
    return {
      id: c.id.toString(),
      nombre: nombreDe(c.party, c.telefono),
      telefono: c.telefono,
      modalidad: pedido ? MODALIDADES[pedido.modalidad] ?? pedido.modalidad : null,
      estado,
      urgente: c.urgente,
      dueno: this.dueno(c),
      esMio: !!c.tomado_por && c.tomado_por === yo,
      ocupado: !!c.tomado_por && c.tomado_por !== yo,
      mensajes: mensajes.map((m) => ({
        id: m.id.toString(),
        autor: m.autor,
        saliente: m.direccion === 'SALE',
        imagen: m.tipo === 'IMAGEN',
        texto: textoDe(m),
        hora: hora(m.en),
      })),
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
    const m = await this.gateway.enviarTexto(c.id, c.telefono, limpio, 'PERSONA');
    // al escribir una persona, el bot calla: el chat deja de ser urgente y queda a cargo de la persona
    await this.tocar(c.id, { duenio: 'PERSONA', urgente: false, estado: c.estado === 'ATENDIDA' ? 'ABIERTA' : c.estado });
    await this.auditar(usuario, 'ENVIAR', c.id, { mensajeId: m.id }, ip);
    return { id: m.id };
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
}
