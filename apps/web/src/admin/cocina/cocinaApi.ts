import { api } from '../../comun/api';
import type {
  AgotadoItem,
  AltaDemandaEstado,
  AreaCocina,
  Comanda,
  DuracionAgotado,
  HistorialComanda,
  ItemCartaBuscable,
  PedidoDespacho,
  TipoAgotado,
} from './cocinaTipos';

export async function listarAreasCocina(): Promise<AreaCocina[]> {
  return api.get<AreaCocina[]>('/admin/cocina/areas');
}

export async function listarComandasArea(areaRef: string): Promise<Comanda[]> {
  const query = areaRef ? `?area=${encodeURIComponent(areaRef)}` : '';
  return api.get<Comanda[]>(`/admin/cocina/comandas${query}`);
}

export async function despejarComanda(
  pedidoId: string,
  areaId: string,
): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(
    `/admin/cocina/comandas/${encodeURIComponent(pedidoId)}/${encodeURIComponent(areaId)}/despejar`,
  );
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

export async function listarDespacho(): Promise<PedidoDespacho[]> {
  return api.get<PedidoDespacho[]>('/admin/cocina/despacho');
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
  items: { insumo: string; cantidad: number; unidad: string }[];
  nota?: string;
  area?: string;
}): Promise<any> {
  return api.post('/admin/almacen/pedidos-internos', dto);
}

export async function registrarMermaIndividual(dto: {
  insumoId: string | number;
  cantidad: number;
  origen: string;
  motivo: string;
  nota?: string;
}): Promise<any> {
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

export async function registrarMermaMultiple(dto: {
  motivoGlobal?: string;
  lineas: {
    insumoId: string | number;
    cantidad: number;
    origen: string;
    destino: string;
  }[];
}): Promise<any> {
  return api.post('/admin/almacen/movimientos-merma-multiple', dto);
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
        items.push({
          tipo: 'PRODUCTO',
          id: p.id.toString(),
          nombre: p.nombre,
          subtitulo: `Producto · ${cat.nombre}`,
          categoriaNombre: cat.nombre,
        });

        const sabores = p.sabores || [];
        for (const s of sabores) {
          items.push({
            tipo: 'SABOR',
            id: s.id.toString(),
            nombre: `${s.nombre}`,
            subtitulo: `Sabor de ${p.nombre}`,
            categoriaNombre: cat.nombre,
          });
        }

        const grupos = p.grupos || [];
        for (const g of grupos) {
          const opciones = g.opciones || [];
          for (const op of opciones) {
            items.push({
              tipo: 'OPCION',
              id: op.id.toString(),
              nombre: `${op.nombre}`,
              subtitulo: `Opción de ${p.nombre} (${g.nombre})`,
              categoriaNombre: cat.nombre,
            });
          }
        }
      }
    }

    return items;
  } catch {
    return [];
  }
}
