import { TEXTOS_REPARTO } from '../conversacion/textos-reparto';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';

describe('Avisos «Ya salió» y «Ya llegó» del delivery', () => {
  it('salida lleva tiempo estimado y usa una plantilla del catálogo con sus variables', () => {
    const p = TEXTOS_REPARTO.salida('Ana', 'CP-1', '25 a 30');
    expect(p.textoLibre).toContain('25 a 30 minutos');
    const plantilla = CATALOGO_PLANTILLAS[p.plantillaClave];
    expect(plantilla.nombre).toBe('caprichos_delivery_en_camino');
    expect(plantilla.texto).toContain('{{3}}');
    expect(p.variablesPlantilla).toHaveLength(3);
  });

  it('llegada usa su plantilla del catálogo con nombre y código', () => {
    const p = TEXTOS_REPARTO.llegada('Ana', 'CP-1');
    const plantilla = CATALOGO_PLANTILLAS[p.plantillaClave];
    expect(plantilla.nombre).toBe('caprichos_delivery_llegado');
    expect(p.variablesPlantilla).toEqual(['Ana', 'CP-1']);
    expect(plantilla.texto).toContain('{{2}}');
  });
});
