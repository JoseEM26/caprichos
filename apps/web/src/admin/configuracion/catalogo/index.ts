import type { EntradaConfig } from './tipos';
import { LOCAL } from './local';
import { HORARIO } from './horario';
import { FECHAS } from './fechas';
import { PAGOS } from './pagos';
import { ZONAS } from './zonas';
import { DEMANDA } from './demanda';
import { REPARTO } from './reparto';
import { PARAMETROS } from './parametros';
import { CHATBOT } from './chatbot';
import { IMPRESION } from './impresion';
import { MAPA_IMPRESION } from './mapa-impresion';
import { AYUDA } from './ayuda';
import { VOUCHERS } from './vouchers';
import { INGRESO } from './ingreso';
import { OPERACION } from './operacion';
import { COCINA } from './cocina';

export type { EntradaConfig, PeligroConfig } from './tipos';

export const CATALOGO: EntradaConfig[] = [
  ...LOCAL, ...HORARIO, ...FECHAS, ...PAGOS, ...ZONAS, ...DEMANDA, ...REPARTO, ...PARAMETROS,
  ...CHATBOT, ...MAPA_IMPRESION, ...IMPRESION, ...AYUDA, ...VOUCHERS, ...INGRESO, ...OPERACION, ...COCINA,
];

/** Ids repetidos o mal formados (lo valida el test del catálogo). */
export function idsInvalidos(lista: EntradaConfig[] = CATALOGO): string[] {
  const vistos = new Set<string>();
  const malos: string[] = [];
  for (const e of lista) {
    if (vistos.has(e.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) malos.push(e.id);
    vistos.add(e.id);
  }
  return malos;
}
