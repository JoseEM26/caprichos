import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { enmascararDni, validarDocumentoComprobante } from '../comprobantes/comprobantes.util';
import { CambiarComprobanteDto } from './dto/cambiar-comprobante.dto';

/** Cambia el comprobante de un pedido mientras no esté cobrado y sin comprobante emitido. */
@Injectable()
export class PedidoComprobanteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async cambiar(idRaw: string, dto: CambiarComprobanteDto, usuario?: UsuarioAutenticado, ip?: string) {
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'PEDIDO_INVALIDO', mensaje: 'El pedido no es válido' });
    }
    const id = BigInt(idRaw);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        estado: true,
        pago_estado: true,
        total: true,
        comprobante_tipo: true,
        comprobante_doc: true,
        comprobante_razon: true,
        comprobante_direccion: true,
      },
    });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
    }
    if (pedido.estado === 'ANULADO') {
      throw new ConflictException({ codigo: 'PEDIDO_ANULADO', mensaje: 'El pedido está anulado: no se le puede cambiar el comprobante' });
    }
    if (pedido.pago_estado === 'PAGADO') {
      throw new ConflictException({
        codigo: 'PEDIDO_COBRADO',
        mensaje: 'El pedido ya está cobrado. Para corregir el comprobante, anúlalo y emite otro.',
      });
    }

    const emitido = await this.prisma.comprobante.findFirst({
      where: { pedido_id: id, anulado_en: null },
      select: { tipo: true, numero_texto: true },
    });
    if (emitido) {
      throw new ConflictException({
        codigo: 'COMPROBANTE_EMITIDO',
        mensaje: `Ya tiene el comprobante ${emitido.numero_texto} emitido. Anúlalo para cambiarlo.`,
      });
    }

    const tipo = dto.tipo;
    const doc = tipo === 'SIMPLE' ? null : dto.doc?.trim() || null;
    const razon = tipo === 'FACTURA' ? dto.razon?.trim() || null : null;
    const direccion = tipo === 'FACTURA' ? dto.direccion?.trim() || null : null;

    // Sin total: la exigencia de DNI por más de S/ 700 la aplica el cobro, no el cambio de comprobante
    const validacion = validarDocumentoComprobante(tipo, doc, razon);
    if (!validacion.valido) {
      throw new BadRequestException({ codigo: 'COMPROBANTE_INVALIDO', mensaje: validacion.motivo });
    }

    // updateMany con la condición de no cobrado: si Caja cobra entre la lectura y la escritura, no se cambia
    const cambio = await this.prisma.pedido.updateMany({
      where: { id, pago_estado: { not: 'PAGADO' } },
      data: { comprobante_tipo: tipo, comprobante_doc: doc, comprobante_razon: razon, comprobante_direccion: direccion },
    });
    if (cambio.count === 0) {
      throw new ConflictException({
        codigo: 'PEDIDO_COBRADO',
        mensaje: 'El pedido ya está cobrado. Para corregir el comprobante, anúlalo y emite otro.',
      });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'CAMBIAR_COMPROBANTE',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: id,
      antes: {
        tipo: pedido.comprobante_tipo,
        documento: pedido.comprobante_doc ? enmascararDni(pedido.comprobante_doc) : null,
        razon: pedido.comprobante_razon ?? null,
        direccion: pedido.comprobante_direccion ?? null,
      },
      despues: {
        tipo,
        documento: doc ? enmascararDni(doc) : null,
        razon,
        direccion,
      },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    return {
      id: pedido.id.toString(),
      codigo: pedido.codigo,
      comprobante_tipo: tipo,
      comprobante_doc: doc,
      comprobante_razon: razon,
      comprobante_direccion: direccion,
    };
  }
}
