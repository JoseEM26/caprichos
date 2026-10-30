/** Puerto mínimo para crear la cuenta del cliente desde el bot (lo implementa ClientesService; evita importarlo aquí). */
export const CUENTA_CLIENTE_BOT_PUERTO = Symbol('CUENTA_CLIENTE_BOT_PUERTO');

export interface CuentaClienteBotPuerto {
  crearCuentaDesdeBot(telefono: string, nombre: string): Promise<{ partyId: string; primerNombre: string }>;
}
