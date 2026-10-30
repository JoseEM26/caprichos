import { montoElegiblePuntos } from '../ofertas/puntos-elegibles.util';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { partyClienteDelPedido } from './cliente-del-pedido';

@Injectable()
export class PuntosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Obtiene el saldo actual de puntos de un cliente.
   * La fuente contable inmutable es movimiento_puntos, complementada por customer_detail.
   */
  async obtenerSaldo(partyId: bigint | string): Promise<number> {
    const id = BigInt(partyId);
    const detalle = await this.prisma.customerDetail.findFirst({
      where: {
        party_role: {
          party_id: id,
          rol: 'CLIENTE',
        },
      },
    });

    if (detalle) {
      return Number(detalle.puntos);
    }

    // Si no tiene customer_detail, calculamos desde movimiento_puntos
    const movimientos = await this.prisma.movimientoPuntos.findMany({
      where: { party_id: id },
    });

    let saldo = 0;
    for (const mov of movimientos) {
      const p = Number(mov.puntos);
      if (mov.tipo === 'SUMA' || mov.tipo === 'DEVOLUCION_CANJE') {
        saldo += p;
      } else if (mov.tipo === 'CANJE' || mov.tipo === 'REVERSA') {
        saldo -= p;
      }
    }
    return Math.max(0, Math.round(saldo * 100) / 100);
  }

  /** Productos sin descuento ni promoción de un pedido: la base que suma y que se puede canjear. */
  private async montoElegiblePedido(pId: bigint, descuentoDetalle: unknown): Promise<number> {
    const lineas = await this.prisma.pedidoLinea.findMany({
      where: { pedido_id: pId },
      include: { producto: { select: { no_suma_beneficios: true } } },
    });
    return montoElegiblePuntos(
      lineas.map((l) => ({
        productoId: l.producto_id ?? `linea-${l.id}`,
        subtotal: Number(l.subtotal ?? Number(l.precio_unit) * l.cantidad),
        noSumaBeneficios: l.producto?.no_suma_beneficios ?? true,
        enPromocion: l.oferta_id !== null || l.linea_combo_id !== null,
      })),
      (descuentoDetalle as any) ?? [],
    );
  }

  /**
   * Acumula el 5% (o porcentaje configurado) de lo pagado en productos sin descuento al cobrar un pedido. Los puntos no vencen.
   * Totalmente IDEMPOTENTE: si ya se sumó para este pedido, devuelve el registro existente sin duplicar.
   */
  async acumularPorPedido(pedidoId: bigint | string): Promise<{ puntos: number; sumados: boolean }> {
    const pId = BigInt(pedidoId);

    // 1. Verificar si ya existe movimiento SUMA para este pedido (Idempotencia)
    const movExistente = await this.prisma.movimientoPuntos.findFirst({
      where: {
        pedido_id: pId,
        tipo: 'SUMA',
      },
    });

    if (movExistente) {
      return { puntos: Number(movExistente.puntos), sumados: false };
    }

    // 2. Obtener el pedido con sus datos
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: `No se encontró el pedido ${pedidoId}`,
      });
    }

    // Cliente con cuenta del pedido; invitado (o pedido de mozo sin cliente identificado) no acumula (RQ-CLI-02-03)
    const partyCliente = partyClienteDelPedido(pedido);
    if (!partyCliente) {
      return { puntos: 0, sumados: false };
    }

    // Si usó cupón, no suma puntos (DT-56, RQ-CLI-02-02)
    if (pedido.cupon_id || pedido.cupon_emitido_id) {
      return { puntos: 0, sumados: false };
    }

    // Verificar si el cliente tiene cuenta o rol CLIENTE
    const rolCliente = await this.prisma.partyRole.findFirst({
      where: {
        party_id: partyCliente,
        rol: 'CLIENTE',
        hasta: null,
      },
      include: { customer_detail: true },
    });

    if (!rolCliente) {
      return { puntos: 0, sumados: false };
    }

    // 3. Obtener el porcentaje configurado (por defecto 5%)
    let porcentaje = 5;
    try {
      const param = await this.prisma.parametro.findUnique({
        where: { clave: 'puntos_porcentaje' },
      });
      if (param && param.valor !== null && param.valor !== undefined) {
        porcentaje = Number(param.valor);
      }
    } catch {
      porcentaje = 5;
    }

    // 4. Base: solo productos sin descuento ni promoción, sin envío ni lo pagado con puntos (DT-73, DT-65)
    const elegible = await this.montoElegiblePedido(pId, pedido.descuento_detalle);
    const montoCanje = Number(pedido.puntos_canjeados || 0);
    const baseCalculo = Math.max(0, elegible - montoCanje);

    const puntosCalculados = Math.round((baseCalculo * (porcentaje / 100)) * 100) / 100;
    if (puntosCalculados <= 0) {
      return { puntos: 0, sumados: false };
    }

    // 5. Transacción atómica: insertar movimiento y actualizar saldos
    await this.prisma.$transaction(async (tx) => {
      // Movimiento inmutable
      await tx.movimientoPuntos.create({
        data: {
          party_id: partyCliente,
          pedido_id: pId,
          tipo: 'SUMA',
          puntos: puntosCalculados,
          motivo: `Puntos por pedido ${pedido.codigo}`,
        },
      });

      // Actualizar saldo rápido en customer_detail
      if (rolCliente.customer_detail) {
        await tx.customerDetail.update({
          where: { party_role_id: rolCliente.id },
          data: {
            puntos: {
              increment: puntosCalculados,
            },
          },
        });
      } else {
        await tx.customerDetail.create({
          data: {
            party_role_id: rolCliente.id,
            puntos: puntosCalculados,
          },
        });
      }

      // Actualizar pedido
      await tx.pedido.update({
        where: { id: pId },
        data: { puntos_ganados: puntosCalculados },
      });
    });

    return { puntos: puntosCalculados, sumados: true };
  }

  /**
   * Revierte los puntos sumados al anular un pedido y devuelve los canjeados (RQ-CLI-02-04, RQ-CLI-02-12).
   * Totalmente IDEMPOTENTE.
   */
  async reversarPorPedido(pedidoId: bigint | string): Promise<{ puntosReversados: number; puntosDevueltos: number }> {
    const pId = BigInt(pedidoId);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
    });

    const partyCliente = pedido ? partyClienteDelPedido(pedido) : null;
    if (!pedido || !partyCliente) {
      return { puntosReversados: 0, puntosDevueltos: 0 };
    }

    const rolCliente = await this.prisma.partyRole.findFirst({
      where: {
        party_id: partyCliente,
        rol: 'CLIENTE',
        hasta: null,
      },
      include: { customer_detail: true },
    });

    let puntosReversados = 0;
    let puntosDevueltos = 0;

    await this.prisma.$transaction(async (tx) => {
      // 1. Revertir puntos ganados (si hubo SUMA y no hay ya REVERSA)
      const movSuma = await tx.movimientoPuntos.findFirst({
        where: { pedido_id: pId, tipo: 'SUMA' },
      });
      const movReversa = await tx.movimientoPuntos.findFirst({
        where: { pedido_id: pId, tipo: 'REVERSA' },
      });

      if (movSuma && !movReversa) {
        puntosReversados = Number(movSuma.puntos);
        await tx.movimientoPuntos.create({
          data: {
            party_id: partyCliente,
            pedido_id: pId,
            tipo: 'REVERSA',
            puntos: puntosReversados,
            motivo: `Reversa por anulación del pedido ${pedido.codigo}`,
          },
        });

        if (rolCliente?.customer_detail) {
          const nuevoSaldo = Math.max(0, Number(rolCliente.customer_detail.puntos) - puntosReversados);
          await tx.customerDetail.update({
            where: { party_role_id: rolCliente.id },
            data: { puntos: nuevoSaldo },
          });
        }
      }

      // 2. Restaurar puntos canjeados (si hubo CANJE y no hay ya DEVOLUCION_CANJE)
      const movCanje = await tx.movimientoPuntos.findFirst({
        where: { pedido_id: pId, tipo: 'CANJE' },
      });
      const movDevolucion = await tx.movimientoPuntos.findFirst({
        where: { pedido_id: pId, tipo: 'DEVOLUCION_CANJE' },
      });

      if (movCanje && !movDevolucion) {
        puntosDevueltos = Number(movCanje.puntos);
        await tx.movimientoPuntos.create({
          data: {
            party_id: partyCliente,
            pedido_id: pId,
            tipo: 'DEVOLUCION_CANJE',
            puntos: puntosDevueltos,
            motivo: `Devolución de puntos canjeados por anulación del pedido ${pedido.codigo}`,
          },
        });

        if (rolCliente?.customer_detail) {
          await tx.customerDetail.update({
            where: { party_role_id: rolCliente.id },
            data: {
              puntos: { increment: puntosDevueltos },
            },
          });
        }
      }

      await tx.pedido.update({
        where: { id: pId },
        data: {
          puntos_ganados: 0,
        },
      });
    });

    return { puntosReversados, puntosDevueltos };
  }

  /**
   * Canje de puntos: valida saldo y descuenta (RQ-CLI-02-11, RQ-CLI-02-12).
   */
  async canjear(
    partyId: bigint | string,
    puntosACanjear: number,
    pedidoId?: bigint | string,
  ): Promise<{ puntosCanjeados: number; saldoRestante: number }> {
    const id = BigInt(partyId);
    const puntos = Math.round(Number(puntosACanjear) * 100) / 100;

    if (puntos <= 0) {
      throw new BadRequestException({
        codigo: 'MONTO_INVALIDO',
        mensaje: 'La cantidad de puntos a canjear debe ser mayor a 0',
      });
    }

    const saldoActual = await this.obtenerSaldo(id);
    if (puntos > saldoActual) {
      throw new BadRequestException({
        codigo: 'PUNTOS_INSUFICIENTES',
        mensaje: `Solo tienes ${saldoActual.toFixed(2)} puntos`,
      });
    }

    const pId = pedidoId ? BigInt(pedidoId) : undefined;

    // Si viene pedidoId, validar que no exceda el monto de productos
    if (pId) {
      const pedido = await this.prisma.pedido.findUnique({
        where: { id: pId },
      });
      if (pedido) {
        const maxCanjeable = await this.montoElegiblePedido(pId, pedido.descuento_detalle);
        if (puntos > maxCanjeable) {
          throw new BadRequestException({
            codigo: 'TOPE_CANJE_EXCEDIDO',
            mensaje: `Los puntos solo se usan en productos sin descuento ni promoción (S/ ${maxCanjeable.toFixed(2)})`,
          });
        }
      }
    }

    const rolCliente = await this.prisma.partyRole.findFirst({
      where: {
        party_id: id,
        rol: 'CLIENTE',
        hasta: null,
      },
      include: { customer_detail: true },
    });

    if (!rolCliente) {
      throw new BadRequestException({
        codigo: 'CLIENTE_NO_ENCONTRADO',
        mensaje: 'El cliente no tiene rol activo para canjear puntos',
      });
    }

    let nuevoSaldo = 0;
    await this.prisma.$transaction(async (tx) => {
      await tx.movimientoPuntos.create({
        data: {
          party_id: id,
          pedido_id: pId,
          tipo: 'CANJE',
          puntos: puntos,
          motivo: pId ? `Canje de puntos en pedido #${pId}` : 'Canje de puntos en compra',
        },
      });

      const res = await tx.customerDetail.update({
        where: { party_role_id: rolCliente.id },
        data: {
          puntos: { decrement: puntos },
        },
      });
      nuevoSaldo = Number(res.puntos);

      if (pId) {
        await tx.pedido.update({
          where: { id: pId },
          data: { puntos_canjeados: puntos },
        });
      }
    });

    return { puntosCanjeados: puntos, saldoRestante: Math.max(0, nuevoSaldo) };
  }

  /**
   * Ajuste manual de puntos con motivo obligatorio y registro en auditoría (Admin).
   */
  async ajustarManual(
    partyId: bigint | string,
    datos: { puntos: number; tipo?: 'SUMA' | 'REVERSA' | 'CANJE'; motivo: string },
    usuarioId?: bigint | string,
    ip?: string,
  ): Promise<{ puntos: number; nuevoSaldo: number; motivo: string }> {
    const id = BigInt(partyId);
    const tipo = datos.tipo || (datos.puntos >= 0 ? 'SUMA' : 'REVERSA');
    const valorPuntos = Math.abs(Math.round(Number(datos.puntos) * 100) / 100);

    if (valorPuntos <= 0) {
      throw new BadRequestException({
        codigo: 'MONTO_INVALIDO',
        mensaje: 'Los puntos a ajustar deben ser distintos de 0',
      });
    }

    if (!datos.motivo || datos.motivo.trim().length < 4) {
      throw new BadRequestException({
        codigo: 'MOTIVO_REQUERIDO',
        mensaje: 'Escribe el motivo del ajuste de puntos (mínimo 4 caracteres)',
      });
    }

    const rolCliente = await this.prisma.partyRole.findFirst({
      where: { party_id: id, rol: 'CLIENTE', hasta: null },
      include: { customer_detail: true },
    });

    if (!rolCliente) {
      throw new NotFoundException({
        codigo: 'CLIENTE_NO_ENCONTRADO',
        mensaje: 'No se encontró el rol de cliente para esta persona',
      });
    }

    const saldoActual = Number(rolCliente.customer_detail?.puntos || 0);
    if ((tipo === 'REVERSA' || tipo === 'CANJE') && valorPuntos > saldoActual) {
      throw new BadRequestException({
        codigo: 'PUNTOS_INSUFICIENTES',
        mensaje: `No se puede restar ${valorPuntos} puntos porque el saldo actual es ${saldoActual}`,
      });
    }

    let nuevoSaldo = saldoActual;

    await this.prisma.$transaction(async (tx) => {
      await tx.movimientoPuntos.create({
        data: {
          party_id: id,
          tipo,
          puntos: valorPuntos,
          motivo: datos.motivo.trim(),
        },
      });

      if (tipo === 'SUMA') {
        const up = await tx.customerDetail.upsert({
          where: { party_role_id: rolCliente.id },
          create: { party_role_id: rolCliente.id, puntos: valorPuntos },
          update: { puntos: { increment: valorPuntos } },
        });
        nuevoSaldo = Number(up.puntos);
      } else {
        const up = await tx.customerDetail.update({
          where: { party_role_id: rolCliente.id },
          data: { puntos: { decrement: valorPuntos } },
        });
        nuevoSaldo = Number(up.puntos);
      }
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'puntos',
      accion: 'PUNTOS_AJUSTE_MANUAL',
      entidad: 'movimiento_puntos',
      entidadId: id,
      motivo: datos.motivo.trim(),
      despues: {
        tipo,
        puntos: valorPuntos,
        nuevoSaldo,
      },
      partyId: usuarioId ? BigInt(usuarioId) : undefined,
      ip,
    });

    return {
      puntos: valorPuntos,
      nuevoSaldo,
      motivo: datos.motivo.trim(),
    };
  }

  /**
   * Historial inmutable de movimientos de puntos de un cliente.
   */
  async listarMovimientos(partyId: bigint | string, pagina?: number, tamano = 10) {
    const id = BigInt(partyId);
    const paginar = pagina !== undefined;
    const movs = await this.prisma.movimientoPuntos.findMany({
      ...(paginar ? { skip: (Math.max(1, pagina!) - 1) * tamano, take: tamano + 1 } : {}),
      where: { party_id: id },
      include: {
        pedido: {
          select: {
            id: true,
            codigo: true,
            total: true,
            modalidad: true,
            creado_en: true,
          },
        },
      },
      orderBy: [{ en: 'desc' }, { id: 'desc' }],
    });

    return (paginar ? movs.slice(0, tamano) : movs).map((m) => ({
      id: m.id.toString(),
      tipo: m.tipo,
      puntos: Number(m.puntos),
      motivo: m.motivo,
      fecha: m.en.toISOString(),
      pedido: m.pedido
        ? {
            id: m.pedido.id.toString(),
            codigo: m.pedido.codigo,
            total: Number(m.pedido.total),
            modalidad: m.pedido.modalidad,
            fecha: m.pedido.creado_en.toISOString(),
          }
        : null,
    }));
  }

  /** Historial paginado (10 por página) de la cuenta del cliente, con el porcentaje vigente para «Cómo funcionan». */
  async movimientosCuenta(partyId: bigint, pagina: number) {
    const tamano = 10;
    const [movimientos, total, param] = await Promise.all([
      this.listarMovimientos(partyId, pagina, tamano),
      this.prisma.movimientoPuntos.count({ where: { party_id: partyId } }),
      this.prisma.parametro.findUnique({ where: { clave: 'puntos_porcentaje' } }).catch(() => null),
    ]);
    return {
      porcentaje: param && param.valor !== null && param.valor !== undefined ? Number(param.valor) : 5,
      movimientos,
      pagina,
      hayMas: total > pagina * tamano,
    };
  }
}
