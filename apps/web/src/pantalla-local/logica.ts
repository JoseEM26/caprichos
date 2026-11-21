/** Lógica pura de la pantalla de TV del local (sin React, fácil de probar). */

export interface PedidoPantalla {
  codigo: string;
  estado: 'PREPARANDO' | 'LISTO';
  modalidad: 'COMER_LOCAL' | 'LLEVAR';
  minutos: number;
  nombre: string | null;
  avatarUrl: string | null;
}

export interface RespuestaPantalla {
  pedidos: PedidoPantalla[];
  mostrarNombre: boolean;
  ahora: string;
}

/** Un pedido en pantalla; `saliendo` lo deja visible un instante para animar su salida. */
export interface PedidoVisible extends PedidoPantalla {
  saliendo?: boolean;
}

export interface Columna {
  preparando: PedidoVisible[];
  listos: PedidoVisible[];
}

export function agrupar(pedidos: PedidoVisible[]): { local: Columna; llevar: Columna } {
  const vacio = (): Columna => ({ preparando: [], listos: [] });
  const r = { local: vacio(), llevar: vacio() };
  for (const p of pedidos) {
    const col = p.modalidad === 'LLEVAR' ? r.llevar : r.local;
    (p.estado === 'LISTO' ? col.listos : col.preparando).push(p);
  }
  return r;
}

/** Pedidos que en la lectura nueva están LISTO y antes no (o no existían). `previos` null = primera lectura: no se anuncia nada. */
export function nuevosListos(previos: PedidoPantalla[] | null, nuevos: PedidoPantalla[]): PedidoPantalla[] {
  if (!previos) return [];
  const antes = new Map(previos.map((p) => [p.codigo, p.estado]));
  return nuevos.filter((p) => p.estado === 'LISTO' && antes.get(p.codigo) !== 'LISTO');
}

/** Mezcla la lectura nueva con lo que ya estaba: lo que desaparece queda marcado `saliendo` (la pantalla lo quita después). */
export function fusionarConSalida(visibles: PedidoVisible[], nuevos: PedidoPantalla[]): PedidoVisible[] {
  const claves = new Set(nuevos.map((p) => p.codigo));
  const saliendo = visibles.filter((p) => !claves.has(p.codigo)).map((p) => ({ ...p, saliendo: true }));
  return [...nuevos, ...saliendo];
}

/** Texto del globo de Capri. Sin nombre (parámetro apagado) solo lleva el código. */
export function textoGlobo(p: Pick<PedidoPantalla, 'codigo' | 'nombre'>): string {
  return p.nombre ? `¡${p.nombre}! Tu pedido ${p.codigo} está listo` : `¡Pedido ${p.codigo} listo!`;
}

/** Texto para la voz: el código se deletrea para que se entienda («CP W 9 4 5»). */
export function textoVoz(p: Pick<PedidoPantalla, 'codigo' | 'nombre'>): string {
  const codigo = p.codigo.replace(/-/g, ' ').split('').join(' ').replace(/ {2,}/g, ' ');
  return p.nombre ? `${p.nombre}, tu pedido ${codigo} está listo` : `Pedido ${codigo} listo`;
}

/** Temas con paleta propia en la pantalla; cualquier otro usa la paleta de Caprichos. */
export const TEMAS_PANTALLA = ['navidad', 'halloween', 'fiestas_patrias', 'san_valentin', 'ano_nuevo'] as const;
export function temaPantalla(clave: string | null | undefined): string {
  return (TEMAS_PANTALLA as readonly string[]).includes(String(clave)) ? String(clave) : 'normal';
}

/** Meta de espera para la barra de minutos: llena al llegar a este tiempo. */
export const META_ESPERA_MIN = 15;
export const porcentajeEspera = (minutos: number): number => Math.min(100, Math.round((minutos / META_ESPERA_MIN) * 100));
