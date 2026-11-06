import { ConflictException, Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Ventana24hService } from '../chatbot/servicios/ventana-24h.service';
import { UbicacionPedidoPuerto, UbicacionRecibida } from '../chatbot/puerto/ubicacion-pedido.puerto';
import { CambioUbicacionService } from './cambio-ubicacion.service';
import {
  ESTADOS_ASIGNABLES,
  HORAS_PEDIDO_RECIENTE,
  distanciaMetros,
  textoPedirUbicacion,
  textoUbicacionAsignada,
  textoUbicacionFueraDeZona,
  textoUbicacionIgual,
  textoUbicacionPropuesta,
} from './ubicacion-whatsapp.util';

/** Menos de estos metros se considera la misma ubicación (no genera propuesta). */
const MISMA_UBICACION_M = 30;

type PedidoCand = Awaited<ReturnType<UbicacionWhatsappPedidoService['candidatos']>>[number];

/**
 * Ubicación de WhatsApp (pin) del cliente → pedido delivery activo de ese celular.
 *  - Pedido sin ubicación (el más reciente): se asigna y recalcula zona y envío con el flujo de cambio de ubicación.
 *  - Pedido que ya tiene ubicación: queda como propuesta para Caja (Usar / Descartar).
 *  - Fuera de zona: no se asigna; queda propuesta marcada «Fuera de zona» y se avisa a Caja y al cliente.
 * Siempre responde al cliente por WhatsApp (dentro de la ventana de 24 h: acaba de escribir).
 */
@Injectable()
export class UbicacionWhatsappPedidoService implements UbicacionPedidoPuerto {
  private readonly logger = new Logger(UbicacionWhatsappPedidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cambio: CambioUbicacionService,
    private readonly ventana: Ventana24hService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /** Delivery activos del celular, creados hace poco, el más reciente primero. */
  async candidatos(telefono: string) {
    const ult9 = telefono.replace(/\D/g, '').slice(-9);
    if (ult9.length < 9) return [];
    return this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        estado: { in: ESTADOS_ASIGNABLES },
        creado_en: { gte: new Date(Date.now() - HORAS_PEDIDO_RECIENTE * 3600 * 1000) },
        cliente_telefono: { endsWith: ult9 },
      },
      orderBy: { creado_en: 'desc' },
      select: {
        id: true, codigo: true, cliente_telefono: true, cliente_party_id: true,
        entrega_lat: true, entrega_lng: true, zona_id: true,
      },
    });
  }

  async recibir(u: UbicacionRecibida): Promise<{ atendida: boolean }> {
    const pedidos = await this.candidatos(u.telefono);
    if (pedidos.length === 0) return { atendida: false };
    const sin = pedidos.filter((p) => p.entrega_lat == null || p.entrega_lng == null);
    const punto = { lat: u.lat, lng: u.lng, ...(u.direccion?.trim() ? { direccion: u.direccion.trim() } : {}) };

    if (sin.length > 0) {
      const [objetivo, ...otros] = sin;
      await this.asignar(objetivo, punto, otros.map((o) => o.codigo), u.telefono);
    } else {
      await this.proponer(pedidos[0], punto, u.telefono);
    }
    return { atendida: true };
  }

  private async asignar(p: PedidoCand, punto: { lat: number; lng: number; direccion?: string }, otros: string[], telefono: string) {
    try {
      // La dirección escrita por el cliente se conserva: el pin solo aporta las coordenadas
      const r = await this.cambio.aplicarCambio(p.id, { lat: punto.lat, lng: punto.lng }, { origen: 'WHATSAPP_CLIENTE', usuario: null, omitirAvisoCliente: true });
      const texto = textoUbicacionAsignada({ codigo: p.codigo, envioNuevo: r.envioNuevo, totalNuevo: r.totalNuevo, ajuste: r.ajuste, otros });
      const aviso = await this.responder(telefono, texto, p.id);
      await this.prisma.pedidoCambioUbicacion.update({ where: { id: BigInt(r.cambioId) }, data: { aviso_cliente: aviso } });
      this.eventosGateway?.emitirAdmin('ubicacion:propuesta', { pedidoId: String(p.id), estado: 'APROBADA' });
    } catch (e) {
      if (e instanceof ConflictException) {
        const codigo = (e.getResponse() as { codigo?: string })?.codigo;
        // Fuera de zona o algo que impide aplicarla sola (saldo pendiente…): Caja decide
        await this.proponer(p, punto, telefono, codigo === 'FUERA_DE_COBERTURA');
        return;
      }
      throw e;
    }
  }

  /** Deja la ubicación como propuesta para Caja (o fuera de zona) y avisa a Caja y al cliente. */
  private async proponer(p: PedidoCand, punto: { lat: number; lng: number; direccion?: string }, telefono: string, fueraDeZona = false) {
    if (!fueraDeZona && p.entrega_lat != null && p.entrega_lng != null) {
      const d = distanciaMetros({ lat: Number(p.entrega_lat), lng: Number(p.entrega_lng) }, punto);
      if (d < MISMA_UBICACION_M) {
        await this.responder(telefono, textoUbicacionIgual(p.codigo), p.id);
        return;
      }
    }
    const actual = await this.prisma.pedido.findUnique({ where: { id: p.id } });
    if (!actual) return;
    let calc: Awaited<ReturnType<CambioUbicacionService['calcular']>> | null = null;
    if (!fueraDeZona) {
      try {
        calc = await this.cambio.calcular(this.prisma, actual, punto.lat, punto.lng);
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        fueraDeZona = true;
      }
    }

    let guardada = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        // Una sola propuesta pendiente: la del cliente reemplaza a la anterior del cliente (no a la de Caja o del repartidor)
        await tx.pedidoCambioUbicacion.updateMany({
          where: { pedido_id: p.id, estado: 'PROPUESTA', origen: 'WHATSAPP_CLIENTE' },
          data: { estado: 'CANCELADA', motivo: 'Reemplazada por otra ubicación del cliente', resuelto_en: new Date() },
        });
        await tx.pedidoCambioUbicacion.create({
          data: {
            pedido_id: p.id,
            origen: 'WHATSAPP_CLIENTE',
            estado: 'PROPUESTA',
            propuesto_por_party_id: p.cliente_party_id ?? null,
            lat_anterior: actual.entrega_lat,
            lng_anterior: actual.entrega_lng,
            direccion_anterior: actual.entrega_direccion,
            referencia_anterior: actual.entrega_referencia,
            zona_anterior_id: actual.zona_id,
            lat_nueva: punto.lat,
            lng_nueva: punto.lng,
            direccion_nueva: punto.direccion ?? null,
            zona_nueva_id: calc?.zona.zonaId ?? null,
            envio_anterior: Number(actual.envio ?? 0),
            envio_nuevo: calc?.envioNuevo ?? null,
            total_anterior: Number(actual.total),
            total_nuevo: calc?.totalNuevo ?? null,
            diferencia_envio: calc?.diferencia ?? null,
            fuera_de_zona: fueraDeZona,
          },
        });
      });
    } catch (e) {
      // Ya hay una propuesta pendiente de Caja o del repartidor: no se pisa, solo se avisa
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') guardada = false;
      else throw e;
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: fueraDeZona ? 'UBICACION_WHATSAPP_FUERA_DE_ZONA' : 'PROPONER_UBICACION_WHATSAPP',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: p.id,
      despues: { lat: punto.lat, lng: punto.lng, origen: 'WHATSAPP_CLIENTE', guardada },
    });
    await this.avisarCaja(p.codigo, fueraDeZona);
    this.eventosGateway?.emitirAdmin('ubicacion:propuesta', { pedidoId: String(p.id), estado: 'PROPUESTA' });
    await this.responder(telefono, fueraDeZona ? textoUbicacionFueraDeZona(p.codigo) : textoUbicacionPropuesta(p.codigo), p.id);
  }

  private async avisarCaja(codigo: string, fueraDeZona: boolean) {
    const titulo = fueraDeZona ? `Ubicación fuera de zona en ${codigo}` : `El cliente envió otra ubicación en ${codigo}`;
    try {
      const n = await this.prisma.notificacion.create({
        data: {
          tipo: 'UBICACION_PROPUESTA',
          rol_destino: 'CAJERO',
          titulo,
          mensaje: fueraDeZona
            ? 'La ubicación del cliente está fuera de la zona de reparto: revísala en el pedido.'
            : '¿Usarla? Revisa el mapa y el envío en el pedido (Usar o Descartar).',
          enlace: '/admin/pedidos',
        },
      });
      this.eventosGateway?.emitirAdmin('notificaciones:nueva', { id: n.id.toString(), titulo });
    } catch (err) {
      this.logger.error(`Aviso de ubicación de WhatsApp no registrado: ${(err as Error).message}`);
    }
  }

  /** Mensaje al cliente: texto libre (la ventana está abierta porque acaba de escribir). Devuelve el estado para el historial. */
  private async responder(telefono: string, texto: string, pedidoId: bigint): Promise<string> {
    try {
      if (!(await this.ventana.esVentanaAbierta(telefono))) return 'NO_ENVIADO_VENTANA';
      const r = await this.ventana.enviarMensajeNegocio(telefono, { textoLibre: texto }, { pedidoId });
      return r.exito ? 'ENVIADO' : 'FALLIDO';
    } catch {
      return 'FALLIDO';
    }
  }

  /**
   * Botón «Pedir ubicación por WhatsApp» de Caja: reenvía el pedido de ubicación al cliente. Solo con la ventana de
   * 24 h abierta (no existe plantilla aprobada para esto); si está cerrada, 409 con el motivo.
   */
  async pedirUbicacion(pedidoIdRaw: string, usuario: UsuarioAutenticado, ip?: string) {
    const id = this.cambio.parseId(pedidoIdRaw);
    const pedido = await this.cambio.pedidoEditable(id);
    if (!pedido.cliente_telefono) {
      throw new ConflictException({ codigo: 'SIN_WHATSAPP', mensaje: 'El pedido no tiene celular para escribirle por WhatsApp' });
    }
    if (!(await this.ventana.esVentanaAbierta(pedido.cliente_telefono))) {
      throw new ConflictException({
        codigo: 'VENTANA_CERRADA',
        mensaje: 'Pasaron más de 24 h desde el último mensaje del cliente: WhatsApp no deja escribirle. Pídele que te escriba o llámalo.',
      });
    }
    const r = await this.ventana.enviarMensajeNegocio(pedido.cliente_telefono, { textoLibre: textoPedirUbicacion(pedido.codigo) }, { pedidoId: id });
    if (!r.exito) {
      throw new ConflictException({
        codigo: r.errorCodigo === 'CLIENTE_BAJA' ? 'CLIENTE_BAJA' : 'ENVIO_FALLIDO',
        mensaje: r.errorCodigo === 'CLIENTE_BAJA' ? 'El cliente pidió no recibir mensajes.' : 'No se pudo enviar el mensaje por WhatsApp.',
      });
    }
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'PEDIR_UBICACION_WHATSAPP',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: id,
      partyId: BigInt(usuario.partyId),
      ip,
    });
    return { enviado: true };
  }
}
