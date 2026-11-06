import { FlujoPedidoSubFlujo } from '../flujos/pedido/flujo-pedido';

/**
 * WhatsApp: un paso de combo con opciones agotadas por stock avisa en una línea y ofrece solo lo que se puede elegir.
 * El aviso y la disponibilidad vienen de la carta (CatalogoService.obtenerCarta), la misma fuente que la web.
 */
describe('Bot: paso de combo con opciones agotadas por stock', () => {
  const bot: any = Object.create(FlujoPedidoSubFlujo.prototype);

  const paso = (aviso: string | null, opciones: Array<{ id: string; nombre: string; disponible: boolean }>) => ({
    id: 'g1',
    nombre: 'Complemento 1 · Complemento',
    obligatorio: true,
    minimo: 1,
    maximo: 1,
    opciones: opciones.map((o) => ({ ...o, precioExtra: 0 })),
    aviso,
    sinStock: false,
  });

  it('con plan B: primero la línea de aviso y luego solo las opciones disponibles', () => {
    const acciones = bot.construirAccionGrupo(
      paso('Se acabaron: 2 Donas. Elige entre: 2 Galletas choco chips', [
        { id: 'o1', nombre: '2 Donas', disponible: false },
        { id: 'o2', nombre: '2 Galletas choco chips', disponible: true },
      ]),
    );
    expect(acciones[0]).toMatchObject({ tipo: 'enviarTexto', texto: 'Se acabaron: 2 Donas. Elige entre: 2 Galletas choco chips' });
    const resto = JSON.stringify(acciones.slice(1));
    expect(resto).toContain('ped_op_o2');
    expect(resto).not.toContain('ped_op_o1');
  });

  it('sin opciones agotadas: no hay línea de aviso', () => {
    const acciones = bot.construirAccionGrupo(
      paso(null, [{ id: 'o2', nombre: '2 Galletas choco chips', disponible: true }]),
    );
    expect(acciones.some((a: any) => a.tipo === 'enviarTexto')).toBe(false);
    expect(JSON.stringify(acciones)).toContain('ped_op_o2');
  });
});
