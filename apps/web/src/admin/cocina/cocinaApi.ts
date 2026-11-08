import { api } from '../../comun/api';
import { registrarHoraServidor } from './tiempoEnVivo';
import type {
  AgotadoItem,
  AltaDemandaEstado,
  AreaCocina,
  Comanda,
  DespachoRespuesta,
  DuracionAgotado,
  HistorialComanda,
  InsumoExistenciaCocina,
  ItemCartaBuscable,
  PedidoInternoItem,
  TipoAgotado,
  TrasladoItem,
} from './cocinaTipos';

export async function listarAreasCocina(): Promise<AreaCocina[]> {
  return api.get<AreaCocina[]>('/admin/cocina/areas');
}

export async function listarComandasArea(areaRef: string): Promise<Comanda[]> {
  const query = areaRef ? `?area=${encodeURIComponent(areaRef)}` : '';
  const comandas = await api.get<Comanda[]>(`/admin/cocina/comandas${query}`);
  // Hora del servidor: el tiempo en vivo de las tarjetas se cuenta con ella, no con el reloj del navegador
  registrarHoraServidor(comandas.find((c) => c.ahoraServidor)?.ahoraServidor);
  return comandas;
}

export async function despejarComanda(
  pedidoId: string,
  areaId: string,
): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(
    `/admin/cocina/comandas/${encodeURIComponent(pedidoId)}/${encodeURIComponent(areaId)}/despejar`,
  );
}

/**
 * Fija las unidades listas de una línea (0..cantidad). Si el área queda completa, el servidor la despeja.
 * Bajar unidades de un área recién despejada (mismo usuario, 15 s) la reabre: `reabierta` lo confirma.
 */
export async function marcarUnidadesLinea(
  lineaId: string,
  listas: number,
): Promise<{ despejada: boolean; reabierta?: boolean }> {
  return api.post<{ despejada: boolean; reabierta?: boolean }>(
    `/admin/cocina/lineas/${encodeURIComponent(lineaId)}/listas`,
    { listas },
  );
}

/** Despacha lo listo de un pedido: sin líneas, todo lo listo; con líneas, solo esas unidades. */
export async function despacharPedido(
  pedidoId: string,
  lineas?: Array<{ lineaId: string; unidades: number }>,
): Promise<{ completo: boolean; estado: string }> {
  return api.post<{ completo: boolean; estado: string }>(
    `/admin/cocina/pedidos/${encodeURIComponent(pedidoId)}/despachar`,
    lineas ? { lineas } : {},
  );
}

/**
 * Ajustes de la pantalla que lee el personal (GET /admin/cocina/ajustes).
 * `confirmarDespejar` es el valor efectivo para quien consulta: su preferencia personal o, si no tiene, el general.
 */
export interface AjustesCocina {
  confirmarDespejar: boolean;
  confirmarDespejarGeneral?: boolean;
  personalizado?: boolean;
}

export async function obtenerAjustesCocina(): Promise<AjustesCocina> {
  return api.get<AjustesCocina>('/admin/cocina/ajustes');
}

/** Preferencia personal de «Confirmar al despejar». null la quita y vuelve al valor general del local. */
export async function guardarMisAjustesCocina(confirmarDespejar: boolean | null): Promise<AjustesCocina> {
  return api.put<AjustesCocina>('/admin/cocina/mis-ajustes', { confirmarDespejar });
}

export async function listarHistorialCocina(
  areaRef?: string,
): Promise<HistorialComanda[]> {
  const query = areaRef && areaRef.trim() ? `?area=${encodeURIComponent(areaRef)}` : '';
  return api.get<HistorialComanda[]>(`/admin/cocina/historial${query}`);
}

export async function devolverComanda(
  pedidoId: string,
  areaId: string,
): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(
    `/admin/cocina/comandas/${encodeURIComponent(pedidoId)}/${encodeURIComponent(areaId)}/devolver`,
  );
}

export async function listarAgotados(): Promise<AgotadoItem[]> {
  return api.get<AgotadoItem[]>('/admin/cocina/agotados');
}

export async function agotarElemento(dto: {
  tipo: TipoAgotado;
  id: string;
  duracion: DuracionAgotado;
}): Promise<any> {
  return api.post('/admin/cocina/agotados', dto);
}

export async function reactivarAgotado(id: string): Promise<any> {
  return api.post(`/admin/cocina/agotados/${encodeURIComponent(id)}/reactivar`);
}

export async function obtenerAltaDemanda(): Promise<AltaDemandaEstado> {
  return api.get<AltaDemandaEstado>('/admin/cocina/alta-demanda');
}

export async function configurarAltaDemanda(dto: {
  activa: boolean;
  minutos?: number;
  pausa?: boolean;
}): Promise<AltaDemandaEstado> {
  return api.put<AltaDemandaEstado>('/admin/cocina/alta-demanda', dto);
}

export async function pedirInsumosAlmacen(dto: {
  items: { insumo: string; cantidad: number; unidad: string; insumoId?: string | number }[];
  nota?: string;
  area?: string;
}): Promise<any> {
  return api.post('/admin/almacen/pedidos-internos', dto);
}

export async function registrarMermaIndividual(
  dto: {
    insumoId: string | number;
    cantidad: number;
    origen: string;
    motivo: string;
    nota?: string;
  },
): Promise<any> {
  return api.post('/admin/almacen/movimientos', {
    tipo: 'MERMA',
    insumoId: dto.insumoId,
    cantidad: dto.cantidad,
    origen: dto.origen,
    destino: `Merma · ${dto.motivo}`,
    motivo: dto.motivo,
    nota: dto.nota,
  });
}

export async function registrarMermaMultiple(
  dto: {
    motivoGlobal?: string;
    lineas: {
      insumoId: string | number;
      cantidad: number;
      origen: string;
      destino: string;
    }[];
  },
): Promise<any> {
  return api.post('/admin/almacen/movimientos-merma-multiple', dto);
}

export async function obtenerExistenciasParaPedir(): Promise<InsumoExistenciaCocina[]> {
  return api.get<InsumoExistenciaCocina[]>('/admin/cocina/existencias-para-pedir');
}

export async function listarPedidosInternos(): Promise<PedidoInternoItem[]> {
  return api.get<PedidoInternoItem[]>('/admin/almacen/pedidos-internos');
}

export async function listarTraslados(): Promise<TrasladoItem[]> {
  return api.get<TrasladoItem[]>('/admin/almacen/traslados');
}

export async function confirmarRecepcionTraslado(
  trasladoId: string,
  recibido: number,
): Promise<any> {
  return api.post(`/admin/almacen/traslados/${encodeURIComponent(trasladoId)}/confirmar-recepcion`, {
    recibido,
  });
}

export async function obtenerCartaCategorias(): Promise<any[]> {
  return api.get<any[]>('/carta');
}

/**
 * Consulta la carta pública y extrae todos los productos, sabores y opciones
 * para el buscador reactivo del diálogo "Se acabó algo".
 */
export async function buscarItemsDeCarta(): Promise<ItemCartaBuscable[]> {
  try {
    const categorias = await api.get<any[]>('/carta');
    const items: ItemCartaBuscable[] = [];

    if (!Array.isArray(categorias)) return items;

    for (const cat of categorias) {
      const prods = cat.productos || [];
      for (const p of prods) {
        const saboresList = (p.sabores || []).map((s: any) => ({
          id: s.id.toString(),
          nombre: s.nombre,
          disponible: s.disponible !== false,
        }));

        const opcionesList: Array<{ id: string; nombre: string; disponible: boolean; grupoNombre?: string }> = [];
        for (const g of p.grupos || []) {
          for (const op of g.opciones || []) {
            opcionesList.push({
              id: op.id.toString(),
              nombre: op.nombre,
              disponible: op.disponible !== false,
              grupoNombre: g.nombre,
            });
          }
        }

        items.push({
          tipo: 'PRODUCTO',
          id: p.id.toString(),
          nombre: p.nombre,
          subtitulo: `Producto · ${cat.nombre}`,
          categoriaNombre: cat.nombre,
          categoriaId: cat.id?.toString(),
          fotoUrl: p.fotoUrl || null,
          precio: p.precio,
          sabores: saboresList,
          opciones: opcionesList,
        });

        for (const s of saboresList) {
          items.push({
            tipo: 'SABOR',
            id: s.id,
            nombre: `${s.nombre}`,
            subtitulo: `Sabor de ${p.nombre}`,
            categoriaNombre: cat.nombre,
            categoriaId: cat.id?.toString(),
          });
        }

        for (const op of opcionesList) {
          items.push({
            tipo: 'OPCION',
            id: op.id,
            nombre: `${op.nombre}`,
            subtitulo: `Opción de ${p.nombre}${op.grupoNombre ? ` (${op.grupoNombre})` : ''}`,
            categoriaNombre: cat.nombre,
            categoriaId: cat.id?.toString(),
          });
        }
      }
    }

    return items;
  } catch {
    return [];
  }
}


/** Pantalla Despacho: pedidos completos del día (con `atendidos` también los ya atendidos). */
export async function listarDespacho(atendidos = false): Promise<DespachoRespuesta> {
  const r = await api.get<DespachoRespuesta>(`/admin/cocina/despacho${atendidos ? '?atendidos=true' : ''}`);
  registrarHoraServidor(r.ahoraServidor);
  return r;
}

/** Marca o desmarca el pedido como atendido (idempotente). */
export async function marcarPedidoAtendido(pedidoId: string, atendido: boolean): Promise<{ ok: boolean; atendido: boolean }> {
  return api.post<{ ok: boolean; atendido: boolean }>(
    `/admin/cocina/despacho/${encodeURIComponent(pedidoId)}/atendido`,
    { atendido },
  );
}
