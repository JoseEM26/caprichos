jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class AccesoGuard {} }));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArchivosService, MAX_AUDIO_BYTES } from './archivos.service';
import { ArchivosController } from './archivos.controller';
import { interpretarRango } from './rango-http.util';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

describe('Audios privados (notas de voz)', () => {
  let dir: string;
  let prisma: any;
  let svc: ArchivosService;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-test-'));
    prisma = {
      archivo: {
        create: jest.fn(async ({ data }: any) => ({ id: 31n, ...data })),
        findUnique: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    svc = new ArchivosService(prisma, { get: () => dir } as any, { registrar: jest.fn() } as any);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('guarda el audio en la carpeta privada y registra tipo y tamaño', async () => {
    const r = await svc.subirAudio(Buffer.from('OggS-datos'), 'audio/ogg');
    expect(r).toEqual({ id: '31', url: '/admin/archivos/31' });
    const { ruta, privado, tipo_mime } = prisma.archivo.create.mock.calls[0][0].data;
    expect(ruta).toMatch(/^privado\/\d{4}\/\d{2}\/.+\.ogg$/);
    expect(privado).toBe(true);
    expect(tipo_mime).toBe('audio/ogg');
    expect(fs.readFileSync(path.join(dir, ruta)).toString()).toBe('OggS-datos');
  });

  it('rechaza tipos no permitidos, vacíos y más de 16 MB', async () => {
    await expect(svc.subirAudio(Buffer.from('x'), 'video/mp4')).rejects.toMatchObject({ status: 415 });
    await expect(svc.subirAudio(Buffer.alloc(0), 'audio/ogg')).rejects.toMatchObject({ status: 413 });
    await expect(svc.subirAudio(Buffer.alloc(MAX_AUDIO_BYTES + 1), 'audio/ogg')).rejects.toMatchObject({ status: 413 });
  });

  it('eliminarArchivo borra el archivo físico y la fila (retención/baja)', async () => {
    const r = await svc.subirAudio(Buffer.from('OggS-datos'), 'audio/ogg');
    const { ruta } = prisma.archivo.create.mock.calls[0][0].data;
    prisma.archivo.findUnique.mockResolvedValue({ id: 31n, ruta });
    expect(await svc.eliminarArchivo(r.id)).toBe(true);
    expect(fs.existsSync(path.join(dir, ruta))).toBe(false);
    expect(prisma.archivo.delete).toHaveBeenCalledWith({ where: { id: 31n } });
    prisma.archivo.findUnique.mockResolvedValue(null);
    expect(await svc.eliminarArchivo('99')).toBe(false);
  });
});

describe('Range y permiso del endpoint privado', () => {
  it('interpretarRango entiende a-b, a-, -n, y detecta lo inválido', () => {
    expect(interpretarRango('bytes=0-99', 1000)).toEqual({ inicio: 0, fin: 99 });
    expect(interpretarRango('bytes=900-', 1000)).toEqual({ inicio: 900, fin: 999 });
    expect(interpretarRango('bytes=-100', 1000)).toEqual({ inicio: 900, fin: 999 });
    expect(interpretarRango('bytes=0-5000', 1000)).toEqual({ inicio: 0, fin: 999 });
    expect(interpretarRango('bytes=2000-3000', 1000)).toBe('invalido');
    expect(interpretarRango('bytes=50-10', 1000)).toBe('invalido');
    expect(interpretarRango(undefined, 1000)).toBeNull();
    expect(interpretarRango('items=0-1', 1000)).toBeNull();
  });

  let dir: string;
  let ruta: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rango-test-'));
    ruta = path.join(dir, 'a.ogg');
    fs.writeFileSync(ruta, Buffer.from('0123456789'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const respuesta = () => {
    const chunks: Buffer[] = [];
    const res: any = {
      headers: {} as Record<string, any>,
      statusCode: 200,
      setHeader: (k: string, v: any) => (res.headers[k] = v),
      status: (c: number) => ((res.statusCode = c), res),
      end: jest.fn(),
      // Writable mínimo para stream.pipe
      write: (c: Buffer) => (chunks.push(Buffer.from(c)), true),
      on: jest.fn().mockReturnThis(),
      once: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      removeListener: jest.fn(),
      cuerpo: () => Buffer.concat(chunks).toString(),
    };
    return res;
  };
  const llamar = async (range?: string) => {
    const servicio: any = { obtenerArchivoPrivado: jest.fn().mockResolvedValue({ rutaAbsoluta: ruta, tipoMime: 'audio/ogg', bytes: 10 }) };
    const res = respuesta();
    await new ArchivosController(servicio).servirPrivado('7', { headers: range ? { range } : {} }, res);
    await new Promise((r) => setTimeout(r, 50));
    return res;
  };

  it('con Range responde 206 con el tramo y Content-Range; sin Range, el archivo completo', async () => {
    const parcial = await llamar('bytes=2-5');
    expect(parcial.statusCode).toBe(206);
    expect(parcial.headers['Content-Range']).toBe('bytes 2-5/10');
    expect(parcial.headers['Content-Length']).toBe(4);
    expect(parcial.headers['Content-Type']).toBe('audio/ogg');
    expect(parcial.headers['Accept-Ranges']).toBe('bytes');

    const completo = await llamar();
    expect(completo.statusCode).toBe(200);
    expect(completo.headers['Content-Length']).toBe(10);
  });

  it('un rango fuera del archivo responde 416', async () => {
    const res = await llamar('bytes=50-60');
    expect(res.statusCode).toBe(416);
    expect(res.headers['Content-Range']).toBe('bytes */10');
  });

  it('exige sesión y permiso: guard de acceso y permiso mensajes.ver (o archivos/iniciativas)', () => {
    const guards = Reflect.getMetadata('__guards__', ArchivosController.prototype.servirPrivado) as any[];
    expect(guards.map((g) => g.name)).toContain('AccesoGuard');
    const permisos = Reflect.getMetadata(CLAVE_PERMISO, ArchivosController.prototype.servirPrivado);
    expect(permisos).toEqual(expect.arrayContaining([{ modulo: 'mensajes', accion: 'ver' }]));
  });
});

describe('Documentos privados (WhatsApp)', () => {
  let dir: string;
  let svc: ArchivosService;
  let prisma: any;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-test-'));
    prisma = { archivo: { create: jest.fn(async ({ data }: any) => ({ id: 41n, ...data })) } };
    svc = new ArchivosService(prisma, { get: () => dir } as any, { registrar: jest.fn() } as any);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('guarda un PDF en privado con nombre aleatorio (el nombre original no toca el disco)', async () => {
    const r = await svc.subirDocumento(Buffer.from('%PDF-1.4 x'), 'application/pdf', '../../etc/carta.pdf');
    const fila = prisma.archivo.create.mock.calls[0][0].data;
    expect(fila).toMatchObject({ tipo_mime: 'application/pdf', privado: true, bytes: 10 });
    expect(fila.ruta).toMatch(/^privado\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
    expect(r.nombre).toBe('carta.pdf');
    expect(fs.existsSync(path.join(dir, fila.ruta))).toBe(true);
  });

  it('rechaza tipo no permitido, contenido falso y tamaños fuera de límite', async () => {
    await expect(svc.subirDocumento(Buffer.from('MZ'), 'application/pdf', 'a.exe')).rejects.toMatchObject({ status: 415 });
    await expect(svc.subirDocumento(Buffer.from('MZ-programa'), 'application/pdf', 'a.pdf')).rejects.toMatchObject({ status: 415 });
    await expect(svc.subirDocumento(Buffer.alloc(0), 'text/plain', 'a.txt')).rejects.toMatchObject({ status: 413 });
    await expect(svc.subirDocumento(Buffer.alloc(17 * 1024 * 1024), 'text/plain', 'a.txt')).rejects.toMatchObject({ status: 413 });
  });
});
