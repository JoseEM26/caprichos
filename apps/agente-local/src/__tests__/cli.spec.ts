import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ejecutarComandoProbar, ejecutarComandoVolcar, listarImpresorasLinux, crearDispositivo, interpretarIeee1284, describirImpresora, ejecutarAsistente } from '../cli';
import { rutaArchivoConfiguracion, obtenerConfiguracion } from '../config';
import { ImpresoraMemoria } from '../impresora/impresoraMemoria';
import { ImpresoraUsb } from '../impresora/impresoraUsb';
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

describe('Linux: dos impresoras por rol', () => {
  it('lista los /dev/usb/lpN con modelo y lenguaje de ieee1284, y marca sin permiso', () => {
    const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'usb-'));
    const sys = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sys-'));
    ['lp1', 'lp0', 'hiddev0'].forEach((n) => fs.writeFileSync(path.join(d, n), ''));
    fs.mkdirSync(`${sys}/lp0/device`, { recursive: true });
    fs.writeFileSync(`${sys}/lp0/device/ieee1284_id`, 'MFG:4BARCODE;CMD:TSPL2;MDL:4B-2054TH;CLS:PRINTER;');
    fs.chmodSync(`${d}/lp1`, 0o444);
    const l = listarImpresorasLinux(d, sys);
    expect(l.map((x) => x.destino)).toEqual([`${d}/lp0`, `${d}/lp1`]);
    expect(l[0]).toMatchObject({ modelo: '4BARCODE 4B-2054TH', lenguaje: 'TSPL2', sugerido: 'ETIQUETERA' });
    expect(describirImpresora({ ...l[0], destino: '/dev/usb/lp0', puedeEscribir: false })).toBe('/dev/usb/lp0 — 4BARCODE 4B-2054TH (etiquetas TSPL2) [sin permiso]');
    fs.rmSync(d, { recursive: true, force: true });
    fs.rmSync(sys, { recursive: true, force: true });
    expect(listarImpresorasLinux(d, sys)).toEqual([]);
  });

  it('sugiere por lenguaje: TSPL/ZPL/EPL etiquetera, ESC/POS ticketera', () => {
    expect(interpretarIeee1284('MFG:Zebra;CMD:ZPL;MDL:ZD220;').sugerido).toBe('ETIQUETERA');
    expect(interpretarIeee1284('MFG:X;CMD:EPL2;MDL:Y;').sugerido).toBe('ETIQUETERA');
    expect(interpretarIeee1284('MFG:EPSON;CMD:ESCPOS;MDL:TM-T20;')).toMatchObject({ sugerido: 'TICKETERA', modelo: 'EPSON TM-T20' });
    expect(interpretarIeee1284('MFG:A;MDL:B;').sugerido).toBeUndefined();
  });

  it('asistente: valida la entrada y vuelve a preguntar; acepta número o ruta existente', async () => {
    const home = fs.mkdtempSync(path.join(require('os').tmpdir(), 'home-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    const ruta = rutaArchivoConfiguracion();
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify({ apiUrl: 'http://x', agenteKey: 'k' }));
    const resp = ['ImpresoraInventada', '/no/existe', '/dev/null', ''];
    const logs: string[] = [];
    const cfg = await ejecutarAsistente(async () => resp.shift() ?? '', (m) => logs.push(m));
    process.env.HOME = prev;
    expect(cfg.etiquetera).toBe('/dev/null');
    expect(cfg.ticketera).toBeUndefined();
    expect(logs.filter((m) => m.includes('no existe en este equipo'))).toHaveLength(2);
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('config en ~/.config/CaprichosAgente y rutas /dev/usb distintas por rol', () => {
    expect(rutaArchivoConfiguracion({ HOME: '/home/caja' } as any)).toBe('/home/caja/.config/CaprichosAgente/config.json');
    const c = obtenerConfiguracion({} as any, { etiquetera: '/dev/usb/lp0', ticketera: '/dev/usb/lp1' });
    expect([c.etiquetera, c.ticketera]).toEqual(['/dev/usb/lp0', '/dev/usb/lp1']);
    expect(crearDispositivo('/dev/usb/lp1').obtenerRuta()).toBe('/dev/usb/lp1');
  });

  it('si lp0 y lp1 se intercambian, cada rol sigue a su impresora', async () => {
    const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'usb-'));
    const sys = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sys-'));
    const poner = (n: string, id: string) => {
      fs.writeFileSync(path.join(d, n), '');
      fs.mkdirSync(`${sys}/${n}/device`, { recursive: true });
      fs.writeFileSync(`${sys}/${n}/device/ieee1284_id`, id);
    };
    const ETQ = 'MFG:4BARCODE;CMD:TSPL2;MDL:4B-2054TH;SN:A1;';
    const TKT = 'MFG:EPSON;CMD:ESCPOS;MDL:TM-T20;';
    poner('lp0', ETQ); poner('lp1', TKT);
    const antes = listarImpresorasLinux(d, sys);
    const idE = antes[0].identidad, idT = antes[1].identidad;
    expect(idE).toBe('4BARCODE 4B-2054TH|A1');
    const logs: string[] = [];
    const mk = (ruta: string, id?: string) => new ImpresoraUsb(ruta, id, () => listarImpresorasLinux(d, sys), (m) => logs.push(m));
    const etq = mk(`${d}/lp0`, idE), tkt = mk(`${d}/lp1`, idT), vieja = mk(`${d}/lp0`);
    poner('lp0', TKT); poner('lp1', ETQ); // reconexión: se intercambian
    expect((await etq.verificarEstado()).estado).toBe('lista');
    expect(etq.obtenerRuta()).toBe(`${d}/lp1`);
    await tkt.verificarEstado();
    expect(tkt.obtenerRuta()).toBe(`${d}/lp0`);
    expect(logs).toHaveLength(2);
    await vieja.verificarEstado();
    expect(vieja.obtenerRuta()).toBe(`${d}/lp0`); // config solo con ruta: se mantiene
    fs.rmSync(d, { recursive: true, force: true });
    fs.rmSync(sys, { recursive: true, force: true });
  });
});
