jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }) } }));

import { AvisoCuentaService } from './aviso-cuenta.service';

describe('AvisoCuentaService (aviso de seguridad de la cuenta)', () => {
  let prisma: any;
  let outbox: any;
  let servicio: AvisoCuentaService;
  let valorFlag: unknown;

  beforeEach(() => {
    valorFlag = 'si';
    prisma = { parametro: { findUnique: jest.fn(async () => ({ valor: valorFlag })) } };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    servicio = new AvisoCuentaService(prisma, { get: () => outbox } as any);
  });

  it('al crear la cuenta encola el aviso con plantilla de seguridad y clave única por cuenta', async () => {
    await servicio.avisar(BigInt(100), '912345678', 'CREADA');
    const dato = outbox.encolar.mock.calls[0][0];
    expect(dato).toMatchObject({ telefono: '51912345678', tipo: 'TEXTO', clave: 'cuenta-creada-100', origen: 'AVISO_CUENTA' });
    expect(dato.carga.plantillaClave).toBe('CUENTA_AVISO_SEGURIDAD');
    expect(dato.carga.textoLibre).toContain('fue creada');
    expect(outbox.despertar).toHaveBeenCalled();
  });

  it('al cambiar la contraseña avisa cada vez (clave con marca de tiempo)', async () => {
    await servicio.avisar('100', '912345678', 'CLAVE_CAMBIADA');
    expect(outbox.encolar.mock.calls[0][0].clave).toMatch(/^cuenta-clave_cambiada-100-\d+$/);
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).toContain('cambió tu contraseña');
  });

  it('con el parámetro apagado no encola nada', async () => {
    valorFlag = 'no';
    await servicio.avisar('100', '912345678', 'CREADA');
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('un fallo de WhatsApp no lanza: la cuenta sigue', async () => {
    outbox.encolar.mockRejectedValueOnce(new Error('Meta caído'));
    await expect(servicio.avisar('100', '912345678', 'CREADA')).resolves.toBeUndefined();
  });
});
