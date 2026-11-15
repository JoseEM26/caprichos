import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ImpresionService } from '../impresion/impresion.service';
import { PagoPlanService, PlanPagoItem } from '../pedidos/pago-plan.service';
import { textoCargoParaNota, validarCargosLibres } from '../pedidos/cargo-libre';
import { ajustarPlanAlTotal } from './editar-pedido.service';
import { CargoLibrePedidoDto } from './dto/cargo-libre-pedido.dto';

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * «Servicio o producto» sobre un pedido que AÚN NO está cobrado: agrega la línea libre, sube subtotal y total,
 * ajusta el plan de pago, reimprime solo la etiqueta del producto vinculado y audita. Si el pedido ya está cobrado,
 * la pantalla usa «Agregar extra» (pedido enlazado con su propio cobro y comprobante).
 */
@Injectable()
export class CargoLibreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagoPlan: PagoPlanService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly impresion?: ImpresionService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async agregar(idRaw: string, dto: CargoLibrePedidoDto, usuario: UsuarioAutenticado, ip?: string) {
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }
    const id = BigInt(idRaw);
    const [cargo] = validarCargosLibres([{ descripcion: dto.descripcion, monto: dto.monto }], 0);
    const incluir = { lineas: { orderBy: { id: 'asc' as const } }, planPago: { orderBy: { orden: 'asc' as const } }, cobros: { where: { anulado_en: null }, select: { id: true }, take: 1 } };
    const pedido: any = await this.prisma.pedido.findUnique({ where: { id }, include: incluir });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    this.exigirNoCobrado(pedido);

    let destino: any = null;
    if (dto.paraLineaId != null && dto.paraLineaId !== '') {
      destino = pedido.lineas.find((l: any) => String(l.id) === String(dto.paraLineaId) && l.linea_combo_id == null && !l.cargo_libre && !l.es_cortesia);
      if (!destino) throw new BadRequestException({ codigo: 'CARGO_LIBRE_PRODUCTO', mensaje: 'El producto elegido no está en este pedido' });
    }

    const etiquetasAntes = destino ? ((await this.impresion?.capturarEtiquetas(id)) ?? new Map<string, string>()) : new Map<string, string>();
    const ahora = new Date();
    const r = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM pedido WHERE id = ${id} FOR UPDATE`;
      const vivo: any = await tx.pedido.findUnique({ where: { id }, include: incluir });
      this.exigirNoCobrado(vivo);

      await tx.pedidoLinea.create({
        data: {
          pedido_id: id,
          producto_id: null,
          nombre: cargo.descripcion,
          cantidad: 1,
          precio_unit: new Prisma.Decimal(cargo.monto),
          subtotal: new Prisma.Decimal(cargo.monto),
          nota: destino ? `Para: ${destino.nombre}` : null,
          cargo_libre: true,
          listas: 1,
          despachadas: 1,
          cargo_libre_por: BigInt(usuario.partyId),
          cargo_libre_en: ahora,
        },
      });
      if (destino) {
        await tx.pedidoLinea.update({
          where: { id: destino.id },
          data: { nota: [destino.nota, textoCargoParaNota(cargo.descripcion)].filter(Boolean).join(' · ') },
        });
      }

      const subtotal = redondear(Number(vivo.subtotal) + cargo.monto);
      const total = redondear(Number(vivo.total) + cargo.monto);
      const aCobrar = redondear(total + Number(vivo.propina ?? 0));
      const datos: Prisma.PedidoUncheckedUpdateInput = {};
      const planViejo: PlanPagoItem[] = (vivo.planPago ?? []).map((f: any) => ({ medio: f.medio, monto: Number(f.monto) }));
      let planNuevo: PlanPagoItem[] | null = null;
      if (planViejo.length > 0) {
        planNuevo = ajustarPlanAlTotal(planViejo, aCobrar);
        await tx.pedidoPagoPlan.deleteMany({ where: { pedido_id: id } });
        if (planNuevo.length > 0) {
          await this.pagoPlan.guardar(tx, id, planNuevo);
          datos.pago_metodo = this.pagoPlan.pagoPrincipal(planNuevo);
          datos.pago_preferido = this.pagoPlan.pagoPrincipal(planNuevo);
        }
      }
      const efectivo = planNuevo ? this.pagoPlan.montoEfectivo(planNuevo) : vivo.pago_metodo === 'EFECTIVO' ? aCobrar : 0;
      if (vivo.paga_con != null && (efectivo <= 0 || Number(vivo.paga_con) < efectivo)) datos.paga_con = null;

      const actualizado = await tx.pedido.update({
        where: { id },
        data: { ...datos, subtotal: new Prisma.Decimal(subtotal), total: new Prisma.Decimal(total), version: { increment: 1 } },
      });
      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'pedidos',
          accion: 'CARGO_LIBRE',
          resultado: 'OK',
          entidad: 'pedido',
          entidadId: id,
          antes: { total: Number(vivo.total), plan: planViejo },
          despues: { descripcion: cargo.descripcion, monto: cargo.monto, paraProducto: destino?.nombre ?? null, total, plan: planNuevo, version: actualizado.version },
          partyId: usuario.partyId,
          ip,
        },
        tx,
      );
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: id,
          estado_anterior: vivo.estado,
          estado_nuevo: vivo.estado,
          motivo: `Servicio o producto libre: ${cargo.descripcion} · S/ ${cargo.monto.toFixed(2)}`.slice(0, 480),
          por_party_id: BigInt(usuario.partyId),
        },
      });
      return { version: actualizado.version, total, totalAnterior: Number(vivo.total) };
    });

    if (destino) await this.impresion?.encolarEtiquetasEditadas(id, etiquetasAntes);
    try {
      this.eventos?.emitirAdmin('pedido:editado', { id: String(id), codigo: pedido.codigo, estado: pedido.estado, version: r.version, por: String(usuario.partyId) });
    } catch {
      // sin websocket en pruebas
    }
    return { id: String(id), codigo: pedido.codigo, version: r.version, total: r.total, totalAnterior: r.totalAnterior, descripcion: cargo.descripcion, monto: cargo.monto, mensaje: 'Servicio o producto agregado' };
  }

  private exigirNoCobrado(p: any) {
    if (['ANULADO', 'RECHAZADO'].includes(p.estado)) {
      throw new ConflictException({ codigo: 'PEDIDO_NO_ADMITE_CARGO', mensaje: 'Un pedido anulado no admite un servicio o producto.' });
    }
    if (p.pago_estado === 'PAGADO' || (p.cobros?.length ?? 0) > 0 || p.cobro_mozo_en) {
      throw new ConflictException({ codigo: 'PEDIDO_COBRADO', mensaje: 'Este pedido ya está cobrado: el servicio o producto va en un pedido extra.' });
    }
    if (Number(p.monto_credito ?? 0) > 0) {
      throw new ConflictException({ codigo: 'PEDIDO_CON_CREDITO', mensaje: 'Este pedido se cargó al crédito del personal: el servicio o producto va en un pedido extra.' });
    }
  }
}
