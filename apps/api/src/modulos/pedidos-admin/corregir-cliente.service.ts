import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { DireccionesClienteService } from '../clientes/direcciones-cliente.service';
import { tieneTelefonoReal } from '../chatbot/utilidades/enmascarar.util';
import { CorregirClienteDto } from './dto/corregir-cliente.dto';

/** Solo un pedido anulado o rechazado no se corrige; entregado o cobrado sí (el dato sirve para contactar). */
export const ESTADOS_SIN_CORREGIR_CLIENTE = ['ANULADO', 'RECHAZADO'];

/**
 * «Corregir datos del cliente»: nombre, celular y, en delivery, dirección y referencia escritas del pedido.
 * No toca la cuenta del cliente (cliente_party_id), la conversación de WhatsApp ni el punto del mapa.
 * Los avisos de WhatsApp leen pedido.cliente_telefono al enviarse, así que usan el número corregido.
 */
@Injectable()
export class CorregirClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly direcciones?: DireccionesClienteService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async corregir(idRaw: string, dto: CorregirClienteDto, usuario: UsuarioAutenticado, ip?: string) {
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }
    const id = BigInt(idRaw);
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (ESTADOS_SIN_CORREGIR_CLIENTE.includes(pedido.estado)) {
      throw new ConflictException({ codigo: 'PEDIDO_CERRADO', mensaje: `No se corrigen los datos de un pedido ${pedido.estado.toLowerCase()}` });
    }

    const esDelivery = pedido.modalidad === 'DELIVERY';
    const antes = {
      nombre: pedido.cliente_nombre,
      telefono: tieneTelefonoReal(pedido.cliente_telefono) ? pedido.cliente_telefono : null,
      direccion: pedido.entrega_direccion,
      referencia: pedido.entrega_referencia,
    };
    const despues = {
      nombre: dto.nombre,
      telefono: dto.telefono,
      // Solo delivery lleva dirección y referencia; vacío las borra, ausente las deja como están
      direccion: esDelivery && dto.direccion !== undefined ? dto.direccion || null : antes.direccion,
      referencia: esDelivery && dto.referencia !== undefined ? dto.referencia || null : antes.referencia,
    };
    const motivo = dto.motivo?.trim() || null;
    const quien = await this.nombreUsuario(usuario.partyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id },
        data: {
          cliente_nombre: despues.nombre,
          cliente_telefono: despues.telefono,
          ...(esDelivery ? { entrega_direccion: despues.direccion, entrega_referencia: despues.referencia } : {}),
        },
      });
      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'pedidos',
          accion: 'CORREGIR_CLIENTE',
          resultado: 'OK',
          entidad: 'pedido',
          entidadId: id,
          antes,
          despues: { ...despues, motivo },
          partyId: usuario.partyId,
          ip,
        },
        tx,
      );
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: id,
          estado_anterior: pedido.estado,
          estado_nuevo: pedido.estado,
          motivo: `Datos del cliente corregidos por ${quien}${motivo ? `: ${motivo}` : ''}`.slice(0, 480),
          por_party_id: BigInt(usuario.partyId),
        },
      });
    });

    try {
      this.eventos?.emitirAdmin('pedido:editado', {
        id: String(id),
        codigo: pedido.codigo,
        estado: pedido.estado,
        version: pedido.version,
        por: String(usuario.partyId),
      });
    } catch {
      // Sin socket (pruebas): no bloquea
    }

    // Avisos ya encolados con el número viejo: no se reescriben, solo se informan
    const avisosPendientes =
      antes.telefono && antes.telefono !== despues.telefono
        ? await this.prisma.salienteWhatsapp.count({ where: { pedido_id: id, estado: { in: ['PENDIENTE', 'ENVIANDO'] } } })
        : 0;
    const cuenta = await this.direcciones?.cuentaPorTelefono(despues.telefono).catch(() => null);
    return {
      id: String(id),
      codigo: pedido.codigo,
      cliente_nombre: despues.nombre,
      cliente_telefono: despues.telefono,
      entrega_direccion: despues.direccion,
      entrega_referencia: despues.referencia,
      avisosPendientes,
      numeroDeCuenta: cuenta ? cuenta.primerNombre : null,
    };
  }

  private async nombreUsuario(partyId: bigint): Promise<string> {
    const p = await this.prisma.person.findUnique({ where: { party_id: partyId }, select: { nombres: true, apellidos: true } }).catch(() => null);
    const nombre = p ? `${p.nombres} ${p.apellidos ?? ''}`.trim() : '';
    return nombre || `usuario ${partyId}`;
  }
}
