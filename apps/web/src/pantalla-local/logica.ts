/** Lógica pura de la pantalla de TV «Pedidos del local» (sin React, fácil de probar). */
import { detalleLinea, textoSabores, type ColorComanda, type UmbralesCocina } from '../admin/cocina/cocinaTipos';
import { colorPorMinutos } from '../admin/cocina/tiempoEnVivo';
import { etiquetaMedio } from '../admin/cocina/ResumenPagoDespacho';

export type Etapa = 'CAJA' | 'COCINA' | 'LISTO' | 'ANULADO';

export interface LineaPedido {
  id: string;
  nombre: string;
  cantidad: number;
  tamano?: string | null;
  sabor?: string | null;
  sabores?: Array<{ nombre: string; cantidad: number }>;
  combo?: string | null;
  opciones?: Array<string | { nombre: string }>;
  personas?: string[];
  nota?: string | null;
  paraLlevar?: boolean;
}

export interface AreaPedido {
  areaId: string;
  areaNombre: string;
  listo: boolean;
  despachada: boolean;
  lineas: LineaPedido[];
}

export interface PedidoPantalla {
  codigo: string;
  etapa: Etapa;
  modalidad: string;
  mesa: string | null;
  enEsperaMesa: boolean;
  nombre: string | null;
  avatarUrl: string | null;
  zona: string | null;
  nota: string | null;
  extraDe: string | null;
  esperaDesde: string;
  fin: string | null;
  minutos: number;
  pago: { estado: 'PAGADO' | 'COBRADO_MOZO' | 'POR_COBRAR'; medios: Array<{ medio: string; monto: number }>; total: number; esPersonal: boolean };
  areas: AreaPedido[];
}

export interface RespuestaPantalla {
  pedidos: PedidoPantalla[];
  mostrarNombre: boolean;
  umbrales: UmbralesCocina;
  ahora: string;
}

/** Cuántos pedidos caben por página (3 columnas × 2 filas en una TV de 1080p). */
export const POR_PAGINA = 6;
/** Segundos que se queda cada página antes de pasar a la siguiente. */
export const PAGINA_SEG = 12;

export const ETAPAS: Etapa[] = ['CAJA', 'COCINA', 'LISTO'];
export const ETIQUETA_ETAPA: Record<Etapa, string> = { CAJA: 'En caja', COCINA: 'En cocina', LISTO: 'Listo', ANULADO: 'Anulado' };

/** Cuánto pesa cada etapa al ordenar: lo que espera va primero (el más antiguo arriba), luego anulados y listos. */
const PESO: Record<Etapa, number> = { CAJA: 0, COCINA: 0, ANULADO: 1, LISTO: 2 };

export function ordenar(pedidos: PedidoPantalla[]): PedidoPantalla[] {
  return [...pedidos].sort((a, b) => PESO[a.etapa] - PESO[b.etapa] || Date.parse(a.esperaDesde) - Date.parse(b.esperaDesde));
}

/** Parte la lista en páginas de `tam`; siempre devuelve al menos una (vacía) para no romper el indicador. */
export function paginar<T>(items: T[], tam = POR_PAGINA): T[][] {
  const paginas: T[][] = [];
  for (let i = 0; i < items.length; i += tam) paginas.push(items.slice(i, i + tam));
  return paginas.length ? paginas : [[]];
}

/** Columnas de la grilla según cuántos pedidos hay en la página: pocos pedidos, tarjetas más grandes. */
export const columnasPara = (n: number): number => (n <= 1 ? 1 : n <= 4 ? 2 : 3);

const MODALIDAD: Record<string, string> = {
  COMER_LOCAL: 'Comer en el local',
  LOCAL: 'En el local',
  LLEVAR: 'Para llevar',
  RECOGER: 'Recoger',
  DELIVERY: 'DELIVERY',
};

/** «Mesa 4», «Esperando mesa», «Comer en el local», «Para llevar», «Recoger» o «DELIVERY · zona». */
export function textoModalidad(p: Pick<PedidoPantalla, 'modalidad' | 'mesa' | 'enEsperaMesa' | 'zona'>): string {
  if (p.enEsperaMesa) return 'Esperando mesa';
  if (p.modalidad === 'MESA') return p.mesa || 'En mesa';
  if (p.modalidad === 'COMER_LOCAL' && p.mesa) return p.mesa;
  if (p.modalidad === 'DELIVERY') return p.zona ? `DELIVERY · ${p.zona}` : 'DELIVERY';
  return MODALIDAD[p.modalidad] ?? p.modalidad;
}

/** Texto de pago: «Pagado · Yape», «Por cobrar», «Pagado (cobró el mozo) · Efectivo», «Consumo del personal». */
export function textoPago(pago: PedidoPantalla['pago']): string {
  if (pago.esPersonal) return 'Consumo del personal';
  const medios = pago.medios.length > 1 ? pago.medios.map((m) => `${etiquetaMedio(m.medio)} S/ ${m.monto.toFixed(2)}`).join(' + ') : pago.medios.map((m) => etiquetaMedio(m.medio)).join('');
  const estado = pago.estado === 'PAGADO' ? 'Pagado' : pago.estado === 'COBRADO_MOZO' ? 'Pagado (cobró el mozo)' : 'Por cobrar';
  return medios ? `${estado} · ${medios}` : estado;
}

export interface EstadoArea {
  texto: string;
  /** Marca corta: ✓ lista, ● preparando. */
  marca: string;
  listo: boolean;
}

/** Estado de un área para el resumen («Salado ✓ Lista», «Bebidas ● Preparando»). Antes de cocina todas esperan. */
export function estadoArea(a: AreaPedido, etapa: Etapa): EstadoArea {
  if (a.despachada) return { texto: 'Ya salió', marca: '✓', listo: true };
  if (a.listo || etapa === 'LISTO') return { texto: 'Lista', marca: '✓', listo: true };
  return { texto: etapa === 'CAJA' ? 'En espera' : 'Preparando', marca: '●', listo: false };
}

/** Líneas de todas las áreas juntas (para pedidos de una sola área o para contar). */
export const lineasDe = (p: PedidoPantalla): LineaPedido[] => p.areas.flatMap((a) => a.lineas);

/** Detalle de una línea en texto corrido: tamaño, opciones, personas, sabores. Misma regla que Despacho. */
export function detalleTexto(l: LineaPedido): string {
  const sabores = textoSabores({ sabor: l.sabor, sabores: l.sabores });
  return [...detalleLinea({ tamano: l.tamano, opciones: l.opciones as any, personas: l.personas }), sabores].filter(Boolean).join(' · ');
}

/** Color de la espera: el del pedido mientras corre; verde al quedar listo; rojo si se anuló. */
export function colorEspera(p: Pick<PedidoPantalla, 'etapa'>, minutos: number, umbrales: UmbralesCocina): ColorComanda {
  if (p.etapa === 'LISTO') return 'VERDE';
  if (p.etapa === 'ANULADO') return 'ROJO';
  return colorPorMinutos(minutos, umbrales);
}
