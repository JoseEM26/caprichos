import { montoACobrar } from '../../comun/monto-a-cobrar';
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { pedidoDebeEstarCobrado, MOTIVO_SIN_COBRO_MIN } from '../pedidos';
import { tieneRol } from '../acceso/roles-usuario';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CobrosService } from '../caja/cobros.service';
import { PuntosService } from '../clientes/puntos.service';
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
import { ImpresionService } from '../impresion/impresion.service';
import { armarTicketCierre } from './ticket-cierre';
import { AjusteMedioDto } from './dto/ajuste-medio.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { LiquidarRepartidorDto } from './dto/liquidar.dto';
import { HistorialCierresDto } from './dto/historial.dto';
import {
  ClaveDigitalCierre,
  calcularTotalConteo,
  pagadosSinCobroDelDia,
  rangoDiaCaja,
  sumarDevolucionesDigitales,
} from './cierre.util';
import { nombresDePartes, salidaDevolucion } from '../pedidos-admin/devolucion-pedido.util';
import { sumarAjustesCambioDigitales } from '../pedidos-admin/cambio-ubicacion.util';
import { cerrarValidarPagoDePedido } from '../chatbot/conversacion/validar-pago-salida.util';
import { detallarVentasTurno, idsDePersonas, nombresDeCobros } from './ventas-turno.util';

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

/** Medios digitales: el cajero no los teclea; su monto sale del sistema o del último ajuste aprobado. */
const CLAVE_DIGITAL = { YAPE: 'yape', PLIN: 'plin', TRANSFERENCIA: 'transferencia', TARJETA: 'tarjeta' } as const;
type ClaveDigital = (typeof CLAVE_DIGITAL)[keyof typeof CLAVE_DIGITAL];
type MedioDigital = keyof typeof CLAVE_DIGITAL;
const MEDIOS_DIGITALES = Object.keys(CLAVE_DIGITAL) as MedioDigital[];

type AjusteMedioFila = {
  id: bigint;
  medio: string;
  monto_sistema: unknown;
  monto_anterior: unknown;
  monto_nuevo: unknown;
  motivo: string;
  por_party_id: bigint;
  autorizado_por_party_id: bigint;
  creado_en: Date;
};

/** Lo que suma el sistema para cada medio digital, en la forma del DTO. */
function digitalesDelSistema(montos: MontosSistema): Record<ClaveDigital, number> {
  return {
    yape: montos.sistemaYape,
    plin: montos.sistemaPlin,
    transferencia: montos.sistemaTransferencia,
    tarjeta: montos.sistemaTarjeta,
  };
}

/** Monto que vale cada medio digital: el del sistema, o el del último ajuste aprobado de ese medio. */
function digitalesAceptados(
  montos: MontosSistema,
  ajustes: Map<string, AjusteMedioFila>,
): Record<ClaveDigital, number> {
  const aceptados = digitalesDelSistema(montos);
  for (const medio of MEDIOS_DIGITALES) {
    const ajuste = ajustes.get(medio);
    if (ajuste) aceptados[CLAVE_DIGITAL[medio]] = Number(ajuste.monto_nuevo);
  }
  return aceptados;
}

/**
 * Montos del cierre: el cobrado por el sistema y, en digitales, ya descontadas las devoluciones del día.
 * `sistemaYape`… son el esperado neto; `digitalesCobrados`/`digitalesDevueltos` son el desglose en pantalla.
 */
type MontosCierre = MontosSistema & {
  digitalesCobrados: Record<ClaveDigitalCierre, number>;
  digitalesDevueltos: Record<ClaveDigitalCierre, number>;
};

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
    @Optional() private readonly puntosService?: PuntosService,
    @Optional() private readonly impresion?: ImpresionService,
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
   * Montos del cierre de una caja: lo cobrado por medio (caja.calculo.ts) menos las devoluciones digitales
   * (Yape, Plin, transferencia, tarjeta) hechas el día de Lima de la caja. Las de efectivo no se tocan:
   * ya entran como egreso en calcularMontosCaja.
   */
  private async montosCierre(
    cliente: ClienteCaja & Pick<Prisma.TransactionClient, 'devolucionPedido' | 'pedidoCambioUbicacion'>,
    caja: { id: bigint; fecha: Date; apertura: unknown },
  ): Promise<MontosCierre> {
    const montos = await calcularMontosCaja(cliente, caja);
    const { inicio, fin } = rangoDiaCaja(caja.fecha);
    const filas = await cliente.devolucionPedido.findMany({
      where: { creado_en: { gte: inicio, lt: fin } },
      select: { medio: true, monto_devuelto: true, creado_en: true },
    });
    const devueltos = sumarDevolucionesDigitales(filas, inicio, fin);
    // Saldos cobrados y devoluciones de cambio de ubicación resueltos hoy (digital; el efectivo ya es movimiento de caja)
    const ajustes = await cliente.pedidoCambioUbicacion.findMany({
      where: { ajuste_en: { gte: inicio, lt: fin }, ajuste_estado: { in: ['COBRADO', 'DEVUELTO'] } },
      select: { ajuste_tipo: true, ajuste_estado: true, ajuste_medio: true, ajuste_monto: true, ajuste_en: true },
    });
    const ajustesDig = sumarAjustesCambioDigitales(ajustes, inicio, fin);
    const cobrados = {
      yape: montos.sistemaYape + ajustesDig.cobrados.yape,
      plin: montos.sistemaPlin + ajustesDig.cobrados.plin,
      transferencia: montos.sistemaTransferencia + ajustesDig.cobrados.transferencia,
      tarjeta: montos.sistemaTarjeta + ajustesDig.cobrados.tarjeta,
    };
    for (const k of ['yape', 'plin', 'transferencia', 'tarjeta'] as const) {
      devueltos[k] = enPesos(aCentimos(devueltos[k]) + aCentimos(ajustesDig.devueltos[k]));
    }
    const neto = (clave: ClaveDigitalCierre) => enPesos(aCentimos(cobrados[clave]) - aCentimos(devueltos[clave]));
    return {
      ...montos,
      sistemaYape: neto('yape'),
      sistemaPlin: neto('plin'),
      sistemaTransferencia: neto('transferencia'),
      sistemaTarjeta: neto('tarjeta'),
      digitalesCobrados: cobrados,
      digitalesDevueltos: devueltos,
    };
  }

  /**
   * Calcula los montos esperados por el sistema para una caja dada (ver caja.calculo.ts).
   */
  async calcularMontosSistema(cajaId: bigint): Promise<MontosCierre> {
    const caja = await this.prisma.caja.findUnique({
      where: { id: cajaId },
    });
    if (!caja) {
      throw new NotFoundException('Caja no encontrada');
    }
    return this.montosCierre(this.prisma, caja);
  }

  /** Último ajuste aprobado de cada medio en la caja (el que vale). */
  private async ajustesVigentes(cliente: Pick<Prisma.TransactionClient, 'cierreAjusteMedio'>, cajaId: bigint) {
    const filas: AjusteMedioFila[] = await cliente.cierreAjusteMedio.findMany({
      where: { caja_id: cajaId },
      orderBy: { id: 'asc' },
    });
    const ultimo = new Map<string, AjusteMedioFila>();
    for (const f of filas) ultimo.set(f.medio, f);
    return ultimo;
  }

  /** Cuántos cobros vigentes de la caja llevan un pago en cada medio digital. */
  private async cobrosPorMedio(cajaId: bigint): Promise<Record<ClaveDigital, number>> {
    const cobros = await this.prisma.cobro.findMany({
      where: { caja_id: cajaId, anulado_en: null },
      include: { pagos: true },
    });
    const cuenta: Record<ClaveDigital, number> = { yape: 0, plin: 0, transferencia: 0, tarjeta: 0 };
    for (const c of cobros) {
      const medios = new Set(c.pagos.map((p) => (p.medio || '').trim().toUpperCase()));
      for (const m of MEDIOS_DIGITALES) {
        if (medios.has(m)) cuenta[CLAVE_DIGITAL[m]] += 1;
      }
    }
    return cuenta;
  }

  /**
   * Los 4 montos digitales de la caja abierta (de cualquier día) para el cajero. NUNCA efectivo,
   * esperado ni diferencias: el cierre ciego del efectivo se mantiene (DT-61).
   */
  async obtenerDigitales() {
    const caja = await this.obtenerCajaAbierta();
    const montos = await this.montosCierre(this.prisma, caja);
    const ajustes = await this.ajustesVigentes(this.prisma, caja.id);
    const aceptados = digitalesAceptados(montos, ajustes);
    const delSistema = digitalesDelSistema(montos);
    const cobros = await this.cobrosPorMedio(caja.id);
    return {
      cajaId: Number(caja.id),
      fecha: caja.fecha,
      medios: Object.fromEntries(
        MEDIOS_DIGITALES.map((m) => {
          const clave = CLAVE_DIGITAL[m];
          const devuelto = montos.digitalesDevueltos[clave];
          return [
            clave,
            {
              monto: aceptados[clave],
              // sistema = esperado digital: cobrado menos devoluciones del día (negativo en pantalla)
              sistema: delSistema[clave],
              cobrado: montos.digitalesCobrados[clave],
              devuelto: devuelto === 0 ? 0 : -devuelto,
              cobros: cobros[clave],
              corregido: ajustes.has(m),
            },
          ];
        }),
      ),
    };
  }

  /**
   * Devoluciones de pedidos del día de Lima de la caja abierta. Las digitales ya se descuentan del
   * esperado digital (montosCierre); las de efectivo salen como egreso de caja.
   */
  async listarDevolucionesTurno() {
    const caja = await this.obtenerCajaAbierta();
    const { inicio, fin } = rangoDiaCaja(caja.fecha);
    const filas = await this.prisma.devolucionPedido.findMany({
      where: { creado_en: { gte: inicio, lt: fin } },
      include: { pedido: { select: { codigo: true } } },
      orderBy: { id: 'asc' },
    });
    const nombres = await nombresDePartes(
      this.prisma,
      filas.flatMap((f) => [f.por_party_id, f.autorizado_por_party_id]),
    );
    return filas.map((f) => ({
      ...salidaDevolucion(f, nombres),
      pedidoCodigo: f.pedido.codigo,
      codigoOperacion: f.codigo_operacion,
    }));
  }

  /** Correcciones de montos digitales de la caja abierta, en orden de registro. */
  async listarAjustesMedio() {
    const caja = await this.obtenerCajaAbierta();
    const filas = await this.prisma.cierreAjusteMedio.findMany({
      where: { caja_id: caja.id },
      orderBy: { id: 'asc' },
    });
    return this.mapearAjustes(filas);
  }

  /** Forma de salida de los ajustes: nombres de quien lo hizo y de quien lo autorizó, no IDs. */
  private async mapearAjustes(filas: AjusteMedioFila[]) {
    const nombres = await this.nombresDePartes(
      filas.flatMap((f) => [f.por_party_id, f.autorizado_por_party_id]),
    );
    return filas.map((f) => ({
      id: Number(f.id),
      medio: f.medio,
      montoSistema: Number(f.monto_sistema),
      montoAnterior: Number(f.monto_anterior),
      montoNuevo: Number(f.monto_nuevo),
      motivo: f.motivo,
      porNombre: nombres.get(String(f.por_party_id)) ?? null,
      autorizadoPorNombre: nombres.get(String(f.autorizado_por_party_id)) ?? null,
      creadoEn: f.creado_en,
    }));
  }

  /**
   * Corrige el monto de un medio digital de la caja abierta. Excepción, no camino normal: exige motivo
   * y queda auditado a nombre de quien lo hace.
   * Solo se inserta un registro; el valor corregido es el que usa el arqueo y el cierre.
   */
  async registrarAjusteMedio(
    dto: AjusteMedioDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const motivo = (dto.motivo ?? '').trim();
    if (motivo.length < 10) {
      throw new HttpException(
        { codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo del cambio (al menos 10 caracteres).' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!esCentimosValidos(dto.montoNuevo)) {
      throw new HttpException(
        { codigo: 'MONTO_INVALIDO', mensaje: 'El monto admite como máximo dos decimales.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const cajaAbierta = await this.obtenerCajaAbierta();
    const clave = CLAVE_DIGITAL[dto.medio];

    const { fila } = await this.prisma.$transaction(async (tx) => {
      const caja = await this.bloquearCajaAbierta(tx, cajaAbierta.id);

      const montos = await this.montosCierre(tx, caja);
      const ajustes = await this.ajustesVigentes(tx, caja.id);
      const anterior = digitalesAceptados(montos, ajustes)[clave];
      if (aCentimos(anterior) === aCentimos(dto.montoNuevo)) {
        throw new HttpException(
          { codigo: 'AJUSTE_SIN_CAMBIO', mensaje: 'El monto nuevo es igual al que ya vale en el cierre.' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const creada = await tx.cierreAjusteMedio.create({
        data: {
          caja_id: caja.id,
          medio: dto.medio,
          monto_sistema: digitalesDelSistema(montos)[clave],
          monto_anterior: anterior,
          monto_nuevo: enPesos(aCentimos(dto.montoNuevo)),
          motivo,
          por_party_id: usuario.partyId,
          autorizado_por_party_id: usuario.partyId,
        },
      });
      return { fila: creada };
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cierre',
      accion: 'AJUSTE_MEDIO_DIGITAL',
      resultado: 'OK',
      entidad: 'cierre_ajuste_medio',
      entidadId: fila.id,
      antes: { medio: dto.medio, monto: Number(fila.monto_anterior) },
      despues: {
        medio: dto.medio,
        montoSistema: Number(fila.monto_sistema),
        montoNuevo: Number(fila.monto_nuevo),
        motivo,
        autorizadoPor: String(usuario.partyId),
      },
      motivo,
      partyId: usuario.partyId,
      ip,
    });

    const [salida] = await this.mapearAjustes([fila]);
    return salida;
  }

  /**
   * Arqueo ciego: registra el conteo físico por denominación y medios digitales.
   * La respuesta NUNCA entrega los montos esperados ni las diferencias (DT-61).
   */
  async arqueo(
    dto: ArqueoDto,
    usuario: UsuarioAutenticado,
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

      const montos = await this.montosCierre(tx, caja);
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
   * Exige que no haya cobros en curso ni repartidores sin liquidar.
   * NO se bloquea por diferencia: si no cuadra, se cierra igual y la nota explicativa es opcional.
   */
  async cerrar(
    dto: CerrarCajaDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const cajaAbierta = await this.obtenerCajaAbierta();

    let pagosSinCobro: string[] = [];
    let entregadosJustificados: string[] = [];
    let sinTerminarJustificados: string[] = [];
    let cobrosEnCursoJustificados = 0;
    const cierre = await this.prisma.$transaction(async (tx) => {
      const caja = await this.bloquearCajaAbierta(tx, cajaAbierta.id);

      // 1. No puede haber cobros en curso ni pedidos pendientes de confirmación.
      // Un entregado sin cobrar ya justificado por el ADMIN (sin_cobro_justificado_en) no vuelve a bloquear.
      const cobrosEnCurso = await tx.pedido.count({
        where: {
          pago_estado: { in: ['PENDIENTE', 'COORDINADO'] },
          // Un pedido PROGRAMADO (para otro día) aún no es venta del día: no bloquea ni descuadra el cierre.
          // Lo ya adelantado entra por pedido_adelanto en la caja del día en que se recibió.
          estado: { notIn: ['ANULADO', 'PROGRAMADO'] },
          sin_cobro_justificado_en: null,
        },
      });

      if (cobrosEnCurso > 0) {
        // Entregados sin cobrar de Para llevar / Recoger / Delivery digital: se cobran, se anulan o el ADMIN los justifica
        const entregados = await tx.pedido.findMany({
          where: { pago_estado: { in: ['PENDIENTE', 'COORDINADO'] }, estado: 'ENTREGADO', sin_cobro_justificado_en: null },
          select: { id: true, codigo: true, modalidad: true, pago_estado: true, pago_metodo: true, es_personal: true, total: true, monto_credito: true, adelanto_total: true, planPago: { select: { medio: true, monto: true } } },
          orderBy: { creado_en: 'asc' },
        });
        const sinCobrar = entregados.filter((p: any) => pedidoDebeEstarCobrado(p));
        const lista = sinCobrar.map((p: any) => ({ id: Number(p.id), codigo: p.codigo, modalidad: p.modalidad, pagoEstado: p.pago_estado, total: montoACobrar(p) }));
        const esAdmin = tieneRol(usuario, 'ADMIN');
        const enCurso = cobrosEnCurso - sinCobrar.length;
        if (enCurso > 0) {
          // Cobros en curso (pedido vivo sin entregar): solo el ADMIN cierra igual, con un motivo que queda en auditoría y en el cierre
          const motivoCurso = (dto.motivoCobrosEnCurso ?? '').trim();
          if (!esAdmin || motivoCurso.length < MOTIVO_SIN_COBRO_MIN) {
            throw new HttpException(
              {
                codigo: 'COBROS_EN_CURSO',
                mensaje:
                  `No se puede cerrar la caja: hay ${enCurso} pedido(s) con cobro en curso o por confirmar.` +
                  (esAdmin
                    ? ' Como administrador puedes cerrar escribiendo un motivo (mínimo 10 letras).'
                    : ' Solo el administrador puede cerrar con cobros en curso, escribiendo un motivo.'),
                ...(lista.length ? { entregadosSinCobrar: lista } : {}),
                puedeJustificar: esAdmin,
              },
              HttpStatus.CONFLICT,
            );
          }
          cobrosEnCursoJustificados = enCurso;
        }
        if (lista.length > 0) {
          // Solo el ADMIN puede cerrar con entregados sin cobrar, con un motivo (queda auditado)
          const motivo = (dto.motivoEntregadosSinCobrar ?? '').trim();
          if (!esAdmin || motivo.length < MOTIVO_SIN_COBRO_MIN) {
            throw new HttpException(
              {
                codigo: 'ENTREGADOS_SIN_COBRAR',
                mensaje:
                  `No se puede cerrar la caja: hay ${lista.length} pedido(s) entregados sin cobrar. Cóbralos o anúlalos.` +
                  (esAdmin ? ' Como administrador puedes cerrar escribiendo un motivo (mínimo 10 letras).' : ''),
                entregadosSinCobrar: lista,
                puedeJustificar: esAdmin,
              },
              HttpStatus.CONFLICT,
            );
          }
          entregadosJustificados = lista.map((p) => `${p.codigo} S/ ${p.total.toFixed(2)}`);
          // Justificado una vez: queda marcado y sigue visible en «Justificados pendientes» hasta cobrarlo o anularlo
          await tx.pedido.updateMany({ where: { id: { in: lista.map((p) => BigInt(p.id)) } }, data: { sin_cobro_justificado_en: new Date() } });
        }
      }

      // 1b. Ningún pedido sin terminar (ni pagado): todo debe quedar ENTREGADO o ANULADO. Solo el ADMIN justifica.
      const sinTerminar = await this.pedidosSinTerminar(tx);
      if (sinTerminar.length > 0) {
        const esAdminST = tieneRol(usuario, 'ADMIN');
        const motivoST = (dto.motivoPedidosSinTerminar ?? '').trim();
        if (!esAdminST || motivoST.length < MOTIVO_SIN_COBRO_MIN) {
          throw new HttpException(
            {
              codigo: 'PEDIDOS_SIN_TERMINAR',
              mensaje:
                `No se puede cerrar la caja: hay ${sinTerminar.length} pedido(s) sin terminar (no están entregados ni anulados). Entrégalos o anúlalos.` +
                (esAdminST ? ' Como administrador puedes cerrar escribiendo un motivo (mínimo 10 letras).' : ''),
              pedidosSinTerminar: sinTerminar,
              puedeJustificar: esAdminST,
            },
            HttpStatus.CONFLICT,
          );
        }
        sinTerminarJustificados = sinTerminar.map((p) => `${p.codigo} ${p.estado} S/ ${p.total.toFixed(2)}`);
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

      // 3. Conteo y medios: lo que trae el cierre. El arqueo previo (si existe) es solo informativo:
      // no cuenta intentos ni bloquea. El efectivo viene por denominación (conteo) o como total directo.
      const conteo: Record<string, number> = { ...(dto.conteo ?? {}) };
      const hayConteo = Object.keys(conteo).length > 0;
      const totalDirecto = dto.efectivoTotal;
      if (totalDirecto !== undefined && totalDirecto !== null && !esCentimosValidos(totalDirecto)) {
        throw new HttpException(
          { codigo: 'MONTO_INVALIDO', mensaje: 'El efectivo total admite como máximo dos decimales.' },
          HttpStatus.BAD_REQUEST,
        );
      }
      const usaTotalDirecto = !hayConteo && totalDirecto !== undefined && totalDirecto !== null;
      if (usaTotalDirecto) conteo['total_directo'] = totalDirecto;

      const montos = await this.montosCierre(tx, caja);
      // Digitales: lo que el usuario vio en su app o POS. Si no lo escribió, vale el del sistema (o su última
      // corrección aprobada): ese medio queda sin diferencia. Un monto distinto ya no bloquea: queda como diferencia.
      const aceptados = digitalesAceptados(montos, await this.ajustesVigentes(tx, caja.id));
      const visto = (clave: ClaveDigital) => {
        const enviado = dto.medios?.[clave];
        return enviado === undefined || enviado === null ? aceptados[clave] : Number(enviado);
      };
      for (const clave of Object.values(CLAVE_DIGITAL)) {
        if (!esCentimosValidos(visto(clave))) {
          throw new HttpException(
            { codigo: 'MONTO_INVALIDO', mensaje: 'Los montos admiten como máximo dos decimales.' },
            HttpStatus.BAD_REQUEST,
          );
        }
      }
      const vistos = {
        efectivo: usaTotalDirecto ? Number(totalDirecto) : calcularTotalConteo(conteo),
        yape: visto('yape'),
        plin: visto('plin'),
        transferencia: visto('transferencia'),
        tarjeta: visto('tarjeta'),
      };
      // El resultado se guarda tal cual (CUADRA / NO_CUADRA) para auditoría y reportes; la diferencia NUNCA bloquea.
      const comparacion = compararConSistema(vistos, montos);
      const { resultado } = comparacion;

      // Dinero pagado que no pasó por «cobrar» (confirmaciones de antes de esta versión): no se cierra a ciegas.
      // No bloquea (Caja no tiene cómo cobrarlo de nuevo; lo regulariza el administrador con «conciliar-cobros»),
      // pero exige la nota y deja los pedidos escritos en la auditoría del cierre.
      const { inicio: dIni, fin: dFin } = rangoDiaCaja(new Date(caja.fecha));
      const sinCobro = await pagadosSinCobroDelDia(tx, { gte: dIni, lt: dFin });
      if (sinCobro.length > 0 && (!dto.nota || dto.nota.trim().length < 3)) {
        throw new HttpException(
          {
            codigo: 'PAGOS_SIN_COBRO',
            mensaje: `Hay ${sinCobro.length} pedido(s) pagados sin cobro en caja (${sinCobro.map((p: any) => p.codigo).join(', ')}). Su dinero no suma en este cierre: escribe una nota para cerrar y avisa al administrador.`,
            pedidos: sinCobro.map((p: any) => ({ codigo: p.codigo, total: montoACobrar(p), medio: p.pago_metodo })),
          },
          HttpStatus.CONFLICT,
        );
      }
      pagosSinCobro = sinCobro.map((p: any) => `${p.codigo} S/ ${montoACobrar(p).toFixed(2)} ${p.pago_metodo ?? ''}`.trim());

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
          nota: [dto.nota?.trim(), cobrosEnCursoJustificados > 0 ? `Cerrado con ${cobrosEnCursoJustificados} cobro(s) en curso. Motivo del administrador: ${dto.motivoCobrosEnCurso?.trim()}` : '']
            .filter(Boolean)
            .join(' | ') || null,
          // La BD exige quién respondió por un cierre NO_CUADRA (ck_cierre_caja_aprobacion): aquí es quien cierra,
          // no una aprobación de supervisor (el cierre con diferencia ya no pide aprobación).
          aprobado_por: resultado === 'NO_CUADRA' ? usuario.partyId : null,
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

      return { caja, resultado, mediosData, diferenciaTotal: enPesos(mediosData.reduce((t, m) => t + aCentimos(m.diferencia), 0)) };
    });

    const { caja, resultado, mediosData, diferenciaTotal } = cierre;

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cierre',
      accion: 'CERRAR_CAJA',
      resultado: 'OK',
      entidad: 'cierre_caja',
      entidadId: caja.id,
      despues: {
        resultado,
        diferenciaTotal,
        nota: dto.nota?.trim() || null,
        ...(pagosSinCobro.length ? { pagos_sin_cobro: pagosSinCobro } : {}),
      },
      partyId: usuario.partyId,
      ip,
    });
    if (entregadosJustificados.length) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'cierre',
        accion: 'CIERRE_ENTREGADOS_SIN_COBRO',
        resultado: 'OK',
        entidad: 'cierre_caja',
        entidadId: caja.id,
        despues: { pedidos: entregadosJustificados, forzadoPorAdministrador: true },
        motivo: dto.motivoEntregadosSinCobrar?.trim(),
        partyId: usuario.partyId,
        ip,
      });
    }

    if (cobrosEnCursoJustificados > 0) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'cierre',
        accion: 'CIERRE_COBROS_EN_CURSO',
        resultado: 'OK',
        entidad: 'cierre_caja',
        entidadId: caja.id,
        despues: { pedidos: cobrosEnCursoJustificados, forzadoPorAdministrador: true },
        motivo: dto.motivoCobrosEnCurso?.trim(),
        partyId: usuario.partyId,
        ip,
      });
    }

    if (sinTerminarJustificados.length) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'cierre',
        accion: 'CIERRE_PEDIDOS_SIN_TERMINAR',
        resultado: 'OK',
        entidad: 'cierre_caja',
        entidadId: caja.id,
        despues: { pedidos: sinTerminarJustificados, forzadoPorAdministrador: true },
        motivo: dto.motivoPedidosSinTerminar?.trim(),
        partyId: usuario.partyId,
        ip,
      });
    }

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
      nota: dto.nota?.trim() || null,
      diferenciaTotal,
      // Quien cierra ve el esperado y la diferencia: el conteo a ciegas ya no se usa
      medios: mediosData,
    };
  }

  /**
   * Montos esperados por el sistema y el turno (cobros y movimientos) de la caja ABIERTA, sea del día que sea.
   * Lo ve quien cierra la caja (permiso caja/ver), sin código: el conteo a ciegas ya no se usa.
   */
  async obtenerEsperado(_usuario?: UsuarioAutenticado) {
    const caja = await this.obtenerCajaAbierta();
    const montos = await this.calcularMontosSistema(caja.id);
    // Mismos cobros y movimientos que la caja de hoy, pero de la caja que se cierra: totales y listas cuadran
    const cobros = await this.prisma.cobro.findMany({
      where: { caja_id: caja.id },
      include: {
        pagos: true,
        pedido: {
          select: {
            codigo: true,
            cliente_nombre: true,
            // Solo para el detalle de ventas del cierre (no entra en ningún cálculo)
            modalidad: true,
            canal: true,
            estado: true,
            mesa_nombre: true,
            creado_en: true,
            party_id: true,
            repartidor_party_id: true,
            cobro_mozo_party_id: true,
            lineas: { select: { producto: { select: { categoria: { select: { nombre: true } } } } } },
            comprobante: { select: { tipo: true, numero_texto: true, facturacion_estado: true, emision: true, anulado_en: true } },
          },
        },
      },
    });
    const movimientos = await this.prisma.movimientoCaja.findMany({
      where: { caja_id: caja.id },
      orderBy: { id: 'asc' },
    });
    // Nombres para el detalle: si falla, el cierre sigue igual y el detalle sale sin nombres
    let nombres = new Map<string, string>();
    try {
      nombres = await nombresDeCobros(this.prisma, idsDePersonas(cobros as any));
    } catch {
      nombres = new Map();
    }

    // Vueltos entregados en efectivo (informativo: el monto cobrado ya es neto de vuelto)
    const vueltos = cobros
      .filter((c) => !c.anulado_en)
      .flatMap((c) => c.pagos)
      .filter((p) => (p.medio || '').trim().toUpperCase() === 'EFECTIVO')
      .reduce((t, p) => t + aCentimos((p as { vuelto?: unknown }).vuelto), 0);

    return {
      cajaId: Number(caja.id),
      fecha: caja.fecha,
      cobrados: mapearCobrosCaja(cobros),
      // Detalle de cada venta (quién, tipo, categoría, repartidor…): aditivo, se une por pedidoId
      ventas: detallarVentasTurno(cobros as any, nombres),
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
        // Propinas del día: aparte de las ventas (no son ingreso). Efectivo y digital ya están en medios.
        propinas: {
          total: enPesos(aCentimos(montos.propinasEfectivo) + aCentimos(montos.propinasDigitales)),
          efectivo: montos.propinasEfectivo,
          digital: montos.propinasDigitales,
        },
        ingresos: montos.ingresos,
        egresos: montos.egresos,
        liquidadoRepartidores: montos.liquidadoEfectivo,
        // Efectivo en lenguaje llano: apertura + cobros en efectivo (con propinas, ya netos de vuelto)
        // + efectivo de repartidores + ingresos − egresos = esperado
        apertura: Number(caja.apertura),
        cobrosEfectivo: enPesos(aCentimos(montos.ventasEfectivo) + aCentimos(montos.propinasEfectivo)),
        vueltos: enPesos(vueltos),
        esperado: montos.esperadoEfectivo,
        porMedio: {
          efectivo: montos.esperadoEfectivo,
          yape: montos.sistemaYape,
          plin: montos.sistemaPlin,
          transferencia: montos.sistemaTransferencia,
          tarjeta: montos.sistemaTarjeta,
        },
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

    const ajustes = await this.mapearAjustes(
      await this.prisma.cierreAjusteMedio.findMany({ where: { caja_id: cierre.caja_id }, orderBy: { id: 'asc' } }),
    );
    const [conteos, movimientos, liquidaciones, cobrosAnulados, local] = await Promise.all([
      this.prisma.conteoCierre.findMany({ where: { caja_id: cierre.caja_id }, orderBy: { intento: 'asc' } }),
      this.prisma.movimientoCaja.findMany({ where: { caja_id: cierre.caja_id }, orderBy: { id: 'asc' } }),
      this.prisma.liquidacion.findMany({ where: { caja_id: cierre.caja_id }, orderBy: { id: 'asc' } }),
      this.prisma.cobro.findMany({
        where: { caja_id: cierre.caja_id, anulado_en: { not: null } },
        include: { pedido: { select: { codigo: true } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }).catch(() => null),
    ]);
    const ids: bigint[] = [
      cierre.caja.abierta_por,
      ...(cierre.caja.cerrada_por ? [cierre.caja.cerrada_por] : []),
      ...(cierre.aprobado_por ? [cierre.aprobado_por] : []),
      ...conteos.map((c) => c.por),
      ...liquidaciones.map((l) => l.repartidor_party_id),
      ...cobrosAnulados.flatMap((c) => (c.anulado_por ? [c.anulado_por] : [])),
    ];
    const nombres = await this.nombresDePartes(ids);
    const ticket = armarTicketCierre({
      localNombre: ((local?.valor as any)?.nombre as string) || 'Caprichos',
      caja: cierre.caja,
      cierre,
      conteos,
      movimientos,
      ajustes,
      liquidaciones,
      cobrosAnulados,
      nombre: (id) => (id == null ? null : (nombres.get(String(id)) ?? null)),
    });

    return {
      cajaId: Number(cierre.caja_id),
      fecha: cierre.caja.fecha,
      apertura: Number(cierre.caja.apertura),
      resultado: cierre.resultado,
      aprobadoPor: cierre.aprobado_por ? Number(cierre.aprobado_por) : null,
      nota: cierre.nota,
      cerradaPor: cierre.caja.cerrada_por ? Number(cierre.caja.cerrada_por) : null,
      cerradaPorNombre: cierre.caja.cerrada_por ? (nombres.get(String(cierre.caja.cerrada_por)) ?? null) : null,
      cerradaEn: cierre.caja.cerrada_en,
      conteo: cierre.conteo,
      medios: cierre.medios.map((m) => ({
        medio: m.medio,
        sistema: Number(m.sistema),
        visto: Number(m.visto),
        diferencia: m.diferencia !== null ? Number(m.diferencia) : null,
      })),
      ajustesMedio: ajustes,
      ticket,
    };
  }

  /** Encola el ticket de cierre de una caja ya cerrada en la ticketera de Caja. Solo administrador. */
  async imprimirCierre(id: bigint | number | string, usuario: UsuarioAutenticado, ip?: string) {
    exigirAdmin(usuario, 'Solo el administrador puede imprimir un cierre.');
    if (!this.impresion) {
      throw new HttpException({ codigo: 'IMPRESION_NO_DISPONIBLE', mensaje: 'La impresión no está disponible.' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const detalle = await this.obtenerCierrePorId(id, usuario);
    return this.impresion.encolarTicketCierre(BigInt(detalle.cajaId), detalle.ticket, usuario, ip);
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
      // Si siguieran PENDIENTE o COORDINADO (p. ej. pago dividido con Yape validado y efectivo contraentrega)
      // bloquearían el cierre, y cobrarlos después contaría el efectivo dos veces.
      const pedidosIds = (info?.pedidos ?? []).map((p) => BigInt(p.id));
      // Marca liquidado: en una caja posterior no vuelve a contar (el contra entrega de otro día se liquida una sola vez)
      await tx.pedido.updateMany({ where: { id: { in: pedidosIds }, liquidado_en: null }, data: { liquidado_en: new Date() } });
      // Pago dividido (p. ej. Yape 38 + efectivo 2): el efectivo entra por esta liquidación y la parte digital, que
      // ya validó Caja, se asienta como Cobro digital en esta caja. Sin él el pedido quedaría PAGADO con parte del
      // dinero fuera de caja y ya no se podría cobrar. La liquidación no cambia (ver efectivoDelRepartidor).
      const porAsentar = await tx.pedido.findMany({
        where: { id: { in: pedidosIds }, pago_estado: { in: ['PENDIENTE', 'COORDINADO'] }, cobros: { none: { anulado_en: null } } },
        include: { planPago: true },
      });
      for (const ped of porAsentar) {
        const digitales = (ped.planPago ?? []).filter((f) => f.medio !== 'EFECTIVO' && aCentimos(f.monto) > 0);
        if (digitales.length === 0) continue;
        await tx.cobro.create({
          data: {
            pedido_id: ped.id,
            caja_id: caja.id,
            total: enPesos(digitales.reduce((a, f) => a + aCentimos(f.monto), 0)),
            credito_personal: false,
            cobrado_por: BigInt(usuario.partyId),
            pagos: {
              create: digitales.map((f) => ({ medio: String(f.medio).toUpperCase(), monto: enPesos(aCentimos(f.monto)), propina: 0 })),
            },
          },
        });
      }
      await tx.pedido.updateMany({
        where: { id: { in: pedidosIds }, pago_estado: { in: ['PENDIENTE', 'COORDINADO'] } },
        data: { pago_estado: 'PAGADO' },
      });

      return { liquidacion: liq, esperado: pendiente, entregado: entregadoCentimos, pedidosIds };
    });

    // el contra entrega se cobra aquí y no pasa por Caja → cobrar: suma los puntos del cliente
    // (idempotente; si falla no deshace la liquidación)
    for (const id of pedidosIds) {
      await cerrarValidarPagoDePedido(this.prisma, id, 'el repartidor cobró el pedido', this.eventosGateway);
      try {
        await this.puntosService?.acumularPorPedido(id);
      } catch {
        // sin puntos no se detiene la liquidación
      }
      // el pedido no pasó por el cobro de Caja: sus insumos por receta se descuentan aquí (idempotente)
      await this.cobrosService.descontarInsumosSinCobro(id);
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
   */
  /**
   * Pedidos de cualquier día que no están en estado final (ENTREGADO o ANULADO), pagados o no.
   * Bloquean el cierre (PEDIDOS_SIN_TERMINAR). Sin teléfono ni DNI.
   */
  async pedidosSinTerminar(db: any = this.prisma) {
    const pedidos = await db.pedido.findMany({
      where: { estado: { notIn: ['ENTREGADO', 'ANULADO', 'PROGRAMADO'] } },
      orderBy: { creado_en: 'asc' },
      select: { id: true, codigo: true, canal: true, modalidad: true, estado: true, pago_estado: true, total: true, creado_en: true, cliente_nombre: true },
    });
    return ((pedidos ?? []) as any[]).map((p) => ({
      id: Number(p.id),
      codigo: p.codigo as string,
      canal: p.canal as string,
      modalidad: p.modalidad as string,
      estado: p.estado as string,
      pagoEstado: (p.pago_estado ?? null) as string | null,
      clienteNombre: (p.cliente_nombre?.trim() || null) as string | null,
      total: enPesos(aCentimos(p.total)),
      fecha: p.creado_en as Date,
    }));
  }

  /** `justificados`: la lista aparte de los entregados sin cobrar que el ADMIN ya justificó (no bloquean el cierre). */
  async listarPendientesDeCobro(justificados = false) {
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        pago_estado: { in: ['PENDIENTE', 'COORDINADO'] },
        estado: { notIn: ['ANULADO', 'PROGRAMADO'] },
        cobros: { none: { anulado_en: null } },
        sin_cobro_justificado_en: justificados ? { not: null } : null,
      },
      orderBy: { creado_en: 'asc' },
      select: {
        id: true,
        codigo: true,
        canal: true,
        modalidad: true,
        estado: true,
        total: true,
        monto_credito: true, adelanto_total: true,
        creado_en: true,
        pago_estado: true,
        cliente_nombre: true,
      },
    });

    // Crédito del personal + delivery sin envío por cobrar (gratis o por confirmar): no hay nada pendiente de cobro
    return pedidos.filter((p) => !(Number(p.monto_credito) > 0 && montoACobrar(p) <= 0)).map((p) => ({
      id: Number(p.id),
      codigo: p.codigo,
      canal: p.canal,
      modalidad: p.modalidad,
      estado: p.estado,
      pagoEstado: p.pago_estado,
      // Solo el nombre para reconocer el pedido; nunca teléfono ni DNI
      clienteNombre: p.cliente_nombre?.trim() || null,
      total: montoACobrar(p),
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

  /**
   * Efectivo cobrado por repartidor en la caja (en céntimos): cobrado, liquidado y pendiente.
   * Los pedidos se filtran por el día de la caja (hora de Lima) y las liquidaciones por caja.
   */
  private async repartidoresConEfectivo(cliente: ClienteCaja, caja: { id: bigint; fecha: Date }) {
    const fechaIso = new Date(caja.fecha).toISOString().slice(0, 10);
    const pedidos = await pedidosRepartoDelDia(cliente, fechaIso, true);

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
