import type { EntradaConfig } from './tipos';

// Pestaña «Mapa de impresión» (apps/web/src/admin/impresion/mapa). Los ids coinciden con data-cfg-id del lienzo.
const S = 'Mapa de impresión';

export const MAPA_IMPRESION: EntradaConfig[] = [
  { id: 'mapa-impresion-bebida', tab: 'mapa-impresion', seccion: S, titulo: 'Sticker de bebida', descripcion: 'Enciende o apaga el sticker que sale por cada vaso con bebida. Afecta a todos los pedidos que llevan bebidas y se imprime en el equipo que atiende Bebidas, o en Caja si no hay.', ejemplo: 'Apagado: los vasos ya no salen con sticker; el resto de tickets sigue igual.', palabras: ['vaso', 'bebida', 'sticker', 'etiqueta', 'bebidas', 'imprimir'], peligro: 'medio', permiso: 'configuracion/editar' },
  { id: 'mapa-impresion-area', tab: 'mapa-impresion', seccion: S, titulo: 'Sticker por área', descripcion: 'Enciende o apaga un sticker por cada área del pedido (Bebidas, Salados, Postres), para que cada área lo reciba en su equipo. Viene apagado hasta que el dueño lo confirme.', palabras: ['area', 'salados', 'postres', 'bebidas', 'sticker por area', 'cocina'], peligro: 'medio', permiso: 'configuracion/editar' },
  { id: 'mapa-impresion-comanda', tab: 'mapa-impresion', seccion: S, titulo: 'Comanda de salón', descripcion: 'Enciende o apaga la comanda que sale en la ticketera de Caja al aceptar un pedido de mesa o local, con cada línea, tamaño, opciones y notas. No sale para llevar ni delivery.', palabras: ['comanda', 'salon', 'mesa', 'ticket', 'ticketera', 'cocina'], peligro: 'medio', permiso: 'configuracion/editar' },
];
