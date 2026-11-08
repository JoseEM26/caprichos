/**
 * Estado por área de cocina de un pedido: UNA sola fuente de verdad para Despacho de Cocina y para Repartos.
 * Solo nombre del área y su estado (nada de líneas, notas ni tiempos).
 */
export interface ComandaAreaEntrada {
  area_id: bigint;
  estado: string;
  area?: { nombre: string } | null;
}
export interface LineaAreaEntrada {
  cantidad: number;
  despachadas?: number | null;
  area_id?: bigint | null;
  producto?: { categoria?: { area_id: bigint | null } | null } | null;
}
export interface EstadoAreaPedido {
  areaId: string;
  areaNombre: string;
  listo: boolean;
  /** Lo de esa área ya salió en un despacho parcial (todas sus líneas despachadas). */
  despachada: boolean;
  /** Líneas del área (solo la cuenta; el detalle lo arma quien lo necesite). */
  nLineas: number;
}
export interface EstadoAreasPedido {
  areas: EstadoAreaPedido[];
  areasListas: number;
  areasTotal: number;
  /** Todas las áreas listas (false si no hay áreas). */
  completo: boolean;
}

const areaDe = (l: LineaAreaEntrada) => l.area_id ?? l.producto?.categoria?.area_id ?? null;

export function estadoAreasDePedido(comandas: ComandaAreaEntrada[], lineas: LineaAreaEntrada[]): EstadoAreasPedido {
  const areas = comandas
    .map((c) => {
      const propias = lineas.filter((l) => areaDe(l) === c.area_id);
      return {
        areaId: c.area_id.toString(),
        areaNombre: c.area?.nombre ?? '',
        listo: c.estado === 'DESPEJADA',
        despachada: propias.length > 0 && propias.every((l) => (l.despachadas ?? 0) >= l.cantidad),
        nLineas: propias.length,
      };
    })
    .filter((a) => a.nLineas > 0) // un área sin líneas no participa
    .sort((x, y) => Number(BigInt(x.areaId) - BigInt(y.areaId)));
  const areasListas = areas.filter((a) => a.listo).length;
  return { areas, areasListas, areasTotal: areas.length, completo: areas.length > 0 && areasListas === areas.length };
}
