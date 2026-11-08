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
import { ImpresionService } from '../impresion/impresion.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { AbrirPedidoMesaDto } from './dto/abrir-pedido-mesa.dto';
import { LiberarMesaDto } from './dto/liberar-mesa.dto';
import { CrearPedidoDto } from '../pedidos/dto/crear-pedido.dto';
import { tieneTelefonoReal } from '../chatbot/utilidades/enmascarar.util';
import { progresoDelPedido, ProgresoPedido } from '../pedidos/progreso-pedido';
import { tiemposPreparacion } from '../cocina/tiempo-preparacion';
import { lineasDeCuenta } from '../pedidos/lineas-combo.util';
import { descuentosDePedido, lineaDetalleTicket } from '../impresion/constructor-etiquetas';
import { puedeDarCortesia } from '../cortesias/cortesia.tipos';
import { etiquetaMesasPedido, MAX_MESAS_PEDIDO, nombreUnaMesa } from './mesas-pedido.util';

@Injectable()
export class SalonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidosService: PedidosService,
    private readonly auditoria: AuditoriaService,
    private readonly eventosGateway: EventosGateway,
    @Optional() private readonly reservasService?: ReservasService,
    @Optional() private readonly impresionService?: ImpresionService,
  ) {}

  /**
   * 1) GET /admin/salon/mesas (mesas/ver):
   * Lista todas las mesas activas por piso (solo pisos activos) con su estado derivado
   * LIBRE u OCUPADA (pedido_mesa abierta, código del pedido y mozo que lo abrió)
   * y la marca de reserva si hay una ACTIVA hoy (hora, nombre, personas).
   */
  async obtenerMesas() {
    const { inicio: inicioDia, fin: finDia } = obtenerRangoHoyLima();
    const ahora = new Date();

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
                    lineas: {
                      include: {
                        opcionesElegidas: true,
                        sabores: true,
                        cortesia: true,
                        producto: { select: { categoria: { select: { area_id: true } } } },
                      },
                    },
                    // Cocina y entrega en vivo para la vista previa de la mesa
                    comandas: { select: { area_id: true, estado: true, area: { select: { nombre: true } } } },
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

    // Tiempos de preparación por producto para el «Listo en ~N min» de cada mesa ocupada
    const preparacion = await tiemposPreparacion(
      this.prisma,
      pisos
        .flatMap((p) => p.elementos.flatMap((e) => e.pedidosMesa.flatMap((pm) => pm.pedido.lineas ?? [])))
        .map((l) => l.producto_id)
        .filter((id): id is bigint => id != null)
        .map(String),
      ahora,
    );

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
              estado?: string;
              mozo: string | null;
              cliente: string | null;
              creadoEn: Date;
              total?: number;
              progreso: ProgresoPedido;
              lineas?: Array<{ cantidad: number; nombre: string; detalle: string; opciones: string[]; entrada?: unknown; precio?: number }>;
              /** Para la precuenta detallada: descuentos desglosados, subtotal, envío y nota general */
              descuentos?: unknown[];
              subtotal?: number;
              envio?: number;
              nota?: string | null;
              /** Mesa principal del pedido (la que lleva su nombre) y su orden entre las mesas juntas */
              esPrincipal: boolean;
              orden: number;
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
                esPrincipal: pedidoMesaAbierto.principal === true,
                orden: pedidoMesaAbierto.orden ?? 0,
                estado: ped.estado,
                mozo: mozoNombre || null,
                cliente: ped.cliente_nombre?.trim() || null,
                creadoEn: ped.creado_en,
                total: ped.total ? Number(ped.total) : (ped.subtotal ? Number(ped.subtotal) : 0),
                progreso: progresoDelPedido(ped as any, { ahora, preparacion }),
                lineas: lineasDeCuenta((ped as any).lineas || []).map((l: any) => ({
                  cantidad: l.cantidad,
                  nombre: l.nombre,
                  detalle: l.tamano ? `${l.tamano}${l.nota ? ` · ${l.nota}` : ''}` : (l.nota || ''),
                  opciones: (l.opcionesElegidas || []).map((o: any) => o.opcion_nombre),
                  precio: l.subtotal == null ? undefined : Number(l.subtotal),
                  // Mismo detalle que el ticket de pago (sabores, opciones, nombre por vaso, nota, combo, cortesía)
                  entrada: lineaDetalleTicket(l, (ped as any).lineas || []),
                })),
                descuentos: descuentosDePedido(ped),
                subtotal: ped.subtotal == null ? undefined : Number(ped.subtotal),
                envio: ped.envio == null ? undefined : Number(ped.envio),
                nota: (ped as any).nota?.trim() || null,
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
    /** SUPERVISOR que presentó su código para una línea de cortesía (lo llena SupervisorCodigoGuard) */
    supervisorCortesiaPartyId?: bigint | string | number,
  ) {
    if (!dto.mesas || dto.mesas.length === 0) {
      throw new BadRequestException({
        codigo: 'MESAS_REQUERIDAS',
        mensaje: 'Debe especificar al menos una mesa para abrir el pedido',
      });
    }

    if (dto.mesas.length > MAX_MESAS_PEDIDO) {
      throw new BadRequestException({
        codigo: 'MESAS_LIMITE',
        mensaje: `Un pedido puede ocupar hasta ${MAX_MESAS_PEDIDO} mesas juntas`,
      });
    }

    const mesasIds = dto.mesas.map((m) => parseIdMesa(m));
    if (new Set(mesasIds.map((id) => id.toString())).size !== mesasIds.length) {
      throw new BadRequestException({
        codigo: 'MESA_REPETIDA',
        mensaje: 'Una mesa aparece dos veces en el pedido. Elige cada mesa una sola vez.',
      });
    }

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

    // La primera mesa elegida es la principal (da el nombre al pedido)
    const mesasOrdenadas = mesasIds.map((id) => mesasDb.find((m) => m.id === id)!);
    const mesaNombre = etiquetaMesasPedido(mesasOrdenadas);

    // Con personas (sentar una reserva o el mozo lo indica) la capacidad se valida igual que en reservas
    if (dto.personas !== undefined && this.reservasService) {
      await this.reservasService.validarMesasYAsientos(mesasIds, dto.personas, dto.confirmarCapacidad === true);
    }

    // Sin cuenta, el nombre lo escribe el mozo (obligatorio). Con cuenta, nombre y teléfono salen de la cuenta
    // (pedidos.service). El teléfono es opcional: sin él el pedido se guarda sin teléfono real.
    const identificado = Boolean(dto.clienteTelefono || dto.clientePartyId);
    // cliente.nombre (flujo de la mesa) manda; clienteNombre solo completa cuando no viene y el pedido no es de cuenta
    const nombreCorto = dto.clienteNombre?.trim() ?? '';
    const nombreEnviado = dto.cliente?.nombre?.trim() || (identificado ? '' : nombreCorto);
    if (!identificado && nombreEnviado.length < 2) {
      throw new BadRequestException({
        codigo: 'CLIENTE_NOMBRE_REQUERIDO',
        mensaje: 'Escribe el nombre del cliente (mínimo 2 caracteres) para la boleta y la lista',
      });
    }
    const telefonoDigitos = (dto.cliente?.telefono ?? '').replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
    if (telefonoDigitos && !/^9\d{8}$/.test(telefonoDigitos)) {
      throw new BadRequestException({
        codigo: 'TELEFONO_INVALIDO',
        mensaje: 'El teléfono debe tener 9 dígitos y empezar con 9',
      });
    }
    const pedidoDto: CrearPedidoDto = {
      modalidad: 'MESA',
      cliente: {
        nombre: nombreEnviado.length >= 2 ? nombreEnviado : '',
        // el relleno 999999999 de versiones anteriores no es un teléfono real
        telefono: tieneTelefonoReal(telefonoDigitos) ? telefonoDigitos : '',
      },
      lineas: dto.lineas,
      pago: dto.pago || { metodo: 'EFECTIVO' },
      comprobante: dto.comprobante,
      nota: dto.nota,
      mesa: mesaNombre,
      cuponCodigo: dto.cuponCodigo,
      clienteTelefono: dto.clienteTelefono,
      clientePartyId: dto.clientePartyId,
    };

    const idempotencyKey =
      idempotencyKeyHeader ||
      `mozo-${usuario?.partyId ?? 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    let resultadoPedido: any;

    try {
      resultadoPedido = await this.pedidosService.crear(pedidoDto, idempotencyKey, {
        canal: dto.canal === 'CAJA' ? 'CAJA' : 'MOZO',
        usuarioPartyId: usuario?.partyId,
        clientePartyId: dto.colaboradorPartyId,
        esPersonal: dto.esPersonal,
        mesasIds,
        mesaNombre,
        omitirChequeoCarta: true,
        // Cortesías en mesa: mismo permiso cortesias/dar que en Pedidos (Caja y ADMIN; el MOZO no)
        puedeCortesia: puedeDarCortesia(usuario),
        supervisorCortesiaPartyId,
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

          // 2. Crear las filas pedido_mesa en la misma tx (la primera es la principal)
          for (const [indice, mesa] of mesasOrdenadas.entries()) {
            await tx.pedidoMesa.create({
              data: {
                pedido_id: pedido.id,
                mesa_id: mesa.id,
                mesa_nombre: nombreUnaMesa(mesa),
                abierta: true,
                principal: indice === 0,
                orden: indice + 1,
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

    // El pedido de mesa entra directo a cocina: sus etiquetas se imprimen ya (igual que el pedido del mozo)
    if (resultadoPedido?.id && this.impresionService) {
      try {
        await this.impresionService.encolarEtiquetasPedido(resultadoPedido.id);
      } catch {
        // Encolado no bloqueante: la mesa queda abierta y las etiquetas se reimprimen desde la cola
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
      mesas: mesasOrdenadas.map((m) => ({
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

    if (dto.forzar === true) {
      return this.forzarLiberacionMesa(mesaId, dto.motivo.trim(), usuario, ip);
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
   * Liberación forzada: cierra TODAS las filas abiertas de la mesa sin mirar la cocina.
   * No anula ni modifica el pedido; solo deja la mesa libre. Audita LIBERAR_FORZADO.
   */
  private async forzarLiberacionMesa(
    mesaId: bigint,
    motivo: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const abiertas = await this.prisma.pedidoMesa.findMany({
      where: { mesa_id: mesaId, abierta: true },
      include: { pedido: true },
    });

    await this.prisma.pedidoMesa.updateMany({
      where: { mesa_id: mesaId, abierta: true },
      data: { abierta: false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mesas',
      accion: 'LIBERAR_FORZADO',
      resultado: 'OK',
      entidad: 'elemento_plano',
      entidadId: mesaId,
      motivo,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
      despues: {
        mesaId: mesaId.toString(),
        pedidos: abiertas.map((pm) => ({
          pedidoId: pm.pedido_id?.toString() || null,
          estado: pm.pedido?.estado ?? null,
        })),
      },
    });

    this.eventosGateway.emitirAdmin('salon:mesa', {
      mesaId: mesaId.toString(),
      estado: 'LIBRE',
    });

    return {
      ok: true,
      mensaje: 'Mesa liberada a la fuerza. El pedido no se anuló ni se cobró.',
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

    // «Mis pedidos» del mozo refresca el progreso en vivo
    this.eventosGateway.emitirAdmin('pedido:progreso', {
      id: Number(pedidoId),
      codigo: actualizado.codigo,
    });

    return {
      ok: true,
      id: actualizado.id.toString(),
      codigo: actualizado.codigo,
      entregado_mesa_en: ahora,
    };
  }

  /**
   * 5) POST /admin/salon/pedidos/:id/cambiar-mesa (mesas/abrir) { mesaId }
   * Pasa un pedido de mesa a otra mesa LIBRE y activa. Si ocupaba varias, las cierra todas y deja una sola.
   * Actualiza el nombre de mesa del pedido (comprobantes, cocina) y audita. No reimprime nada.
   */
  async cambiarMesaPedido(
    pedidoId: string | number | bigint,
    mesaId: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
    desdeMesaId?: string,
  ) {
    const pId = BigInt(pedidoId);
    const destinoId = BigInt(mesaId);
    // Con desdeMesaId se mueve solo esa mesa del pedido; sin él, la mesa destino reemplaza a todo el conjunto
    const origenId = desdeMesaId !== undefined ? parseIdMesa(desdeMesaId) : null;

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: { mesas: { where: { abierta: true }, include: { mesa: true } } },
    });

    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    if (pedido.modalidad !== 'MESA') {
      throw new BadRequestException({
        codigo: 'MODALIDAD_INVALIDA',
        mensaje: 'Solo los pedidos de salón (MESA) pueden cambiar de mesa',
      });
    }
    if (pedido.estado === 'ANULADO') {
      throw new ConflictException({ codigo: 'ESTADO_INVALIDO', mensaje: 'Un pedido anulado no puede cambiar de mesa' });
    }

    const abiertas = pedido.mesas;
    if (abiertas.length === 0) {
      throw new ConflictException({
        codigo: 'PEDIDO_SIN_MESA',
        mensaje: 'El pedido no está abierto en ninguna mesa',
      });
    }
    const filaOrigen = origenId !== null ? abiertas.find((pm) => pm.mesa_id === origenId) : undefined;
    if (origenId !== null && !filaOrigen) {
      throw new NotFoundException({ codigo: 'MESA_NO_EN_PEDIDO', mensaje: 'Esa mesa no es de este pedido' });
    }

    const destino = await this.prisma.elementoPlano.findUnique({ where: { id: destinoId } });
    if (!destino || destino.tipo !== 'MESA') {
      throw new NotFoundException({ codigo: 'MESA_NO_ENCONTRADA', mensaje: 'Mesa no encontrada' });
    }
    if (!destino.activo) {
      throw new BadRequestException({
        codigo: 'MESA_INACTIVA',
        mensaje: `La mesa ${destino.numero ?? destino.nombre ?? destino.id} no está activa`,
      });
    }
    if (abiertas.some((pm) => pm.mesa_id === destinoId)) {
      throw new ConflictException({ codigo: 'MESA_OCUPADA', mensaje: 'El pedido ya está en esa mesa' });
    }

    const ocupada = await this.prisma.pedidoMesa.findFirst({
      where: { mesa_id: destinoId, abierta: true },
    });
    if (ocupada) {
      const num = destino.numero ?? destino.nombre ?? destino.id.toString();
      throw new ConflictException({ codigo: 'MESA_OCUPADA', mensaje: `La mesa ${num} ya está ocupada` });
    }

    const nombreDestino = destino.numero ? `Mesa ${destino.numero}` : destino.nombre || `Mesa ${destino.id}`;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (filaOrigen) {
          // Mover una mesa: la fila pasa a la mesa destino con la misma posición (principal u orden)
          await tx.pedidoMesa.update({ where: { id: filaOrigen.id }, data: { abierta: false } });
          await tx.pedidoMesa.create({
            data: {
              pedido_id: pId,
              mesa_id: destinoId,
              mesa_nombre: nombreDestino,
              abierta: true,
              principal: filaOrigen.principal,
              orden: filaOrigen.orden,
            },
          });
          await this.refrescarMesasPedido(tx, pId);
          return;
        }
        await tx.pedidoMesa.updateMany({
          where: { pedido_id: pId, abierta: true },
          data: { abierta: false },
        });
        await tx.pedidoMesa.create({
          data: { pedido_id: pId, mesa_id: destinoId, mesa_nombre: nombreDestino, abierta: true, principal: true, orden: 1 },
        });
        await tx.pedido.update({ where: { id: pId }, data: { mesa_nombre: nombreDestino } });
      });
    } catch (error: any) {
      // Otro mozo ocupó la mesa entre la comprobación y la escritura (restricción única)
      if (error?.code === 'P2002' || (error?.message && error.message.includes('ux_mesa_un_pedido_abierto'))) {
        const num = destino.numero ?? destino.nombre ?? destino.id.toString();
        throw new ConflictException({ codigo: 'MESA_OCUPADA', mensaje: `La mesa ${num} ya está ocupada` });
      }
      throw error;
    }

    const anteriores = abiertas.map((pm) => ({
      mesaId: pm.mesa_id?.toString() ?? null,
      mesa: pm.mesa?.numero ? `Mesa ${pm.mesa.numero}` : pm.mesa_nombre,
    }));

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mesas',
      accion: 'CAMBIAR_MESA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pId,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
      antes: { mesas: anteriores },
      despues: { mesaId: destinoId.toString(), mesa: nombreDestino },
    });

    for (const pm of filaOrigen ? [filaOrigen] : abiertas) {
      if (pm.mesa_id) {
        this.eventosGateway.emitirAdmin('salon:mesa', { mesaId: pm.mesa_id.toString(), estado: 'LIBRE' });
      }
    }
    this.eventosGateway.emitirAdmin('salon:mesa', { mesaId: destinoId.toString(), estado: 'OCUPADA' });
    // Cocina y «Mis pedidos» refrescan el nombre de mesa del pedido
    this.emitirCambioMesas(pId, pedido.codigo);

    return {
      ok: true,
      pedidoId: pId.toString(),
      codigo: pedido.codigo,
      mesaId: destinoId.toString(),
      mesa: nombreDestino,
      anteriores,
    };
  }

  /**
   * 8) POST /admin/salon/pedidos/:id/mesas (mesas/abrir) { mesaIds }
   * Suma mesas juntas a un pedido de salón abierto. Mismas reglas que abrir: libres, activas, sin repetir,
   * máximo 6 mesas en total. Audita AGREGAR_MESA y deja el nombre del pedido con todas sus mesas.
   */
  async agregarMesasPedido(
    pedidoId: string | number | bigint,
    mesaIds: Array<string | number>,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = BigInt(pedidoId);
    const ids = mesaIds.map((m) => parseIdMesa(m));
    if (ids.length === 0) {
      throw new BadRequestException({ codigo: 'MESAS_REQUERIDAS', mensaje: 'Elige al menos una mesa para sumar' });
    }
    if (new Set(ids.map((id) => id.toString())).size !== ids.length) {
      throw new BadRequestException({ codigo: 'MESA_REPETIDA', mensaje: 'Una mesa aparece dos veces. Elige cada mesa una sola vez.' });
    }

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: { mesas: { where: { abierta: true }, include: { mesa: true } } },
    });
    this.validarPedidoDeMesas(pedido, 'sumar mesas');

    const yaEnPedido = ids.find((id) => pedido!.mesas.some((pm) => pm.mesa_id === id));
    if (yaEnPedido !== undefined) {
      throw new ConflictException({ codigo: 'MESA_REPETIDA', mensaje: 'Esa mesa ya es de este pedido' });
    }
    if (pedido!.mesas.length + ids.length > MAX_MESAS_PEDIDO) {
      throw new BadRequestException({
        codigo: 'MESAS_LIMITE',
        mensaje: `Un pedido puede ocupar hasta ${MAX_MESAS_PEDIDO} mesas juntas`,
      });
    }

    const mesasDb = await this.prisma.elementoPlano.findMany({ where: { id: { in: ids }, tipo: 'MESA' } });
    if (mesasDb.length !== ids.length) {
      throw new NotFoundException({ codigo: 'MESA_NO_ENCONTRADA', mensaje: 'Una o más mesas no existen o no son mesas' });
    }
    const inactiva = mesasDb.find((m) => !m.activo);
    if (inactiva) {
      throw new BadRequestException({
        codigo: 'MESA_INACTIVA',
        mensaje: `La mesa ${inactiva.numero ?? inactiva.nombre ?? inactiva.id} no está activa`,
      });
    }
    const ocupada = await this.prisma.pedidoMesa.findFirst({
      where: { mesa_id: { in: ids }, abierta: true },
      include: { mesa: true },
    });
    if (ocupada) {
      const num = ocupada.mesa?.numero ?? ocupada.mesa?.nombre ?? ocupada.mesa_id?.toString();
      throw new ConflictException({ codigo: 'MESA_OCUPADA', mensaje: `La mesa ${num} ya está ocupada` });
    }

    const mesasOrdenadas = ids.map((id) => mesasDb.find((m) => m.id === id)!);
    const base = Math.max(0, ...pedido!.mesas.map((pm) => pm.orden ?? 0));
    let abiertas: any[];
    try {
      abiertas = await this.prisma.$transaction(async (tx) => {
        for (const [indice, mesa] of mesasOrdenadas.entries()) {
          await tx.pedidoMesa.create({
            data: {
              pedido_id: pId,
              mesa_id: mesa.id,
              mesa_nombre: nombreUnaMesa(mesa),
              abierta: true,
              principal: false,
              orden: base + indice + 1,
            },
          });
        }
        return this.refrescarMesasPedido(tx, pId);
      });
    } catch (error: any) {
      if (error?.code === 'P2002' || (error?.message && error.message.includes('ux_pedido_mesa'))) {
        throw new ConflictException({ codigo: 'MESA_OCUPADA', mensaje: 'Una de las mesas ya está ocupada' });
      }
      throw error;
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mesas',
      accion: 'AGREGAR_MESA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pId,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
      antes: { mesas: pedido!.mesas.map((pm) => pm.mesa_id?.toString() ?? null) },
      despues: { mesas: abiertas.map((pm) => pm.mesa_id?.toString() ?? null) },
    });

    for (const mesa of mesasOrdenadas) {
      this.eventosGateway.emitirAdmin('salon:mesa', { mesaId: mesa.id.toString(), estado: 'OCUPADA' });
    }
    this.emitirCambioMesas(pId, pedido!.codigo);

    return this.resumenMesasPedido(pId, pedido!.codigo, abiertas);
  }

  /**
   * 9) DELETE /admin/salon/pedidos/:id/mesas/:mesaId (mesas/abrir)
   * Quita una mesa del pedido (queda libre). Un pedido conserva al menos una mesa: para cambiarla, usar cambiar-mesa.
   * Si quita la principal, la siguiente pasa a serlo.
   */
  async quitarMesaPedido(
    pedidoId: string | number | bigint,
    mesaId: string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = BigInt(pedidoId);
    const mId = parseIdMesa(mesaId);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: { mesas: { where: { abierta: true }, include: { mesa: true } } },
    });
    this.validarPedidoDeMesas(pedido, 'quitar mesas');

    const fila = pedido!.mesas.find((pm) => pm.mesa_id === mId);
    if (!fila) {
      throw new NotFoundException({ codigo: 'MESA_NO_EN_PEDIDO', mensaje: 'Esa mesa no es de este pedido' });
    }
    if (pedido!.mesas.length === 1) {
      throw new ConflictException({
        codigo: 'ULTIMA_MESA',
        mensaje: 'El pedido necesita al menos una mesa. Para cambiarla, usa «Cambiar mesa».',
      });
    }

    const abiertas = await this.prisma.$transaction(async (tx) => {
      await tx.pedidoMesa.update({ where: { id: fila.id }, data: { abierta: false } });
      return this.refrescarMesasPedido(tx, pId);
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mesas',
      accion: 'QUITAR_MESA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pId,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
      antes: { mesas: pedido!.mesas.map((pm) => pm.mesa_id?.toString() ?? null) },
      despues: { mesaQuitada: mId.toString(), mesas: abiertas.map((pm) => pm.mesa_id?.toString() ?? null) },
    });

    this.eventosGateway.emitirAdmin('salon:mesa', { mesaId: mId.toString(), estado: 'LIBRE' });
    this.emitirCambioMesas(pId, pedido!.codigo);

    return this.resumenMesasPedido(pId, pedido!.codigo, abiertas);
  }

  /** Pedido que puede cambiar sus mesas: de salón, no anulado y con al menos una mesa abierta. */
  private validarPedidoDeMesas(pedido: { modalidad: string; estado: string; mesas: unknown[] } | null, accion: string): void {
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    if (pedido.modalidad !== 'MESA') {
      throw new BadRequestException({ codigo: 'MODALIDAD_INVALIDA', mensaje: `Solo los pedidos de salón pueden ${accion}` });
    }
    if (pedido.estado === 'ANULADO') {
      throw new ConflictException({ codigo: 'ESTADO_INVALIDO', mensaje: `Un pedido anulado no puede ${accion}` });
    }
    if (pedido.mesas.length === 0) {
      throw new ConflictException({ codigo: 'PEDIDO_SIN_MESA', mensaje: 'El pedido no está abierto en ninguna mesa' });
    }
  }

  /**
   * Deja las mesas abiertas del pedido en orden (la principal primero, luego por orden e id) y pone su
   * nombre al pedido («Mesas 3 y 4»). Quita primero la principal de todas: el índice único parcial no
   * admite dos principales abiertas a la vez.
   */
  private async refrescarMesasPedido(tx: Prisma.TransactionClient, pedidoId: bigint) {
    const abiertas = await tx.pedidoMesa.findMany({
      where: { pedido_id: pedidoId, abierta: true },
      include: { mesa: true },
      orderBy: [{ principal: 'desc' }, { orden: 'asc' }, { id: 'asc' }],
    });
    await tx.pedidoMesa.updateMany({
      where: { pedido_id: pedidoId, abierta: true },
      data: { principal: false },
    });
    for (const [indice, pm] of abiertas.entries()) {
      await tx.pedidoMesa.update({
        where: { id: pm.id },
        data: { principal: indice === 0, orden: indice + 1 },
      });
    }
    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        mesa_nombre: etiquetaMesasPedido(
          abiertas.map((pm) => ({ numero: pm.mesa?.numero ?? null, nombre: pm.mesa?.nombre ?? pm.mesa_nombre })),
        ),
      },
    });
    return abiertas;
  }

  private emitirCambioMesas(pedidoId: bigint, codigo: string) {
    this.eventosGateway.emitirAdmin('cocina:comanda', { pedidoId: Number(pedidoId), areaId: null, completo: false });
    this.eventosGateway.emitirAdmin('pedido:progreso', { id: Number(pedidoId), codigo });
  }

  private resumenMesasPedido(
    pedidoId: bigint,
    codigo: string,
    abiertas: Array<{ mesa_id: bigint | null; mesa?: { numero?: number | null; nombre?: string | null } | null; mesa_nombre?: string | null }>,
  ) {
    const mesas = abiertas.map((pm) => ({
      id: pm.mesa_id?.toString() ?? null,
      numero: pm.mesa?.numero ?? null,
      nombre: pm.mesa?.nombre ?? pm.mesa_nombre ?? null,
    }));
    return {
      ok: true,
      pedidoId: pedidoId.toString(),
      codigo,
      mesas,
      mesa: etiquetaMesasPedido(mesas.map((m) => ({ numero: m.numero, nombre: m.nombre }))),
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

    // Campana del mozo que tomó el pedido (o de todos los mozos si no se sabe quién): «Mesa N lista para llevar»
    try {
      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'MESA_LISTA',
          ...(mozoPartyId ? { party_destino: BigInt(mozoPartyId) } : { rol_destino: 'MOZO' }),
          titulo: `${mesas.length > 1 ? 'Mesas' : 'Mesa'} ${mesas.join(', ')} lista para llevar`,
          mensaje: `El pedido ${pedido.codigo} ya fue despachado desde cocina: llévalo a la mesa.`,
        },
      });
      this.eventosGateway.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo: 'Mesa lista para llevar' });
    } catch {
      // la campana es informativa: el aviso en pantalla ya salió
    }
  }
}

/** Id de mesa que llega como texto o número. 400 si no es un id numérico. */
function parseIdMesa(valor: string | number | bigint): bigint {
  const texto = String(valor).trim();
  if (!/^\d+$/.test(texto)) {
    throw new BadRequestException({ codigo: 'MESA_INVALIDA', mensaje: 'Id de mesa inválido' });
  }
  return BigInt(texto);
}
