import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { obtenerFechaHoraLima } from '../local/local.util';
import { generarTokenSeguimiento, verificarTokenSeguimiento } from './seguimiento.tokens';

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
}

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
  historial: {
    select: { estado_nuevo: true, en: true },
    orderBy: { en: 'asc' as const },
  },
};

const TAMANO_PAGINA_CUENTA = 10;
const MAX_PRODUCTOS_RESUMEN = 3;

export const MAX_PEDIDOS_LOTE = 20;

export interface PedidoCuenta extends SeguimientoPedido {
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
  historial: { estado_nuevo: string; en: Date }[];
};

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
      select: SELECCION_SEGUIMIENTO,
    });

    if (!pedido || !verificarTokenSeguimiento(pedido.id, token)) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    return this.construir(pedido as PedidoSeguimiento);
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

    return pedidos.map(({ codigo, t }) => {
      const pedido = porCodigo.get(codigo);
      if (!pedido || !verificarTokenSeguimiento(pedido.id, t)) return { codigo, noEncontrado: true as const };
      return this.construir(pedido as PedidoSeguimiento);
    });
  }

  /**
   * Historial de pedidos de la cuenta del cliente, del más nuevo al más viejo (10 por página).
   * Solo los pedidos cuyo party_id es el de la sesión.
   */
  async pedidosDeCuenta(partyId: bigint, pagina: number): Promise<{ pedidos: PedidoCuenta[]; pagina: number; hayMas: boolean }> {
    const filas = await this.prisma.pedido.findMany({
      where: { party_id: partyId },
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      skip: (pagina - 1) * TAMANO_PAGINA_CUENTA,
      take: TAMANO_PAGINA_CUENTA + 1,
      select: {
        ...SELECCION_SEGUIMIENTO,
        lineas: {
          where: { linea_combo_id: null },
          orderBy: { id: 'asc' },
          select: { nombre: true, cantidad: true },
        },
      },
    });

    const hayMas = filas.length > TAMANO_PAGINA_CUENTA;
    const pedidos = filas.slice(0, TAMANO_PAGINA_CUENTA).map((fila) => ({
      ...this.construir(fila as PedidoSeguimiento),
      creadoEn: fila.creado_en.toISOString(),
      resumen: resumenProductos(fila.lineas),
      seguimientoToken: generarTokenSeguimiento(fila.id),
    }));

    return { pedidos, pagina, hayMas };
  }

  private construir(pedido: PedidoSeguimiento): SeguimientoPedido {
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
