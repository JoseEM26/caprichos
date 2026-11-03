import { representacionDe } from '../comprobantes/facturacion/representacion';
import {
  EtiquetaGeneralDatos,
  EtiquetaGeneralProducto,
  EtiquetaAreaDatos,
  EtiquetaAreaLinea,
  EtiquetaBebidaDatos,
  TicketPagoDatos,
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

const nombreOpcion = (o: any): string => o.opcion_nombre || o.nombre || '';
const grupoOpcion = (o: any): string => String(o.grupo_nombre || o.grupo || '');

/** Opciones elegidas de la línea que son una bebida del combo (grupos «Bebida 1 · Bebida»), en orden. */
export function bebidasDeCombo(linea: any): any[] {
  return (linea.opcionesElegidas || linea.opciones || []).filter((o: any) => {
    const g = grupoOpcion(o);
    return g.includes(' · ') && /^bebida/i.test(g.split(' · ')[1].trim());
  });
}

/** Un combo se reconoce por sus grupos «paso · tipo» o por su categoría, nunca por el nombre. */
function esLineaCombo(linea: any): boolean {
  const categoria = String(linea.categoria?.nombre || linea.categoria_nombre || linea.categoria || '').toUpperCase();
  return (
    categoria.includes('COMBO') ||
    (linea.opcionesElegidas || linea.opciones || []).some((o: any) => grupoOpcion(o).includes(' · '))
  );
}

export function esLineaBebida(linea: any): boolean {
  // un combo no es una bebida: sus bebidas salen una por una (bebidasDeCombo)
  if (esLineaCombo(linea)) return false;
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
    const areaNombre = (areaRaw || 'SALADOS').toUpperCase();
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
  const lineas: any[] = pedido.lineas || [];
  const hora = formatearHora(pedido.creado_en);
  const clienteNombre = obtenerNombreCliente(pedido);
  const bebidas: EtiquetaBebidaDatos[] = [];

  lineas.forEach((linea) => {
    const cant = Math.max(1, Number(linea.cantidad) || 1);
    const nombres = (linea.nombres_persona || []).filter(Boolean);
    const enCombo = bebidasDeCombo(linea);
    if (enCombo.length > 0) {
      // nombres en orden: unidad 1 (bebida 1, bebida 2), unidad 2 (...)
      const todos: any[] = linea.nombres_persona || [];
      for (let u = 0; u < cant; u++) {
        enCombo.forEach((o, k) => {
          const paso = grupoOpcion(o).split(' · ')[0].trim();
          const extras = (linea.opcionesElegidas || linea.opciones || [])
            .filter((x: any) => x !== o && grupoOpcion(x).startsWith(`${paso} · `))
            .map(nombreOpcion)
            .filter(Boolean);
          bebidas.push({
            tipo: 'ETIQUETA_BEBIDA',
            bebidaIndex: 0,
            totalBebidas: 0,
            codigo: pedido.codigo,
            persona: (todos[u * enCombo.length + k] && String(todos[u * enCombo.length + k]).trim()) || clienteNombre,
            bebidaNombre: nombreOpcion(o),
            tamano: linea.tamano || null,
            opciones: extras,
            contiene: extras.length > 0 ? extras.join(', ') : null,
            who: `Para: ${clienteNombre}`,
            hora,
          });
        });
      }
      return;
    }
    if (!esLineaBebida(linea)) return;
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

const num = (v: unknown): number => Math.round(Number(v ?? 0) * 100) / 100;

/** Ticket/voucher de pago para la ticketera térmica; el agente lo maquetea a 58 u 80 mm. */
export function construirTicketPago(pedido: any, local: any, comprobante?: any): TicketPagoDatos {
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const cobro = (pedido.cobros || []).find((c: any) => !c.anulado_en);
  const ahora = cobro?.en ?? new Date();
  return {
    tipo: 'TICKET_PAGO',
    local: {
      nombre: texto(local?.nombre) || 'Caprichos',
      razonSocial: texto(local?.razon_social) || texto(local?.razonSocial),
      ruc: texto(local?.ruc),
      direccion: texto(local?.direccion),
    },
    codigo: pedido.codigo,
    fecha: formatearFecha(ahora),
    hora: formatearHora(ahora),
    who: pedido.cliente_nombre || '',
    modalidad: pedido.modalidad || '',
    lineas: (pedido.lineas || []).map((l: any) => ({
      cantidad: l.cantidad,
      nombre: l.nombre,
      tamano: l.tamano ?? null,
      subtotal: num(l.subtotal ?? Number(l.precio_unit) * l.cantidad),
    })),
    total: num(pedido.total),
    pagos: (cobro?.pagos || []).map((p: any) => ({
      medio: p.medio,
      monto: num(p.monto),
      recibido: p.recibido == null ? null : num(p.recibido),
      vuelto: p.vuelto == null ? null : num(p.vuelto),
    })),
    plan: (pedido.planPago || []).map((p: any) => ({ medio: p.medio, monto: num(p.monto) })),
    comprobante: comprobante
      ? {
          tipo: comprobante.tipo,
          numero: comprobante.numero_texto,
          // Boleta/factura electrónica: hash y QR en cuanto el XML está firmado; si SUNAT rechazó, se avisa
          ...(comprobante.tipo === 'BOLETA' || comprobante.tipo === 'FACTURA'
            ? (() => {
                const rep = representacionDe(comprobante);
                return { representacion: rep.titulo, hash: rep.hash, cadenaQr: rep.cadenaQr, simulado: rep.prueba, situacion: rep.situacion };
              })()
            : {}),
        }
      : null,
  };
}

/**
 * Ticket de la nota de venta que el mozo envía a Caja: aún no hay cobro, así que el pago sale del plan.
 * Efectivo con «Recibido» y «Vuelto» (vuelto contra el renglón de efectivo) y «Cobrado por mozo».
 */
export function construirTicketNotaMozo(
  pedido: any,
  local: any,
  comprobante: { tipo: string; numero_texto: string },
  pagos: Array<{ medio: string; monto: number }>,
  recibido: number | null,
  mozo: string | null,
): TicketPagoDatos {
  const base = construirTicketPago({ ...pedido, cobros: [] }, local, comprobante);
  const efectivo = pagos.filter((p) => p.medio === 'EFECTIVO').reduce((acc, p) => acc + Number(p.monto), 0);
  return {
    ...base,
    pagos: pagos.map((p) => {
      const conRecibido = p.medio === 'EFECTIVO' && recibido != null;
      return {
        medio: p.medio,
        monto: num(p.monto),
        recibido: conRecibido ? num(recibido) : null,
        vuelto: conRecibido ? num(Number(recibido) - efectivo) : null,
      };
    }),
    plan: [],
    cobradoPorMozo: mozo,
  };
}

/**
 * Datos de ejemplo para la prueba de la etiquetera: mismo formato que una etiqueta general real,
 * marcada como prueba (codigo PRUEBA, sin pedido). `quien` es el nombre de quien la pidió.
 */
export function construirEtiquetaPrueba(local: any, quien: string, ahora = new Date()): EtiquetaGeneralDatos {
  const nombreLocal = String(local?.nombre || '').trim() || 'Caprichos';
  return {
    tipo: 'ETIQUETA_GENERAL',
    codigo: 'PRUEBA',
    modalidad: 'Prueba',
    modalidadPill: 'PRUEBA',
    who: quien,
    canal: nombreLocal,
    hora: formatearHora(ahora),
    fecha: formatearFecha(ahora),
    cantidadProductos: 1,
    productos: [{ cantidad: 1, nombre: 'Linea de ejemplo', tamano: null }],
    nota: 'PRUEBA DE ETIQUETA: no es un pedido',
    printer: 'Etiquetera de caja',
  };
}

/**
 * Datos de ejemplo para la prueba de la ticketera: dos líneas y un pago de ejemplo marcado SIN VALOR.
 * No lleva comprobante (no inventa números ni hashes).
 */
export function construirTicketPrueba(local: any, quien: string, ahora = new Date()): TicketPagoDatos {
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    tipo: 'TICKET_PAGO',
    local: {
      nombre: texto(local?.nombre) || 'Caprichos',
      razonSocial: texto(local?.razon_social) || texto(local?.razonSocial),
      ruc: texto(local?.ruc),
      direccion: texto(local?.direccion),
    },
    codigo: 'PRUEBA',
    fecha: formatearFecha(ahora),
    hora: formatearHora(ahora),
    who: `Prueba pedida por ${quien}`,
    modalidad: 'PRUEBA DE TICKET (SIN VALOR)',
    lineas: [
      { cantidad: 1, nombre: 'Linea de ejemplo 1 SIN VALOR', tamano: null, subtotal: 0 },
      { cantidad: 1, nombre: 'Linea de ejemplo 2 SIN VALOR', tamano: null, subtotal: 0 },
    ],
    total: 0,
    pagos: [{ medio: 'SIN VALOR', monto: 0 }],
  };
}
