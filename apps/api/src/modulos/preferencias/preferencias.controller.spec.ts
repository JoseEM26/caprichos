jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));
import { BadRequestException } from '@nestjs/common';
import { PreferenciasController, MAX_BYTES_PREFERENCIA } from './preferencias.controller';

describe('PreferenciasController', () => {
  const svc = { obtener: jest.fn(), guardar: jest.fn(), borrar: jest.fn() };
  const ctl = new PreferenciasController(svc as any);
  const req = { usuario: { partyId: 7n } };
  beforeEach(() => jest.clearAllMocks());

  it('lee solo la preferencia del propio usuario', async () => {
    svc.obtener.mockResolvedValue(['codigo']);
    expect(await ctl.obtener('caja.tabla.columnas', req)).toEqual({ clave: 'caja.tabla.columnas', valor: ['codigo'] });
    expect(svc.obtener).toHaveBeenCalledWith(7n, 'caja.tabla.columnas');
  });

  it('sin valor guardado devuelve null', async () => {
    svc.obtener.mockResolvedValue(undefined);
    expect((await ctl.obtener('caja.vista', req)).valor).toBeNull();
  });

  it('guarda con el party del token', async () => {
    await ctl.guardar('caja.vista', { valor: 'tabla' }, req);
    expect(svc.guardar).toHaveBeenCalledWith(7n, 'caja.vista', 'tabla');
  });

  it('valor null borra', async () => {
    await ctl.guardar('caja.vista', { valor: null }, req);
    expect(svc.borrar).toHaveBeenCalledWith(7n, 'caja.vista');
  });

  it('acepta las preferencias de la tabla de ventas del cierre', async () => {
    await ctl.guardar('cierre.ventas.vista', { valor: 'tabla' }, req);
    await ctl.guardar('cierre.ventas.columnas', { valor: ['codigo', 'total'] }, req);
    await ctl.guardar('cierre.ventas.filas', { valor: 25 }, req);
    expect(svc.guardar).toHaveBeenCalledTimes(3);
  });

  it('rechaza claves fuera de la lista y valores enormes', async () => {
    await expect(ctl.obtener('otra.cosa', req)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctl.guardar('caja.vista', { valor: 'x'.repeat(MAX_BYTES_PREFERENCIA + 1) }, req)).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.guardar).not.toHaveBeenCalled();
  });
});
