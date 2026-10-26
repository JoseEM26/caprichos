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

export function esLineaBebida(linea: LineaPedido): boolean {
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
    printer: 'Etiquetera de caja',
  };

  // 2. Por Área
  // Agrupa las líneas por linea.area.nombre; si no trae área usa 'COCINA'
  const areaMap = new Map<string, LineaPedido[]>();
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
  const lineasBebida = lineas.filter(esLineaBebida);
  const bebidas: EtiquetaBebidaDatos[] = [];

  lineasBebida.forEach((linea) => {
    const cant = Math.max(1, linea.cantidad || 1);
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
