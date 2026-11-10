/**
 * Línea de tiempo de un pedido, armada SOLO con lo ya guardado (sin tabla nueva): marcas del pedido
 * (creado_en, pasa_cocina_en, listo_en, entregado_mesa_en, tomado_en, salio_en, llego_en, entregado_en, anulado_en),
 * `pedido_estado_historial`, `cobro.en` y `pedido_linea.listo_en` por área. Pura: no toca la base.
 */
export type CodigoEtapa = 'TOMADO' | 'EN_COLA' | 'PREPARACION' | 'LISTO' | 'COBRADO' | 'EN_RUTA' | 'ENTREGADO' | 'ANULADO';

export interface EtapaTiempo {
  codigo: CodigoEtapa;
  etiqueta: string;
  area: string | null;
  desde: string | null;
  hasta: string | null;
  duracionSeg: number | null;
  /** true = derivada de datos históricos aproximados (p. ej. sin hora de listo por área). */
  estimada: boolean;
}

export interface DatosLineaTiempo {
  estado: string;
  modalidad: string;
  creado_en: Date;
  pasa_cocina_en: Date | null;
  listo_en: Date | null;
  entregado_mesa_en: Date | null;
  entregado_en: Date | null;
  anulado_en: Date | null;
  tomado_en: Date | null;
  salio_en: Date | null;
  despachado_en: Date | null;
  llego_en: Date | null;
  cobro_mozo_en: Date | null;
  lineas: Array<{ area: string | null; listo_en: Date | null }>;
  historial: Array<{ estado_nuevo: string; en: Date }>;
  /** Cobro vigente (no anulado): el más reciente. */
  cobro_en: Date | null;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const seg = (a: Date | null, b: Date | null) =>
  a && b ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000)) : null;

type PartesTotal = Pick<DatosLineaTiempo, 'estado' | 'creado_en' | 'entregado_en' | 'entregado_mesa_en' | 'anulado_en'>;

/** Total del pedido: de tomado a entregado (o anulado); null si sigue abierto o falta la marca. */
export function totalSegDePedido(p: PartesTotal): number | null {
  if (p.estado === 'ANULADO') return seg(p.creado_en, p.anulado_en);
  if (p.estado === 'ENTREGADO') return seg(p.creado_en, p.entregado_en ?? p.entregado_mesa_en);
  return null;
}

function etapa(
  codigo: CodigoEtapa,
  etiqueta: string,
  desde: Date | null,
  hasta: Date | null,
  extra: { area?: string | null; estimada?: boolean } = {},
): EtapaTiempo {
  return {
    codigo,
    etiqueta,
    area: extra.area ?? null,
    desde: iso(desde),
    hasta: iso(hasta),
    duracionSeg: seg(desde, hasta),
    estimada: extra.estimada ?? false,
  };
}

export function construirLineaTiempo(p: DatosLineaTiempo): { etapas: EtapaTiempo[]; totalSeg: number | null; completo: boolean } {
  const etapas: EtapaTiempo[] = [];
  const anulado = p.estado === 'ANULADO';
  const primeraVez = (estado: string) =>
    p.historial.filter((h) => h.estado_nuevo === estado).sort((a, b) => a.en.getTime() - b.en.getTime())[0]?.en ?? null;
  // Aceptado en cocina: marca del pedido o, si falta, la primera vez que el historial lo puso en PREPARANDO
  const aceptado = p.pasa_cocina_en ?? primeraVez('PREPARANDO');

  etapas.push(etapa('TOMADO', 'Pedido tomado', p.creado_en, p.creado_en));
  etapas.push(etapa('EN_COLA', 'Espera hasta aceptarse en cocina', p.creado_en, aceptado ?? (anulado ? p.anulado_en : null)));

  if (anulado) {
    etapas.push(etapa('ANULADO', 'Anulado', p.anulado_en, p.anulado_en));
    const totalSeg = totalSegDePedido(p);
    return { etapas, totalSeg, completo: totalSeg !== null };
  }

  // Preparación: una etapa por área; termina cuando su última línea quedó lista
  const porArea = new Map<string, Array<Date | null>>();
  for (const l of p.lineas) {
    const k = l.area ?? 'General';
    porArea.set(k, [...(porArea.get(k) ?? []), l.listo_en]);
  }
  const inicioPrep = aceptado ?? p.creado_en;
  for (const [area, listos] of [...porArea.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const fin = listos.every((x) => x !== null)
      ? new Date(Math.max(...listos.map((x) => (x as Date).getTime())))
      : null;
    // Datos viejos sin hora por línea: se usa el «listo» del pedido para todas las áreas (aproximado)
    const aproximado = fin === null && p.listo_en !== null && listos.every((x) => x === null);
    etapas.push(
      etapa('PREPARACION', `Preparación · ${area}`, inicioPrep, fin ?? (aproximado ? p.listo_en : null), {
        area,
        estimada: !aceptado || aproximado,
      }),
    );
  }

  // Listo → cobrado → entregado
  const cobradoEn = p.cobro_en ?? p.cobro_mozo_en;
  etapas.push(etapa('LISTO', 'Pedido listo', p.listo_en, p.listo_en));
  // Cobrado antes de estar listo: el tramo dura 0
  const desdeCobro = p.listo_en && cobradoEn && cobradoEn < p.listo_en ? cobradoEn : p.listo_en;
  etapas.push(etapa('COBRADO', 'De listo a cobrado', desdeCobro, cobradoEn, { estimada: p.cobro_en === null && p.cobro_mozo_en !== null }));

  if (p.modalidad === 'DELIVERY') {
    const salida = p.salio_en ?? p.despachado_en;
    etapas.push(etapa('EN_RUTA', 'Asignado al repartidor', p.tomado_en, salida, { estimada: !p.salio_en && !!p.despachado_en }));
    etapas.push(etapa('EN_RUTA', 'En ruta', salida, p.llego_en ?? p.entregado_en, { estimada: !p.llego_en && !!p.entregado_en }));
    etapas.push(etapa('ENTREGADO', 'Entrega al cliente', p.llego_en, p.entregado_en));
  } else {
    // Mesa: el mozo lo lleva a la mesa (entregado_mesa_en); el resto, el cierre (entregado_en)
    const entrega = p.modalidad === 'MESA' ? (p.entregado_mesa_en ?? p.entregado_en) : p.entregado_en;
    const desde =
      [p.listo_en, cobradoEn].filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    etapas.push(etapa('ENTREGADO', p.modalidad === 'MESA' ? 'Entregado en mesa' : 'Entregado', desde, entrega));
  }

  const totalSeg = totalSegDePedido(p);
  return { etapas, totalSeg, completo: totalSeg !== null && etapas.every((e) => e.duracionSeg !== null) };
}
