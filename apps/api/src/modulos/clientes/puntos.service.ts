import { montoElegiblePuntos } from '../ofertas/puntos-elegibles.util';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { partyClienteDelPedido } from './cliente-del-pedido';
import { PartyPuntosService } from './party-puntos.service';

export interface OpcionesAcumular {
  /** true = calcula sin escribir nada (simulacro de la reconstrucción) */
  simular?: boolean;
  /** Texto del movimiento (por defecto «Puntos por pedido CÓDIGO») */
  motivo?: string;
}

export interface ResultadoAcumular {
  puntos: number;
  sumados: boolean;
  /** Por qué no sumó */
  motivoNo?: 'YA_SUMADO' | 'SIN_CELULAR' | 'CUPON' | 'PERSONAL' | 'SIN_CUENTA_CLIENTE' | 'SIN_PUNTOS';
  partyId?: bigint | null;
  /** simulacro: el celular todavía no tiene party y se crearía al aplicar */
  partyNuevo?: boolean;
}

@Injectable()
export class PuntosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly puntosParty?: PartyPuntosService,
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
  private async montoElegiblePedido(pId: bigint, descuentoDetalle: unknown, db: Pick<Prisma.TransactionClient, 'pedidoLinea'> = this.prisma): Promise<number> {
    const lineas = await db.pedidoLinea.findMany({
      where: { pedido_id: pId },
      include: { producto: { select: { no_suma_beneficios: true } } },
    });
    return montoElegiblePuntos(
      lineas.map((l) => ({
        productoId: l.producto_id ?? `linea-${l.id}`,
        subtotal: Number(l.subtotal ?? Number(l.precio_unit) * l.cantidad),
        // Una cortesía no suma puntos ni se canjea
        noSumaBeneficios: (l.producto?.no_suma_beneficios ?? true) || l.es_cortesia,
        enPromocion: l.oferta_id !== null || l.linea_combo_id !== null,
      })),
      (descuentoDetalle as any) ?? [],
    );
  }

  /**
   * Acumula el 5% (o porcentaje configurado) de lo pagado en productos sin descuento al cobrar un pedido. Los puntos no vencen.
   * Totalmente IDEMPOTENTE: si ya se sumó para este pedido, devuelve el registro existente sin duplicar.
   */
  async acumularPorPedido(pedidoId: bigint | string, opts: OpcionesAcumular = {}): Promise<ResultadoAcumular> {
    const pId = BigInt(pedidoId);
    const simular = opts.simular === true;

    // 1. Idempotencia por cobro vigente: el último SUMA del pedido manda. Si sigue sin REVERSA, ya está sumado;
    // si fue reversado (se anuló el cobro), un cobro nuevo abre el ciclo siguiente (la BD tiene único (pedido_id, tipo, ciclo)).
    const ultimaSuma = await this.prisma.movimientoPuntos.findFirst({
      where: { pedido_id: pId, tipo: 'SUMA' },
      orderBy: { ciclo: 'desc' },
    });
    let ciclo = 1;
    if (ultimaSuma) {
      const reversa = await this.prisma.movimientoPuntos.findFirst({
        where: { pedido_id: pId, tipo: 'REVERSA', ciclo: ultimaSuma.ciclo },
        select: { id: true },
      });
      if (!reversa) return { puntos: Number(ultimaSuma.puntos), sumados: false, motivoNo: 'YA_SUMADO' };
      ciclo = ultimaSuma.ciclo + 1;
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

    // Re-cobro: solo suma si el pedido sigue vivo y pagado (un pedido anulado o reprogramado no vuelve a sumar)
    if (ciclo > 1 && (pedido.pago_estado !== 'PAGADO' || ['ANULADO', 'RECHAZADO'].includes(String(pedido.estado)))) {
      return { puntos: 0, sumados: false, motivoNo: 'YA_SUMADO' };
    }

    // Cliente del pedido; si no quedó ligado (pedido sin cuenta, de otro canal o anterior a «puntos por celular»),
    // el celular válido del pedido manda: se reutiliza o se crea su party de puntos.
    let partyCliente = partyClienteDelPedido(pedido);
    let ligadoPorCelular = false;
    let partyNuevo = false;
    if (!partyCliente) {
      if (!this.puntosParty || !pedido.cliente_telefono) return { puntos: 0, sumados: false, motivoNo: 'SIN_CELULAR' };
      if (simular) {
        const c = await this.puntosParty.consultar(pedido.cliente_telefono);
        if (!c.valido) return { puntos: 0, sumados: false, motivoNo: 'SIN_CELULAR' };
        partyCliente = c.partyId;
        partyNuevo = c.partyId === null;
      } else {
        partyCliente = await this.puntosParty.resolverOCrear(pedido.cliente_telefono);
        if (!partyCliente) return { puntos: 0, sumados: false, motivoNo: 'SIN_CELULAR' };
      }
      ligadoPorCelular = true;
    }

    // Si usó cupón, no suma puntos (DT-56, RQ-CLI-02-02)
    if (pedido.cupon_id || pedido.cupon_emitido_id) {
      return { puntos: 0, sumados: false, motivoNo: 'CUPON', partyId: partyCliente };
    }

    // Con el descuento del equipo (detalle tipo PERSONAL) el pedido cuenta como descuento: no suma puntos
    if (Array.isArray(pedido.descuento_detalle) && (pedido.descuento_detalle as any[]).some((d) => d?.tipo === 'PERSONAL')) {
      return { puntos: 0, sumados: false, motivoNo: 'PERSONAL', partyId: partyCliente };
    }

    // Rol CLIENTE vigente. Quien nunca fue cliente lo recibe (cuenta sin verificar); a quien se le dio de baja, no.
    let rolCliente = partyCliente ? await this.rolClienteVigente(partyCliente) : null;
    if (partyCliente && !rolCliente) {
      const baja = await this.prisma.partyRole.findFirst({ where: { party_id: partyCliente, rol: 'CLIENTE' }, select: { id: true } });
      if (baja || !this.puntosParty) {
        return { puntos: 0, sumados: false, motivoNo: 'SIN_CUENTA_CLIENTE', partyId: partyCliente };
      }
      if (!simular) {
        await this.puntosParty.asegurarRolCliente(partyCliente);
        rolCliente = await this.rolClienteVigente(partyCliente);
      }
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
      return { puntos: 0, sumados: false, motivoNo: 'SIN_PUNTOS', partyId: partyCliente };
    }
    if (simular) return { puntos: puntosCalculados, sumados: false, partyId: partyCliente, partyNuevo };

    // 5. Transacción atómica: insertar movimiento y actualizar saldos
    try {
    await this.prisma.$transaction(async (tx) => {
      // Movimiento inmutable
      await tx.movimientoPuntos.create({
        data: {
          party_id: partyCliente!,
          pedido_id: pId,
          tipo: 'SUMA',
          ciclo,
          puntos: puntosCalculados,
          motivo: opts.motivo ?? `Puntos por pedido ${pedido.codigo}`,
        },
      });

      // Actualizar saldo rápido en customer_detail
      if (rolCliente!.customer_detail) {
        await tx.customerDetail.update({
          where: { party_role_id: rolCliente!.id },
          data: {
            puntos: {
              increment: puntosCalculados,
            },
          },
        });
      } else {
        await tx.customerDetail.create({
          data: {
            party_role_id: rolCliente!.id,
            puntos: puntosCalculados,
          },
        });
      }

      // Actualizar pedido (y ligarlo al cliente del celular para que se pueda reversar y verlo en su historial)
      await tx.pedido.update({
        where: { id: pId },
        data: { puntos_ganados: puntosCalculados, ...(ligadoPorCelular && !pedido.cliente_party_id ? { cliente_party_id: partyCliente } : {}) },
      });
    });
    } catch (err: any) {
      // Carrera con otro cobro del mismo pedido: el único (pedido_id, tipo) ya lo sumó
      if (err?.code === 'P2002') return { puntos: 0, sumados: false, motivoNo: 'YA_SUMADO', partyId: partyCliente };
      throw err;
    }

    return { puntos: puntosCalculados, sumados: true, partyId: partyCliente };
  }

  private rolClienteVigente(partyId: bigint) {
    return this.prisma.partyRole.findFirst({
      where: { party_id: partyId, rol: 'CLIENTE', hasta: null },
      include: { customer_detail: true },
    });
  }

  /**
   * Revierte los puntos sumados al anular un pedido y devuelve los canjeados (RQ-CLI-02-04, RQ-CLI-02-12).
   * Totalmente IDEMPOTENTE.
   */
  async reversarPorPedido(
    pedidoId: bigint | string,
    opts: { conservarCanje?: boolean } = {},
  ): Promise<{ puntosReversados: number; puntosDevueltos: number }> {
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
        orderBy: { ciclo: 'desc' },
      });
      const movReversa = await tx.movimientoPuntos.findFirst({
        where: { pedido_id: pId, tipo: 'REVERSA', ciclo: movSuma?.ciclo ?? 1 },
      });

      if (movSuma && !movReversa) {
        puntosReversados = Number(movSuma.puntos);
        await tx.movimientoPuntos.create({
          data: {
            party_id: partyCliente,
            pedido_id: pId,
            tipo: 'REVERSA',
            ciclo: movSuma.ciclo,
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

      // conservarCanje: se anuló solo el COBRO (el pedido sigue vivo y con su descuento): los puntos canjeados no se devuelven
      if (movCanje && !movDevolucion && !opts.conservarCanje) {
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
    tx?: Prisma.TransactionClient,
  ): Promise<{ puntosCanjeados: number; saldoRestante: number }> {
    // Con `tx` (la transacción del pedido) todo ocurre dentro de ella: un fallo revierte también el pedido y su stock.
    const db = tx ?? this.prisma;
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
      const pedido = await db.pedido.findUnique({
        where: { id: pId },
      });
      if (pedido) {
        const maxCanjeable = await this.montoElegiblePedido(pId, pedido.descuento_detalle, db);
        if (puntos > maxCanjeable) {
          throw new BadRequestException({
            codigo: 'TOPE_CANJE_EXCEDIDO',
            mensaje: `Los puntos solo se usan en productos sin descuento ni promoción (S/ ${maxCanjeable.toFixed(2)})`,
          });
        }
      }
    }

    const rolCliente = await db.partyRole.findFirst({
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
    const aplicar = async (tx: Prisma.TransactionClient) => {
      await tx.movimientoPuntos.create({
        data: {
          party_id: id,
          pedido_id: pId,
          tipo: 'CANJE',
          puntos: puntos,
          motivo: pId ? `Canje de puntos en pedido #${pId}` : 'Canje de puntos en compra',
        },
      });

      // Descuento condicionado al saldo (where con puntos >= canje): dos canjes simultáneos no dejan el saldo en negativo
      let res;
      try {
        res = await tx.customerDetail.update({
          where: { party_role_id: rolCliente.id, puntos: { gte: puntos } },
          data: { puntos: { decrement: puntos } },
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new BadRequestException({ codigo: 'PUNTOS_INSUFICIENTES', mensaje: 'Tu saldo de puntos cambió; revisa cuántos puntos tienes' });
        }
        throw err;
      }
      nuevoSaldo = Number(res.puntos);

      if (pId) {
        await tx.pedido.update({
          where: { id: pId },
          data: { puntos_canjeados: puntos },
        });
      }
    };
    if (tx) await aplicar(tx);
    else await this.prisma.$transaction(aplicar);

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

    let saldoAntes = 0;
    let nuevoSaldo = 0;

    await this.prisma.$transaction(async (tx) => {
      // La lista de clientes trae también a los desactivados (rol con `hasta`) y a quien aún no tiene rol/detalle:
      // se usa el rol CLIENTE más reciente (activo primero) y, si falta, se crea aquí mismo.
      const party = await tx.party.findUnique({ where: { id }, select: { id: true } });
      if (!party) {
        throw new NotFoundException({ codigo: 'CLIENTE_NO_ENCONTRADO', mensaje: 'No se encontró al cliente' });
      }
      let rol = await tx.partyRole.findFirst({
        where: { party_id: id, rol: 'CLIENTE' },
        orderBy: [{ hasta: { sort: 'asc', nulls: 'first' } }, { id: 'desc' }],
      });
      if (!rol) rol = await tx.partyRole.create({ data: { party_id: id, rol: 'CLIENTE' } });
      const detalle = await tx.customerDetail.upsert({
        where: { party_role_id: rol.id },
        create: { party_role_id: rol.id, puntos: 0 },
        update: {},
      });
      saldoAntes = Number(detalle.puntos || 0);
      if ((tipo === 'REVERSA' || tipo === 'CANJE') && valorPuntos > saldoAntes) {
        throw new BadRequestException({
          codigo: 'PUNTOS_INSUFICIENTES',
          mensaje: `No se puede restar ${valorPuntos} puntos porque el saldo actual es ${saldoAntes}`,
        });
      }
      await tx.movimientoPuntos.create({
        data: { party_id: id, tipo, puntos: valorPuntos, motivo: datos.motivo.trim() },
      });
      const up = await tx.customerDetail.update({
        where: { party_role_id: rol.id },
        data: { puntos: tipo === 'SUMA' ? { increment: valorPuntos } : { decrement: valorPuntos } },
      });
      nuevoSaldo = Number(up.puntos);
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'puntos',
      accion: 'PUNTOS_AJUSTE_MANUAL',
      entidad: 'movimiento_puntos',
      entidadId: id,
      motivo: datos.motivo.trim(),
      antes: { saldo: saldoAntes },
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
