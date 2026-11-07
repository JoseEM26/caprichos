jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ejecutarImportacion, filasDesdeCsv, leerOpciones, textoDesdeEnv } from '../importar-personal';

// CSV inventado: nombres, documentos y celulares de prueba
const CSV = [
  'nombres,apellidos,tipo_documento,documento,celular,fecha_nacimiento,fecha_ingreso,fecha_reingreso,pais_nacimiento,rol_principal,roles_extra,activo',
  'Ana,Ruiz,CE,AB12345,,1990-03-04,2024-07-02,,Venezuela,CAJERO,MOZO|ALMACEN,si',
  'Luis,Paz,DNI,87654321,987654321,,,,,MOZO,,si',
  'Mal,Dato,DNI,123,,,,,,MOZO,,si',
  'Eva,Ros,DNI,11223344,,,,,,COCINA,,no',
].join('\n');

function servicioFalso(resultados: Array<{ indice: number; estado: string; motivo?: string; avisos?: string[] }>) {
  return { importarPersonal: jest.fn(async () => ({ filas: 0, simulacion: true, resultados })) };
}

describe('importar-personal (consola)', () => {
  it('lee las opciones: --archivo, --desde-env y --aplicar', () => {
    expect(leerOpciones(['--archivo', '/x.csv'])).toEqual({ archivo: '/x.csv', desdeEnv: undefined, aplicar: false });
    expect(leerOpciones(['--desde-env', 'PERSONAL_CSV_B64', '--aplicar']).aplicar).toBe(true);
  });

  it('lee el CSV desde la variable base64 y no falla si no existe', () => {
    const b64 = Buffer.from(CSV, 'utf8').toString('base64');
    expect(textoDesdeEnv('PERSONAL_CSV_B64', { PERSONAL_CSV_B64: b64 })).toBe(CSV);
    expect(textoDesdeEnv('PERSONAL_CSV_B64', {})).toBeNull();
  });

  it('convierte las columnas: roles extra con |, activo si/no, celular vacío válido', () => {
    const { filas, error } = filasDesdeCsv(CSV);
    expect(error).toBeUndefined();
    expect(filas[0].fila).toEqual(expect.objectContaining({
      tipoDocumento: 'CE', documento: 'AB12345', rol: 'CAJERO', otrosRoles: ['MOZO', 'ALMACEN'], activo: true,
      fechaIngreso: '2024-07-02', paisNacimiento: 'Venezuela',
    }));
    expect(filas[0].fila).not.toHaveProperty('celular');
    expect(filas[3].fila).toEqual(expect.objectContaining({ activo: false }));
  });

  it('una cabecera sin columnas obligatorias aborta', () => {
    expect(filasDesdeCsv('nombres,apellidos\nAna,Ruiz').error).toMatch(/documento, rol_principal/);
  });

  it('simulacro: llama al servicio sin escribir, imprime crear / ya existe / error sin documento ni celular', async () => {
    const servicio = servicioFalso([
      { indice: 0, estado: 'OK' },
      { indice: 1, estado: 'YA_EXISTE' },
      { indice: 2, estado: 'ERROR', motivo: 'El DNI debe tener exactamente 8 dígitos numéricos' },
    ]);
    const lineas: string[] = [];
    const codigo = await ejecutarImportacion(CSV, false, servicio as any, (l) => lineas.push(l));

    expect(codigo).toBe(0);
    expect(servicio.importarPersonal).toHaveBeenCalledWith(expect.any(Array), { simular: true });
    expect(lineas).toContain('fila 2: crear — Ana Ruiz (CAJERO)');
    expect(lineas).toContain('fila 3: ya existe — Luis Paz (MOZO)');
    expect(lineas).toContain('fila 4: error: El DNI debe tener exactamente 8 dígitos numéricos — Mal Dato (MOZO)');
    const todo = lineas.join('\n');
    for (const secreto of ['AB12345', '87654321', '987654321', '123', '11223344']) {
      expect(todo).not.toContain(secreto);
    }
  });

  it('--aplicar: llama al servicio en modo real; las filas con formato malo no se envían', async () => {
    const malo = CSV.replace('Eva,Ros,DNI,11223344,,,,,,COCINA,,no', 'Eva,Ros,DNI,11223344,,,,,,COCINA,,quizá');
    const servicio = servicioFalso([{ indice: 0, estado: 'CREADA' }, { indice: 1, estado: 'YA_EXISTE' }, { indice: 2, estado: 'ERROR', motivo: 'x' }]);
    const lineas: string[] = [];
    await ejecutarImportacion(malo, true, servicio as any, (l) => lineas.push(l));
    expect(servicio.importarPersonal).toHaveBeenCalledWith(expect.any(Array), { simular: false });
    expect((servicio.importarPersonal.mock.calls[0] as any[])[0]).toHaveLength(3);
    expect(lineas).toContain('fila 2: creada — Ana Ruiz (CAJERO)');
    expect(lineas).toContain('fila 5: error: activo debe ser si o no — Eva Ros (COCINA)');
  });

  it('un archivo sin encabezado válido devuelve 1 y no llama al servicio', async () => {
    const servicio = servicioFalso([]);
    const codigo = await ejecutarImportacion('foo,bar\n1,2', false, servicio as any, () => undefined);
    expect(codigo).toBe(1);
    expect(servicio.importarPersonal).not.toHaveBeenCalled();
  });

  it('import con reingreso: la línea creada muestra el aviso de salida no registrada', async () => {
    const servicio = servicioFalso([{ indice: 0, estado: 'CREADA', avisos: ['Fecha de salida no registrada: corregir en el historial laboral.'] }]);
    const lineas: string[] = [];
    await ejecutarImportacion(CSV.split('\n').slice(0, 2).join('\n'), true, servicio as any, (l) => lineas.push(l));
    expect(lineas).toContain('fila 2: creada — Ana Ruiz (CAJERO) · aviso: Fecha de salida no registrada: corregir en el historial laboral.');
  });
});

describe('importar-personal: el rol eliminado Call Center', () => {
  const CSV_CC = [
    'nombres,apellidos,tipo_documento,documento,celular,fecha_nacimiento,fecha_ingreso,fecha_reingreso,pais_nacimiento,rol_principal,roles_extra,activo',
    'Ana,Ruiz,DNI,11112222,,,,,,Call Center,CAJERO,si',
    'Eva,Paz,DNI,33334444,,,,,,CAJERO,Call Center|MOZO,si',
  ].join('\n');

  it('se asigna MOZO (sin repetir) y el simulacro lo avisa', async () => {
    const { filas } = filasDesdeCsv(CSV_CC);
    expect(filas[0].fila).toMatchObject({ rol: 'MOZO', otrosRoles: ['CAJERO'] });
    expect(filas[1].fila).toMatchObject({ rol: 'CAJERO', otrosRoles: ['MOZO'] });
    const salidas: string[] = [];
    const servicio = servicioFalso([{ indice: 0, estado: 'OK' }, { indice: 1, estado: 'OK' }]);
    await ejecutarImportacion(CSV_CC, false, servicio as any, (l) => salidas.push(l));
    expect(salidas.join('\n')).toMatch(/Ana Ruiz \(MOZO\) · aviso: el rol Call Center ya no existe: se asigna MOZO/);
  });
});
