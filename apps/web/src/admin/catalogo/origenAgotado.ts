export type OrigenAgotado = 'MANUAL' | 'AUTOMATICO';

/** Texto corto y explicación (tooltip) de por qué algo está agotado. Un agotado sin origen se lee como a mano. */
export function textosOrigenAgotado(origen?: string | null): { corto: string; ayuda: string } {
  if (origen === 'AUTOMATICO') {
    return {
      corto: 'Agotado por stock (vuelve al reponer)',
      ayuda:
        'Se agotó solo porque su saldo llegó a 0. Vuelve a estar disponible al reponer stock, al hacer la apertura del día o al anular un pedido que lo había descontado.',
    };
  }
  return {
    corto: 'Agotado a mano (no vuelve solo)',
    ayuda:
      'Alguien lo marcó Agotado a propósito. No vuelve solo al reponer stock ni al abrir el día: hay que ponerlo Disponible desde Productos o Cocina › Agotados.',
  };
}
