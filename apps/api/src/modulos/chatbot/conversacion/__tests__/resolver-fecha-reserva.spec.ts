import { resolverFechaEntradaReserva, obtenerFechaLimaActual } from '../flujos/reserva/flujo-reserva';

describe('resolverFechaEntradaReserva', () => {
  it('Hoy y Mañana por botón o texto', () => {
    expect(resolverFechaEntradaReserva({ id: 'res_f_hoy' })?.fechaIso).toBe(obtenerFechaLimaActual(0).fechaIso);
    expect(resolverFechaEntradaReserva({ id: 'res_f_manana' })?.fechaIso).toBe(obtenerFechaLimaActual(1).fechaIso);
    expect(resolverFechaEntradaReserva({ texto: 'mañana' })?.fechaIso).toBe(obtenerFechaLimaActual(1).fechaIso);
  });

  it('Otra fecha por botón no resuelve nada y texto inválido tampoco', () => {
    expect(resolverFechaEntradaReserva({ id: 'res_f_otra' })).toBeNull();
    expect(resolverFechaEntradaReserva({ texto: 'xyz', textoOriginal: 'xyz' })).toBeNull();
  });
});
