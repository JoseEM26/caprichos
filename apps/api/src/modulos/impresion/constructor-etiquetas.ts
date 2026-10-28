import {
  EtiquetaGeneralDatos,
  EtiquetaGeneralProducto,
  EtiquetaAreaDatos,
  EtiquetaAreaLinea,
  EtiquetaBebidaDatos,
} from '@caprichos/compartido';

export const CRITERIO_BEBIDA_AREAS = ['BARRA', 'BEBIDAS', 'CAFETERIA', 'BAR'];
export const CRITERIO_BEBIDA_CATEGORIAS = [
  'BEBIDAS',
  'CAFES',
  'CAFÉS',
  'FRAPPES',
  'FRAPPÉS',
  'INFUSIONES',
  'JUGOS',
  'BEBIDA',
];

export function esLineaBebida(linea: any): boolean {
  const areaNombre = (linea.area?.nombre || '').trim().toUpperCase();
  if (CRITERIO_BEBIDA_AREAS.some((a) => areaNombre.includes(a))) {
    return true;
  }
  const categoria = String(
    linea.categoria?.nombre || linea.categoria_nombre || linea.categoria || '',
  )
    .trim()
    .toUpperCase();
  if (categoria && CRITERIO_BEBIDA_CATEGORIAS.some((c) => categoria.includes(c))) {
    return true;
  }
  return false;
}

export function formatearHora(fecha?: Date | string | null): string {
  if (!fecha) return '00:00';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return '00:00';
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Lima',
  }).format(d);
}

export function formatearFecha(fecha?: Date | string | null): string {
  if (!fecha) return '';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Lima',
  }).format(d);
}

export function canalLabel(c?: string | null): string {
  if (!c) return 'Web';
  const cu = c.toUpperCase();
  if (cu === 'CARTA') return 'Web';
  if (cu === 'BOT' || cu === 'WHATSAPP') return 'WhatsApp';
  if (cu === 'MOZO') return 'Mozo';
  if (cu === 'CAJA') return 'Caja';
  return c;
}

export function modLabel(m?: string | null): string {
  if (!m) return 'Local';
  const mu = m.toUpperCase();
  if (mu === 'DELIVERY') return 'Delivery';
  if (mu === 'LLEVAR' || mu === 'RECOGER') return 'Para llevar';
  if (mu === 'MESA') return 'En mesa';
  return m;
}

export function obtenerModalidadPill(pedido: any): string {
  if (pedido.mesa_nombre) {
    const mesa = String(pedido.mesa_nombre).trim().toUpperCase();
    return mesa.startsWith('MESA') ? mesa : `MESA ${mesa}`;
  }
  return modLabel(pedido.modalidad).toUpperCase();
}

export function obtenerNombreCliente(pedido: any): string {
  if (pedido.cliente_nombre && pedido.cliente_nombre.trim()) {
    return pedido.cliente_nombre.trim();
  }
  if (pedido.mesa_nombre) {
    const mesa = String(pedido.mesa_nombre).trim().toUpperCase();
    return mesa.startsWith('MESA') ? mesa : `Mesa ${pedido.mesa_nombre}`;
  }
  return 'Cliente';
}

export function construirEtiquetaGeneral(pedido: any): EtiquetaGeneralDatos {
  const lineas: any[] = pedido.lineas || [];
  const modalidadPill = obtenerModalidadPill(pedido);
  const hora = formatearHora(pedido.creado_en);
  const fecha = formatearFecha(pedido.creado_en);
  const canal = canalLabel(pedido.canal);
  const clienteNombre = obtenerNombreCliente(pedido);

  const cantidadProductos = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 1), 0);
  const productosGeneral: EtiquetaGeneralProducto[] = lineas.map((l) => ({
    cantidad: Number(l.cantidad) || 1,
    nombre: l.nombre,
    tamano: l.tamano || null,
  }));

  return {
    tipo: 'ETIQUETA_GENERAL',
    codigo: pedido.codigo,
    modalidad: modLabel(pedido.modalidad),
    modalidadPill,
    who: clienteNombre,
    canal,
    hora,
    fecha,
    cantidadProductos,
    productos: productosGeneral,
    nota: pedido.nota || null,
    printer: 'Etiquetera de caja',
  };
}

export function construirEtiquetasArea(pedido: any): EtiquetaAreaDatos[] {
  const lineas: any[] = pedido.lineas || [];
  const modalidadPill = obtenerModalidadPill(pedido);
  const hora = formatearHora(pedido.creado_en);
  const fecha = formatearFecha(pedido.creado_en);
  const canal = canalLabel(pedido.canal);
  const clienteNombre = obtenerNombreCliente(pedido);

  const areaMap = new Map<string, any[]>();
  lineas.forEach((l) => {
    const areaRaw = l.area?.nombre?.trim();
    const areaNombre = (areaRaw || 'COCINA').toUpperCase();
    if (!areaMap.has(areaNombre)) {
      areaMap.set(areaNombre, []);
    }
    areaMap.get(areaNombre)!.push(l);
  });

  const totalAreas = areaMap.size;
  let areaIdx = 1;
  const areas: EtiquetaAreaDatos[] = [];

  for (const [areaNombre, lList] of areaMap.entries()) {
    const lineasArea: EtiquetaAreaLinea[] = lList.map((l) => {
      const opciones = (l.opcionesElegidas || l.opciones || [])
        .map((o: any) => o.opcion_nombre || o.nombre || '')
        .filter(Boolean);
      return {
        cantidad: Number(l.cantidad) || 1,
        nombre: l.nombre,
        tamano: l.tamano || null,
        opciones,
        nota: l.nota || null,
      };
    });

    const esCompacta = lineasArea.length > 1;

    areas.push({
      tipo: 'ETIQUETA_AREA',
      areaNombre,
      areaIndex: areaIdx++,
      totalAreas,
      codigo: pedido.codigo,
      modalidadPill,
      who: clienteNombre,
      canal,
      hora,
      fecha,
      lineas: lineasArea,
      esCompacta,
      nota: pedido.nota || null,
      printer: `Etiquetera de ${areaNombre.toLowerCase()}`,
    });
  }

  return areas;
}

export function construirEtiquetasBebida(pedido: any): EtiquetaBebidaDatos[] {
  const lineas: any[] = (pedido.lineas || []).filter(esLineaBebida);
  const hora = formatearHora(pedido.creado_en);
  const clienteNombre = obtenerNombreCliente(pedido);
  const bebidas: EtiquetaBebidaDatos[] = [];

  lineas.forEach((linea) => {
    const cant = Math.max(1, Number(linea.cantidad) || 1);
    const nombres = (linea.nombres_persona || []).filter(Boolean);
    const opciones = (linea.opcionesElegidas || linea.opciones || [])
      .map((o: any) => o.opcion_nombre || o.nombre || '')
      .filter(Boolean);

    const contiene =
      linea.ingredientes ||
      linea.contenido ||
      (opciones.length > 0 ? opciones.join(', ') : null);

    for (let i = 0; i < cant; i++) {
      const nombreVaso = (nombres[i] && String(nombres[i]).trim()) || clienteNombre;
      bebidas.push({
        tipo: 'ETIQUETA_BEBIDA',
        bebidaIndex: bebidas.length + 1,
        totalBebidas: 0,
        codigo: pedido.codigo,
        persona: nombreVaso,
        bebidaNombre: linea.nombre,
        tamano: linea.tamano || null,
        opciones,
        contiene,
        who: `Para: ${clienteNombre}`,
        hora,
      });
    }
  });

  const totalBebidas = bebidas.length;
  bebidas.forEach((b, idx) => {
    b.bebidaIndex = idx + 1;
    b.totalBebidas = totalBebidas;
  });

  return bebidas;
}

export function construirTodasLasEtiquetas(pedido: any) {
  return {
    general: construirEtiquetaGeneral(pedido),
    areas: construirEtiquetasArea(pedido),
    bebidas: construirEtiquetasBebida(pedido),
  };
}

/** Clave estable de una etiqueta dentro del pedido (general, un área o un vaso). */
export const CLAVE_GENERAL = 'GENERAL';
export const claveEtiquetaArea = (areaNombre: string) => `AREA:${areaNombre}`;
export const claveEtiquetaBebida = (bebidaIndex: number) => `BEBIDA:${bebidaIndex}`;

/** Clave de la etiqueta a la que pertenece un print_job, leída de su payload. */
export function claveDeTrabajo(job: { tipo: string; payload: any }): string | null {
  const p = job.payload || {};
  if (job.tipo === 'ETIQUETA_GENERAL') return CLAVE_GENERAL;
  if (job.tipo === 'ETIQUETA_AREA') return claveEtiquetaArea(String(p.areaNombre ?? ''));
  if (job.tipo === 'ETIQUETA_BEBIDA') return claveEtiquetaBebida(Number(p.bebidaIndex));
  return null;
}
