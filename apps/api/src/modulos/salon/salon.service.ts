import { obtenerRangoHoyLima } from '../plano/plano.util';
import { ReservasService } from '../reservas/reservas.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { AbrirPedidoMesaDto } from './dto/abrir-pedido-mesa.dto';
import { LiberarMesaDto } from './dto/liberar-mesa.dto';
import { CrearPedidoDto } from '../pedidos/dto/crear-pedido.dto';

@Injectable()
export class SalonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidosService: PedidosService,
    private readonly auditoria: AuditoriaService,
    private readonly eventosGateway: EventosGateway,
    @Optional() private readonly reservasService?: ReservasService,
  ) {}

  /**
   * 1) GET /admin/salon/mesas (mesas/ver):
   * Lista todas las mesas activas por piso (solo pisos activos) con su estado derivado
   * LIBRE u OCUPADA (pedido_mesa abierta, código del pedido y mozo que lo abrió)
   * y la marca de reserva si hay una ACTIVA hoy (hora, nombre, personas).
   */
  async obtenerMesas() {
    const { inicio: inicioDia, fin: finDia } = obtenerRangoHoyLima();

    const pisos = await this.prisma.piso.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' },
      include: {
        elementos: {
          where: { tipo: 'MESA', activo: true },
          orderBy: [{ numero: 'asc' }, { id: 'asc' }],
          include: {
            pedidosMesa: {
              where: { abierta: true },
              include: {
                pedido: {
                  include: {
                    party: {
                      include: {
                        persona: true,
                      },
                    },
                    historial: {
                      where: { estado_anterior: null },
                      take: 1,
                    },
                  },
                },
              },
            },
            reservasMesa: {
              include: {
                reserva: true,
              },
            },
          },
        },
      },
    });

    // Mapear pisos y mesas con su estado derivado
    const pisosFormateados = await Promise.all(
      pisos.map(async (piso) => {
        const mesasFormateadas = await Promise.all(
          piso.elementos.map(async (elem) => {
            const pedidoMesaAbierto = elem.pedidosMesa[0];
            let estado: 'LIBRE' | 'OCUPADA' = 'LIBRE';
            let pedidoInfo: {
              id: string;
              codigo: string;
              mozo: string | null;
            } | null = null;
            let pedidoCodigo: string | null = null;
            let mozoNombre: string | null = null;

            if (pedidoMesaAbierto?.pedido) {
              estado = 'OCUPADA';
              const ped = pedidoMesaAbierto.pedido;
              pedidoCodigo = ped.codigo;

              // Obtener nombre del mozo
              if (ped.party?.persona) {
                mozoNombre = `${ped.party.persona.nombres} ${ped.party.persona.apellidos || ''}`.trim();
              } else if (ped.historial?.[0]?.por_party_id) {
                const persona = await this.prisma.person.findUnique({
                  where: { party_id: ped.historial[0].por_party_id },
                });
                if (persona) {
                  mozoNombre = `${persona.nombres} ${persona.apellidos || ''}`.trim();
                }
              }

              pedidoInfo = {
                id: ped.id.toString(),
                codigo: ped.codigo,
                mozo: mozoNombre || null,
              };
            }

            // Buscar reserva activa de hoy
            const reservaHoy = elem.reservasMesa.find(
              (rm) =>
                rm.reserva &&
                rm.reserva.estado === 'ACTIVA' &&
                new Date(rm.reserva.hora) >= inicioDia &&
                new Date(rm.reserva.hora) <= finDia,
            )?.reserva;

            const reservaInfo = reservaHoy
              ? {
                  id: reservaHoy.id.toString(),
                  hora: reservaHoy.hora,
                  nombre: reservaHoy.nombre,
                  personas: reservaHoy.personas,
                }
              : null;

            return {
              id: elem.id.toString(),
              pisoId: elem.piso_id.toString(),
              tipo: elem.tipo,
              numero: elem.numero,
              nombre: elem.nombre || (elem.numero ? `Mesa ${elem.numero}` : null),
              asientos: elem.asientos,
              x: elem.x,
              y: elem.y,
              ancho: elem.ancho,
              alto: elem.alto,
              activo: elem.activo,
              estado,
              pedido: pedidoInfo,
              pedidoCodigo,
              mozo: mozoNombre,
              reserva: reservaInfo,
            };
          }),
        );

        return {
          id: piso.id.toString(),
          nombre: piso.nombre,
          activo: piso.activo,
          cuadricula_ancho: piso.cuadricula_ancho,
          cuadricula_alto: piso.cuadricula_alto,
          mesas: mesasFormateadas,
        };
      }),
    );

    return {
      pisos: pisosFormateados,
    };
  }

  /**
   * 2) POST /admin/salon/pedidos (mesas/abrir)
   * Abre un pedido de modalidad MESA en una o varias mesas usando PedidosService.crear con origen MOZO.
   * Crea pedido_mesa en la misma transacción y maneja concurrencia (409 MESA_OCUPADA).
   */
  async abrirPedido(
    dto: AbrirPedidoMesaDto,
    usuario?: UsuarioAutenticado,
    idempotencyKeyHeader?: string,
  ) {
    if (!dto.mesas || dto.mesas.length === 0) {
      throw new BadRequestException({
        codigo: 'MESAS_REQUERIDAS',
        mensaje: 'Debe especificar al menos una mesa para abrir el pedido',
      });
    }

    const mesasIds = dto.mesas.map((m) => BigInt(m));

    // Validar existencia y estado de las mesas
    const mesasDb = await this.prisma.elementoPlano.findMany({
      where: { id: { in: mesasIds }, tipo: 'MESA' },
    });

    if (mesasDb.length !== mesasIds.length) {
      throw new NotFoundException({
        codigo: 'MESA_NO_ENCONTRADA',
        mensaje: 'Una o más mesas especificadas no existen o no son mesas',
      });
    }

    const mesaInactiva = mesasDb.find((m) => !m.activo);
    if (mesaInactiva) {
      throw new BadRequestException({
        codigo: 'MESA_INACTIVA',
        mensaje: `La mesa ${mesaInactiva.numero ?? mesaInactiva.nombre ?? mesaInactiva.id} no está activa`,
      });
    }

    // Verificar si alguna ya está ocupada (fail-fast antes de entrar a la transacción)
    const mesasOcupadas = await this.prisma.pedidoMesa.findMany({
      where: { mesa_id: { in: mesasIds }, abierta: true },
      include: { mesa: true },
    });

    if (mesasOcupadas.length > 0) {
      const primeraOcupada = mesasOcupadas[0];
      const num = primeraOcupada.mesa?.numero ?? primeraOcupada.mesa_nombre ?? primeraOcupada.mesa_id?.toString();
      throw new ConflictException({
        codigo: 'MESA_OCUPADA',
        mensaje: `La mesa ${num} ya está ocupada`,
      });
    }

    const mesaNombre = mesasDb
      .map((m) => (m.numero ? `Mesa ${m.numero}` : m.nombre || `Mesa ${m.id}`))
      .join(', ');

    const pedidoDto: CrearPedidoDto = {
      modalidad: 'MESA',
      cliente: dto.cliente || {
        nombre: mesaNombre,
        telefono: '999999999',
      },
      lineas: dto.lineas,
      pago: dto.pago || { metodo: 'EFECTIVO' },
      comprobante: dto.comprobante,
      nota: dto.nota,
      mesa: mesaNombre,
    };

    const idempotencyKey =
      idempotencyKeyHeader ||
      `mozo-${usuario?.partyId ?? 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    let resultadoPedido: any;

    try {
      resultadoPedido = await this.pedidosService.crear(pedidoDto, idempotencyKey, {
        canal: 'MOZO',
        usuarioPartyId: usuario?.partyId,
        mesasIds,
        mesaNombre,
        omitirChequeoCarta: true,
        enTransaccion: async (tx, pedido) => {
          // 1. Doble chequeo dentro de la transacción
          for (const mesa of mesasDb) {
            const abierta = await tx.pedidoMesa.findFirst({
              where: { mesa_id: mesa.id, abierta: true },
            });
            if (abierta) {
              const num = mesa.numero ?? mesa.nombre ?? mesa.id.toString();
              throw new ConflictException({
                codigo: 'MESA_OCUPADA',
                mensaje: `La mesa ${num} ya está ocupada`,
              });
            }
          }

          // 2. Crear las filas pedido_mesa en la misma tx
          for (const mesa of mesasDb) {
            await tx.pedidoMesa.create({
              data: {
                pedido_id: pedido.id,
                mesa_id: mesa.id,
                mesa_nombre: mesa.numero ? `Mesa ${mesa.numero}` : (mesa.nombre || `Mesa ${mesa.id}`),
                abierta: true,
              },
            });
          }
        },
      });
    } catch (error: any) {
      if (
        error?.code === 'P2002' ||
        (error?.message && error.message.includes('ux_mesa_un_pedido_abierto'))
      ) {
        const num = mesasDb[0]?.numero ?? mesasDb[0]?.nombre ?? mesasDb[0]?.id.toString();
        throw new ConflictException({
          codigo: 'MESA_OCUPADA',
          mensaje: `La mesa ${num} ya está ocupada`,
        });
      }
      throw error;
    }

    // Si el pedido nace de «Sentar» una reserva, queda asociado a ella (no frena el pedido si falla)
    if (dto.reservaId !== undefined && dto.reservaId !== null && this.reservasService) {
      try {
        await this.reservasService.marcarPedidoDeReserva(dto.reservaId, resultadoPedido.id);
      } catch {
        // el pedido ya está abierto: la reserva se puede marcar a mano
      }
    }

    // Emitir eventos 'salon:mesa' { mesaId, estado: 'OCUPADA' } para cada mesa abierta
    for (const mesa of mesasDb) {
      this.eventosGateway.emitirAdmin('salon:mesa', {
        mesaId: mesa.id.toString(),
        estado: 'OCUPADA',
      });
    }

    // Verificar si hay reservas activas para hoy en esas mesas (aviso sin bloquear)
    const { inicio: inicioDia, fin: finDia } = obtenerRangoHoyLima();

    const reservasActivas = await this.prisma.reservaMesa.findMany({
      where: {
        mesa_id: { in: mesasIds },
        reserva: {
          estado: 'ACTIVA',
          hora: { gte: inicioDia, lte: finDia },
        },
      },
      include: { reserva: true },
    });

    let avisoReserva: string | null = null;
    if (reservasActivas.length > 0) {
      const r = reservasActivas[0].reserva;
      const horaStr = new Date(r.hora).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      avisoReserva = `La mesa tiene una reserva activa para hoy a las ${horaStr} a nombre de ${r.nombre} (${r.personas} personas)`;
    }

    return {
      ...resultadoPedido,
      mesas: mesasDb.map((m) => ({
        id: m.id.toString(),
        numero: m.numero,
        nombre: m.nombre,
      })),
      aviso: avisoReserva,
    };
  }

  /**
   * 3) POST /admin/salon/mesas/:id/liberar (mesas/liberar) { motivo }
   * Libera a mano la mesa (pedido_mesa.abierta = false) con motivo obligatorio de >= 5 caracteres.
   * Si el pedido sigue en cocina (COLA/PREPARANDO) retorna 409 PEDIDO_EN_COCINA.
   */
  async liberarMesaManual(
    id: string | number | bigint,
    dto: LiberarMesaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const mesaId = BigInt(id);

    const mesa = await this.prisma.elementoPlano.findUnique({
      where: { id: mesaId },
    });

    if (!mesa || mesa.tipo !== 'MESA') {
      throw new NotFoundException({
        codigo: 'MESA_NO_ENCONTRADA',
        mensaje: 'Mesa no encontrada',
      });
    }

    if (!dto?.motivo || dto.motivo.trim().length < 5) {
      throw new BadRequestException({
        codigo: 'MOTIVO_INVALIDO',
        mensaje: 'El motivo es obligatorio y debe tener al menos 5 caracteres',
      });
    }

    const pedidoMesa = await this.prisma.pedidoMesa.findFirst({
      where: { mesa_id: mesaId, abierta: true },
      include: { pedido: true },
    });

    if (pedidoMesa?.pedido) {
      const estadoPedido = pedidoMesa.pedido.estado;
      if (estadoPedido === 'COLA' || estadoPedido === 'PREPARANDO') {
        throw new ConflictException({
          codigo: 'PEDIDO_EN_COCINA',
          mensaje:
            'El pedido sigue activo en cocina. Debe anularlo antes de liberar la mesa.',
        });
      }

      await this.prisma.pedidoMesa.update({
        where: { id: pedidoMesa.id },
        data: { abierta: false },
      });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mesas',
      accion: 'LIBERAR_MANUAL',
      resultado: 'OK',
      entidad: 'elemento_plano',
      entidadId: mesaId,
      motivo: dto.motivo.trim(),
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
      despues: {
        mesaId: mesaId.toString(),
        pedidoId: pedidoMesa?.pedido_id?.toString() || null,
      },
    });

    this.eventosGateway.emitirAdmin('salon:mesa', {
      mesaId: mesaId.toString(),
      estado: 'LIBRE',
    });

    return {
      ok: true,
      mensaje: 'Mesa liberada correctamente',
    };
  }

  /**
   * Método público idempotente para liberar todas las mesas abiertas asociadas a un pedido.
   * El integrador lo llamará desde el cobro (módulo caja) y la anulación.
   */
  async liberarMesasDePedido(
    pedidoId: bigint | string | number,
    tx?: Prisma.TransactionClient,
  ) {
    const pId = BigInt(pedidoId);
    const db = tx ?? this.prisma;

    const pedidosMesaAbiertos = await db.pedidoMesa.findMany({
      where: { pedido_id: pId, abierta: true },
    });

    if (pedidosMesaAbiertos.length === 0) {
      return { liberadas: 0 };
    }

    await db.pedidoMesa.updateMany({
      where: { pedido_id: pId, abierta: true },
      data: { abierta: false },
    });

    for (const pm of pedidosMesaAbiertos) {
      if (pm.mesa_id) {
        this.eventosGateway.emitirAdmin('salon:mesa', {
          mesaId: pm.mesa_id.toString(),
          estado: 'LIBRE',
        });
      }
    }

    return {
      liberadas: pedidosMesaAbiertos.length,
    };
  }

  /**
   * 4) POST /admin/salon/pedidos/:id/entregado-mesa (mesas/abrir)
   * Marca entregado_mesa_en (solo pedidos MESA en LISTO), audita.
   */
  async marcarEntregadoMesa(
    id: string | number | bigint,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = BigInt(id);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (pedido.modalidad !== 'MESA') {
      throw new BadRequestException({
        codigo: 'MODALIDAD_INVALIDA',
        mensaje: 'Solo los pedidos de salón (MESA) pueden marcarse como entregados en mesa',
      });
    }

    if (pedido.estado !== 'LISTO') {
      throw new ConflictException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: 'Solo los pedidos en estado LISTO pueden marcarse como entregados en mesa',
      });
    }

    const ahora = new Date();
    const actualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: { entregado_mesa_en: ahora },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mesas',
      accion: 'ENTREGADO_MESA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
      despues: {
        entregado_mesa_en: ahora.toISOString(),
      },
    });

    return {
      ok: true,
      id: actualizado.id.toString(),
      codigo: actualizado.codigo,
      entregado_mesa_en: ahora,
    };
  }

  /**
   * Método público que el integrador llamará desde cocina cuando un pedido pasa a LISTO.
   * Emite 'salon:listo' { pedidoId, codigo, mesas, mozoPartyId }
   */
  async avisarListo(pedidoId: bigint | string | number) {
    const pId = BigInt(pedidoId);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: {
        mesas: {
          include: { mesa: true },
        },
        historial: {
          where: { estado_anterior: null },
          take: 1,
        },
      },
    });

    if (!pedido || pedido.modalidad !== 'MESA') {
      return;
    }

    const mozoPartyId = pedido.party_id
      ? pedido.party_id.toString()
      : pedido.historial?.[0]?.por_party_id
      ? pedido.historial[0].por_party_id.toString()
      : null;

    const mesas = pedido.mesas.map(
      (pm) => pm.mesa?.numero ?? pm.mesa_nombre ?? (pm.mesa_id ? pm.mesa_id.toString() : ''),
    );

    this.eventosGateway.emitirAdmin('salon:listo', {
      pedidoId: pedido.id.toString(),
      codigo: pedido.codigo,
      mesas,
      mozoPartyId,
    });
  }
}
