import {
  FRASE_IMPORTAR, esEjecucionReal, exigirEsquemaCompatible, exigirRespaldo, leerEntornoDatos, parsearImportar,
  validarDestinoDatos,
} from '../guardas';

const url = (host: string, base: string) => ['postgresql', '://', 'usuario', ':', 'clave', '@', host, '/', base, '?schema=public'].join('');

describe('guardas de la migración de datos', () => {
  it('local, demo y prod son los únicos entornos; cualquier otro se rechaza', () => {
    expect(leerEntornoDatos('local', 'exportar', {})).toBe('local');
    expect(leerEntornoDatos('demo', 'exportar', {})).toBe('demo');
    expect(() => leerEntornoDatos(undefined, 'exportar', {})).toThrow(/ENTORNO_DATOS/);
    expect(() => leerEntornoDatos('staging', 'importar', {})).toThrow(/ENTORNO_DATOS/);
  });

  it('producción solo se importa con IMPORTAR_PRODUCCION=SI, y nunca se exporta', () => {
    expect(() => leerEntornoDatos('prod', 'importar', {})).toThrow(/IMPORTAR_PRODUCCION=SI/);
    expect(leerEntornoDatos('prod', 'importar', { IMPORTAR_PRODUCCION: 'SI' })).toBe('prod');
    expect(() => leerEntornoDatos('prod', 'exportar', { IMPORTAR_PRODUCCION: 'SI' })).toThrow(/no está permitido/);
  });

  it('prod exige host postgres y base *prod*; demo y local siguen sus reglas', () => {
    expect(() => validarDestinoDatos('prod', url('postgres', 'caprichos_prod'))).not.toThrow();
    expect(() => validarDestinoDatos('prod', url('postgres', 'caprichos_demo'))).toThrow();
    expect(() => validarDestinoDatos('prod', url('localhost:5442', 'caprichos_prod'))).toThrow();
    expect(() => validarDestinoDatos('demo', url('postgres', 'caprichos_demo'))).not.toThrow();
    expect(() => validarDestinoDatos('demo', url('postgres', 'caprichos_prod'))).toThrow();
    expect(() => validarDestinoDatos('local', url('localhost:5442', 'caprichos_migracion_test'))).not.toThrow();
    expect(() => validarDestinoDatos('local', url('postgres', 'caprichos'))).toThrow();
  });

  it('sin --confirmar es simulacro; con otra frase se rechaza; con la frase exacta escribe', () => {
    expect(esEjecucionReal(parsearImportar(['--paquete=/x']))).toBe(false);
    expect(() => esEjecucionReal(parsearImportar(['--paquete=/x', '--confirmar=importar']))).toThrow(FRASE_IMPORTAR);
    expect(esEjecucionReal(parsearImportar([`--paquete=/x`, `--confirmar=${FRASE_IMPORTAR}`]))).toBe(true);
  });

  it('para escribir hace falta --respaldo o --sin-respaldo; sin pg_dump, --respaldo no sirve', () => {
    const o = parsearImportar(['--paquete=/x', `--confirmar=${FRASE_IMPORTAR}`]);
    expect(() => exigirRespaldo(o, true)).toThrow(/--respaldo/);
    expect(() => exigirRespaldo({ ...o, respaldo: '/r.dump' }, false)).toThrow(/pg_dump/);
    expect(() => exigirRespaldo({ ...o, sinRespaldo: true }, false)).not.toThrow();
    expect(() => exigirRespaldo({ ...o, respaldo: '/r.dump' }, true)).not.toThrow();
  });

  it('la base destino debe tener la misma última migración o una más reciente', () => {
    expect(() => exigirEsquemaCompatible('20261118100000_a', '20261118100000_a')).not.toThrow();
    expect(() => exigirEsquemaCompatible('20261118100000_a', '20261201000000_b')).not.toThrow();
    expect(() => exigirEsquemaCompatible('20261118100000_a', '20261001000000_z')).toThrow(/anterior/);
    expect(() => exigirEsquemaCompatible('20261118100000_a', null)).toThrow(/anterior/);
  });
});
