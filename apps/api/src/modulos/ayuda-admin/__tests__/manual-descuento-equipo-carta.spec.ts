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
    expect(t).toContain('el costo del envio NUNCA se carga a credito');
    expect(t).not.toContain('El credito NO aplica a pedidos con delivery');
    expect(t).toContain('Nadie mas ve esta opcion');
  });

  it('usuarios explica que el celular es uno solo, la vinculacion automatica y como desvincular', () => {
    const t = readFileSync(join(__dirname, '..', 'manuales', 'usuarios.md'), 'utf8');
    expect(t).toContain('El celular es uno solo: el del usuario');
    expect(t).toContain('No hay un segundo campo para la cuenta de cliente');
    expect(t).toContain('Desvincular');
    expect(t).toContain('nunca gana permisos');
  });

  it('usuarios explica la vinculacion automatica por celular, sus avisos y la confirmacion', () => {
    const t = readFileSync(join(__dirname, '..', 'manuales', 'usuarios.md'), 'utf8');
    expect(t).toContain('Un cliente y un usuario del equipo pueden compartir el mismo celular');
    expect(t).toContain('Cuenta de cliente vinculada');
    expect(t).toContain('Si, es la misma persona');
    expect(t).toContain('lo usa otro usuario del equipo');
    const c = readFileSync(join(__dirname, '..', 'manuales', 'creditos.md'), 'utf8');
    expect(c).toContain('se hace solo cuando el Administrador escribe en el usuario el mismo celular');
  });
});
