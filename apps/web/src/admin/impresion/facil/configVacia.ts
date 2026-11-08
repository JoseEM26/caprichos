import type { ConfigEquipoImpresion } from '@caprichos/compartido';

/** PC nueva: todo apagado y sin configurar (no imprime nada hasta que se guarde por primera vez). */
export const CONFIG_VACIA: ConfigEquipoImpresion = {
  ticketera: false,
  etiquetera: false,
  ticketPago: false,
  comandaSalon: false,
  comandaAreas: [],
  stickerGeneral: false,
  stickerAreas: [],
  stickerBebidaAreas: [],
  stickerBebidaCategorias: null,
  tamanoGeneral: null,
  tamanoBebida: null,
  pausado: false,
  configurado: false,
};
