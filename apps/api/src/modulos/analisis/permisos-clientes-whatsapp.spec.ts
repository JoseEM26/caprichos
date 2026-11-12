jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));
jest.mock('../chatbot', () => ({ ConsumoWhatsappService: class {}, enmascararTelefono: jest.requireActual('../chatbot/utilidades/enmascarar.util').enmascararTelefono }));

import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ClientesAnalisisController } from './clientes/clientes.controller';
import { WhatsappAnalisisController } from './whatsapp/whatsapp.controller';
import { WhatsappAnalisisService } from './whatsapp/whatsapp.service';
import { CLAVE_PERMISO, type PermisoRequerido } from '../acceso/permiso.decorator';

describe('Análisis › Clientes y WhatsApp: permisos y rutas', () => {
  const reflector = new Reflector();
  const permiso = (c: any, m: string) => reflector.get<PermisoRequerido>(CLAVE_PERMISO, c.prototype[m]);

  it.each([
    ['clientes', ClientesAnalisisController, 'resumen', 'admin/analisis/clientes'],
    ['whatsapp', WhatsappAnalisisController, 'resumen', 'admin/analisis/whatsapp'],
    ['whatsapp sin respuesta', WhatsappAnalisisController, 'sinRespuesta', 'admin/analisis/whatsapp'],
  ])('%s: exige analisis/ver', (_n, controlador, metodo, ruta) => {
    expect(permiso(controlador, metodo)).toEqual({ modulo: 'analisis', accion: 'ver' });
    expect(Reflect.getMetadata(PATH_METADATA, controlador)).toBe(ruta);
  });

  it('el desglose por persona solo se pide cuando el usuario es ADMIN', () => {
    const resumen = jest.fn();
    const c = new WhatsappAnalisisController({ resumen } as unknown as WhatsappAnalisisService);
    c.resumen({}, { usuario: { roles: ['SUPERVISOR'] } });
    c.resumen({}, { usuario: { roles: ['ADMIN'] } });
    c.resumen({}, { usuario: { rol: 'admin' } });
    c.resumen({});
    expect(resumen.mock.calls.map((x) => x[1])).toEqual([false, true, true, false]);
  });
});
