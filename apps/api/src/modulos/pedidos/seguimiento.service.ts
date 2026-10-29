import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
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

type Modalidad = 'DELIVERY' | 'RECOGER' | 'MESA';

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
  campo: 'creado_en' | 'pasa_cocina_en' | 'listo_en' | 'despachado_en' | 'entregado_en';
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
  etiqueta: 'En preparación en cocina',
  rango: 1,
  campo: 'pasa_cocina_en',
  estadosHistorial: ['PREPARANDO', 'LISTO'],
};
const PASO_ENTREGADO: PasoDef = {
  clave: 'entregado',
  etiqueta: 'Entregado',
  rango: 4,
  campo: 'entregado_en',
  estadosHistorial: ['ENTREGADO'],
};

// MESA usa los pasos de RECOGER (el contrato no define otros).
const PASOS_POR_MODALIDAD: Record<Modalidad, PasoDef[]> = {
  DELIVERY: [
    PASO_RECIBIDO,
    PASO_COCINA,
    {
      clave: 'camino',
      etiqueta: 'En camino',
      rango: 3,
      campo: 'despachado_en',
      estadosHistorial: ['EN_CAMINO'],
    },
    PASO_ENTREGADO,
  ],
  RECOGER: [
    PASO_RECIBIDO,
    PASO_COCINA,
    {
      clave: 'listo',
      etiqueta: 'Listo para recoger',
      rango: 2,
      campo: 'listo_en',
      estadosHistorial: ['LISTO'],
    },
    PASO_ENTREGADO,
  ],
  MESA: [
    PASO_RECIBIDO,
    PASO_COCINA,
    {
      clave: 'listo',
      etiqueta: 'Listo para recoger',
      rango: 2,
      campo: 'listo_en',
      estadosHistorial: ['LISTO'],
    },
    PASO_ENTREGADO,
  ],
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
  total: number;
  terminado: boolean;
  anulado: boolean;
  pasos: PasoSeguimiento[];
  /** Progreso en cocina y entrega (mismo cálculo que «Mis pedidos» del mozo). */
  progreso: ProgresoPedido;
  /** Pago con Yape, Plin o transferencia: la pantalla pide adjuntar la captura. Solo en obtener(). */
  pagoDigital?: boolean;
  /**
   * Tiempo que falta (aditivo). Antes de salir: estimado de la zona. En camino: lo prometido al salir
   * menos lo transcurrido. Null cuando el pedido ya está entregado o anulado.
   */
  tiempo?: TiempoSeguimiento | null;
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
  total: true,
  creado_en: true,
  pasa_cocina_en: true,
  listo_en: true,
  despachado_en: true,
  entregado_en: true,
  entregado_mesa_en: true,
  repartidor_party_id: true,
  eta_min: true,
  eta_max: true,
  entrega_lat: true,
  entrega_lng: true,
  zona: { select: { minutos_min: true, minutos_max: true } },
  lineas: { where: { linea_combo_id: null }, select: { cantidad: true, ...SELECCION_AREA_LINEA } },
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
  total: { toString(): string };
  creado_en: Date;
  pasa_cocina_en: Date | null;
  listo_en: Date | null;
  despachado_en: Date | null;
  entregado_en: Date | null;
  eta_min: number | null;
  eta_max: number | null;
  entrega_lat: unknown;
  entrega_lng: unknown;
  zona: { minutos_min: number | null; minutos_max: number | null } | null;
  entregado_mesa_en: Date | null;
  repartidor_party_id: unknown;
  lineas: { cantidad: number; area_id?: bigint | null; producto?: { categoria?: { area_id: bigint | null } | null } | null }[];
  comandas: { area_id: bigint; estado: string; area: { nombre: string } }[];
  historial: { estado_nuevo: string; en: Date }[];
};

/** Contexto de cálculo del tiempo: configuración de parámetros y «ahora» (inyectable en pruebas). */
type ContextoTiempo = ContextoProgreso;

const textoRango = (min: number, max: number) =>
  min === max ? `unos ${min} minutos` : `unos ${min} a ${max} minutos`;

import { explicarPedidosPorId } from '../clientes/explicar-puntos-pedidos';
import type { ExplicacionPuntos } from '../clientes/explicar-puntos-pedido';

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
      select: { ...SELECCION_SEGUIMIENTO, pago_preferido: true },
    });

    if (!pedido || !verificarTokenSeguimiento(pedido.id, token)) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    const pagoDigital = MEDIOS_DIGITALES.includes(String(pedido.pago_preferido ?? '').toUpperCase());
    return { ...this.construir(pedido as PedidoSeguimiento, await this.contexto()), pagoDigital };
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
      const unidades = (pedido.lineas ?? []).reduce((s, l) => s + Number(l.cantidad || 0), 0);
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
    const modalidad = (pedido.modalidad in PASOS_POR_MODALIDAD ? pedido.modalidad : 'RECOGER') as Modalidad;
    const anulado = pedido.estado === 'ANULADO';
    const rangoEstado = anulado ? -1 : (RANGO_ESTADO[pedido.estado] ?? 0);

    const pasosDef = PASOS_POR_MODALIDAD[modalidad];
    const hecho = pasosDef.map((paso) => paso === PASO_RECIBIDO || rangoEstado >= paso.rango);
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
      total: Number(pedido.total.toString()),
      terminado: anulado || pedido.estado === 'ENTREGADO',
      anulado,
      pasos,
      progreso: progresoDelPedido(pedido, ctx),
      tiempo: this.tiempoDe(pedido, anulado, ctx),
    };
  }

  /** Hora del paso: el campo del pedido, o la primera entrada del historial si el campo falta. */
  private horaDe(pedido: PedidoSeguimiento, paso: PasoDef): string | null {
    const fecha =
      pedido[paso.campo] ??
      pedido.historial.find((h) => paso.estadosHistorial.includes(h.estado_nuevo))?.en ??
      null;
    return fecha ? obtenerFechaHoraLima(fecha).horaMinutos : null;
  }
}

// «2 x Frappe Oreo, 1 x Waffle y 2 más»: hasta 3 productos y el resto como cuenta
function resumenProductos(lineas: { nombre: string; cantidad: number }[]): string {
  const partes = lineas.slice(0, MAX_PRODUCTOS_RESUMEN).map((l) => `${l.cantidad} x ${l.nombre}`);
  const restantes = lineas.length - MAX_PRODUCTOS_RESUMEN;
  return restantes > 0 ? `${partes.join(', ')} y ${restantes} más` : partes.join(', ');
}
