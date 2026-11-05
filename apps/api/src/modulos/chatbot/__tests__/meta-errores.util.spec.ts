import {
  causaPlantillaMeta,
  detalleTecnicoMeta,
  sanearDetalleMeta,
  sanearVariablePlantilla,
  separarDetalleTecnico,
} from '../utilidades/meta-errores.util';

describe('meta-errores.util', () => {
  it('sanearVariablePlantilla: saltos, tabulaciones y espacios repetidos pasan a un espacio; vacía va «-»', () => {
    expect(sanearVariablePlantilla('Ana\n\tMaría   López')).toBe('Ana María López');
    expect(sanearVariablePlantilla('   \t\n ')).toBe('-');
    expect(sanearVariablePlantilla(undefined)).toBe('-');
    expect(sanearVariablePlantilla(null)).toBe('-');
    expect(sanearVariablePlantilla(4)).toBe('4');
  });

  it('causaPlantillaMeta: 132001 sin «does not exist» ni «not approved» es idioma, no aprobación', () => {
    expect(causaPlantillaMeta(132001, 'template name does not exist')?.codigo).toBe('PLANTILLA_NO_APROBADA');
    expect(causaPlantillaMeta(132001, 'language mismatch')?.codigo).toBe('PLANTILLA_NO_EXISTE_IDIOMA');
    expect(causaPlantillaMeta(131047)).toBeNull();
  });

  it('sanearDetalleMeta oculta tokens y teléfonos y limita a 500 caracteres', () => {
    const texto = sanearDetalleMeta(`Bearer EAAB123456789012 falló para 51987654321 ${'a'.repeat(600)}`);
    expect(texto).not.toContain('EAAB123456789012');
    expect(texto).not.toContain('51987654321');
    expect(sanearDetalleMeta('Recipient PE.1048174911395155 no válido')).toBe('Recipient [identificador] no válido');
    expect(texto.length).toBeLessThanOrEqual(500);
  });

  it('detalleTecnicoMeta y separarDetalleTecnico son inversos para errores de Meta', () => {
    const guardado = detalleTecnicoMeta(132012, 'Parameter format does not match');
    expect(guardado).toBe('[132012] Parameter format does not match');
    expect(separarDetalleTecnico('PLANTILLA_FORMATO_VARIABLE', guardado)).toEqual({
      codigoMeta: '132012',
      original: 'Parameter format does not match',
    });
    // Webhook asíncrono: el código llega como código y el texto sin prefijo
    expect(separarDetalleTecnico('132015', 'Template paused')).toEqual({ codigoMeta: '132015', original: 'Template paused' });
    expect(separarDetalleTecnico(null, null)).toBeNull();
  });
});
