jest.mock('@nestjs/jwt', () => ({
  JwtService: class {},
  JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }) },
}));

import { BadRequestException, PayloadTooLargeException, UnauthorizedException } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CuentaClienteController } from './cuenta-cliente.controller';
import { fotoMostrada, retratoDesdeDataUrl, validarAvatarConfig } from './avatar-config';

const pieza = (id: string, colores: Record<string, string> = {}) => ({ id, colores });
const configValida = () => ({
  nombre: 'Lucía',
  genero: 'mujer',
  piel: '#F8D2B0',
  ojos: '#5b3a29',
  expresion: 'feliz',
  colorPelo: '#4A2C1D',
  disfraz: null,
  disfrazId: null,
  cabello: pieza('bob_cerquillo'),
  arriba: pieza('polo_basico', { principal: '#E67929' }),
  abajo: pieza('jean'),
  calzado: pieza('zapatilla_urbana'),
  cabeza: pieza('ninguno'),
  cara: pieza('ninguno'),
  accesorio: pieza('ninguno'),
});
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50, 1)]);
const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`;

describe('validarAvatarConfig › pijamas kigurumi destacadas', () => {
  it.each(['conejita', 'michi', 'diablito', 'perrito', 'osito'])('acepta la pijama %s con colores y entra holgada en el tope de tamaño', (e) => {
    const cfg = {
      ...configValida(),
      disfraz: 'Perrito Nube de Leche',
      disfrazId: `dz_kig_${e}`,
      arriba: pieza(`dz_kig_${e}`, { principal: '#9CD3F2', secundario: '#FFF6E8', acento: '#6FAEE0' }),
      cabeza: pieza(`dz_capucha_${e}`, { principal: '#9CD3F2', secundario: '#FFF6E8', acento: '#6FAEE0' }),
      calzado: pieza('dz_pantufla_patita', { principal: '#9CD3F2', secundario: '#FFF6E8', acento: '#F5A9C2' }),
    };
    const r = validarAvatarConfig(cfg);
    expect(r.disfrazId).toBe(`dz_kig_${e}`);
    expect(r.cabeza.id).toBe(`dz_capucha_${e}`);
    expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThan(2 * 1024);
  });
});

describe('validarAvatarConfig', () => {
  it('acepta una configuración válida y normaliza los colores a mayúsculas', () => {
    const r = validarAvatarConfig(configValida());
    expect(r.ojos).toBe('#5B3A29');
    expect(r.arriba.colores.principal).toBe('#E67929');
  });

  it('descarta campos que no son del avatar (lista blanca)', () => {
    const r = validarAvatarConfig({ ...configValida(), telefono: '999888777' }) as unknown as Record<string, unknown>;
    expect(r.telefono).toBeUndefined();
  });

  it.each([
    ['color que no es hex', { piel: 'rojo' }],
    ['color con script', { ojos: '#12345<script>' }],
    ['género desconocido', { genero: 'otro' }],
    ['expresión desconocida', { expresion: 'furia' }],
    ['id de pieza con símbolos', { arriba: pieza('../etc/passwd') }],
    ['slot de color desconocido', { arriba: { id: 'polo', colores: { fondo: '#FFFFFF' } } }],
    ['apodo largo', { nombre: 'a'.repeat(19) }],
    ['pieza faltante', { calzado: undefined }],
  ])('rechaza %s', (_n, cambio) => {
    expect(() => validarAvatarConfig({ ...configValida(), ...cambio })).toThrow(BadRequestException);
  });

  it('mostrarAlEntrar: acepta un booleano, lo omite si falta y rechaza otro tipo', () => {
    expect(validarAvatarConfig({ ...configValida(), mostrarAlEntrar: false }).mostrarAlEntrar).toBe(false);
    expect(validarAvatarConfig(configValida()).mostrarAlEntrar).toBeUndefined();
    expect(() => validarAvatarConfig({ ...configValida(), mostrarAlEntrar: 'no' })).toThrow(BadRequestException);
  });

  it('rechaza un cuerpo que no es objeto y uno demasiado grande', () => {
    expect(() => validarAvatarConfig(null)).toThrow(BadRequestException);
    expect(() => validarAvatarConfig([])).toThrow(BadRequestException);
    expect(() => validarAvatarConfig({ ...configValida(), basura: 'x'.repeat(5000) })).toThrow(PayloadTooLargeException);
  });
});

describe('retratoDesdeDataUrl', () => {
  it('acepta un PNG pequeño', () => {
    expect(retratoDesdeDataUrl(dataUrl(PNG)).equals(PNG)).toBe(true);
  });
  it('rechaza lo que no es data URL PNG o no tiene la firma PNG', () => {
    expect(() => retratoDesdeDataUrl('http://x/a.png')).toThrow(BadRequestException);
    expect(() => retratoDesdeDataUrl('data:image/jpeg;base64,AAAA')).toThrow(BadRequestException);
    expect(() => retratoDesdeDataUrl(dataUrl(Buffer.from('no soy png de verdad')))).toThrow(BadRequestException);
    expect(() => retratoDesdeDataUrl(undefined)).toThrow(BadRequestException);
  });
  it('rechaza pasar de 200 KB', () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(201 * 1024, 2)]);
    expect(() => retratoDesdeDataUrl(dataUrl(grande))).toThrow(PayloadTooLargeException);
  });
});

describe('ClientesService: avatar', () => {
  let prisma: any;
  let archivos: any;
  let auditoria: any;
  let service: ClientesService;

  beforeEach(() => {
    prisma = {
      person: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      archivo: { findUnique: jest.fn().mockResolvedValue({ ruta: '2027/04/uuid.png' }) },
      pedido: { findUnique: jest.fn() },
    };
    archivos = { subirArchivo: jest.fn().mockResolvedValue({ id: '77' }) };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new ClientesService(prisma, {} as any, {} as any, {} as any, auditoria, {} as any, archivos, {} as any, {} as any);
    jest.spyOn(service, 'yo').mockResolvedValue({ partyId: '5', avatarUrl: '/archivos/2027/04/uuid.png' } as any);
  });

  it('guarda config y retrato, enlaza la URL a la persona y audita', async () => {
    const r = await service.guardarAvatar(5n, { config: configValida(), retrato: dataUrl(PNG) }, '1.2.3.4');
    expect(archivos.subirArchivo).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'image/png', buffer: PNG }),
      false,
      expect.objectContaining({ partyId: 5n, rol: 'CLIENTE' }),
      '1.2.3.4',
    );
    const data = prisma.person.update.mock.calls[0][0].data;
    expect(data.avatar_url).toBe('/archivos/2027/04/uuid.png');
    expect(data.avatar_config.arriba.id).toBe('polo_basico');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CLIENTE_AVATAR_GUARDADO', modulo: 'clientes' }));
    expect(r?.avatarUrl).toBe('/archivos/2027/04/uuid.png');
  });

  it('no sube ni guarda nada si la configuración o el retrato no valen', async () => {
    await expect(service.guardarAvatar(5n, { config: { ...configValida(), piel: 'x' }, retrato: dataUrl(PNG) })).rejects.toThrow(BadRequestException);
    await expect(service.guardarAvatar(5n, { config: configValida(), retrato: 'nada' })).rejects.toThrow(BadRequestException);
    expect(archivos.subirArchivo).not.toHaveBeenCalled();
    expect(prisma.person.update).not.toHaveBeenCalled();
  });

  it('avatarDeCuenta devuelve nulos si no hay avatar', async () => {
    prisma.person.findUnique.mockResolvedValue({ avatar_config: null, avatar_url: null });
    await expect(service.avatarDeCuenta(5n)).resolves.toEqual({ config: null, avatarUrl: null });
  });

  it('avatarDePedido devuelve solo la URL, y null sin cliente o sin avatar', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce({ party_id: 9n });
    prisma.person.findUnique.mockResolvedValueOnce({ avatar_url: '/archivos/a.png' });
    await expect(service.avatarDePedido(1n)).resolves.toBe('/archivos/a.png');
    expect(prisma.person.findUnique).toHaveBeenCalledWith({ where: { party_id: 9n }, select: { avatar_url: true } });
    prisma.pedido.findUnique.mockResolvedValueOnce({ party_id: null });
    await expect(service.avatarDePedido(2n)).resolves.toBeNull();
    prisma.pedido.findUnique.mockResolvedValueOnce({ party_id: 9n });
    prisma.person.findUnique.mockResolvedValueOnce({ avatar_url: null });
    await expect(service.avatarDePedido(3n)).resolves.toBeNull();
  });
});

describe('CuentaClienteController: avatar', () => {
  const req: any = { ip: '9.9.9.9', headers: {} };
  const crear = (cliente: any) => {
    const clientes: any = {
      clienteDesdeRequest: jest.fn().mockResolvedValue(cliente),
      avatarDeCuenta: jest.fn().mockResolvedValue({ config: null, avatarUrl: null }),
      guardarAvatar: jest.fn().mockResolvedValue({ partyId: '5', avatarUrl: '/archivos/a.png' }),
    };
    return { clientes, ctrl: new CuentaClienteController(clientes, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any) };
  };

  it('sin sesión responde 401 en GET y PUT', async () => {
    const { ctrl } = crear(null);
    await expect(ctrl.avatar(req)).rejects.toThrow(UnauthorizedException);
    await expect(ctrl.guardarAvatar({}, req)).rejects.toThrow(UnauthorizedException);
  });

  it('con sesión guarda para la cuenta de la sesión (no para otra) y devuelve el cliente', async () => {
    const { ctrl, clientes } = crear({ partyId: '5' });
    const dto = { config: configValida(), retrato: dataUrl(PNG) };
    await expect(ctrl.guardarAvatar(dto, req)).resolves.toEqual({ cliente: { partyId: '5', avatarUrl: '/archivos/a.png' } });
    expect(clientes.guardarAvatar).toHaveBeenCalledWith('5', dto, '9.9.9.9');
    await ctrl.avatar(req);
    expect(clientes.avatarDeCuenta).toHaveBeenCalledWith('5');
  });
});

describe('validarAvatarConfig: mascota y foto de perfil', () => {
  it('un avatar sin mascota (guardado antes) se lee como «ninguno»', () => {
    const r = validarAvatarConfig(configValida());
    expect(r.mascota).toEqual({ id: 'ninguno', colores: {}, nombre: '' });
    expect(r.usarComoFoto).toBe(false);
  });

  it('acepta la mascota con colores y nombre, y limpia el nombre', () => {
    const r = validarAvatarConfig({ ...configValida(), mascota: { id: 'perro_cachorro', colores: { principal: '#d9a25b', acento: '#2B1B14' }, nombre: '  Canela ' } });
    expect(r.mascota).toEqual({ id: 'perro_cachorro', colores: { principal: '#D9A25B', acento: '#2B1B14' }, nombre: 'Canela' });
  });

  it('rechaza nombre de mascota de más de 14 letras, id raro, color malo o slot desconocido', () => {
    const base = configValida();
    expect(() => validarAvatarConfig({ ...base, mascota: { id: 'gato', colores: {}, nombre: 'a'.repeat(15) } })).toThrow(BadRequestException);
    expect(() => validarAvatarConfig({ ...base, mascota: { id: '../gato', colores: {}, nombre: '' } })).toThrow(BadRequestException);
    expect(() => validarAvatarConfig({ ...base, mascota: { id: 'gato', colores: { principal: 'rojo' }, nombre: '' } })).toThrow(BadRequestException);
    expect(() => validarAvatarConfig({ ...base, mascota: { id: 'gato', colores: { cola: '#FFFFFF' }, nombre: '' } })).toThrow(BadRequestException);
    expect(() => validarAvatarConfig({ ...base, mascota: { id: 'gato', colores: {}, nombre: 5 } })).toThrow(BadRequestException);
  });

  it('descarta campos extra dentro de la mascota (lista blanca)', () => {
    const r = validarAvatarConfig({ ...configValida(), mascota: { id: 'gato', colores: {}, nombre: '', telefono: '999' } });
    expect(Object.keys(r.mascota).sort()).toEqual(['colores', 'id', 'nombre']);
  });

  it('usarComoFoto: solo booleano', () => {
    expect(validarAvatarConfig({ ...configValida(), usarComoFoto: true }).usarComoFoto).toBe(true);
    expect(() => validarAvatarConfig({ ...configValida(), usarComoFoto: 'si' })).toThrow(BadRequestException);
  });
});

describe('fotoMostrada (una sola regla de foto del cliente)', () => {
  const av = '/archivos/avatar.png';
  const foto = '/archivos/foto.jpg';
  it('eligió usar el avatar: su retrato', () => expect(fotoMostrada({ fotoUrl: foto, avatarUrl: av, avatarComoFoto: true })).toBe(av));
  it('no eligió y no tiene foto: el retrato por defecto', () => expect(fotoMostrada({ fotoUrl: null, avatarUrl: av, avatarComoFoto: false })).toBe(av));
  it('tiene foto y no eligió el avatar: su foto', () => expect(fotoMostrada({ fotoUrl: foto, avatarUrl: av, avatarComoFoto: false })).toBe(foto));
  it('sin avatar: su foto o nada, aunque marque la opción', () => {
    expect(fotoMostrada({ fotoUrl: foto, avatarUrl: null, avatarComoFoto: true })).toBe(foto);
    expect(fotoMostrada({ fotoUrl: null, avatarUrl: null, avatarComoFoto: true })).toBeNull();
  });
});
