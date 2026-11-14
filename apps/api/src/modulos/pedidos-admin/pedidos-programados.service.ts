import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ImpresionService } from '../impresion/impresion.service';
import { AdelantoEntrada, anularAdelantoTx, registrarAdelantoTx } from '../pedidos/adelanto.util';
import { leerConfigProgramados, validarProgramadoPara } from '../pedidos/programado.util';
import { OrigenPedido, PedidosService } from '../pedidos/pedidos.service';
import { CrearPedidoDto } from '../pedidos/dto/crear-pedido.dto';
import { ReservasService } from '../reservas/reservas.service';

/** Pedidos programados: paso automático a cocina o a la cola de reparto, y adelantos. */
@Injectable()
export class PedidosProgramadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly impresion?: ImpresionService,
    @Optional() private readonly pedidos?: PedidosService,
    @Optional() private readonly reservas?: ReservasService,
  ) {}

  /**
   * Pasa a COLA los PROGRAMADO cuya hora pactada menos el aviso ya llegó. Idempotente: el cambio es condicional
   * al estado PROGRAMADO, así que dos instancias o dos ciclos no lo pasan dos veces. Devuelve los códigos pasados.
   */
  async pasarACola(ahora: Date = new Date()): Promise<string[]> {
    const { avisoMin } = await leerConfigProgramados(this.prisma);
    const limite = new Date(ahora.getTime() + avisoMin * 60_000);
    const debidos = await this.prisma.pedido.findMany({
      where: { estado: 'PROGRAMADO', programado_para: { lte: limite } },
      select: { id: true, codigo: true },
      orderBy: { programado_para: 'asc' },
    });
    const pasados: string[] = [];
    for (const p of debidos) {
      const pasoOk = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.pedido.updateMany({
          where: { id: p.id, estado: 'PROGRAMADO' },
          data: { estado: 'COLA', pasa_cocina_en: ahora },
        });
        if (count !== 1) return false;
        await tx.pedidoEstadoHistorial.create({
          data: { pedido_id: p.id, estado_anterior: 'PROGRAMADO', estado_nuevo: 'COLA', motivo: 'Pedido programado: llegó su hora de aviso' },
        });
        return true;
      });
      if (!pasoOk) continue;
      pasados.push(p.codigo);
      // Efectos accesorios: no deshacen el paso (cocina sincroniza sus comandas al listar)
      try {
        await this.impresion?.encolarEtiquetasPedido(String(p.id));
      } catch {
        // la impresión se puede repetir desde Caja
      }
      this.eventos?.emitirAdmin('pedido:estado', { id: Number(p.id), codigo: p.codigo, estado: 'COLA' });
      this.eventos?.emitirAdmin('pedido:nuevo', { id: p.id.toString(), codigo: p.codigo, estado: 'COLA' });
    }
    return pasados;
  }

  /**
   * Crea un pedido programado. Si es de MESA, crea primero la RESERVA de mesa (aparece en Reservas y en el plano a su hora y
   * aparta la mesa) y la deja enlazada al pedido (reserva.pedido_id); si el pedido falla, la reserva se cancela.
   * La reserva se sienta con el flujo de siempre cuando el cliente llega; al pasar a cola el pedido ya lleva su mesa.
   */
  async crearProgramado(dto: CrearPedidoDto, clave: string, origen: OrigenPedido, usuario: any, ip?: string) {
    if (dto.modalidad !== 'MESA') return this.pedidos!.crear(dto, clave, origen);
    if (!dto.reserva) {
      throw new BadRequestException({ codigo: 'RESERVA_REQUERIDA', mensaje: 'Un pedido de mesa programado necesita mesa y número de personas' });
    }
    const telefono = dto.cliente?.telefono?.trim() || dto.clienteTelefono;
    if (!telefono) {
      throw new BadRequestException({ codigo: 'TELEFONO_REQUERIDO', mensaje: 'La reserva de mesa necesita el celular del cliente' });
    }
    // Un reintento con la misma clave no vuelve a reservar
    const existente = await this.prisma.pedido.findUnique({ where: { clave_idempotencia: clave.trim() }, select: { id: true } });
    if (existente) return this.pedidos!.crear(dto, clave, origen);
    const cfg = await leerConfigProgramados(this.prisma);
    const fecha = validarProgramadoPara(origen.programadoPara, new Date(), cfg.diasMax);
    const reserva = await this.reservas!.crear(
      { nombre: dto.cliente?.nombre?.trim() || 'Cliente', telefono, personas: dto.reserva.personas, hora: fecha.toISOString(), mesas: dto.reserva.mesas, confirmarCapacidad: dto.reserva.confirmarCapacidad },
      usuario,
      ip,
    );
    const mesaNombre = reserva.mesas.map((m: any) => m.nombre || (m.numero != null ? `Mesa ${m.numero}` : 'Mesa')).join(' + ');
    let res: any;
    try {
      res = await this.pedidos!.crear(dto, clave, { ...origen, mesaNombre });
    } catch (e) {
      await this.reservas!.cancelar(reserva.id, { motivo: 'El pedido programado no se pudo crear' } as any, usuario, ip).catch(() => undefined);
      throw e;
    }
    await this.prisma.reserva.update({ where: { id: BigInt(reserva.id) }, data: { pedido_id: BigInt(res.id) } });
    return { ...res, reservaId: reserva.id };
  }

  /** Cambia la fecha y hora de un programado (alternativa a devolver el adelanto). Con reserva de mesa, mueve también la reserva. */
  async reprogramar(pedidoId: string, programadoPara: string, usuario: any, ip?: string) {
    const id = this.parsearId(pedidoId);
    const pedido = await this.prisma.pedido.findUnique({ where: { id }, select: { id: true, estado: true, codigo: true, programado_para: true } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (pedido.estado !== 'PROGRAMADO') {
      throw new ConflictException({ codigo: 'REPROGRAMAR_SOLO_PROGRAMADO', mensaje: 'Solo se reprograma un pedido que sigue programado' });
    }
    const cfg = await leerConfigProgramados(this.prisma);
    const nueva = validarProgramadoPara(programadoPara, new Date(), cfg.diasMax);
    const reserva = await this.prisma.reserva.findFirst({ where: { pedido_id: id, estado: 'ACTIVA' }, select: { id: true } });
    if (reserva) await this.reservas!.actualizar(reserva.id, { hora: nueva.toISOString() } as any, usuario, ip);
    await this.prisma.pedido.update({ where: { id }, data: { programado_para: nueva } });
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'pedidos', accion: 'REPROGRAMAR_PEDIDO', resultado: 'OK', entidad: 'pedido', entidadId: id,
      antes: { programadoPara: pedido.programado_para }, despues: { programadoPara: nueva }, partyId: BigInt(usuario.partyId), ip,
    });
    return { id: id.toString(), programadoPara: nueva.toISOString() };
  }

  /** Adelanto sobre un pedido ya programado (el de la creación va dentro de la transacción del pedido). */
  async agregarAdelanto(pedidoId: string, entrada: AdelantoEntrada, usuario: { partyId: bigint | string }, ip?: string) {
    const id = this.parsearId(pedidoId);
    const adelanto = await this.prisma.$transaction((tx) => registrarAdelantoTx(tx, id, entrada, BigInt(usuario.partyId)));
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'caja', accion: 'ADELANTO_PEDIDO', resultado: 'OK', entidad: 'pedido', entidadId: id,
      despues: { medio: adelanto.medio, monto: Number(adelanto.monto), caja: adelanto.caja_id.toString() },
      partyId: BigInt(usuario.partyId), ip,
    });
    const p = await this.prisma.pedido.findUnique({ where: { id }, select: { adelanto_total: true, total: true } });
    return { adelantoId: adelanto.id.toString(), adelantoTotal: Number(p?.adelanto_total ?? 0), saldo: Number(p?.total ?? 0) - Number(p?.adelanto_total ?? 0) };
  }

  async anularAdelanto(adelantoId: string, motivo: string, usuario: { partyId: bigint | string }, ip?: string) {
    const m = (motivo ?? '').trim();
    if (m.length < 5) throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'El motivo debe tener al menos 5 caracteres' });
    const id = this.parsearId(adelantoId);
    const previo = await this.prisma.$transaction((tx) => anularAdelantoTx(tx, id, m, BigInt(usuario.partyId)));
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'caja', accion: 'ADELANTO_ANULADO', resultado: 'OK', entidad: 'pedido', entidadId: previo.pedido_id,
      antes: { medio: previo.medio, monto: Number(previo.monto) }, motivo: m, partyId: BigInt(usuario.partyId), ip,
    });
    return { ok: true };
  }

  /** Lista de «Programados»: de la hora más próxima a la más lejana, con lo adelantado y el saldo. */
  async listarProgramados() {
    const pedidos = await this.prisma.pedido.findMany({
      where: { estado: 'PROGRAMADO' },
      orderBy: { programado_para: 'asc' },
      select: { id: true, codigo: true, canal: true, modalidad: true, cliente_nombre: true, mesa_nombre: true, total: true, adelanto_total: true, programado_para: true, pago_estado: true },
    });
    return pedidos.map((p) => ({
      id: p.id.toString(), codigo: p.codigo, canal: p.canal, modalidad: p.modalidad, clienteNombre: p.cliente_nombre?.trim() || null,
      total: Number(p.total), adelanto: Number(p.adelanto_total), saldo: Number(p.total) - Number(p.adelanto_total),
      programadoPara: p.programado_para, pagoEstado: p.pago_estado,
    }));
  }

  private parsearId(valor: string): bigint {
    if (!/^\d+$/.test(String(valor))) throw new NotFoundException({ codigo: 'NO_ENCONTRADO', mensaje: 'Registro no encontrado' });
    return BigInt(valor);
  }
}
