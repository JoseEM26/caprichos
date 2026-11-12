import { readFileSync } from 'fs';
import { join } from 'path';

const leer = (n: string) => readFileSync(join(__dirname, '..', 'manuales', `${n}.md`), 'utf8');

describe('Manual de Capri: encuesta de calificacion despues de la compra', () => {
  it('Parametros explica interruptor, plantilla, tope por celular y horario', () => {
    const t = leer('config-parametros-sistema');
    expect(t).toContain('whatsapp_aviso_encuesta_activo');
    expect(t).toContain('caprichos_encuesta_posventa');
    expect(t).toContain('encuesta_tope_dias');
    expect(t).toContain('encuesta_hora_desde');
    expect(t).toContain('encuesta_hora_hasta');
  });

  it('Reclamos explica la lista de envios y los motivos de omision', () => {
    const t = leer('reclamos');
    expect(t).toContain('Ultimas encuestas enviadas');
    expect(t).toContain('tope por celular');
    expect(t).toContain('no existe o no esta aprobada en Meta');
  });
});
