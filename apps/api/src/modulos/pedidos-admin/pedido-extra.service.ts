import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { esSoloMozo } from '../acceso/roles-usuario';
import { PedidosService } from '../pedidos/pedidos.service';
import { CrearPedidoDto } from '../pedidos/dto/crear-pedido.dto';
import { ImpresionService } from '../impresion/impresion.service';
import { tieneTelefonoReal } from '../chatbot/utilidades/enmascarar.util';
import { ExtraPedidoDto } from './dto/extra-pedido.dto';

/** Un pedido anulado o rechazado ya no admite extras; entregado o pagado sí. */
export const ESTADOS_SIN_EXTRA = ['ANULADO', 'RECHAZADO'];

/**
 * «Agregar extra»: crea un SEGUNDO pedido enlazado al original (pedido.pedido_origen_id) con el mismo cliente, modalidad y
 * mesa o dirección. Pasa por PedidosService.crear (stock, descuentos, puntos, comanda), con envío 0, y tiene su propio pago,
 * voucher y comprobante. No toca el original ni avisa al cliente por WhatsApp.
 */
@Injectable()
export class PedidoExtraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidos: PedidosService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly impresion?: ImpresionService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async crearExtra(idRaw: string, dto: ExtraPedidoDto, usuario: UsuarioAutenticado, idempotencyKey?: string, ip?: string) {
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }
    const original = await this.prisma.pedido.findUnique({ where: { id: BigInt(idRaw) } });
    if (!original) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    if (ESTADOS_SIN_EXTRA.includes(original.estado)) {
      throw new ConflictException({
        codigo: 'PEDIDO_NO_ADMITE_EXTRA',
        mensaje: `Un pedido ${original.estado === 'ANULADO' ? 'anulado' : 'rechazado'} no admite extras`,
      });
    }
    // Un extra de un extra se enlaza al pedido raíz: la cuenta siempre cuelga de un solo pedido
    const raizId = original.pedido_origen_id ?? original.id;
    const raiz = raizId === original.id ? original : await this.prisma.pedido.findUnique({ where: { id: raizId } });
    if (!raiz) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido original no encontrado' });
    }

    const telefono = tieneTelefonoReal(original.cliente_telefono) ? original.cliente_telefono! : undefined;
    const crearDto: CrearPedidoDto = {
      cliente: { nombre: original.cliente_nombre || original.mesa_nombre || 'Cliente', telefono },
      modalidad: original.modalidad as CrearPedidoDto['modalidad'],
      mesa: original.mesa_nombre ?? undefined,
      entrega:
        original.modalidad === 'DELIVERY'
          ? {
              direccion: original.entrega_direccion ?? undefined,
              referencia: original.entrega_referencia ?? undefined,
              lat: original.entrega_lat != null ? Number(original.entrega_lat) : undefined,
              lng: original.entrega_lng != null ? Number(original.entrega_lng) : undefined,
            }
          : undefined,
      lineas: dto.lineas,
      pago: dto.pago,
      comprobante: dto.comprobante,
      nota: dto.nota,
      // misma cuenta del cliente (puntos): por celular si lo hay; si no, por el party ya identificado
      clienteTelefono: telefono,
      clientePartyId: !telefono && original.cliente_party_id ? String(original.cliente_party_id) : undefined,
    };

    const key = idempotencyKey || `extra-${usuario?.partyId ?? 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await this.pedidos.crear(crearDto, key, {
      canal: usuario && esSoloMozo(usuario) ? 'MOZO' : 'CAJA',
      usuarioPartyId: usuario?.partyId,
      omitirChequeoCarta: true,
      pedidoOrigenId: raiz.id,
      mesaNombre: original.mesa_nombre ?? undefined,
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'AGREGAR_EXTRA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: raiz.id,
      despues: { extraId: res.id, extraCodigo: res.codigo, total: res.total, origen: raiz.codigo },
      partyId: usuario?.partyId,
      ip,
    });

    if (res?.id && this.impresion) {
      try {
        await this.impresion.encolarEtiquetasPedido(res.id);
      } catch {
        // Encolado no bloqueante, igual que en un pedido nuevo
      }
    }
    try {
      this.eventos?.emitirAdmin('pedido:extra', { id: raiz.id.toString(), extraId: res.id, codigo: res.codigo });
    } catch {
      // sin websocket en pruebas
    }
    return { ...res, pedidoOrigenId: raiz.id.toString(), pedidoOrigenCodigo: raiz.codigo };
  }
}
