import { normalizarBusqueda } from '../../../comun/normalizarBusqueda';

const EN_CURSO = ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];

/**
 * Imita a la API de «Mis pedidos» para los tests: aplica `q` (cliente, código o mesa) y `estado`
 * (lista con comas, EN_CURSO agrupa los activos) a la respuesta. El resumen no cambia.
 */
export function filtrarComoServidor(base: { pedidos: any[] }, filtros: { q?: string; estado?: string }): any {
  const q = normalizarBusqueda(filtros.q);
  const estados = filtros.estado ? filtros.estado.split(',') : [];
  const pedidos = base.pedidos.filter((p) => {
    if (q && ![p.codigo, p.clienteNombre, p.mesaNombre].some((campo) => normalizarBusqueda(campo).includes(q))) return false;
    return estados.length === 0 || estados.some((e) => (e === 'EN_CURSO' ? EN_CURSO.includes(p.estado) : p.estado === e));
  });
  return { ...base, pedidos };
}
