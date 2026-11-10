import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { mediosDigitalesDelPedido, montoDigitalDePlan } from './pago-plan.service';
import { obtenerFechaHoraLima } from '../local/local.util';
import { generarTokenSeguimiento, verificarTokenSeguimiento } from './seguimiento.tokens';
import { ContextoProgreso, progresoDelPedido, ProgresoPedido } from './progreso-pedido';
import {
  calcularEtaEntrega,
  CONFIG_ETA_DEFECTO,
  ConfigEta,
  leerConfigEta,
  RangoEta,
  restanteEnCamino,
} from '../repartos/eta-entrega';

/** Medios que requieren captura del comprobante (mismo criterio que Caja). */
const MEDIOS_DIGITALES = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

type Modalidad = 'DELIVERY' | 'RECOGER' | 'MESA' | 'COMER_LOCAL';

// Rango de cada estado del flujo: COLA < PREPARANDO < LISTO < EN_CAMINO < ENTREGADO
const RANGO_ESTADO: Record<string, number> = {
  COLA: 0,
  PREPARANDO: 1,
  LISTO: 2,
  EN_CAMINO: 3,
  ENTREGADO: 4,
};

const ETIQUETA_ESTADO: Record<string, string> = {
  COLA: 'En cola',
  PREPARANDO: 'En preparación',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
};

interface PasoDef {
  clave: string;
  etiqueta: string;
  rango: number;
  campo: 'creado_en' | 'pasa_cocina_en' | 'listo_en' | 'despachado_en' | 'llego_en' | 'entregado_en';
  estadosHistorial: string[];
}

const PASO_RECIBIDO: PasoDef = {
  clave: 'recibido',
  etiqueta: 'Pedido recibido',
  rango: 0,
  campo: 'creado_en',
  estadosHistorial: [],
};
const PASO_COCINA: PasoDef = {
  clave: 'cocina',
  etiqueta: 'En preparación',
  rango: 1,
  campo: 'pasa_cocina_en',
  estadosHistorial: ['PREPARANDO', 'LISTO'],
};
const pasoListo = (etiqueta: string): PasoDef => ({ clave: 'listo', etiqueta, rango: 2, campo: 'listo_en', estadosHistorial: ['LISTO'] });
const pasoFinal = (etiqueta: string): PasoDef => ({
  clave: 'entregado',
  etiqueta,
  rango: 4,
  campo: 'entregado_en',
  estadosHistorial: ['ENTREGADO'],
});

// Cada modalidad con sus pasos y sus textos. MESA (mozo/caja) y COMER_LOCAL (carta) comparten los de mesa.
const PASOS_MESA = [PASO_RECIBIDO, PASO_COCINA, pasoListo('Listo para servir'), pasoFinal('Servido en tu mesa')];
const PASOS_POR_MODALIDAD: Record<Modalidad, PasoDef[]> = {
  DELIVERY: [
    PASO_RECIBIDO,
    PASO_COCINA,
    pasoListo('Listo, esperando repartidor'),
    {
      clave: 'camino',
      etiqueta: 'En camino',
      rango: 3,
      campo: 'despachado_en',
      estadosHistorial: ['EN_CAMINO'],
    },
    // «Llegó» depende de llego_en (no de un estado); un pedido entregado sin ese dato también lo da por hecho
    { clave: 'llego', etiqueta: 'Tu repartidor llegó', rango: 3.5, campo: 'llego_en', estadosHistorial: [] },
    pasoFinal('Entregado'),
  ],
  RECOGER: [PASO_RECIBIDO, PASO_COCINA, pasoListo('Listo para recoger'), pasoFinal('Recogido')],
  MESA: PASOS_MESA,
  COMER_LOCAL: PASOS_MESA,
};

export interface PasoSeguimiento {
  clave: string;
  etiqueta: string;
  hecho: boolean;
  actual: boolean;
  hora: string | null;
}

export interface SeguimientoPedido {
  codigo: string;
  estado: string;
  estadoEtiqueta: string;
  modalidad: Modalidad;
  /**
   * Solo «Comer en el local» de la carta: SIN_MESA (se llama por nombre), EN_ESPERA (Caja busca mesa) o
   * ASIGNADA (con `mesa`). La mesa no es dato personal. Aditivo.
   */
  ubicacion?: 'SIN_MESA' | 'EN_ESPERA' | 'ASIGNADA';
  mesa?: string;
  total: number;
  propina?: number;
  terminado: boolean;
  anulado: boolean;
  pasos: PasoSeguimiento[];
  /** Progreso en cocina y entrega (mismo cálculo que «Mis pedidos» del mozo). */
  progreso: ProgresoPedido;
  /** Pago con Yape, Plin o transferencia: la pantalla pide adjuntar la captura. Solo en obtener(). */
  pagoDigital?: boolean;
  /** YAPE, PLIN o TRANSFERENCIA cuando `pagoDigital`: la carta muestra a quién pagar. */
  medioPago?: string;
  /** Pago dividido: lo que se paga por el medio digital (venta + propina). Sin plan no viene y vale el total. */
  montoDigital?: number;
  /** Pago dividido: lo que falta pagar contraentrega o en caja (efectivo o tarjeta). */
  montoContraentrega?: number;
  /**
   * Tiempo que falta (aditivo). Antes de salir: estimado de la zona. En camino: lo prometido al salir
   * menos lo transcurrido. Null cuando el pedido ya está entregado o anulado.
   */
  tiempo?: TiempoSeguimiento | null;
  /** Estado del voucher (aditivo). Solo en obtener() y solo con pago digital; en efectivo no existe. */
  voucher?: VoucherSeguimiento;
  /** Totales de lo que se cobra y cada medio con el estado de su captura (aditivo). Solo en obtener(). */
  resumenPago?: ResumenPago;
  /** Desglose del pedido para la pestaña «Mi pedido» (aditivo). Solo en obtener(). */
  detalle?: DetallePedidoSeguimiento;
}

export interface DetallePedidoSeguimiento {
  subtotal: number;
  descuento: number;
  /** null = por confirmar (delivery sin ubicación aún) */
  envio: number | null;
  puntosCanjeados: number;
  nota: string | null;
  lineas: { nombre: string; cantidad: number; nota: string | null }[];
}

export type EstadoPagoMedio = EstadoVoucherSeguimiento | 'AL_RECIBIR' | 'COBRADO_MOZO' | 'PAGADO';

export interface PagoMedio {
  medio: string;
  monto: number;
  /** Yape, Plin o transferencia: lleva captura */
  digital: boolean;
  estado: EstadoPagoMedio;
  actualizadoEn: string | null;
  motivo?: string;
}

export interface ResumenPago {
  /** Suma de lo ya validado o cobrado */
  pagado: number;
  /** Venta más propina */
  total: number;
  pagos: PagoMedio[];
}

/** Estado del voucher para el invitado: solo el estado y el medio, nunca imagen, operación, montos ni titular. */
export type EstadoVoucherSeguimiento = 'SIN_VOUCHER' | 'EN_REVISION' | 'VERIFICADO' | 'RECHAZADO';

export interface VoucherSeguimiento {
  estado: EstadoVoucherSeguimiento;
  medio: string | null;
  actualizadoEn: string | null;
  /** Motivo corto cuando el voucher no se pudo leer (RECHAZADO). */
  motivo?: string;
}

export interface TiempoSeguimiento {
  min: number;
  max: number;
  enCamino: boolean;
  texto: string;
}

// Área de cada línea (para contar las líneas por área en el progreso): solo ids, nunca nombres de cliente
const SELECCION_AREA_LINEA = {
  area_id: true,
  producto: { select: { categoria: { select: { area_id: true } } } },
};

// Áreas de cocina del pedido y su estado (despejada o no)
const SELECCION_COMANDAS = {
  select: { area_id: true, estado: true, area: { select: { nombre: true } } },
};

// Campos que necesita el seguimiento: nada personal (nombre, teléfono, dirección, coordenadas)
const SELECCION_SEGUIMIENTO = {
  id: true,
  codigo: true,
  estado: true,
  modalidad: true,
  canal: true,
  mesa_nombre: true,
  espera_mesa_desde: true,
  total: true,
  propina: true,
  creado_en: true,
  pasa_cocina_en: true,
  listo_en: true,
  despachado_en: true,
  llego_en: true,
  entregado_en: true,
  entregado_mesa_en: true,
  repartidor_party_id: true,
  eta_min: true,
  eta_max: true,
  entrega_lat: true,
  entrega_lng: true,
  zona: { select: { minutos_min: true, minutos_max: true } },
  lineas: { where: { linea_combo_id: null }, select: { nombre: true, cantidad: true, ...SELECCION_AREA_LINEA } },
  comandas: SELECCION_COMANDAS,
  historial: {
    select: { estado_nuevo: true, en: true },
    orderBy: { en: 'asc' as const },
  },
};

const TAMANO_PAGINA_CUENTA = 10;
const MAX_PRODUCTOS_RESUMEN = 3;

export const MAX_PEDIDOS_LOTE = 20;

export interface PedidoCuenta extends SeguimientoPedido {
  /** Puntos del pedido: ganados, estimados o el motivo por el que no suma */
  puntos: ExplicacionPuntos;
  creadoEn: string;
  resumen: string;
  seguimientoToken: string;
}

type PedidoSeguimiento = {
  id: bigint;
  codigo: string;
  estado: string;
  modalidad: string;
  canal?: string | null;
  mesa_nombre?: string | null;
  espera_mesa_desde?: Date | null;
  total: { toString(): string };
  propina?: { toString(): string } | null;
  creado_en: Date;
  pasa_cocina_en: Date | null;
  listo_en: Date | null;
  despachado_en: Date | null;
  llego_en?: Date | null;
  entregado_en: Date | null;
  eta_min: number | null;
  eta_max: number | null;
  entrega_lat: unknown;
  entrega_lng: unknown;
  zona: { minutos_min: number | null; minutos_max: number | null } | null;
  entregado_mesa_en: Date | null;
  repartidor_party_id: unknown;
  lineas: { nombre: string; cantidad: number; nota?: string | null; area_id?: bigint | null; producto?: { categoria?: { area_id: bigint | null } | null } | null }[];
  comandas: { area_id: bigint; estado: string; area: { nombre: string } }[];
  historial: { estado_nuevo: string; en: Date }[];
};

/** Contexto de cálculo del tiempo: configuración de parámetros y «ahora» (inyectable en pruebas). */
type ContextoTiempo = ContextoProgreso & { cfg: ConfigEta };

const textoRango = (min: number, max: number) =>
  min === max ? `unos ${min} minutos` : `unos ${min} a ${max} minutos`;

import { explicarPedidosPorId } from '../clientes/explicar-puntos-pedidos';
import type { ExplicacionPuntos } from '../clientes/explicar-puntos-pedido';
import { lineasDeCuenta } from './lineas-combo.util';

@Injectable()
export class SeguimientoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Estado del pedido para el invitado de la carta. Solo expone estado, pasos y horas:
   * nunca nombre, teléfono, dirección, referencia ni coordenadas.
   * Token inválido o ausente responde igual que un pedido inexistente.
   */
  async obtener(codigo: string, token: string | undefined): Promise<SeguimientoPedido> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { codigo },
      select: {
        ...SELECCION_SEGUIMIENTO,
        pago_preferido: true,
        pago_estado: true,
        cobro_mozo_en: true,
        subtotal: true,
        descuento: true,
        envio: true,
        puntos_canjeados: true,
        nota: true,
        lineas: {
          where: { linea_combo_id: null },
          orderBy: { id: 'asc' as const },
          select: { nombre: true, cantidad: true, nota: true, ...SELECCION_AREA_LINEA },
        },
        planPago: { select: { medio: true, monto: true }, orderBy: { orden: 'asc' as const } },
      },
    });

    if (!pedido || !verificarTokenSeguimiento(pedido.id, token)) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    const medioPreferido = String(pedido.pago_preferido ?? '').toUpperCase();
    const pagoDigital = MEDIOS_DIGITALES.includes(medioPreferido);
    // Pago dividido: la tarjeta «Paga con Yape» muestra solo la parte digital; el resto se paga al recibir
    const plan = (pedido.planPago ?? []).map((f) => ({ medio: f.medio, monto: Number(f.monto) }));
    const digitales = mediosDigitalesDelPedido(plan, null, 0);
    const montoDigital = digitales.length > 0 ? montoDigitalDePlan(plan) : null;
    const totalCobrable = Math.round((Number(pedido.total) + Number(pedido.propina ?? 0)) * 100) / 100;
    const base = {
      ...this.construir(pedido as PedidoSeguimiento, await this.contexto()),
      pagoDigital,
      ...(pagoDigital ? { medioPago: medioPreferido } : {}),
      ...(pagoDigital && montoDigital !== null
        ? { montoDigital, montoContraentrega: Math.round((totalCobrable - montoDigital) * 100) / 100 }
        : {}),
      detalle: {
        subtotal: Number(pedido.subtotal),
        descuento: Number(pedido.descuento ?? 0),
        envio: pedido.envio == null ? null : Number(pedido.envio),
        puntosCanjeados: Number(pedido.puntos_canjeados ?? 0),
        nota: pedido.nota ?? null,
        lineas: (pedido.lineas ?? []).map((l) => ({ nombre: l.nombre, cantidad: l.cantidad, nota: l.nota ?? null })),
      },
    };

    // Vouchers vigentes del pedido (no reemplazados ni retirados), del más nuevo al más viejo
    const vouchers = pagoDigital || digitales.length > 0
      ? await this.prisma.voucherPago.findMany({
          where: { pedido_id: pedido.id, reemplazado_en: null },
          orderBy: { creado_en: 'desc' },
          select: { medio: true, semaforo: true, motivos: true, creado_en: true, revisado_en: true },
        })
      : [];
    const pagos = pagosDelPedido({
      plan,
      medioPreferido,
      total: totalCobrable,
      pagado: pedido.pago_estado === 'PAGADO',
      cobradoPorMozo: !!pedido.cobro_mozo_en,
      vouchers,
    });
    const pagadoMonto = pagos.filter((f) => f.estado === 'VERIFICADO' || f.estado === 'PAGADO' || f.estado === 'COBRADO_MOZO').reduce((a, f) => a + f.monto, 0);
    const resumenPago = { pagado: Math.round(pagadoMonto * 100) / 100, total: totalCobrable, pagos };
    if (!pagoDigital && digitales.length === 0) return { ...base, resumenPago };
    return { ...base, resumenPago, voucher: voucherAgregado(pagos.filter((f) => f.digital), medioPreferido) };
  }

  /**
   * Pedido al que el invitado adjunta la captura de su pago (mismo token que el seguimiento).
   * Token inválido o pedido inexistente responden igual.
   */
  async idParaComprobante(codigo: string, token: string | undefined): Promise<bigint> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { codigo },
      select: { id: true, estado: true },
    });

    if (!pedido || !verificarTokenSeguimiento(pedido.id, token)) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }
    if (pedido.estado === 'ANULADO') {
      throw new ConflictException({
        codigo: 'PEDIDO_ANULADO',
        mensaje: 'El pedido fue anulado; no se puede adjuntar el pago',
      });
    }
    return pedido.id;
  }

  /**
   * Varios pedidos del invitado en una consulta (POST /carta/seguimiento/lote).
   * Cada entrada sin token válido o inexistente responde igual: { codigo, noEncontrado: true }.
   */
  async obtenerLote(pedidos: { codigo: string; t?: string }[]): Promise<(SeguimientoPedido | { codigo: string; noEncontrado: true })[]> {
    const encontrados = await this.prisma.pedido.findMany({
      where: { codigo: { in: pedidos.map((p) => p.codigo) } },
      select: SELECCION_SEGUIMIENTO,
    });
    const porCodigo = new Map(encontrados.map((p) => [p.codigo, p]));
    const ctx = await this.contexto();

    return pedidos.map(({ codigo, t }) => {
      const pedido = porCodigo.get(codigo);
      if (!pedido || !verificarTokenSeguimiento(pedido.id, t)) return { codigo, noEncontrado: true as const };
      return this.construir(pedido as PedidoSeguimiento, ctx);
    });
  }

  /**
   * Historial de pedidos de la cuenta del cliente, del más nuevo al más viejo (10 por página).
   * Pedidos donde el cliente de la sesión es el identificado (cliente_party_id), o su party en carta/WhatsApp.
   */
  async pedidosDeCuenta(partyId: bigint, pagina: number): Promise<{ pedidos: PedidoCuenta[]; pagina: number; hayMas: boolean }> {
    const filas = await this.prisma.pedido.findMany({
      where: {
        OR: [
          { cliente_party_id: partyId },
          { party_id: partyId, canal: { in: ['CARTA', 'WHATSAPP', 'BOT'] } },
        ],
      },
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      skip: (pagina - 1) * TAMANO_PAGINA_CUENTA,
      take: TAMANO_PAGINA_CUENTA + 1,
      select: {
        ...SELECCION_SEGUIMIENTO,
        lineas: {
          where: { linea_combo_id: null },
          orderBy: { id: 'asc' },
          select: { nombre: true, cantidad: true, ...SELECCION_AREA_LINEA },
        },
      },
    });

    const hayMas = filas.length > TAMANO_PAGINA_CUENTA;
    const ctx = await this.contexto();
    const pagina_ = filas.slice(0, TAMANO_PAGINA_CUENTA);
    const puntos = await explicarPedidosPorId(this.prisma, pagina_.map((f) => f.id)).catch(() => new Map<string, ExplicacionPuntos>());
    const pedidos = pagina_.map((fila) => ({
      ...this.construir(fila as PedidoSeguimiento, ctx),
      puntos: puntos.get(String(fila.id)) ?? { estado: 'NO_SUMA' as const, texto: '' },
      creadoEn: fila.creado_en.toISOString(),
      resumen: resumenProductos(fila.lineas),
      seguimientoToken: generarTokenSeguimiento(fila.id),
    }));

    return { pedidos, pagina, hayMas };
  }

  /** Parámetros del tiempo y reloj de la consulta (una lectura por petición). */
  private async contexto(): Promise<ContextoTiempo> {
    // Un fallo leyendo parámetros no debe romper el seguimiento: rigen los valores por defecto
    const cfg = await leerConfigEta(this.prisma).catch(() => ({ ...CONFIG_ETA_DEFECTO, respaldoMin: 30 }));
    return { cfg, ahora: new Date() };
  }

  /**
   * Tiempo que falta. Regla (documentada en el manual de Repartos):
   * - Sin salir: rango de la zona con empaque (sin ruta). Sin zona ni coordenadas: tiempo_prometido_min.
   * - En camino: lo prometido al salir (eta_min/eta_max) menos lo transcurrido desde la salida;
   *   nunca baja de 5 minutos. Sin rango guardado (pedidos anteriores): tiempo_prometido_min menos lo transcurrido.
   * - Entregado o anulado: sin tiempo.
   */
  private tiempoDe(pedido: PedidoSeguimiento, anulado: boolean, ctx: ContextoTiempo): TiempoSeguimiento | null {
    // Solo delivery tiene tiempo de entrega; recoger en local y mesa no lo muestran
    if (anulado || pedido.estado === 'ENTREGADO' || pedido.modalidad !== 'DELIVERY') return null;
    const enCamino = pedido.estado === 'EN_CAMINO' || pedido.despachado_en !== null;
    let rango: RangoEta | null;
    if (enCamino) {
      const prometido =
        pedido.eta_min != null && pedido.eta_max != null ? { min: pedido.eta_min, max: pedido.eta_max } : null;
      rango = restanteEnCamino(prometido, ctx.cfg.respaldoMin, pedido.despachado_en, ctx.ahora, ctx.cfg.pasoMin);
    } else {
      const unidades = lineasDeCuenta(pedido.lineas ?? []).reduce((s, l) => s + Number(l.cantidad || 0), 0);
      const lat = pedido.entrega_lat == null ? null : Number(pedido.entrega_lat);
      const lng = pedido.entrega_lng == null ? null : Number(pedido.entrega_lng);
      rango =
        calcularEtaEntrega(
          {
            zonaMin: pedido.zona?.minutos_min ?? null,
            zonaMax: pedido.zona?.minutos_max ?? null,
            lat,
            lng,
            unidades,
          },
          ctx.cfg,
        ) ?? { min: ctx.cfg.respaldoMin, max: ctx.cfg.respaldoMin };
    }
    if (!rango) return null;
    return { min: rango.min, max: rango.max, enCamino, texto: textoRango(rango.min, rango.max) };
  }

  private construir(pedido: PedidoSeguimiento, ctx: ContextoTiempo): SeguimientoPedido {
    // Comer en el local que Caja convirtió a MESA (canal CARTA: los de mozo/caja nacen MESA con otro canal)
    const autogestion = pedido.modalidad === 'COMER_LOCAL' || (pedido.modalidad === 'MESA' && pedido.canal === 'CARTA');
    const modalidad = (autogestion ? 'COMER_LOCAL' : pedido.modalidad in PASOS_POR_MODALIDAD ? pedido.modalidad : 'RECOGER') as Modalidad;
    const anulado = pedido.estado === 'ANULADO';
    const progreso = progresoDelPedido(pedido, ctx);
    let rangoEstado = anulado ? -1 : (RANGO_ESTADO[pedido.estado] ?? 0);
    // Con todas las áreas listas pero sin el aviso final (LISTO) el paso sigue siendo «En preparación»: la carta lo
    // redacta como «Casi listo» a partir de progreso (mismo cálculo que el admin).
    // En mesa, servido al cliente (entregado_mesa_en) cierra el último paso aunque el pedido siga abierto para cobrar
    const mesa = modalidad === 'COMER_LOCAL' || modalidad === 'MESA';
    if (!anulado && mesa && pedido.entregado_mesa_en) rangoEstado = 4;

    const pasosDef = PASOS_POR_MODALIDAD[modalidad];
    const hecho = pasosDef.map(
      (paso) =>
        paso === PASO_RECIBIDO ||
        (paso.campo === 'llego_en' ? rangoEstado >= 4 || (rangoEstado >= 3 && !!pedido.llego_en) : rangoEstado >= paso.rango),
    );
    const ultimoHecho = hecho.lastIndexOf(true);

    const pasos: PasoSeguimiento[] = pasosDef.map((paso, i) => ({
      clave: paso.clave,
      etiqueta: paso.etiqueta,
      hecho: hecho[i],
      actual: !anulado && i === ultimoHecho,
      hora: hecho[i] ? this.horaDe(pedido, paso) : null,
    }));

    return {
      codigo: pedido.codigo,
      estado: pedido.estado,
      estadoEtiqueta: ETIQUETA_ESTADO[pedido.estado] ?? pedido.estado,
      modalidad,
      ...(autogestion
        ? pedido.modalidad === 'COMER_LOCAL'
          ? { ubicacion: 'SIN_MESA' as const }
          : pedido.espera_mesa_desde
            ? { ubicacion: 'EN_ESPERA' as const }
            : { ubicacion: 'ASIGNADA' as const, mesa: pedido.mesa_nombre ?? undefined }
        : {}),
      total: Number(pedido.total.toString()),
      // Propina aparte de la venta (0 = sin propina)
      propina: Number(pedido.propina?.toString() ?? 0),
      terminado: anulado || pedido.estado === 'ENTREGADO',
      anulado,
      pasos,
      progreso,
      tiempo: this.tiempoDe(pedido, anulado, ctx),
    };
  }

  /** Hora del paso: el campo del pedido, o la primera entrada del historial si el campo falta. */
  private horaDe(pedido: PedidoSeguimiento, paso: PasoDef): string | null {
    const fecha =
      pedido[paso.campo] ??
      (paso.clave === 'entregado' ? pedido.entregado_mesa_en : null) ??
      pedido.historial.find((h) => paso.estadosHistorial.includes(h.estado_nuevo))?.en ??
      null;
    return fecha ? obtenerFechaHoraLima(fecha).horaMinutos : null;
  }
}

/** Fila mínima de voucher_pago que necesita el estado (sin imagen ni datos leídos). */
export interface FilaVoucherEstado {
  medio: string | null;
  semaforo: string;
  motivos: string[];
  creado_en: Date;
  revisado_en: Date | null;
}

/**
 * Estado del voucher para el invitado. Reglas de siempre: vigente = no reemplazado (ya filtrado por la consulta);
 * útil = no ILEGIBLE (un ILEGIBLE no cuenta). Verificado = pedido PAGADO por Caja o voucher útil revisado por el equipo.
 * Vouchers llegan del más nuevo al más viejo.
 */
export function estadoVoucherDe(args: {
  pagado: boolean;
  medioPreferido: string | null;
  vouchers: FilaVoucherEstado[];
}): VoucherSeguimiento {
  const { pagado, medioPreferido, vouchers } = args;
  const utiles = vouchers.filter((v) => v.semaforo !== 'ILEGIBLE');
  const revisado = utiles.find((v) => v.revisado_en);
  const iso = (f: Date | null | undefined) => (f ? f.toISOString() : null);

  if (pagado || revisado) {
    return { estado: 'VERIFICADO', medio: revisado?.medio ?? medioPreferido, actualizadoEn: iso(revisado?.revisado_en) };
  }
  if (utiles.length > 0) {
    return { estado: 'EN_REVISION', medio: utiles[0].medio ?? medioPreferido, actualizadoEn: iso(utiles[0].creado_en) };
  }
  if (vouchers.length > 0) {
    const ultimo = vouchers[0];
    const motivo = ultimo.motivos[0]?.slice(0, 120);
    return {
      estado: 'RECHAZADO',
      medio: ultimo.medio ?? medioPreferido,
      actualizadoEn: iso(ultimo.creado_en),
      ...(motivo ? { motivo } : {}),
    };
  }
  return { estado: 'SIN_VOUCHER', medio: medioPreferido, actualizadoEn: null };
}

/**
 * Cada medio del pedido con el estado de SU captura. Con plan: un renglón por medio; sin plan: el medio del pedido por el total.
 * Una captura de un medio no cubre a otro. Las capturas sin medio se asignan al primer medio digital que no tiene.
 * Pedido PAGADO por Caja: todo queda pagado. Efectivo y tarjeta no llevan captura (se pagan al recibir o por el mozo).
 */
export function pagosDelPedido(args: {
  plan: { medio: string; monto: number }[];
  medioPreferido: string;
  total: number;
  pagado: boolean;
  cobradoPorMozo: boolean;
  vouchers: FilaVoucherEstado[];
}): PagoMedio[] {
  const { plan, medioPreferido, total, pagado, cobradoPorMozo, vouchers } = args;
  const filas = plan.length > 0 ? plan : medioPreferido ? [{ medio: medioPreferido, monto: total }] : [];
  const sinMedio = vouchers.filter((v) => !v.medio);
  const sinAsignar = [...sinMedio];
  return filas.map((f) => {
    const digital = MEDIOS_DIGITALES.includes(f.medio);
    if (!digital) {
      const estado: EstadoPagoMedio = pagado ? 'PAGADO' : cobradoPorMozo ? 'COBRADO_MOZO' : 'AL_RECIBIR';
      return { medio: f.medio, monto: f.monto, digital, estado, actualizadoEn: null };
    }
    let propios = vouchers.filter((v) => v.medio === f.medio);
    if (propios.length === 0 && sinAsignar.length > 0) propios = [sinAsignar.shift() as FilaVoucherEstado];
    const v = estadoVoucherDe({ pagado, medioPreferido: f.medio, vouchers: propios });
    return { medio: f.medio, monto: f.monto, digital, estado: v.estado, actualizadoEn: v.actualizadoEn, ...(v.motivo ? { motivo: v.motivo } : {}) };
  });
}

/** Un solo estado para quien lee `voucher` (compatibilidad): verificado solo si TODOS los medios digitales lo están. */
function voucherAgregado(digitales: PagoMedio[], medioPreferido: string): VoucherSeguimiento {
  const pick = (e: EstadoPagoMedio) => digitales.find((f) => f.estado === e);
  const estado: EstadoVoucherSeguimiento = digitales.every((f) => f.estado === 'VERIFICADO')
    ? 'VERIFICADO'
    : pick('RECHAZADO')
      ? 'RECHAZADO'
      : pick('EN_REVISION')
        ? 'EN_REVISION'
        : 'SIN_VOUCHER';
  const f = pick(estado) ?? digitales[0];
  return {
    estado,
    medio: f?.medio ?? medioPreferido,
    actualizadoEn: f?.actualizadoEn ?? null,
    ...(f?.motivo && estado === 'RECHAZADO' ? { motivo: f.motivo } : {}),
  };
}

// «2 x Frappe Oreo, 1 x Waffle y 2 más»: hasta 3 productos y el resto como cuenta
function resumenProductos(lineas: { nombre: string; cantidad: number }[]): string {
  const partes = lineas.slice(0, MAX_PRODUCTOS_RESUMEN).map((l) => `${l.cantidad} x ${l.nombre}`);
  const restantes = lineas.length - MAX_PRODUCTOS_RESUMEN;
  return restantes > 0 ? `${partes.join(', ')} y ${restantes} más` : partes.join(', ');
}
