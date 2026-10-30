export interface FiltroInformeDto {
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  canal?: string; // CARTA, WHATSAPP, LOCAL, MOZO, etc.
  pago?: string;  // EFECTIVO, YAPE, PLIN, TRANSFERENCIA, TARJETA
  modalidad?: string; // LOCAL, LLEVAR, DELIVERY
  preset?: string;
}

export interface FiltroMapaDto {
  dias?: number | string;
  periodo?: string;
  canal?: string;
}
