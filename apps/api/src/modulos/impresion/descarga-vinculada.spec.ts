jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('./impresion.service', () => ({ ImpresionService: class {} }));
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { PassThrough } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { unzipSync } from 'fflate';
import { AdminImpresionController } from './admin-impresion.controller';
import { AccesoGuard } from '../acceso/acceso.guard';

describe('descarga del programa ya vinculado', () => {
  const llave = 'agk_secreta123';
  const servicio = { crearLlaveAgente: jest.fn().mockResolvedValue({ id: '9', llave }) };
  const ctrl = new AdminImpresionController(servicio as any);
  const req = (rol = 'ADMIN') => ({
    usuario: { rol, partyId: 1 },
    headers: { host: 'demo.caprichos.pe', 'x-forwarded-proto': 'https' },
    ip: '1.1.1.1',
  });

  function respuesta() {
    const s: any = new PassThrough();
    const trozos: Buffer[] = [];
    s.on('data', (c: Buffer) => trozos.push(c));
    s.set = jest.fn();
    return { s, zip: () => new Promise<Buffer>((r) => s.on('end', () => r(Buffer.concat(trozos)))) };
  }

  it('el endpoint exige el permiso usuarios/crear bajo AccesoGuard', () => {
    expect(Reflect.getMetadata('permiso', AdminImpresionController.prototype.descargaVinculada)).toEqual({
      modulo: 'usuarios',
      accion: 'crear',
    });
    expect(Reflect.getMetadata('__guards__', AdminImpresionController)).toContain(AccesoGuard);
  });

  it('solo ADMIN', async () => {
    await expect(ctrl.descargaVinculada({}, req('MOZO'), respuesta().s)).rejects.toThrow(ForbiddenException);
    expect(servicio.crearLlaveAgente).not.toHaveBeenCalled();
  });

  it('crea el vinculo y responde un zip con exe, config.json valido y LEEME, sin loguear la llave', async () => {
    const exe = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dv-')), 'a.exe');
    fs.writeFileSync(exe, Buffer.alloc(600_000, 7));
    process.env.AGENTE_EXE_RUTA = exe;
    const espia = [jest.spyOn(console, 'log'), jest.spyOn(console, 'error'), jest.spyOn(console, 'warn')];
    const r = respuesta();
    const fin = r.zip();
    await ctrl.descargaVinculada({ nombre: ' Caja ' }, req(), r.s);
    const archivos = unzipSync(new Uint8Array(await fin));
    expect(Object.keys(archivos).sort()).toEqual(['LEEME.txt', 'agente-impresion-windows.exe', 'config.json']);
    expect(archivos['agente-impresion-windows.exe'].length).toBe(600_000);
    expect(JSON.parse(Buffer.from(archivos['config.json']).toString())).toEqual({
      apiUrl: 'https://demo.caprichos.pe',
      agenteKey: llave,
    });
    expect(Buffer.from(archivos['LEEME.txt']).toString().split('\r\n')).toHaveLength(4);
    expect(servicio.crearLlaveAgente).toHaveBeenCalledWith({ nombre: 'Caja' }, expect.anything(), '1.1.1.1');
    expect(r.s.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'application/zip' }));
    for (const e of espia) expect(JSON.stringify(e.mock.calls)).not.toContain(llave);
  });
});
