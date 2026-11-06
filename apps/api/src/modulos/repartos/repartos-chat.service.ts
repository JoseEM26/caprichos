import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { MensajesService } from '../mensajes/mensajes.service';
import { Ventana24hService } from '../chatbot/servicios/ventana-24h.service';
import { enmascararTelefono } from '../chatbot/utilidades/enmascarar.util';

/** Horas que sigue abierto el chat de un pedido después de entregarlo. */
export const HORAS_CHAT_TRAS_ENTREGA = 2;
const ESTADOS_EN_CURSO = ['LISTO', 'EN_CAMINO'];
const MENSAJE_VENTANA = 'Pasaron 24 h sin respuesta del cliente; el local debe escribirle';

const tieneIdentificador = (telefono?: string | null): boolean => {
  const limpio = (telefono ?? '').trim();
  return limpio !== '' && limpio !== 'wa-user:';
};

/** Texto que ve el repartidor: los mensajes que no son texto se muestran con una etiqueta. */
const textoVisible = (m: { tipo: string; contenido: any }): string => {
  const t = m.contenido?.texto;
  return t ? String(t) : `[${m.tipo.toLowerCase()}]`;
};

/**
 * Chat de WhatsApp de UN pedido para el repartidor. Solo el pedido asignado a quien pregunta y
 * mientras siga vigente; solo la conversación de ese cliente, desde que se creó el pedido.
 * El envío reutiliza MensajesService (misma pasarela, límite y ventana de 24 h).
 */
@Injectable()
export class RepartosChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mensajes: MensajesService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly ventana24h?: Ventana24hService,
  ) {}

  /** Pedido asignado a este repartidor y vigente: en curso, o entregado hace menos de 2 h. */
  private async pedidoVigente(id: string, usuario: UsuarioAutenticado) {
    const pedido = /^\d+$/.test(id) ? await this.prisma.pedido.findUnique({ where: { id: BigInt(id) } }) : null;
    if (!pedido || pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== BigInt(usuario.partyId)) {
      throw new ForbiddenException({ codigo: 'NO_ASIGNADO', mensaje: 'Este pedido no está asignado a tu usuario' });
    }
    const limiteEntrega = HORAS_CHAT_TRAS_ENTREGA * 60 * 60 * 1000;
    const entregadoHace = pedido.entregado_en ? Date.now() - pedido.entregado_en.getTime() : null;
    const vigente =
      pedido.anulado_en == null &&
      (ESTADOS_EN_CURSO.includes(pedido.estado) || (pedido.estado === 'ENTREGADO' && entregadoHace !== null && entregadoHace <= limiteEntrega));
    if (!vigente) {
      throw new ForbiddenException({ codigo: 'CHAT_CERRADO', mensaje: 'El chat de este pedido ya no está disponible' });
    }
    return pedido;
  }

  /** Conversación de WhatsApp del cliente del pedido: por teléfono (últimos 9 dígitos) o por cliente. */
  private async conversacionDe(pedido: { cliente_telefono: string | null; party_id: bigint | null }) {
    const ultimos9 = String(pedido.cliente_telefono ?? '').replace(/\D/g, '').slice(-9);
    const condicion: any[] = [];
    if (pedido.cliente_telefono) condicion.push({ telefono: pedido.cliente_telefono });
    if (ultimos9.length === 9) condicion.push({ telefono: { endsWith: ultimos9 } });
    if (pedido.party_id) condicion.push({ party_id: pedido.party_id });
    if (condicion.length === 0) return null;
    const conv = await this.prisma.conversacion.findFirst({
      where: { OR: condicion },
      orderBy: { ultima_actividad: 'desc' },
    });
    return conv && tieneIdentificador(conv.telefono) ? conv : null;
  }

  async obtenerChat(id: string, usuario: UsuarioAutenticado) {
    const pedido = await this.pedidoVigente(id, usuario);
    const conv = await this.conversacionDe(pedido);
    if (!conv) return { disponible: false, motivo: 'Este cliente no tiene chat' };

    const recientes = await this.prisma.mensajeChat.findMany({
      where: { conversacion_id: conv.id, en: { gte: pedido.creado_en }, tipo: { not: 'SISTEMA' } },
      orderBy: { en: 'desc' },
      take: 200,
    });
    const ventanaAbierta = this.ventana24h ? await this.ventana24h.esVentanaAbierta(conv.telefono, conv.id) : true;

    return {
      disponible: true,
      cliente: {
        nombre: conv.nombre_contacto ?? pedido.cliente_nombre ?? 'Cliente',
        telefono: enmascararTelefono(conv.telefono),
      },
      ventanaAbierta,
      atendidoPorLocal: conv.tomado_por != null,
      mensajes: recientes.reverse().map((m) => ({
        id: String(m.id),
        de: m.autor === 'CLIENTE' ? 'cliente' : 'local',
        texto: textoVisible(m),
        en: m.en,
      })),
    };
  }

  async enviar(id: string, texto: string, usuario: UsuarioAutenticado, ip?: string) {
    const pedido = await this.pedidoVigente(id, usuario);
    const conv = await this.conversacionDe(pedido);
    if (!conv) throw new ConflictException({ codigo: 'SIN_CHAT', mensaje: 'Este cliente no tiene chat' });
    if (conv.tomado_por != null) {
      throw new ConflictException({ codigo: 'CHAT_TOMADO', mensaje: 'El local está atendiendo este chat; inténtalo más tarde' });
    }

    let enviado: { id: string };
    try {
      enviado = await this.mensajes.enviar(String(conv.id), texto, usuario, ip);
    } catch (err) {
      const codigo = err instanceof HttpException ? (err.getResponse() as any)?.codigo : undefined;
      if (codigo === 'VENTANA_CERRADA') throw new ConflictException({ codigo, mensaje: MENSAJE_VENTANA });
      throw err;
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'CHAT_ENVIAR',
      entidad: 'pedido',
      entidadId: pedido.id,
      partyId: usuario.partyId,
      despues: { conversacionId: String(conv.id), mensajeId: enviado.id },
      ip,
    });
    return { id: enviado.id };
  }
}
