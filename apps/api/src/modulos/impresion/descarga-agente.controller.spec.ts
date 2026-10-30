jest.mock('./impresion.service', () => ({ ImpresionService: class {} }));
import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DescargaAgenteController } from './descarga-agente.controller';

describe('DescargaAgenteController', () => {
  const ctrl = new DescargaAgenteController({} as any);
  const res = () => ({ download: jest.fn() });

  it('sirve el binario de Linux si existe', () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dl-')), 'agente-impresion-linux');
    fs.writeFileSync(f, 'x');
    process.env.AGENTE_LINUX_RUTA = f;
    const r = res();
    ctrl.descargar('linux', r);
    expect(r.download).toHaveBeenCalledWith(f, 'agente-impresion-linux');
  });

  it('404 claro si aun no esta publicado', () => {
    process.env.AGENTE_LINUX_RUTA = '/no/existe/linux';
    expect(() => ctrl.descargar('linux', res())).toThrow(NotFoundException);
    try { ctrl.descargar('linux', res()); } catch (e: any) { expect(e.getResponse().mensaje).toContain('Linux'); }
  });

  it('404 con sistema desconocido', () => {
    expect(() => ctrl.descargar('mac', res())).toThrow(NotFoundException);
  });
});
