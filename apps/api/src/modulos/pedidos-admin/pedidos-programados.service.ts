import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ImpresionService } from '../impresion/impresion.service';
import { AdelantoEntrada, anularAdelantoTx, registrarAdelantoTx } from '../pedidos/adelanto.util';
import { leerConfigProgramados } from '../pedidos/programado.util';

/** Pedidos programados: paso automático a cocina o a la cola de reparto, y adelantos. */
@Injectable()
export class PedidosProgramadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly impresion?: ImpresionService,
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
