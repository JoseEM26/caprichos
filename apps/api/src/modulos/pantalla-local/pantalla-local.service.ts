import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { hoyLimaIso, inicioDiaLimaIso } from '../../comun/fechas-lima';
import { inicioEspera } from '../../comun/inicio-espera';
import { estadoAreasDePedido } from '../cocina/areas-pedido';
import { lineasDeArea } from '../cocina/comandas.service';
import { mesaDePedido } from '../cocina/mesa-comanda.util';
import { resumenPagoDespacho } from '../cocina/resumen-pago-despacho';

export const CLAVE_MOSTRAR_NOMBRE = 'pantalla_local_mostrar_nombre';
/** Un pedido LISTO sigue en la pantalla este tiempo (si nadie lo marca entregado antes). */
export const LISTO_VISIBLE_MIN = 20;
/** Un pedido anulado o rechazado sigue visible (marcado) este tiempo y luego desaparece. */
export const ANULADO_VISIBLE_MIN = 2;
const CACHE_MS = 4000;
/** Umbrales de color de espera (los mismos que cocina por defecto). */
const UMBRALES = { naranjaMin: 35, rojoMin: 50 };

export type EtapaPedido = 'CAJA' | 'COCINA' | 'LISTO' | 'ANULADO';

export interface LineaPantalla {
  id: string;
  nombre: string;
  cantidad: number;
  tamano: string | null;
  sabor: string | null;
  sabores: Array<{ nombre: string; cantidad: number }>;
  combo: string | null;
  opciones: Array<string | { nombre: string }>;
  personas: string[];
  nota: string | null;
  paraLlevar: boolean;
}

export interface AreaPantalla {
  areaId: string;
  areaNombre: string;
  listo: boolean;
  despachada: boolean;
  lineas: LineaPantalla[];
}

/** Lo que muestra la TV de pedidos del local. Sin celular, DNI ni dirección: delivery solo con su zona. */
export interface PedidoPantalla {
  codigo: string;
  etapa: EtapaPedido;
  modalidad: string;
  mesa: string | null;
  enEsperaMesa: boolean;
  /** Solo la primera palabra del nombre, y solo si el parámetro lo permite. */
  nombre: string | null;
  /** Retrato del avatar del cliente (solo la URL pública), si tiene cuenta y avatar y se muestran nombres. */
  avatarUrl: string | null;
  /** Delivery: solo el código de la zona de reparto (nunca la dirección). */
  zona: string | null;
  nota: string | null;
  extraDe: string | null;
  /** Desde cuándo corre la espera (hora pactada si es programado). */
  esperaDesde: string;
  /** Instante en que terminó la espera (listo o anulado); null mientras corre. */
  fin: string | null;
  minutos: number;
  pago: { estado: 'PAGADO' | 'COBRADO_MOZO' | 'POR_COBRAR'; medios: Array<{ medio: string; monto: number }>; total: number; esPersonal: boolean };
  areas: AreaPantalla[];
}

export interface RespuestaPantalla {
  pedidos: PedidoPantalla[];
  mostrarNombre: boolean;
  umbrales: { naranjaMin: number; rojoMin: number };
  /** Instante del servidor (ISO), para que la pantalla calcule sin depender de su reloj. */
  ahora: string;
}

/** Primera palabra del nombre, solo letras, con inicial mayúscula. null si no queda nada. */
export function nombreDePila(nombre: string | null | undefined): string | null {
  const palabra = String(nombre ?? '').trim().split(/\s+/)[0] ?? '';
  const limpia = palabra.replace(/[^\p{L}'-]/gu, '').slice(0, 20);
  if (!limpia) return null;
  return limpia.charAt(0).toLocaleUpperCase('es-PE') + limpia.slice(1).toLocaleLowerCase('es-PE');
}

@Injectable()
export class PantallaLocalService {
  private cache: { hasta: number; datos: RespuestaPantalla } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async pedidos(ahora: Date = new Date()): Promise<RespuestaPantalla> {
    if (this.cache && this.cache.hasta > ahora.getTime()) return this.cache.datos;

    const param = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_MOSTRAR_NOMBRE } });
    const valor = String(param?.valor ?? 'si').replace(/"/g, '').toLowerCase().trim();
    const mostrarNombre = valor !== 'no' && valor !== 'false';

    const limiteListo = new Date(ahora.getTime() - LISTO_VISIBLE_MIN * 60000);
    const limiteAnulado = new Date(ahora.getTime() - ANULADO_VISIBLE_MIN * 60000);
    const filas = await this.prisma.pedido.findMany({
      where: {
        creado_en: { gte: inicioDiaLimaIso(hoyLimaIso(ahora)) },
        OR: [
          { estado: { in: ['COLA', 'PREPARANDO'] } },
          { estado: 'LISTO', listo_en: { gte: limiteListo } },
          { estado: { in: ['ANULADO', 'RECHAZADO'] }, anulado_en: { gte: limiteAnulado } },
        ],
      },
      // Solo lo necesario: nunca teléfono, documento, apellidos ni dirección.
      select: {
        codigo: true,
        estado: true,
        modalidad: true,
        cliente_nombre: true,
        party_id: true,
        nota: true,
        mesa_nombre: true,
        entrega_referencia: true,
        espera_mesa_desde: true,
        creado_en: true,
        programado_para: true,
        pasa_cocina_en: true,
        listo_en: true,
        anulado_en: true,
        total: true,
        descuento: true,
        propina: true,
        pago_metodo: true,
        pago_estado: true,
        paga_con: true,
        cobro_mozo_en: true,
        cobro_mozo_medio: true,
        cobro_mozo_recibido: true,
        es_personal: true,
        planPago: true,
        pedidoOrigen: { select: { codigo: true } },
        zona: { select: { codigo: true } },
        comandas: { select: { area_id: true, estado: true, area: { select: { nombre: true } } } },
        lineas: {
          include: {
            area: true,
            producto: { include: { categoria: { include: { area: true } } } },
            opcionesElegidas: true,
            sabores: true,
          },
        },
      },
      orderBy: { creado_en: 'asc' },
      take: 80,
    });

    // Retratos en una sola consulta (sin N+1); solo la URL, nunca otros datos de la persona
    const partyIds = mostrarNombre ? [...new Set(filas.map((f) => f.party_id).filter((x): x is bigint => x != null))] : [];
    const retratos = new Map<string, string>();
    if (partyIds.length) {
      const personas = await this.prisma.person.findMany({ where: { party_id: { in: partyIds }, avatar_url: { not: null } }, select: { party_id: true, avatar_url: true } });
      for (const pe of personas) if (pe.avatar_url) retratos.set(String(pe.party_id), pe.avatar_url);
    }

    const pedidos: PedidoPantalla[] = filas.map((f: any) => {
      const estado = estadoAreasDePedido(f.comandas, f.lineas);
      const anulado = f.estado === 'ANULADO' || f.estado === 'RECHAZADO';
      const listo = f.estado === 'LISTO';
      const etapa: EtapaPedido = anulado ? 'ANULADO' : listo ? 'LISTO' : estado.areas.length > 0 || f.pasa_cocina_en ? 'COCINA' : 'CAJA';
      // Sin comandas todavía (en caja): todo el pedido en un solo bloque
      const areas: AreaPantalla[] = estado.areas.length
        ? estado.areas.map(({ nLineas: _n, ...a }) => ({ ...a, lineas: lineasDeArea(f.lineas, BigInt(a.areaId)) as LineaPantalla[] }))
        : [{ areaId: '0', areaNombre: 'Pedido', listo: false, despachada: false, lineas: lineasDeArea(f.lineas.map((l: any) => ({ ...l, area_id: 0n })), 0n) as LineaPantalla[] }];
      const desde = inicioEspera(f);
      const fin = anulado ? f.anulado_en : listo ? f.listo_en : null;
      const pago = resumenPagoDespacho(f);
      return {
        codigo: f.codigo,
        etapa,
        modalidad: f.modalidad,
        mesa: mesaDePedido(f),
        enEsperaMesa: Boolean(f.espera_mesa_desde),
        nombre: mostrarNombre ? nombreDePila(f.cliente_nombre) : null,
        avatarUrl: f.party_id != null ? retratos.get(String(f.party_id)) ?? null : null,
        zona: f.modalidad === 'DELIVERY' ? (f.zona?.codigo ?? null) : null,
        nota: f.nota ?? null,
        extraDe: f.pedidoOrigen?.codigo ?? null,
        esperaDesde: desde.toISOString(),
        fin: fin ? new Date(fin).toISOString() : null,
        minutos: Math.max(0, Math.floor(((fin ? new Date(fin).getTime() : ahora.getTime()) - desde.getTime()) / 60000)),
        pago: { estado: pago.estado, medios: pago.medios, total: pago.total, esPersonal: Boolean((pago as any).esPersonal) },
        areas,
      };
    });

    const datos = { pedidos, mostrarNombre, umbrales: UMBRALES, ahora: ahora.toISOString() };
    this.cache = { hasta: ahora.getTime() + CACHE_MS, datos };
    return datos;
  }
}
