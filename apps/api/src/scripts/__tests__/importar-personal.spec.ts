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

function servicioFalso(resultados: Array<{ indice: number; estado: string; motivo?: string; avisos?: string[]; vincula?: boolean }>) {
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

  it('fecha_nacimiento acepta dd/mm/aaaa y aaaa-mm-dd', () => {
    const csv = ['nombres,apellidos,documento,fecha_nacimiento,rol_principal', 'A,B,11111111,04/03/1990,MOZO', 'C,D,22222222,1991-12-25,MOZO'].join('\n');
    const { filas } = filasDesdeCsv(csv);
    expect(filas[0].fila).toEqual(expect.objectContaining({ fechaNacimiento: '1990-03-04' }));
    expect(filas[1].fila).toEqual(expect.objectContaining({ fechaNacimiento: '1991-12-25' }));
  });

  it('una cabecera sin columnas obligatorias aborta', () => {
    expect(filasDesdeCsv('nombres,apellidos\nAna,Ruiz').error).toMatch(/documento, rol_principal/);
  });

  it('el resumen cuenta cuántas filas se unirían a una cuenta de cliente (simulacro) y no cambia el resto', async () => {
    const servicio = servicioFalso([
      { indice: 0, estado: 'OK', vincula: true },
      { indice: 1, estado: 'OK' },
      { indice: 2, estado: 'ERROR', motivo: 'Ese celular ya lo usa otro usuario del equipo' },
    ]);
    const lineas: string[] = [];
    await ejecutarImportacion(CSV, false, servicio as any, (l) => lineas.push(l));
    expect(lineas.find((l) => l.startsWith('Resumen:'))).toContain('se unirían a su cuenta de cliente 1');
    expect(servicio.importarPersonal).toHaveBeenCalledWith(expect.any(Array), { simular: true });
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

describe('importar-personal: columnas de planilla (datos inventados)', () => {
  const CAB = 'nombres,apellidos,tipo_documento,documento,fecha_ingreso,fecha_reingreso,rol_principal,activo,area,casillas_roles,acuerdo_laboral,sueldo_mensual,tarifa_hora,pago_celular,pago_medio,licencia';
  const csv = (...filas: string[]) => [CAB, ...filas].join('\n');

  it('mapea casillas a roles y áreas de cocina; el rol principal se deduce y Despacho/Mozo no se repite', () => {
    const { filas } = filasDesdeCsv(csv('Ana,Ruiz,DNI,11112222,02/07/2024,NO,,si,Cocina,Despacho|Postres|Repostería|Caja,Tiempo Completo,"S/ 1,500.00",,999 000 111,yape,'));
    expect(filas[0].fila).toMatchObject({
      rol: 'CAJERO', otrosRoles: ['MOZO', 'COCINA'], areasCocina: ['Postres', 'Repostería'], acuerdoLaboral: 'TIEMPO_COMPLETO',
      sueldoMensual: 1500, pagoCelular: '999000111', pagoMedio: 'YAPE', fechaIngreso: '2024-07-02', activo: true,
    });
    expect(filas[0].fila).not.toHaveProperty('fechaReingreso');
  });

  it('tarifa por hora y tercerizado mensual', () => {
    const { filas } = filasDesdeCsv(csv('Eva,Ros,DNI,33334444,,,MOZO,si,Sala,,Tercerizado Mensual,,15.5,,,'));
    expect(filas[0].fila).toMatchObject({ acuerdoLaboral: 'TERCERIZADO_MENSUAL', tarifaHora: 15.5 });
    expect(filas[0].fila).not.toHaveProperty('sueldoMensual');
  });

  it('LICENCIA SIN GOCE: cuenta inactiva con aviso, sin fecha de reingreso', async () => {
    const { filas } = filasDesdeCsv(csv('Luis,Paz,DNI,55556666,2024-01-10,LICENCIA SIN GOCE,MOZO,si,,,,,,,,'));
    expect(filas[0].fila).toMatchObject({ activo: false });
    expect(filas[0].fila).not.toHaveProperty('fechaReingreso');
    const salidas: string[] = [];
    await ejecutarImportacion(csv('Luis,Paz,DNI,55556666,2024-01-10,LICENCIA SIN GOCE,MOZO,si,,,,,,,,'), false, servicioFalso([{ indice: 0, estado: 'OK' }]) as any, (l) => salidas.push(l));
    expect(salidas.join('\n')).toMatch(/Luis Paz \(MOZO\) · aviso: en licencia sin goce/);
  });

  it('área administrativa sin rol: se omite (sin cuenta) y se dice; con rol se importa', async () => {
    const texto = csv('Ivo,Gil,DNI,77778888,,,,si,ALQUILER LOCAL,,,,,,,', 'Mar,Gil,DNI,88889999,,,,si,MARKETING,Caja,,,,,,');
    const { filas } = filasDesdeCsv(texto);
    expect(filas[0]).toMatchObject({ fila: null, omitida: expect.stringContaining('sin rol operativo') });
    expect(filas[1].fila).toMatchObject({ rol: 'CAJERO' });
    const servicio = servicioFalso([{ indice: 0, estado: 'OK' }]);
    const salidas: string[] = [];
    await ejecutarImportacion(texto, false, servicio as any, (l) => salidas.push(l));
    expect((servicio.importarPersonal.mock.calls[0] as any[])[0]).toHaveLength(1);
    expect(salidas.join('\n')).toMatch(/fila 2: omitida: área administrativa/);
    expect(salidas.join('\n')).toMatch(/omitidas 1/);
  });

  it('Delivery con otros roles, casilla desconocida o acuerdo inválido: error de la fila', () => {
    const { filas } = filasDesdeCsv(csv('A,B,DNI,11110000,,,,si,,Delivery|Caja,,,,,,', 'C,D,DNI,22220000,,,,si,,Cocina,,,,,,', 'E,F,DNI,33330000,,,MOZO,si,,,Mitad de tiempo,,,,,'));
    expect(filas[0].errorFormato).toMatch(/Delivery/);
    expect(filas[1].errorFormato).toMatch(/casilla de rol desconocida/);
    expect(filas[2].errorFormato).toMatch(/acuerdo_laboral/);
    expect(filasDesdeCsv(csv('G,H,DNI,44440000,,,,si,,Delivery,,,,,,')).filas[0].fila).toMatchObject({ rol: 'REPARTIDOR', otrosRoles: [] });
  });

  it('el CSV anterior (sin columnas nuevas) sigue funcionando y la salida no imprime celulares ni documentos', async () => {
    const salidas: string[] = [];
    await ejecutarImportacion(
      csv('Ana,Ruiz,DNI,11112222,,,CAJERO,si,Sala,,Tiempo Parcial,1200,,987654321,PLIN,'),
      false,
      servicioFalso([{ indice: 0, estado: 'OK' }]) as any,
      (l) => salidas.push(l),
    );
    const todo = salidas.join('\n');
    for (const secreto of ['11112222', '987654321', '1200']) expect(todo).not.toContain(secreto);
    expect(filasDesdeCsv('nombres,apellidos,documento,rol_principal\nA,B,11111111,MOZO').filas[0].fila).toMatchObject({ rol: 'MOZO' });
  });
});
