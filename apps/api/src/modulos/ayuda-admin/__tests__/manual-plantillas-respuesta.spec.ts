import { readFileSync } from 'fs';
import { join } from 'path';

const leer = (n: string) => readFileSync(join(__dirname, '..', 'manuales', `${n}.md`), 'utf8');

describe('Manual de Capri: plantillas de respuesta rapida', () => {
  const t = leer('mensajes');

  it('explica como usarlas, que no se envian solas y las variables', () => {
    expect(t).toContain('Responder rapido con una plantilla');
    expect(t).toContain('NO se envia sola');
    expect(t).toContain('{{nombre}}');
    expect(t).toContain('{{medios_pago}}');
    expect(t).toContain('Falta completar a mano');
  });

  it('explica como administrarlas y los permisos', () => {
    expect(t).toContain('Crear, editar, pausar o borrar plantillas');
    expect(t).toContain('Administrar plantillas');
    expect(t).toContain('mensajes/enviar');
  });

  it('aclara que no son las plantillas de Meta y la ventana de 24 horas', () => {
    expect(t).toContain('NO son las plantillas de Meta');
    expect(t).toContain('24 horas');
  });
});
