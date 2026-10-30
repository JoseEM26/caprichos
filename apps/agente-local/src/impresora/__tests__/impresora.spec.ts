import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import { ImpresoraUsb } from '../impresoraUsb';
import { ImpresoraMemoria } from '../impresoraMemoria';
import { ErrorImpresora } from '../dispositivo.interface';

describe('ImpresoraMemoria (falsa para pruebas)', () => {
  it('registra los buffers escritos correctamente', async () => {
    const memoria = new ImpresoraMemoria();
    const datos = Buffer.from('TEST');
    await memoria.escribir(datos);

    expect(memoria.obtenerTrabajosEscritos()).toHaveLength(1);
    expect(memoria.obtenerTrabajosEscritos()[0].toString()).toBe('TEST');
  });

  it('permite simular errores de ENOENT (desconectada)', async () => {
    const memoria = new ImpresoraMemoria();
    memoria.simularErrorAlEscribir(
      new ErrorImpresora('No existe el dispositivo', 'desconectada', 'ENOENT')
    );

    await expect(memoria.escribir(Buffer.from('TEST'))).rejects.toThrow(
      'No existe el dispositivo'
    );
    expect(memoria.obtenerEstadoActual().estado).toBe('desconectada');
  });

  it('permite simular errores de EACCES (permiso denegado)', async () => {
    const memoria = new ImpresoraMemoria();
    memoria.simularErrorAlEscribir(
      new ErrorImpresora('Permiso denegado', 'error', 'EACCES')
    );

    await expect(memoria.escribir(Buffer.from('TEST'))).rejects.toThrow('Permiso denegado');
    expect(memoria.obtenerEstadoActual().estado).toBe('error');
  });
});

describe('ImpresoraUsb (dispositivo fisico)', () => {
  it('detecta ENOENT y clasifica estado como desconectada', async () => {
    // Usamos una ruta inexistente garantizada en el sistema
    const rutaInexistente = '/dev/usb/lp_inexistente_test_9999';
    const impresora = new ImpresoraUsb(rutaInexistente);

    const estado = await impresora.verificarEstado();
    expect(estado.estado).toBe('desconectada');
    expect(estado.detalle).toContain(rutaInexistente);

    await expect(impresora.escribir(Buffer.from('TEST'))).rejects.toThrow(ErrorImpresora);
    try {
      await impresora.escribir(Buffer.from('TEST'));
    } catch (e: any) {
      expect(e).toBeInstanceOf(ErrorImpresora);
      expect(e.estado).toBe('desconectada');
      expect(e.codigoOriginal).toBe('ENOENT');
    }
  });

  it('detecta EACCES en la verificación de estado cuando no hay permisos', async () => {
    const impresora = new ImpresoraUsb('/dev/usb/lp0');
    // Espiamos access para simular EACCES
    const errorAcceso: any = new Error('Permission denied');
    errorAcceso.code = 'EACCES';

    vi.spyOn(fs.promises, 'access').mockRejectedValueOnce(errorAcceso);

    const estado = await impresora.verificarEstado();
    expect(estado.estado).toBe('sin_permiso');
    expect(estado.detalle).toContain('sudo usermod -aG lp $USER');

    vi.restoreAllMocks();
  });

  it('detecta EIO al escribir y arroja ErrorImpresora con estado error', async () => {
    const impresora = new ImpresoraUsb('/dev/usb/lp0');
    const errorIO: any = new Error('Input/output error');
    errorIO.code = 'EIO';

    vi.spyOn(fs.promises, 'stat').mockResolvedValueOnce({} as any);
    vi.spyOn(fs.promises, 'open').mockRejectedValueOnce(errorIO);

    try {
      await impresora.escribir(Buffer.from('TEST'));
      expect.unreachable('Debió arrojar error');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ErrorImpresora);
      expect(e.estado).toBe('error');
      expect(e.codigoOriginal).toBe('EIO');
    }

    vi.restoreAllMocks();
  });
});
