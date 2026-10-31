import { ConflictException } from '@nestjs/common';
import { ejecutarCargaInicial, leerOpciones, ServicioResenas } from '../resenas-carga-inicial';

// Servicio simulado: nunca se llama a la API real de reseñas
const candidato = (nombre: string, businessId: string, extra: Record<string, unknown> = {}) => ({
  businessId,
  nombre,
  direccion: 'Av. Campoy 123',
  rating: 4.8,
  total: 778,
  enlaceLocal: 'https://www.google.com/maps/place/local',
  ...extra,
});

function servicioFalso(candidatos: any[], sobre: Partial<Record<keyof ServicioResenas, any>> = {}) {
  return {
    buscarNegocio: jest.fn(async () => ({ ok: true, candidatos })),
    guardarNegocio: jest.fn(async () => ({})),
    cargaInicial: jest.fn(async () => ({
      ok: true,
      paginas: 3,
      recibidas: 60,
      guardadas: 40,
      nuevas: 40,
      actualizadas: 0,
      totalGuardadas: 40,
    })),
    estado: jest.fn(async () => ({ consumo: 9, tope: 80 })),
    ...sobre,
  } as unknown as ServicioResenas & Record<string, jest.Mock>;
}

async function correr(argv: string[], servicio: ServicioResenas) {
  const lineas: string[] = [];
  const codigo = await ejecutarCargaInicial(leerOpciones(argv), servicio, (l) => lineas.push(l));
  return { codigo, salida: lineas.join('\n') };
}

describe('comando de carga inicial de reseñas (consola)', () => {
  it('lee --buscar, --business-id y --repetir con espacio o con =', () => {
    expect(leerOpciones(['--buscar', 'Caprichos Campoy', '--business-id', '123', '--repetir'])).toEqual({
      buscar: 'Caprichos Campoy',
      businessId: '123',
      repetir: true,
    });
    expect(leerOpciones(['--buscar=Caprichos Campoy'])).toEqual({ buscar: 'Caprichos Campoy', businessId: undefined, repetir: false });
  });

  it('con un solo candidato que coincide: guarda el negocio con su resumen y ejecuta la carga', async () => {
    const servicio = servicioFalso([candidato('Caprichos Campoy', 'biz-1'), candidato('Otra Tienda', 'biz-2')]);
    const { codigo, salida } = await correr(['--buscar', 'caprichos campoy'], servicio);

    expect(codigo).toBe(0);
    expect(servicio.buscarNegocio).toHaveBeenCalledWith('caprichos campoy');
    expect(servicio.guardarNegocio).toHaveBeenCalledWith('biz-1', 'Caprichos Campoy', undefined, undefined, 4.8, 778, 'https://www.google.com/maps/place/local');
    expect(servicio.cargaInicial).toHaveBeenCalledWith({ repetir: false });
    expect(salida).toContain('business_id: biz-2');
    expect(salida).toContain('Páginas: 3 · Recibidas: 60 · Guardadas: 40 · Nuevas: 40 · Consumo del mes: 9 de 80');
  });

  it('con varios que coinciden: no guarda, no carga y termina con 2 pidiendo --business-id', async () => {
    const servicio = servicioFalso([candidato('Caprichos Campoy', 'biz-1'), candidato('Caprichos Campoy Norte', 'biz-3')]);
    const { codigo, salida } = await correr(['--buscar', 'Caprichos'], servicio);

    expect(codigo).toBe(2);
    expect(servicio.guardarNegocio).not.toHaveBeenCalled();
    expect(servicio.cargaInicial).not.toHaveBeenCalled();
    expect(salida).toContain('--business-id');
    expect(salida).toContain('No se guardó nada');
  });

  it('con ningún candidato: no guarda y termina con 2', async () => {
    const servicio = servicioFalso([candidato('Pizzería Otra', 'biz-9')]);
    const { codigo, salida } = await correr(['--buscar', 'Caprichos Campoy'], servicio);

    expect(codigo).toBe(2);
    expect(servicio.guardarNegocio).not.toHaveBeenCalled();
    expect(servicio.cargaInicial).not.toHaveBeenCalled();
    expect(salida).toContain('Ninguno tiene ese nombre');
  });

  it('con varios candidatos y --business-id: guarda el elegido y carga', async () => {
    const servicio = servicioFalso([candidato('Caprichos Campoy', 'biz-1'), candidato('Caprichos Campoy Norte', 'biz-3')]);
    const { codigo } = await correr(['--buscar', 'Caprichos', '--business-id', 'biz-3'], servicio);

    expect(codigo).toBe(0);
    expect(servicio.guardarNegocio).toHaveBeenCalledWith('biz-3', 'Caprichos Campoy Norte', undefined, undefined, 4.8, 778, 'https://www.google.com/maps/place/local');
    expect(servicio.cargaInicial).toHaveBeenCalledTimes(1);
  });

  it('--business-id que no está entre los candidatos: no guarda y termina con 2', async () => {
    const servicio = servicioFalso([candidato('Caprichos Campoy', 'biz-1')]);
    const { codigo } = await correr(['--buscar', 'Caprichos', '--business-id', 'biz-404'], servicio);

    expect(codigo).toBe(2);
    expect(servicio.guardarNegocio).not.toHaveBeenCalled();
  });

  it('si ya hay otro negocio configurado (409), no lo cambia ni carga', async () => {
    const servicio = servicioFalso([candidato('Caprichos Campoy', 'biz-1')], {
      guardarNegocio: jest.fn(async () => {
        throw new ConflictException({ codigo: 'NEGOCIO_YA_CONFIGURADO', mensaje: 'El local ya está configurado. No se cambia desde aquí.' });
      }),
    });
    const { codigo, salida } = await correr(['--buscar', 'Caprichos Campoy'], servicio);

    expect(codigo).toBe(1);
    expect(salida).toContain('El local ya está configurado');
    expect(servicio.cargaInicial).not.toHaveBeenCalled();
  });

  it('--repetir se pasa a la carga inicial', async () => {
    const servicio = servicioFalso([candidato('Caprichos Campoy', 'biz-1')]);
    await correr(['--buscar', 'Caprichos Campoy', '--repetir'], servicio);
    expect(servicio.cargaInicial).toHaveBeenCalledWith({ repetir: true });
  });

  it('una carga detenida (tope, error) termina con 1 y muestra lo guardado', async () => {
    const servicio = servicioFalso([candidato('Caprichos Campoy', 'biz-1')], {
      cargaInicial: jest.fn(async () => ({ ok: false, motivo: 'TOPE_MENSUAL', mensaje: 'Se llegó al tope mensual', paginas: 4, recibidas: 80, guardadas: 60, nuevas: 60, actualizadas: 0, totalGuardadas: 60 })),
    });
    const { codigo, salida } = await correr(['--buscar', 'Caprichos Campoy'], servicio);

    expect(codigo).toBe(1);
    expect(salida).toContain('Guardadas: 60');
    expect(salida).toContain('La carga se detuvo: Se llegó al tope mensual');
  });

  it('sin --buscar muestra el uso y no llama a nada', async () => {
    const servicio = servicioFalso([]);
    const { codigo, salida } = await correr(['--business-id', 'biz-1'], servicio);

    expect(codigo).toBe(1);
    expect(salida).toContain('Uso:');
    expect(servicio.buscarNegocio).not.toHaveBeenCalled();
  });
});
