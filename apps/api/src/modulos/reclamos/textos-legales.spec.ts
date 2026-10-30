import { ConfiguracionService } from '../configuracion/configuracion.service';
import { TextosLegalesService } from './textos-legales.service';
import {
  PRIVACIDAD_BASE,
  TERMINOS_BASE,
  TEXTO_CONSENTIMIENTO,
  datosNegocioDe,
  leerTextosLegales,
  resolverMarcadores,
  versionConsentimiento,
} from './textos-legales';

/** parametro en memoria (findUnique/findMany/upsert/create). */
function prismaFalso(inicial: Record<string, unknown> = {}) {
  const filas = new Map(Object.entries(inicial));
  return {
    filas,
    parametro: {
      findUnique: jest.fn(async ({ where }: any) => (filas.has(where.clave) ? { clave: where.clave, valor: filas.get(where.clave) } : null)),
      findMany: jest.fn(async ({ where }: any) =>
        where.clave.in.filter((c: string) => filas.has(c)).map((c: string) => ({ clave: c, valor: filas.get(c) })),
      ),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        filas.set(where.clave, filas.has(where.clave) ? update.valor : create.valor);
        return { clave: where.clave, valor: filas.get(where.clave) };
      }),
      create: jest.fn(async ({ data }: any) => {
        filas.set(data.clave, data.valor);
        return data;
      }),
    },
  } as any;
}

const LOCAL = {
  nombre: 'Caprichos',
  direccion: 'Av. Los Cedros 100, Lima',
  telefono: '987654321',
  whatsapp: '912345678',
  razon_social: 'Caprichos Café SAC',
  ruc: '20601234567',
  direccion_fiscal: 'Av. Los Cedros 100, Lima',
  correo: 'hola@caprichos.pe',
};

describe('textos legales base', () => {
  it('no mencionan el DNI como dato de la cuenta del cliente y hablan de celular', () => {
    for (const t of [TERMINOS_BASE, PRIVACIDAD_BASE]) {
      expect(t).toMatch(/celular/);
      expect(t).not.toMatch(/acepto.*mi DNI/i);
      expect(t).toMatch(/No pedimos tu DNI|solo se pide cuando/);
    }
    expect(TEXTO_CONSENTIMIENTO).toMatch(/mi celular y mis datos/);
    expect(TEXTO_CONSENTIMIENTO).not.toMatch(/dni/i);
  });

  it('cubren lo que pide el negocio: puntos 5 %, voucher, WhatsApp BAJA/STOP, ARCO, Ley 29733, reclamaciones, ley aplicable', () => {
    const todo = TERMINOS_BASE + PRIVACIDAD_BASE;
    for (const frase of ['5 %', 'voucher', 'BAJA', 'STOP', 'ARCO', '29733', 'Libro de Reclamaciones', 'leyes de la República del Perú', 'encuesta', 'cumpleaños']) {
      expect(todo).toContain(frase);
    }
  });
});

describe('resolverMarcadores', () => {
  const datos = datosNegocioDe(LOCAL, '2026-10-29');

  it('reemplaza todos los marcadores cuando hay datos', () => {
    const r = resolverMarcadores(TERMINOS_BASE, datos, 'carta');
    expect(r.texto).not.toMatch(/\{\{/);
    expect(r.texto).toContain('Caprichos Café SAC');
    expect(r.texto).toContain('20601234567');
    expect(r.texto).toContain('29/10/2026');
    expect(r.faltantes).toEqual([]);
  });

  it('en la carta quita la nota del administrador; en el admin la muestra', () => {
    expect(resolverMarcadores(TERMINOS_BASE, datos, 'carta').texto).not.toContain('asesor legal');
    expect(resolverMarcadores(TERMINOS_BASE, datos, 'admin').texto).toContain('Texto base sugerido: revísalo con tu asesor legal antes de publicarlo.');
  });

  it('dato faltante: admin ve «[Falta: RUC]» y la lista; la carta ve un texto neutro sin llaves ni corchetes', () => {
    const sinRuc = datosNegocioDe({ ...LOCAL, ruc: '' }, '2026-10-29');
    const admin = resolverMarcadores(TERMINOS_BASE, sinRuc, 'admin');
    expect(admin.texto).toContain('[Falta: RUC]');
    expect(admin.faltantes).toContain('RUC');

    const carta = resolverMarcadores(TERMINOS_BASE, sinRuc, 'carta');
    expect(carta.texto).not.toMatch(/\[Falta|\{\{/);
    expect(carta.texto).toContain('con RUC el que figura en nuestros comprobantes');
    expect(carta.faltantes).toContain('RUC');
  });

  it('un marcador desconocido se deja tal cual', () => {
    expect(resolverMarcadores('{{otra_cosa}}', datos, 'carta').texto).toBe('{{otra_cosa}}');
  });
});

describe('siembra idempotente', () => {
  it('siembra texto y versión si no existen, y una segunda vez no cambia nada', async () => {
    const prisma = prismaFalso();
    const servicio = new TextosLegalesService(prisma);
    await servicio.onModuleInit();

    expect(prisma.filas.get('terminos_texto')).toBe(TERMINOS_BASE);
    expect(prisma.filas.get('privacidad_texto')).toBe(PRIVACIDAD_BASE);
    expect(prisma.filas.get('terminos_version')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(prisma.filas.get('privacidad_version')).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    prisma.parametro.upsert.mockClear();
    await servicio.onModuleInit();
    expect(prisma.parametro.upsert).not.toHaveBeenCalled();
  });

  it('NUNCA pisa lo que el dueño ya escribió ni su versión', async () => {
    const prisma = prismaFalso({ terminos_texto: 'Mis términos', terminos_version: '2026-01-01', privacidad_texto: 'Mi política' });
    await new TextosLegalesService(prisma).onModuleInit();

    expect(prisma.filas.get('terminos_texto')).toBe('Mis términos');
    expect(prisma.filas.get('terminos_version')).toBe('2026-01-01');
    expect(prisma.filas.get('privacidad_texto')).toBe('Mi política');
    expect(prisma.filas.get('privacidad_version')).toBeDefined(); // se le asigna versión si faltaba
  });

  it('un texto vacío se considera sin escribir y se siembra', async () => {
    const prisma = prismaFalso({ terminos_texto: '   ' });
    await new TextosLegalesService(prisma).onModuleInit();
    expect(prisma.filas.get('terminos_texto')).toBe(TERMINOS_BASE);
  });

  it('si la base falla no rompe el arranque', async () => {
    const prisma = prismaFalso();
    prisma.parametro.findUnique.mockRejectedValue(new Error('sin base'));
    await expect(new TextosLegalesService(prisma).onModuleInit()).resolves.toBeUndefined();
  });
});

describe('leerTextosLegales', () => {
  it('sirve los textos resueltos con la versión y local_datos', async () => {
    const prisma = prismaFalso({ local_datos: LOCAL });
    await new TextosLegalesService(prisma).onModuleInit();
    const carta = await leerTextosLegales(prisma, 'carta');
    expect(carta.terminos.texto).toContain('Caprichos Café SAC');
    expect(carta.terminos.texto).not.toContain('asesor legal');
    expect(carta.terminos.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(carta.privacidad.faltantes).toEqual([]);
  });

  it('con local_datos sin RUC ni razón social avisa qué falta (admin) sin romper la carta', async () => {
    const prisma = prismaFalso({ local_datos: { nombre: 'Caprichos', direccion: 'Lima', telefono: '987654321' } });
    await new TextosLegalesService(prisma).onModuleInit();
    const admin = await leerTextosLegales(prisma, 'admin');
    expect(admin.terminos.faltantes).toEqual(expect.arrayContaining(['razón social', 'RUC', 'correo de contacto']));
    expect(admin.terminos.texto).toContain('[Falta: RUC]');
    const carta = await leerTextosLegales(prisma, 'carta');
    expect(carta.terminos.texto).not.toMatch(/\[Falta|\{\{/);
  });
});

describe('versión al cambiar el texto (Configuración)', () => {
  const armar = (inicial: Record<string, unknown>) => {
    const prisma = prismaFalso(inicial);
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    return { prisma, auditoria, servicio: new ConfiguracionService(prisma, auditoria as any) };
  };

  it('sube la versión (y la audita) cuando el texto cambia de verdad', async () => {
    const { prisma, auditoria, servicio } = armar({ terminos_texto: 'viejo', terminos_version: '2020-01-01' });
    await servicio.actualizar('terminos_texto', 'nuevo texto');
    expect(prisma.filas.get('terminos_version')).not.toBe('2020-01-01');
    expect(prisma.filas.get('terminos_version')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'VERSION_TEXTO_LEGAL' }));
  });

  it('no sube la versión si el texto es el mismo, ni toca la otra', async () => {
    const { prisma, servicio } = armar({
      privacidad_texto: 'igual',
      privacidad_version: '2020-01-01',
      terminos_version: '2019-01-01',
    });
    await servicio.actualizar('privacidad_texto', 'igual');
    expect(prisma.filas.get('privacidad_version')).toBe('2020-01-01');
    expect(prisma.filas.get('terminos_version')).toBe('2019-01-01');
  });
});

describe('versionConsentimiento', () => {
  it('habla de celular y guarda las versiones aceptadas', () => {
    expect(versionConsentimiento({ terminos: '2026-10-29', privacidad: '2026-10-30' })).toBe('celular-v1|T:2026-10-29|P:2026-10-30');
  });
});
