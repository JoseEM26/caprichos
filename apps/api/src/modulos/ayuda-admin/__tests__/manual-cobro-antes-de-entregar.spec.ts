import { readFileSync } from 'fs';
import { join } from 'path';

const leer = (n: string) => readFileSync(join(__dirname, '..', 'manuales', `${n}.md`), 'utf8');

describe('Manuales de Capri: cobro antes de entregar', () => {
  it('caja explica COBRO_PENDIENTE, el alcance y la excepcion del Administrador', () => {
    const t = leer('caja');
    expect(t).toContain('COBRO_PENDIENTE');
    expect(t).toContain('Delivery en efectivo contra entrega');
    expect(t).toContain('Entregar sin cobrar');
    expect(t).toContain('PEDIDO_FORZAR_SIN_COBRO');
  });

  it('cierre explica los entregados sin cobrar y la justificacion del Administrador', () => {
    const t = leer('cierre');
    expect(t).toContain('ENTREGADOS_SIN_COBRAR');
    expect(t).toContain('Justificar y permitir el cierre');
  });

  it('repartos y cocina avisan del cambio', () => {
    expect(leer('repartos')).toContain('COBRO_PENDIENTE');
    expect(leer('cocina')).toContain('se queda en Listo hasta que Caja lo cobre');
  });
});
