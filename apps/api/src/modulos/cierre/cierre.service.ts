import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import {
  exigirPinNoBloqueado,
  limpiarIntentosPin,
  registrarFalloPin,
} from '../../comun/redis/intentos-pin';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CobrosService } from '../caja/cobros.service';
import { PuntosService } from '../clientes/puntos.service';
import {
  SupervisorCodigoService,
  autorizarAdminSinCodigo,
  esOperadorSinCodigo,
} from '../supervisor-codigo/supervisor-codigo.service';
import { CobrarDto } from '../caja/dto/cobrar.dto';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  ClienteCaja,
  MontosSistema,
  aCentimos,
  bloquearCaja,
  calcularMontosCaja,
  efectivoDelRepartidor,
  enPesos,
  esCentimosValidos,
  mapearCobrosCaja,
  mapearMovimientosCaja,
  pedidosRepartoDelDia,
} from '../caja/caja.calculo';
import { ArqueoDto } from './dto/arqueo.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { LiquidarRepartidorDto } from './dto/liquidar.dto';
import { HistorialCierresDto } from './dto/historial.dto';
import { calcularTotalConteo } from './cierre.util';

/**
 * Arqueos que NO cuadraron antes de exigir PIN de supervisor. Un arqueo que cuadra no suma.
 * Los intentos se numeran todos (incluidos los que cuadran); solo los NO_CUADRA cuentan para el PIN.
 */
const ARQUEOS_NO_CUADRA_PARA_PIN = 3;

/** Diferencia por medio en céntimos (visto − sistema). Cuadra si todas son cero. */
function compararConSistema(
  vistos: { efectivo: number; yape: number; plin: number; transferencia: number; tarjeta: number },
  montos: MontosSistema,
) {
  const difEfectivo = aCentimos(vistos.efectivo) - aCentimos(montos.esperadoEfectivo);
  const difYape = aCentimos(vistos.yape) - aCentimos(montos.sistemaYape);
  const difPlin = aCentimos(vistos.plin) - aCentimos(montos.sistemaPlin);
  const difTransferencia = aCentimos(vistos.transferencia) - aCentimos(montos.sistemaTransferencia);
  const difTarjeta = aCentimos(vistos.tarjeta) - aCentimos(montos.sistemaTarjeta);

  const cuadra = [difEfectivo, difYape, difPlin, difTransferencia, difTarjeta].every((d) => d === 0);

  return {
    resultado: (cuadra ? 'CUADRA' : 'NO_CUADRA') as 'CUADRA' | 'NO_CUADRA',
    cuadra,
    difEfectivo: enPesos(difEfectivo),
    difYape: enPesos(difYape),
    difPlin: enPesos(difPlin),
    difTransferencia: enPesos(difTransferencia),
    difTarjeta: enPesos(difTarjeta),
  };
}

function exigirAdmin(usuario: UsuarioAutenticado | undefined, mensaje: string) {
  if (usuario?.rol !== 'ADMIN') {
    throw new HttpException({ codigo: 'SOLO_ADMIN', mensaje }, HttpStatus.FORBIDDEN);
  }
}

@Injectable()
export class CierreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
    private readonly eventosGateway: EventosGateway,
    private readonly cobrosService: CobrosService,
    @Optional() private readonly supervisorCodigoService?: SupervisorCodigoService,
    @Optional() private readonly puntosService?: PuntosService,
  ) {}

  /** Nombre de la persona de cada party (quién cerró la caja): el historial muestra nombres, no IDs. */
  private async nombresDePartes(ids: bigint[]) {
    const partes = await this.prisma.party.findMany({
      where: { id: { in: ids } },
      include: { persona: true },
    });
    return new Map(
      partes.map((p) => [
        String(p.id),
        `${p.persona?.nombres ?? ''} ${p.persona?.apellidos ?? ''}`.trim() || `Usuario #${p.id}`,
      ]),
    );
  }

  /**
   * Obtiene la caja actualmente abierta (solo puede haber una según ux_una_caja_abierta).
   */
  async obtenerCajaAbierta() {
    const caja = await this.prisma.caja.findFirst({
      where: { estado: 'ABIERTA' },
      orderBy: { id: 'desc' },
    });
    if (!caja) {
      throw new HttpException(
        {
          codigo: 'NO_HAY_CAJA_ABIERTA',
          mensaje: 'No hay ninguna caja abierta actualmente.',
        },
        // 409 igual que CAJA_CERRADA: un segundo cierre o arqueo sobre una caja ya cerrada es un conflicto
        HttpStatus.CONFLICT,
      );
    }
    return caja;
  }

  /**
   * Bloquea la caja y comprueba que siga abierta. Todo lo que escribe en la caja pasa por aquí.
   */
  private async bloquearCajaAbierta(tx: Prisma.TransactionClient, cajaId: bigint) {
    const caja = await bloquearCaja(tx, cajaId);
    if (!caja || caja.estado !== 'ABIERTA') {
      throw new HttpException(
        {
          codigo: 'CAJA_CERRADA',
          mensaje: 'La caja ya fue cerrada; no admite más cambios.',
        },
        HttpStatus.CONFLICT,
      );
    }
    return caja;
  }

  /**
   * Calcula los montos esperados por el sistema para una caja dada (ver caja.calculo.ts).
   */
  async calcularMontosSistema(cajaId: bigint): Promise<MontosSistema> {
    const caja = await this.prisma.caja.findUnique({
      where: { id: cajaId },
    });
    if (!caja) {
      throw new NotFoundException('Caja no encontrada');
    }
    return calcularMontosCaja(this.prisma, caja);
  }

  /**
   * Verifica el código rotativo de 6 dígitos del supervisor (RFC 6238 TOTP).
   * 3 intentos fallidos consecutivos bloquean 1 minuto en Redis (FT-CAJ-02).
   */
  async verificarPinSupervisor(
    pinSupervisor?: string,
    partyIdOperador?: bigint,
    ip?: string,
    cajaId?: bigint,
    _cliente?: any,
    accion = 'cierre',
  ): Promise<{ party_id?: bigint; id?: bigint }> {
    if (this.supervisorCodigoService) {
      return this.supervisorCodigoService.verificarYConsumirCodigo(
        pinSupervisor,
        partyIdOperador,
        accion,
        ip,
        'caja',
        cajaId,
      );
    }

    // Mismo criterio que el servicio: el ADMIN no da código.
    const admin = await autorizarAdminSinCodigo(this.prisma, this.auditoria, partyIdOperador, accion, ip, 'caja', cajaId);
    if (admin) return { party_id: admin.party_id, id: admin.id };

    const claveIntentos = `pin:supervisor:intentos:${partyIdOperador ?? 'general'}`;
    const redis = this.redisService.obtenerCliente();
    await exigirPinNoBloqueado(redis, claveIntentos);
    await registrarFalloPin(redis, claveIntentos);
    throw new HttpException(
      {
        codigo: 'CODIGO_INVALIDO',
        mensaje: 'Código de supervisor inválido o no proporcionado',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  /**
   * Arqueo ciego: registra el conteo físico por denominación y medios digitales.
   * La respuesta NUNCA entrega los montos esperados ni las diferencias (DT-61).
   */
  async arqueo(
    dto: ArqueoDto,
    usuario: UsuarioAutenticado,
    pinSupervisor?: string,
    ip?: string,
  ) {
    const cajaAbierta = await this.obtenerCajaAbierta();

    const { resultado, nuevoIntento } = await this.prisma.$transaction(async (tx) => {
      const caja = await this.bloquearCajaAbierta(tx, cajaAbierta.id);

      // Número del intento: todos los arqueos de la caja cuentan para la numeración
      const conteosPrevios = await tx.conteoCierre.count({
        where: { caja_id: caja.id },
      });

      const nuevoIntento = conteosPrevios + 1;

      // Desde el cuarto intento exige PIN de supervisor, pero solo si los tres anteriores no cuadraron
      const noCuadraPrevios = await tx.conteoCierre.count({
        where: { caja_id: caja.id, resultado: 'NO_CUADRA' },
      });
      if (noCuadraPrevios >= ARQUEOS_NO_CUADRA_PARA_PIN) {
        if (!pinSupervisor && !(await esOperadorSinCodigo(this.prisma, usuario.partyId))) {
          throw new HttpException(
            {
              codigo: 'PIN_REQUERIDO',
              mensaje:
                'Se alcanzaron 3 arqueos que no cuadraron. Debe proceder al cierre con PIN de supervisor.',
            },
            HttpStatus.FORBIDDEN,
          );
        }
        await this.verificarPinSupervisor(pinSupervisor, usuario.partyId, ip, caja.id, tx);
      }

      const montos = await calcularMontosCaja(tx, caja);
      const comparacion = compararConSistema(
        {
          efectivo: calcularTotalConteo(dto.conteo),
          yape: Number(dto.medios?.yape ?? 0),
          plin: Number(dto.medios?.plin ?? 0),
          transferencia: Number(dto.medios?.transferencia ?? 0),
          tarjeta: Number(dto.medios?.tarjeta ?? 0),
        },
        montos,
      );

      await tx.conteoCierre.create({
        data: {
          caja_id: caja.id,
          intento: nuevoIntento,
          conteo: dto.conteo as any,
          medios: dto.medios as any,
          resultado: comparacion.resultado,
          por: usuario.partyId,
        },
      });

      return { resultado: comparacion.resultado, nuevoIntento };
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cierre',
      accion: 'ARQUEO',
      resultado: 'OK',
      entidad: 'caja',
      entidadId: cajaAbierta.id,
      despues: {
        intento: nuevoIntento,
        resultado,
      },
      partyId: usuario.partyId,
      ip,
    });

    // Respuesta estrictamente ciega (DT-61)
    return {
      resultado,
      intento: nuevoIntento,
    };
  }

  /**
   * Cierra la caja del día.
   * Crea cierre_caja (inmutable) y cierre_medio por medio.
   * Exige que no haya cobros en curso.
   * Si no cuadra o tras 3 arqueos que no cuadraron, exige PIN de supervisor y notas.
   */
  async cerrar(
    dto: CerrarCajaDto,
    usuario: UsuarioAutenticado,
    pinSupervisor?: string,
    ip?: string,
  ) {
    const cajaAbierta = await this.obtenerCajaAbierta();

    const cierre = await this.prisma.$transaction(async (tx) => {
      const caja = await this.bloquearCajaAbierta(tx, cajaAbierta.id);

      // 1. No puede haber cobros en curso ni pedidos pendientes de confirmación
      const cobrosEnCurso = await tx.pedido.count({
        where: {
          pago_estado: { in: ['PENDIENTE', 'COORDINADO'] },
          estado: { not: 'ANULADO' },
        },
      });

      if (cobrosEnCurso > 0) {
        throw new HttpException(
          {
            codigo: 'COBROS_EN_CURSO',
            mensaje: `No se puede cerrar la caja: hay ${cobrosEnCurso} pedido(s) con cobro en curso o por confirmar.`,
          },
          HttpStatus.CONFLICT,
        );
      }

      // 2. Ningún repartidor con efectivo sin liquidar (RN-CAP-097 / RQ-CIE-02-08)
      const repartidores = await this.repartidoresConEfectivo(tx, caja);
      const pendientes = repartidores.filter((r) => r.pendienteCentimos > 0);
      if (pendientes.length > 0) {
        const nombres = pendientes.map((r) => r.nombre).join(', ');
        throw new HttpException(
          {
            codigo: 'REPARTIDORES_SIN_LIQUIDAR',
            mensaje: `No se puede cerrar la caja: falta liquidar a repartidor(es): ${nombres}.`,
          },
          HttpStatus.CONFLICT,
        );
      }

      // 3. Conteo y medios: del body o del último intento registrado
      let conteo = dto.conteo;
      let medios = dto.medios;

      const conteosCaja = await tx.conteoCierre.findMany({
        where: { caja_id: caja.id },
        orderBy: { intento: 'desc' },
      });

      if (!conteo || !medios) {
        if (conteosCaja.length === 0) {
          throw new HttpException(
            {
              codigo: 'ARQUEO_REQUERIDO',
              mensaje: 'Debe realizar el arqueo ciego antes de cerrar la caja.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        conteo = conteo ?? (conteosCaja[0].conteo as any);
        medios = medios ?? (conteosCaja[0].medios as any);
      }

      const montos = await calcularMontosCaja(tx, caja);
      const vistos = {
        efectivo: calcularTotalConteo(conteo),
        yape: Number(medios?.yape ?? 0),
        plin: Number(medios?.plin ?? 0),
        transferencia: Number(medios?.transferencia ?? 0),
        tarjeta: Number(medios?.tarjeta ?? 0),
      };
      const comparacion = compararConSistema(vistos, montos);
      const { resultado, cuadra } = comparacion;

      let supervisorPartyId: bigint | null = null;

      // Si no cuadra o ya hubo 3 arqueos que no cuadraron, se exige supervisor y notas
      const noCuadraPrevios = conteosCaja.filter((c) => c.resultado === 'NO_CUADRA').length;
      if (!cuadra || noCuadraPrevios >= ARQUEOS_NO_CUADRA_PARA_PIN) {
        if (!dto.nota || typeof dto.nota !== 'string' || dto.nota.trim().length < 3) {
          throw new HttpException(
            {
              codigo: 'NOTA_REQUERIDA',
              mensaje:
                'Se requiere una nota explicativa de al menos 3 caracteres para cerrar la caja con diferencias.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        if (!pinSupervisor && !(await esOperadorSinCodigo(this.prisma, usuario.partyId))) {
          throw new HttpException(
            {
              codigo: 'PIN_REQUERIDO',
              mensaje:
                'El cierre no cuadra o se alcanzaron los intentos máximos: se requiere el PIN de supervisor.',
            },
            HttpStatus.FORBIDDEN,
          );
        }

        const supervisor = await this.verificarPinSupervisor(
          pinSupervisor,
          usuario.partyId,
          ip,
          caja.id,
          tx,
        );
        supervisorPartyId = supervisor.party_id ?? null;
      }

      const mediosData = [
        { medio: 'EFECTIVO', sistema: montos.esperadoEfectivo, visto: vistos.efectivo, diferencia: comparacion.difEfectivo },
        { medio: 'YAPE', sistema: montos.sistemaYape, visto: vistos.yape, diferencia: comparacion.difYape },
        { medio: 'PLIN', sistema: montos.sistemaPlin, visto: vistos.plin, diferencia: comparacion.difPlin },
        { medio: 'TRANSFERENCIA', sistema: montos.sistemaTransferencia, visto: vistos.transferencia, diferencia: comparacion.difTransferencia },
        { medio: 'TARJETA', sistema: montos.sistemaTarjeta, visto: vistos.tarjeta, diferencia: comparacion.difTarjeta },
      ];

      await tx.cierreCaja.create({
        data: {
          caja_id: caja.id,
          conteo: conteo as any,
          resultado,
          aprobado_por: supervisorPartyId,
          nota: dto.nota?.trim() ?? null,
        },
      });

      // diferencia es columna generada en BD
      for (const m of mediosData) {
        await tx.cierreMedio.create({
          data: {
            caja_id: caja.id,
            medio: m.medio,
            sistema: m.sistema,
            visto: m.visto,
          },
        });
      }

      await tx.caja.update({
        where: { id: caja.id },
        data: {
          estado: 'CERRADA',
          cerrada_por: usuario.partyId,
          cerrada_en: new Date(),
        },
      });

      return { caja, resultado, supervisorPartyId, mediosData };
    });

    const { caja, resultado, supervisorPartyId, mediosData } = cierre;

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cierre',
      accion: 'CERRAR_CAJA',
      resultado: 'OK',
      entidad: 'cierre_caja',
      entidadId: caja.id,
      despues: {
        resultado,
        aprobado_por: supervisorPartyId ? String(supervisorPartyId) : null,
        nota: dto.nota?.trim() ?? null,
      },
      conPinAdmin: supervisorPartyId !== null,
      partyId: usuario.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('caja:cerrada', {
        cajaId: Number(caja.id),
        resultado,
      });
    } catch {
      // Ignorar fallo de socket
    }

    return {
      cajaId: Number(caja.id),
      fecha: caja.fecha,
      resultado,
      aprobadoPor: supervisorPartyId ? Number(supervisorPartyId) : null,
      nota: dto.nota?.trim() ?? null,
      // El cajero no ve el esperado ni la diferencia (DT-61)
      medios: usuario.rol === 'ADMIN' ? mediosData : undefined,
    };
  }

  /**
   * Montos esperados por el sistema y el turno (cobros y movimientos) de la caja ABIERTA, sea del día que sea.
   * Solo ADMIN o con PIN de supervisora (cierre ciego para cajeros): sin eso no sale ningún monto.
   */
  async obtenerEsperado(usuario: UsuarioAutenticado, pinSupervisor?: string, ip?: string) {
    const caja = await this.obtenerCajaAbierta();
    // el administrador lo ve directo; otro rol solo con el PIN de la supervisora (RQ-CIE-02-05, HU-CAP-199)
    if (usuario?.rol !== 'ADMIN') {
      await this.verificarPinSupervisor(pinSupervisor, usuario?.partyId, ip, caja.id);
    }
    const montos = await this.calcularMontosSistema(caja.id);
    // Mismos cobros y movimientos que la caja de hoy, pero de la caja que se cierra: totales y listas cuadran
    const cobros = await this.prisma.cobro.findMany({
      where: { caja_id: caja.id },
      include: { pagos: true, pedido: { select: { codigo: true, cliente_nombre: true } } },
    });
    const movimientos = await this.prisma.movimientoCaja.findMany({
      where: { caja_id: caja.id },
      orderBy: { id: 'asc' },
    });

    return {
      cajaId: Number(caja.id),
      fecha: caja.fecha,
      cobrados: mapearCobrosCaja(cobros),
      movimientos: mapearMovimientosCaja(movimientos),
      apertura: Number(caja.apertura),
      efectivoEsperado: montos.esperadoEfectivo,
      medios: {
        efectivo: montos.esperadoEfectivo,
        yape: montos.sistemaYape,
        plin: montos.sistemaPlin,
        transferencia: montos.sistemaTransferencia,
        tarjeta: montos.sistemaTarjeta,
      },
      desglose: {
        ventasEfectivo: montos.ventasEfectivo,
        ingresos: montos.ingresos,
        egresos: montos.egresos,
        liquidadoRepartidores: montos.liquidadoEfectivo,
      },
    };
  }

  /**
   * Historial de cierres de caja con paginación y filtros de fecha. Solo administrador (HU-CAP-046).
   */
  async historial(query: HistorialCierresDto, usuario: UsuarioAutenticado) {
    exigirAdmin(usuario, 'Solo el administrador puede consultar el historial de cierres.');

    const pagina = Number(query.pagina ?? 1);
    const limite = Number(query.limite ?? 20);
    const skip = (pagina - 1) * limite;

    const where: any = {
      estado: 'CERRADA',
      cierre: { isNot: null },
    };

    if (query.desde || query.hasta) {
      where.fecha = {};
      if (query.desde) {
        where.fecha.gte = new Date(query.desde);
      }
      if (query.hasta) {
        where.fecha.lte = new Date(query.hasta);
      }
    }

    const [total, cajas] = await Promise.all([
      this.prisma.caja.count({ where }),
      this.prisma.caja.findMany({
        where,
        skip,
        take: limite,
        orderBy: { fecha: 'desc' },
        include: {
          cierre: {
            include: {
              medios: true,
            },
          },
        },
      }),
    ]);

    const nombres = await this.nombresDePartes(
      cajas.flatMap((c) => (c.cerrada_por ? [c.cerrada_por] : [])),
    );

    const items = cajas.map((c) => ({
      cajaId: Number(c.id),
      fecha: c.fecha,
      apertura: Number(c.apertura),
      cerradaPor: c.cerrada_por ? Number(c.cerrada_por) : null,
      cerradaPorNombre: c.cerrada_por ? (nombres.get(String(c.cerrada_por)) ?? null) : null,
      cerradaEn: c.cerrada_en,
      cierre: c.cierre
        ? {
            resultado: c.cierre.resultado,
            aprobadoPor: c.cierre.aprobado_por ? Number(c.cierre.aprobado_por) : null,
            nota: c.cierre.nota,
            medios: c.cierre.medios.map((m) => ({
              medio: m.medio,
              sistema: Number(m.sistema),
              visto: Number(m.visto),
              diferencia: m.diferencia !== null ? Number(m.diferencia) : null,
            })),
          }
        : null,
    }));

    return {
      cierres: items,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  /**
   * Consulta el detalle de un cierre por ID (mostrando diferencias y medios). Solo administrador.
   */
  async obtenerCierrePorId(id: bigint | number | string, usuario: UsuarioAutenticado) {
    exigirAdmin(usuario, 'Solo el administrador puede ver el detalle de un cierre.');

    let cajaId: bigint;
    try {
      cajaId = BigInt(id);
    } catch {
      throw new HttpException(
        {
          codigo: 'ID_INVALIDO',
          mensaje: 'El ID proporcionado no es válido.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const cierre = await this.prisma.cierreCaja.findUnique({
      where: { caja_id: cajaId },
      include: {
        caja: true,
        medios: true,
      },
    });

    if (!cierre) {
      throw new HttpException(
        {
          codigo: 'CIERRE_NO_ENCONTRADO',
          mensaje: 'Cierre de caja no encontrado.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      cajaId: Number(cierre.caja_id),
      fecha: cierre.caja.fecha,
      apertura: Number(cierre.caja.apertura),
      resultado: cierre.resultado,
      aprobadoPor: cierre.aprobado_por ? Number(cierre.aprobado_por) : null,
      nota: cierre.nota,
      cerradaPor: cierre.caja.cerrada_por ? Number(cierre.caja.cerrada_por) : null,
      cerradaPorNombre: cierre.caja.cerrada_por
        ? ((await this.nombresDePartes([cierre.caja.cerrada_por])).get(String(cierre.caja.cerrada_por)) ?? null)
        : null,
      cerradaEn: cierre.caja.cerrada_en,
      conteo: cierre.conteo,
      medios: cierre.medios.map((m) => ({
        medio: m.medio,
        sistema: Number(m.sistema),
        visto: Number(m.visto),
        diferencia: m.diferencia !== null ? Number(m.diferencia) : null,
      })),
    };
  }

  /**
   * Lista los repartidores con efectivo cobrado del día que aún no liquidan (FT-CIE-01).
   */
  async listarRepartidoresPorLiquidar() {
    const caja = await this.obtenerCajaAbierta();
    const repartidores = await this.repartidoresConEfectivo(this.prisma, caja);

    return repartidores.map((r) => ({
      repartidorPartyId: Number(r.repartidorPartyId),
      nombre: r.nombre,
      pedidos: r.pedidos,
      totalCobrado: enPesos(r.cobradoCentimos),
      totalLiquidado: enPesos(r.liquidadoCentimos),
      pendiente: enPesos(r.pendienteCentimos),
    }));
  }

  /**
   * Registra la liquidación de efectivo de un repartidor: liquida todo lo que cobró ese día
   * (el saldo queda en cero) y registra lo que entregó y la diferencia (FT-CIE-01, RQ-CIE-01-08).
   */
  async liquidarRepartidor(
    dto: LiquidarRepartidorDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const cajaAbierta = await this.obtenerCajaAbierta();
    let repartidorPartyId: bigint;
    try {
      repartidorPartyId = BigInt(dto.repartidorPartyId);
    } catch {
      throw new HttpException(
        {
          codigo: 'ID_INVALIDO',
          mensaje: 'repartidorPartyId proporcionado no es válido.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!esCentimosValidos(Number(dto.entregado))) {
      throw new HttpException(
        {
          codigo: 'MONTO_INVALIDO',
          mensaje: 'El monto entregado admite como máximo dos decimales.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verificar que el repartidor exista
    const repartidor = await this.prisma.party.findUnique({
      where: { id: repartidorPartyId },
      include: { persona: true },
    });

    if (!repartidor) {
      throw new HttpException(
        {
          codigo: 'REPARTIDOR_NO_ENCONTRADO',
          mensaje: 'El repartidor especificado no existe.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const { liquidacion, esperado, entregado, pedidosIds } = await this.prisma.$transaction(async (tx) => {
      const caja = await this.bloquearCajaAbierta(tx, cajaAbierta.id);

      const repartidores = await this.repartidoresConEfectivo(tx, caja);
      const info = repartidores.find((r) => r.repartidorPartyId === String(repartidorPartyId));
      const pendiente = info?.pendienteCentimos ?? 0;

      if (pendiente <= 0) {
        throw new HttpException(
          {
            codigo: 'SIN_EFECTIVO_PENDIENTE',
            mensaje: 'El repartidor no tiene efectivo pendiente por liquidar.',
          },
          HttpStatus.CONFLICT,
        );
      }

      const entregadoCentimos = aCentimos(dto.entregado);
      const liq = await tx.liquidacion.create({
        data: {
          caja_id: caja.id,
          repartidor_party_id: repartidorPartyId,
          esperado: enPesos(pendiente),
          entregado: enPesos(entregadoCentimos),
        },
      });

      // Ese efectivo ya entró a caja por la liquidación: sus pedidos dejan de estar pendientes de cobro.
      // Si siguieran PENDIENTE bloquearían el cierre, y cobrarlos después contaría el efectivo dos veces.
      const pedidosIds = (info?.pedidos ?? []).map((p) => BigInt(p.id));
      await tx.pedido.updateMany({
        where: { id: { in: pedidosIds }, pago_estado: 'PENDIENTE' },
        data: { pago_estado: 'PAGADO' },
      });

      return { liquidacion: liq, esperado: pendiente, entregado: entregadoCentimos, pedidosIds };
    });

    // el contra entrega se cobra aquí y no pasa por Caja → cobrar: suma los puntos del cliente
    // (idempotente; si falla no deshace la liquidación)
    for (const id of pedidosIds) {
      try {
        await this.puntosService?.acumularPorPedido(id);
      } catch {
        // sin puntos no se detiene la liquidación
      }
    }

    const diferencia = enPesos(entregado - esperado);

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cierre',
      accion: 'LIQUIDAR_REPARTIDOR',
      resultado: 'OK',
      entidad: 'liquidacion',
      entidadId: liquidacion.id,
      despues: {
        cajaId: String(cajaAbierta.id),
        repartidorPartyId: String(repartidorPartyId),
        esperado: enPesos(esperado),
        entregado: enPesos(entregado),
        diferencia,
      },
      partyId: usuario.partyId,
      ip,
    });

    return {
      id: Number(liquidacion.id),
      cajaId: Number(cajaAbierta.id),
      repartidorPartyId: Number(repartidorPartyId),
      esperado: enPesos(esperado),
      entregado: enPesos(entregado),
      diferencia,
    };
  }

  /**
   * Pedidos sin cobrar de cualquier día, los mismos que bloquean el cierre (RN-CAP-079).
   * Solo admin o con PIN de supervisor válido.
   */
  async listarPendientesDeCobro(
    usuario: UsuarioAutenticado,
    pinSupervisor?: string,
    ip?: string,
  ) {
    await this.exigirAdminOPin(usuario, pinSupervisor, ip);

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        pago_estado: { in: ['PENDIENTE', 'COORDINADO'] },
        estado: { not: 'ANULADO' },
        cobros: { none: { anulado_en: null } },
      },
      orderBy: { creado_en: 'asc' },
      select: {
        id: true,
        codigo: true,
        canal: true,
        modalidad: true,
        estado: true,
        total: true,
        creado_en: true,
        pago_estado: true,
        cliente_nombre: true,
      },
    });

    return pedidos.map((p) => ({
      id: Number(p.id),
      codigo: p.codigo,
      canal: p.canal,
      modalidad: p.modalidad,
      estado: p.estado,
      pagoEstado: p.pago_estado,
      // Solo el nombre para reconocer el pedido; nunca teléfono ni DNI
      clienteNombre: p.cliente_nombre?.trim() || null,
      total: enPesos(aCentimos(p.total)),
      fecha: p.creado_en,
    }));
  }

  /**
   * Cobra un pedido pendiente en la caja que se cierra (cualquier día). Mismo cobro que en Pedidos y caja,
   * con bloqueo de la caja y sin doble cobro; queda marcado como cobrado durante el cierre.
   */
  async cobrarPendienteDeCierre(
    pedidoId: string,
    dto: CobrarDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const cajaAbierta = await this.obtenerCajaAbierta();
    let id: bigint;
    try {
      id = BigInt(pedidoId);
    } catch {
      throw new HttpException(
        { codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.cobrosService.cobrarEnCierre(
      cajaAbierta.id,
      { ...dto, pedidoId: id.toString() },
      usuario,
      ip,
    );
  }

  /** Lo que pide la pantalla de cierre a un cajero: el PIN de supervisor, o ser admin. */
  private async exigirAdminOPin(usuario: UsuarioAutenticado, pinSupervisor?: string, ip?: string) {
    if (usuario?.rol === 'ADMIN') return;
    await this.verificarPinSupervisor(pinSupervisor, usuario?.partyId, ip);
  }

  /**
   * Efectivo cobrado por repartidor en la caja (en céntimos): cobrado, liquidado y pendiente.
   * Los pedidos se filtran por el día de la caja (hora de Lima) y las liquidaciones por caja.
   */
  private async repartidoresConEfectivo(cliente: ClienteCaja, caja: { id: bigint; fecha: Date }) {
    const fechaIso = new Date(caja.fecha).toISOString().slice(0, 10);
    const pedidos = await pedidosRepartoDelDia(cliente, fechaIso);

    const porRepartidor = new Map<
      string,
      {
        repartidorPartyId: string;
        nombre: string;
        pedidos: Array<{ id: number; codigo: string; total: number; entregadoEn: Date | null }>;
        cobradoCentimos: number;
      }
    >();

    for (const p of pedidos) {
      const centimos = efectivoDelRepartidor(p);
      if (centimos <= 0) continue;

      const repId = String(p.repartidor_party_id);
      if (!porRepartidor.has(repId)) {
        const nombres = p.repartidor?.persona?.nombres ?? '';
        const apellidos = p.repartidor?.persona?.apellidos ?? '';
        const nombreCompleto = `${nombres} ${apellidos}`.trim() || `Repartidor #${repId}`;

        porRepartidor.set(repId, {
          repartidorPartyId: repId,
          nombre: nombreCompleto,
          pedidos: [],
          cobradoCentimos: 0,
        });
      }

      const repData = porRepartidor.get(repId)!;
      repData.pedidos.push({
        id: Number(p.id),
        codigo: p.codigo,
        total: enPesos(centimos),
        entregadoEn: p.entregado_en,
      });
      repData.cobradoCentimos += centimos;
    }

    // Cada liquidación salda lo que el repartidor debía (esperado); la diferencia con lo entregado queda registrada
    const liquidaciones = await cliente.liquidacion.findMany({
      where: { caja_id: caja.id },
    });

    const liquidadoMap = new Map<string, number>();
    for (const liq of liquidaciones) {
      const repId = String(liq.repartidor_party_id);
      liquidadoMap.set(repId, (liquidadoMap.get(repId) ?? 0) + aCentimos(liq.esperado));
    }

    return Array.from(porRepartidor.values()).map((r) => {
      const liquidadoCentimos = liquidadoMap.get(r.repartidorPartyId) ?? 0;
      return {
        ...r,
        liquidadoCentimos,
        pendienteCentimos: Math.max(0, r.cobradoCentimos - liquidadoCentimos),
      };
    });
  }
}
