import { descuentosDePedido, entradaDeLineaPedido, esAreaBebidas, type TicketPagoDatos } from '@caprichos/compartido';
import { lineasDeCuenta } from './precuentaDetalle';
import { Pedido, LineaPedido } from './pedidosApi';
import { canalLabel, modLabel } from './PedidosAdminView';

/**
 * Criterio de negocio para detectar bebidas (HU-CAP-052, RQ-COC-02-03):
 * 1. El área asociada coincide con 'BARRA' o variantes de bebidas ('BAR', 'BEBIDAS', 'CAFETERIA').
 * 2. Si no viene área o es genérica, la categoría (si existe en los datos) coincide con bebidas o cafés.
 * 3. Es configurable y fácil de extender a través de estas constantes.
 */
export const CRITERIO_BEBIDA_AREAS = ['BARRA', 'BEBIDAS', 'CAFETERIA', 'BAR'];
export const CRITERIO_BEBIDA_CATEGORIAS = ['BEBIDAS', 'CAFES', 'FRAPPES', 'INFUSIONES', 'JUGOS', 'BEBIDA'];

const grupoDe = (o: any): string => String(o.grupo_nombre || '');

/** Opciones elegidas que son una bebida del combo (grupos «Bebida 1 · Bebida»), en orden. */
export function bebidasDeCombo(linea: LineaPedido): any[] {
  return (linea.opcionesElegidas || linea.opciones || []).filter((o: any) => {
    const g = grupoDe(o);
    return g.includes(' · ') && /^bebida/i.test(g.split(' · ')[1].trim());
  });
}

export function esLineaBebida(linea: LineaPedido): boolean {
  // un combo no es una bebida: sus bebidas salen una por una (bebidasDeCombo)
  const cat = String((linea as any).categoria || (linea as any).categoria_nombre || '').toUpperCase();
  if (cat.includes('COMBO') || (linea.opcionesElegidas || linea.opciones || []).some((o: any) => grupoDe(o).includes(' · '))) {
    return false;
  }
  const areaNombre = (linea.area?.nombre || '').trim().toUpperCase();
  if (CRITERIO_BEBIDA_AREAS.some((a) => areaNombre.includes(a))) {
    return true;
  }
  const categoria = String((linea as any).categoria || (linea as any).categoria_nombre || '').trim().toUpperCase();
  if (categoria && CRITERIO_BEBIDA_CATEGORIAS.some((c) => categoria.includes(c))) {
    return true;
  }
  return false;
}

export function formatearHora(isoString?: string | null): string {
  if (!isoString) return '00:00';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '00:00';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatearFecha(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

export function obtenerModalidadPill(pedido: Pedido): string {
  if (pedido.mesa_nombre) {
    const mesa = pedido.mesa_nombre.trim().toUpperCase();
    return mesa.startsWith('MESA') ? mesa : `MESA ${mesa}`;
  }
  return modLabel(pedido.modalidad).toUpperCase();
}

export interface EtiquetaGeneralProducto {
  cantidad: number;
  nombre: string;
  tamano?: string | null;
}

export interface EtiquetaGeneralDatos {
  codigo: string;
  modalidad: string;
  modalidadPill: string;
  who: string;
  canal: string;
  hora: string;
  fecha: string;
  cantidadProductos: number;
  productos: EtiquetaGeneralProducto[];
  nota?: string | null;
  total?: number | null;
  /** Solo delivery */
  direccion?: string | null;
  telefono?: string | null;
  printer: string;
}

export interface EtiquetaAreaLinea {
  cantidad: number;
  nombre: string;
  tamano?: string | null;
  opciones: string[];
  nota?: string | null;
}

export interface EtiquetaAreaDatos {
  areaNombre: string;
  areaIndex: number;
  totalAreas: number;
  codigo: string;
  modalidadPill: string;
  who: string;
  canal: string;
  hora: string;
  fecha: string;
  lineas: EtiquetaAreaLinea[];
  esCompacta: boolean;
  nota?: string | null;
  printer: string;
}

export interface EtiquetaBebidaDatos {
  bebidaIndex: number;
  totalBebidas: number;
  codigo: string;
  persona: string;
  bebidaNombre: string;
  tamano?: string | null;
  opciones: string[];
  contiene?: string | null;
  who: string;
  hora: string;
}

export interface ResumenEtiquetas {
  general: EtiquetaGeneralDatos;
  areas: EtiquetaAreaDatos[];
  bebidas: EtiquetaBebidaDatos[];
  bebidasVisibles: EtiquetaBebidaDatos[];
  bebidasRestantes: number;
  totalProductos: number;
  esPedidoNuevo: boolean;
  notaEstado: string;
}

export function armarEtiquetas(pedido: Pedido): ResumenEtiquetas {
  const lineas = pedido.lineas || [];
  const modalidadPill = obtenerModalidadPill(pedido);
  const hora = formatearHora(pedido.creado_en);
  const fecha = formatearFecha(pedido.creado_en);
  const canal = canalLabel(pedido.canal);
  const clienteNombre =
    pedido.cliente_nombre ||
    (pedido.mesa_nombre
      ? pedido.mesa_nombre.toUpperCase().startsWith('MESA')
        ? pedido.mesa_nombre
        : `Mesa ${pedido.mesa_nombre}`
      : 'Cliente');

  // 1. General
  const cantidadProductos = lineas.reduce((acc, l) => acc + (l.cantidad || 1), 0);
  const productosGeneral: EtiquetaGeneralProducto[] = lineas.map((l) => ({
    cantidad: l.cantidad,
    nombre: l.nombre,
    tamano: l.tamano || null,
  }));

  const general: EtiquetaGeneralDatos = {
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
    total: pedido.total != null && pedido.total !== '' ? Number(pedido.total) : null,
    // Solo delivery: dirección y celular van en el sticker (igual que arma la API)
    ...(String(pedido.modalidad || '').toUpperCase() === 'DELIVERY'
      ? { direccion: pedido.entrega_direccion?.trim() || null, telefono: pedido.cliente_telefono?.trim() || null }
      : {}),
    printer: 'Etiquetera de caja',
  };

  // 2. Por Área
  // Agrupa las líneas por linea.area.nombre; si no trae área usa 'SALADOS'. Bebidas no lleva sticker por área.
  const areaMap = new Map<string, LineaPedido[]>();
  lineas.forEach((l) => {
    const areaRaw = l.area?.nombre?.trim();
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
      const opciones = (l.opcionesElegidas || l.opciones || [])
        .map((o) => o.opcion_nombre || o.nombre || '')
        .filter(Boolean);
      return {
        cantidad: l.cantidad,
        nombre: l.nombre,
        tamano: l.tamano || null,
        opciones,
        nota: l.nota || null,
      };
    });

    // Se compacta cuando el área tiene varios productos (más de 1 línea o total de unidades > 1 con detalles)
    const esCompacta = lineasArea.length > 1;

    areas.push({
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

  // 3. Por Bebida
  // Una por cada vaso: si linea tiene cantidad 2, son 2 etiquetas
  const bebidas: EtiquetaBebidaDatos[] = [];

  lineas.forEach((linea) => {
    const cant = Math.max(1, linea.cantidad || 1);
    const enCombo = bebidasDeCombo(linea);
    if (enCombo.length > 0) {
      const todos = linea.nombres_persona || [];
      for (let u = 0; u < cant; u++) {
        enCombo.forEach((o: any, k: number) => {
          bebidas.push({
            bebidaIndex: bebidas.length + 1,
            totalBebidas: 0,
            codigo: pedido.codigo,
            persona: (todos[u * enCombo.length + k] || '').trim() || clienteNombre,
            bebidaNombre: o.opcion_nombre || o.nombre || '',
            tamano: linea.tamano || null,
            opciones: [],
            contiene: null,
            who: `Para: ${clienteNombre}`,
            hora,
          });
        });
      }
      return;
    }
    if (!esLineaBebida(linea)) return;
    const nombres = (linea.nombres_persona || []).filter(Boolean);
    const opciones = (linea.opcionesElegidas || linea.opciones || [])
      .map((o) => o.opcion_nombre || o.nombre || '')
      .filter(Boolean);

    // Si no existen ingredientes en datos, no se inventan: se usan solo las opciones elegidas
    const contiene = (linea as any).ingredientes || (linea as any).contenido || (opciones.length > 0 ? opciones.join(', ') : null);

    for (let i = 0; i < cant; i++) {
      const nombreVaso = (nombres[i] && nombres[i].trim()) || clienteNombre;
      bebidas.push({
        bebidaIndex: bebidas.length + 1,
        totalBebidas: 0, // se completa al final
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

  const bebidasVisibles = bebidas.slice(0, 6);
  const bebidasRestantes = Math.max(0, totalBebidas - 6);

  const esPedidoNuevo = pedido.estado === 'COLA' || pedido.estado === 'PENDIENTE' || pedido.estado === 'NUEVO';
  const notaEstado = esPedidoNuevo
    ? 'Vista previa. Estas etiquetas se imprimirán solas, junto con la comanda, cuando caja acepte el pedido.'
    : 'Sale una general en caja, una por área en su etiquetera y una por vaso en barra.';

  return {
    general,
    areas,
    bebidas,
    bebidasVisibles,
    bebidasRestantes,
    totalProductos: cantidadProductos,
    esPedidoNuevo,
    notaEstado,
  };
}

/**
 * Datos del ticket de pago para la vista previa (la misma maqueta que imprime la ticketera).
 * Antes de cobrar no hay cobro registrado: el pago sale del medio elegido o del plan de pago del pedido.
 */
export function armarTicketPago(pedido: Pedido, igvPct: number = 18): TicketPagoDatos {
  const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
  const total = num(pedido.total);
  const plan = (pedido.planPago || []).map((p) => ({ medio: String(p.medio), monto: num(p.monto) }));
  // Mismo criterio que el servidor (construirTicketPago): el tipo de comprobante del pedido manda el diseño
  const tipoDoc = pedido.comprobante_tipo === 'BOLETA' || pedido.comprobante_tipo === 'FACTURA' ? pedido.comprobante_tipo : 'SIMPLE';
  const doc = pedido.comprobante_doc?.trim() || null;
  const documento: TicketPagoDatos['documento'] =
    tipoDoc === 'SIMPLE'
      ? { tipo: 'SIMPLE' }
      : {
          tipo: tipoDoc,
          clienteNombre: pedido.comprobante_razon?.trim() || pedido.cliente_nombre || null,
          docTipo: tipoDoc === 'FACTURA' ? 'RUC' : doc?.length === 8 ? 'DNI' : doc ? 'CE' : null,
          docNumero: doc,
          direccion: tipoDoc === 'FACTURA' ? pedido.comprobante_direccion?.trim() || null : null,
          igvPct,
        };
  return {
    tipo: 'TICKET_PAGO',
    documento,
    local: { nombre: 'Caprichos' },
    codigo: pedido.codigo,
    fecha: formatearFecha(pedido.creado_en),
    hora: formatearHora(pedido.creado_en),
    who: pedido.cliente_nombre || '',
    modalidad: pedido.modalidad || '',
    // Mismo detalle que el ticket impreso (sabores, opciones, nota, combo, cortesía)
    lineas: lineasDeCuenta(pedido.lineas || []).map((l) => entradaDeLineaPedido(l, pedido.lineas || [])),
    subtotal: num(pedido.subtotal),
    descuentos: descuentosDePedido(pedido),
    ...(num(pedido.envio) > 0 ? { envio: num(pedido.envio) } : {}),
    notaPedido: pedido.nota?.trim() || null,
    entrega: pedido.mesa_nombre ? `Mesa ${String(pedido.mesa_nombre).replace(/^mesa\s*/i, '')}` : pedido.entrega_direccion?.trim() || null,
    pagaCon: pedido.paga_con == null ? null : num(pedido.paga_con),
    total,
    pagos: !plan.length && pedido.pago_metodo ? [{ medio: String(pedido.pago_metodo), monto: total }] : [],
    plan,
    comprobante: null,
  };
}
