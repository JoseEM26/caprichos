import { readFileSync } from 'fs';
import { join } from 'path';

describe('Manual de Capri: descuento del equipo en la carta', () => {
  it('creditos explica que es solo descuento, sin credito, y cuando no aplica', () => {
    const t = readFileSync(join(__dirname, '..', 'manuales', 'creditos.md'), 'utf8');
    expect(t).toContain('Descuento del equipo en la carta virtual');
    expect(t).toContain('NO se carga a su credito');
    expect(t).toContain('usuario esta inactivo');
    expect(t).toContain('Sin sesion iniciada no se aplica ni se muestra nada');
    expect(t).toContain('no suma puntos');
  });

  it('creditos explica la opcion Cargar a mi credito del personal desde la carta', () => {
    const t = readFileSync(join(__dirname, '..', 'manuales', 'creditos.md'), 'utf8');
    expect(t).toContain('Cargar a mi credito del personal');
    expect(t).toContain('VINCULADA');
    expect(t).toContain('El delivery se paga siempre');
    expect(t).toContain('Nadie mas ve esta opcion');
  });

  it('usuarios explica como vincular y desvincular la cuenta de cliente', () => {
    const t = readFileSync(join(__dirname, '..', 'manuales', 'usuarios.md'), 'utf8');
    expect(t).toContain('vincular la cuenta de cliente de un usuario');
    expect(t).toContain('Si, vincular');
    expect(t).toContain('Desvincular');
    expect(t).toContain('nunca gana permisos');
  });
});
