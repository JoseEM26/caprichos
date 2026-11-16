jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
import 'reflect-metadata';
import { CLAVE_PERMISO } from '../../acceso/permiso.decorator';
import { EvolutionAdminController } from '../evolution/evolution-admin.controller';

const montar = (proveedor = 'EVOLUTION', enVivo: string | null = 'close') => {
  const registrar = jest.fn();
  const api: any = {
    configurado: () => true,
    estado: async () => enVivo,
    qr: async () => ({ base64: 'QR64', codigo: 'x' }),
    instancia: 'secreta',
  };
  const c = new EvolutionAdminController({ proveedor: async () => proveedor } as any, api, { get: () => 'clave' } as any, { registrar } as any);
  return { c, registrar };
};

describe('Mensajes: estado y QR de Evolution', () => {
  it('se abren con mensajes/ver y no el cambio de proveedor ni la pausa', () => {
    const p = (m: string) => Reflect.getMetadata(CLAVE_PERMISO, (EvolutionAdminController.prototype as any)[m]);
    expect(p('estadoMensajes')).toEqual({ modulo: 'mensajes', accion: 'ver' });
    expect(p('qrMensajes')).toEqual({ modulo: 'mensajes', accion: 'ver' });
    expect(p('cambiarProveedor').modulo).toBe('configuracion');
    expect(p('pausa').modulo).toBe('configuracion');
  });

  it('estado: desvinculado y sin secretos', async () => {
    const r = await montar().c.estadoMensajes();
    expect(r).toEqual({ proveedor: 'EVOLUTION', vinculado: false, estado: 'close' });
    expect(JSON.stringify(r)).not.toMatch(/clave|secreta|http/);
  });

  it('estado: sin respuesta de Evolution no declara desvinculado', async () => {
    expect((await montar('EVOLUTION', null).c.estadoMensajes()).vinculado).toBeNull();
  });

  it('con Meta en uso informa el estado de Evolution y entrega el QR para vincular antes de cambiar', async () => {
    const { c } = montar('META');
    expect(await c.estadoMensajes()).toEqual({ proveedor: 'META', vinculado: false, estado: 'close' });
    expect(await c.qrMensajes({ usuario: { partyId: 7 } })).toEqual({ disponible: true, base64: 'QR64' });
  });

  it('qr: devuelve la imagen y audita quién lo pidió', async () => {
    const { c, registrar } = montar();
    const r = await c.qrMensajes({ usuario: { partyId: 7 } });
    expect(r).toEqual({ disponible: true, base64: 'QR64' });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'pedir_qr', partyId: 7n }));
  });
});
