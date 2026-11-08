import { representacionDe } from '../comprobantes/facturacion/representacion';
import {
  EtiquetaGeneralDatos,
  EtiquetaGeneralProducto,
  EtiquetaAreaDatos,
  EtiquetaAreaLinea,
  EtiquetaBebidaDatos,
  TicketPagoDatos,
  entradaDeLineaPedido,
  descuentosDePedido,
  TicketComandaSalonDatos,
  esAreaBebidas,
  plusCodeParaMostrar,
} from '@caprichos/compartido';
import { lineasDeCuenta } from '../pedidos/lineas-combo.util';

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

/** Opciones de la línea para la etiqueta: el reparto por sabor («2 Fresa · 3 Oreo · 1 Manjar») primero, si lo hay. */
const opcionesConSabores = (linea: any, opciones: string[]): string[] => {
  const reparto = (linea.sabores || []).map((s: any) => `${s.cantidad} ${s.sabor_nombre}`);
  return reparto.length > 0 ? [reparto.join(' · '), ...opciones] : opciones;
};

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
  const lineas: any[] = lineasDeCuenta(pedido.lineas || []);
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
    total: pedido.total != null ? Number(pedido.total) : null,
    // Solo delivery: el repartidor lleva dirección y celular en el sticker
    ...(String(pedido.modalidad || '').toUpperCase() === 'DELIVERY'
      ? {
          direccion: pedido.entrega_direccion?.trim() || null,
          telefono: pedido.cliente_telefono?.trim() || null,
          plus: pedido.entrega_lat != null && pedido.entrega_lng != null ? plusCodeParaMostrar(Number(pedido.entrega_lat), Number(pedido.entrega_lng)) : null,
        }
      : {}),
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
    if (l.producto_id == null && l.area_id == null && !l.area) return; // madre de combo: sus partes van por área
    const areaRaw = l.area?.nombre?.trim();
    // Bebidas no tiene sticker por área: sus vasos ya salen en construirEtiquetasBebida
    if (esAreaBebidas(areaRaw)) return;
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
      const opciones = opcionesConSabores(l, (l.opcionesElegidas || l.opciones || [])
        .map((o: any) => o.opcion_nombre || o.nombre || '')
        .filter(Boolean));
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
            ...(linea.area_id ? { areaId: String(linea.area_id) } : {}),
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
        ...(linea.area_id ? { areaId: String(linea.area_id) } : {}),
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

/**
 * Comanda de salón: TODAS las líneas del pedido (tamaño, opciones y notas), con mesa o cliente, hora y código.
 * La imprime la ticketera de Caja al aceptarse el pedido; no se usa para llevar ni delivery (lo filtra la regla).
 */
export function construirTicketComandaSalon(pedido: any): TicketComandaSalonDatos {
  const lineas: any[] = lineasDeCuenta(pedido.lineas || []);
  const mesa = pedido.mesa_nombre ? String(pedido.mesa_nombre).trim() : null;
  return {
    tipo: 'TICKET_COMANDA_SALON',
    codigo: pedido.codigo,
    mesa: mesa || null,
    cliente: (pedido.cliente_nombre || '').trim(),
    canal: canalLabel(pedido.canal),
    hora: formatearHora(pedido.creado_en),
    fecha: formatearFecha(pedido.creado_en),
    lineas: lineas.map((l) => ({
      cantidad: Number(l.cantidad) || 1,
      nombre: l.nombre,
      tamano: l.tamano || null,
      opciones: opcionesConSabores(l, (l.opcionesElegidas || l.opciones || []).map((o: any) => o.opcion_nombre || o.nombre || '').filter(Boolean)),
      nota: l.nota || null,
    })),
    nota: pedido.nota || null,
  };
}

/**
 * Comanda de un área: la misma hoja de salón con solo las líneas de esa área (areaId null = líneas sin área).
 * Reutiliza construirTicketComandaSalon; cambia el tipo y lleva el nombre del área en la cabecera.
 */
export function construirTicketComandaArea(pedido: any, areaId: bigint | null): TicketComandaSalonDatos {
  const lineas: any[] = (pedido.lineas || []).filter((l: any) => String(l.area_id ?? null) === String(areaId));
  const nombre: string | null = lineas.find((l) => l.area?.nombre)?.area.nombre ?? null;
  return {
    ...construirTicketComandaSalon({ ...pedido, lineas }),
    tipo: 'TICKET_COMANDA_AREA',
    area: nombre ? String(nombre).toUpperCase() : null,
  };
}

/** Áreas distintas de las líneas del pedido (null = líneas sin área), en orden de aparición. */
export function areasDeLineas(pedido: any): Array<bigint | null> {
  const vistas: Array<bigint | null> = [];
  for (const l of pedido.lineas || []) {
    const id: bigint | null = l.area_id ?? null;
    if (!vistas.some((v) => String(v) === String(id))) vistas.push(id);
  }
  return vistas;
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

/** Detalle de línea y descuentos: una sola función compartida con la precuenta y la vista previa (packages/compartido). */
export const lineaDetalleTicket = entradaDeLineaPedido;
export { descuentosDePedido };

/** Celular con solo los 3 últimos dígitos a la vista. */
const enmascarar = (tel: unknown): string | null => {
  const d = String(tel ?? '').replace(/\D/g, '');
  return d.length >= 4 ? `${'*'.repeat(d.length - 3)}${d.slice(-3)}` : null;
};

/** Ticket/voucher de pago para la ticketera térmica; el agente lo maquetea a 58 u 80 mm. */
// ponytail: el tipo `propina` y `ajusteUbicacion` ya están en packages/compartido/src; el dist publicado puede ir
// atrasado, así que se declaran aquí en la intersección para no depender del orden de construcción.
export function construirTicketPago(
  pedido: any,
  local: any,
  comprobante?: any,
  ajusteUbicacion?: { tipo: 'SALDO' | 'DEVOLUCION'; monto: number } | null,
  igvPct?: number | null,
): TicketPagoDatos & { propina?: number; ajusteUbicacion?: { tipo: 'SALDO' | 'DEVOLUCION'; monto: number } } {
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const cobro = (pedido.cobros || []).find((c: any) => !c.anulado_en);
  const ahora = cobro?.en ?? new Date();
  // Diseño por tipo de comprobante: el del pedido (SIMPLE si no hay); BOLETA/FACTURA llevan los datos del cliente de ESE comprobante
  const tipoDoc = pedido.comprobante_tipo === 'BOLETA' || pedido.comprobante_tipo === 'FACTURA' ? pedido.comprobante_tipo : 'SIMPLE';
  const esFactura = tipoDoc === 'FACTURA';
  const doc = texto(pedido.comprobante_doc) || texto(comprobante?.documento);
  const documento: NonNullable<TicketPagoDatos['documento']> =
    tipoDoc === 'SIMPLE'
      ? { tipo: 'SIMPLE' }
      : {
          tipo: tipoDoc,
          clienteNombre: texto(pedido.comprobante_razon) || texto(comprobante?.razon_social) || texto(pedido.cliente_nombre),
          docTipo: esFactura ? 'RUC' : doc?.length === 8 ? 'DNI' : doc ? 'CE' : null,
          docNumero: doc,
          direccion: esFactura ? texto(pedido.comprobante_direccion) : null,
          igvPct: igvPct ?? null,
        };
  return {
    tipo: 'TICKET_PAGO',
    documento,
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
    // Solo las líneas madre: las piezas de un combo cuelgan de su combo con su sabor y tamaño
    lineas: lineasDeCuenta<any>(pedido.lineas || []).map((l) => lineaDetalleTicket(l, pedido.lineas || [])),
    ...(pedido.subtotal != null ? { subtotal: num(pedido.subtotal) } : {}),
    descuentos: descuentosDePedido(pedido),
    ...(num(pedido.envio) > 0 ? { envio: num(pedido.envio) } : {}),
    notaPedido: texto(pedido.nota),
    entrega: pedido.mesa_nombre ? `Mesa ${String(pedido.mesa_nombre).replace(/^mesa\s*/i, '')}` : texto(pedido.entrega_direccion),
    clienteTelefono: enmascarar(pedido.cliente_telefono),
    pagaCon: pedido.paga_con == null ? null : num(pedido.paga_con),
    // total = venta (comprobante). La propina va en su propia línea; el pago por medio es venta + propina (lo entregado)
    total: num(pedido.total),
    propina: num(pedido.propina ?? 0),
    // Solo si hay ajuste de cambio de dirección pendiente: sin él, el ticket sale igual que antes
    ...(ajusteUbicacion ? { ajusteUbicacion: { tipo: ajusteUbicacion.tipo, monto: num(ajusteUbicacion.monto) } } : {}),
    pagos: (cobro?.pagos || []).map((p: any) => ({
      medio: p.medio,
      monto: num(num(p.monto) + num(p.propina ?? 0)),
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
  igvPct?: number | null,
): TicketPagoDatos {
  const base = construirTicketPago({ ...pedido, cobros: [] }, local, comprobante, null, igvPct);
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
    nota: 'PRUEBA - no es un pedido',
    printer: 'Etiquetera de caja',
  };
}

/** Sticker de bebida de ejemplo para «Imprimir prueba con este tamaño». */
export function construirEtiquetaBebidaPrueba(quien: string, ahora = new Date()): EtiquetaBebidaDatos {
  return {
    tipo: 'ETIQUETA_BEBIDA',
    bebidaIndex: 1,
    totalBebidas: 1,
    codigo: 'PRUEBA',
    persona: quien,
    bebidaNombre: 'Cappuccino',
    tamano: '12oz',
    opciones: ['Leche de avena', 'Sin azucar'],
    contiene: 'PRUEBA - no es un pedido',
    who: 'Para: prueba',
    hora: formatearHora(ahora),
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
    modalidad: 'PRUEBA - no es un pedido (SIN VALOR)',
    lineas: [
      { cantidad: 1, nombre: 'Linea de ejemplo 1 SIN VALOR', tamano: null, subtotal: 0 },
      { cantidad: 1, nombre: 'Linea de ejemplo 2 SIN VALOR', tamano: null, subtotal: 0 },
    ],
    total: 0,
    pagos: [{ medio: 'SIN VALOR', monto: 0 }],
  };
}
