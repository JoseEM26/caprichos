import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ejecutarComandoProbar, ejecutarComandoVolcar } from '../cli';
import { ImpresoraMemoria } from '../impresora/impresoraMemoria';
import { ErrorImpresora } from '../impresora/dispositivo.interface';

describe('CLI - Comandos de prueba y volcado', () => {
  it('ejecutarComandoProbar envia 3 etiquetas de muestra a la impresora (general, area, bebida)', async () => {
    const memoria = new ImpresoraMemoria();
    const logs: string[] = [];

    const resultado = await ejecutarComandoProbar(memoria, (msg) => logs.push(msg));
    expect(resultado.exito).toBe(true);
    expect(resultado.impresas).toBe(3);

    const trabajos = memoria.obtenerTrabajosEscritos();
    expect(trabajos).toHaveLength(3);
    // General
    expect(trabajos[0].toString()).toContain('PEDIDO');
    // Area
    expect(trabajos[1].toString()).toContain('COCINA');
    // Bebida
    expect(trabajos[2].toString()).toContain('BEBIDA 1 de 2');
  });

  it('ejecutarComandoProbar maneja errores de impresora sin lanzar excepcion no capturada', async () => {
    const memoria = new ImpresoraMemoria();
    memoria.simularErrorAlEscribir(
      new ErrorImpresora('Impresora desconectada', 'desconectada', 'ENOENT')
    );
    const logs: string[] = [];

    const resultado = await ejecutarComandoProbar(memoria, (msg) => logs.push(msg));
    expect(resultado.exito).toBe(false);
    expect(resultado.error).toContain('Impresora desconectada');
  });

  it('ejecutarComandoVolcar genera archivos .tspl de los 3 tipos de etiquetas en el directorio especificado', async () => {
    const dirTemporal = path.join(__dirname, 'temp-volcado-test');
    if (fs.existsSync(dirTemporal)) {
      fs.rmSync(dirTemporal, { recursive: true, force: true });
    }

    const logs: string[] = [];
    const archivos = await ejecutarComandoVolcar(dirTemporal, (msg) => logs.push(msg));

    expect(archivos).toHaveLength(3);
    expect(fs.existsSync(path.join(dirTemporal, 'etiqueta-general.tspl'))).toBe(true);
    expect(fs.existsSync(path.join(dirTemporal, 'etiqueta-area.tspl'))).toBe(true);
    expect(fs.existsSync(path.join(dirTemporal, 'etiqueta-bebida.tspl'))).toBe(true);

    const contenidoGeneral = fs.readFileSync(
      path.join(dirTemporal, 'etiqueta-general.tspl'),
      'utf-8'
    );
    expect(contenidoGeneral).toContain('SIZE 63.5 mm,101.6 mm');
    expect(contenidoGeneral).toContain('PEDIDO');

    // Limpieza
    fs.rmSync(dirTemporal, { recursive: true, force: true });
  });
});
