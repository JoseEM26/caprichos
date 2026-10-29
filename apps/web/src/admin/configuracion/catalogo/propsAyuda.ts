import { CATALOGO } from './index';

/** Props de `<CampoAyuda>` sacadas del catálogo: una sola fuente para el buscador y para la ayuda visible del campo. */
export function propsAyuda(id: string) {
  const e = CATALOGO.find((x) => x.id === id);
  return {
    ayuda: e?.descripcion ?? '',
    ejemplo: e?.ejemplo,
    efecto: e?.efecto,
    unidad: e?.unidad,
    rango: e?.rango,
    porDefecto: e?.porDefecto,
  };
}
