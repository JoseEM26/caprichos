import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ejecutarComandoProbar, ejecutarComandoVolcar, listarImpresorasLinux, crearDispositivo, interpretarIeee1284, describirImpresora, ejecutarAsistente } from '../cli';
import { rutaArchivoConfiguracion, obtenerConfiguracion } from '../config';
import { ImpresoraMemoria } from '../impresora/impresoraMemoria';
import { ImpresoraUsb } from '../impresora/impresoraUsb';
import { ErrorImpresora } from '../impresora/dispositivo.interface';
import { ImpresoraRed } from '../impresora/impresoraRed';
import { ImpresoraWindows } from '../impresora/impresoraWindows';
import * as net from 'net';

// Que los comandos no lean la configuracion real del equipo
process.env.AGENTE_CONFIG = path.join(os.tmpdir(), 'caprichos-sin-config.json');

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
    expect(trabajos[0].toString()).toContain('SIZE 100 mm,100 mm');
    // Area
    expect(trabajos[1].toString()).toContain('COCINA');
    // Bebida
    expect(trabajos[2].toString()).toContain('SIZE 76 mm,38 mm');
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
    expect(contenidoGeneral).toContain('SIZE 100 mm,100 mm');
    expect(contenidoGeneral).toContain('PRINT 1,1');

    // Limpieza
    fs.rmSync(dirTemporal, { recursive: true, force: true });
  });
});

describe('Linux: dos impresoras por rol', () => {
  it('lista los /dev/usb/lpN con modelo y lenguaje de ieee1284, y marca sin permiso', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'usb-'));
    const sys = fs.mkdtempSync(path.join(os.tmpdir(), 'sys-'));
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
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
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
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'usb-'));
    const sys = fs.mkdtempSync(path.join(os.tmpdir(), 'sys-'));
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

describe('Impresora de RED por IP', () => {
  /** Servidor local que hace de impresora de red y guarda lo que recibe. */
  function impresoraDeRed(): Promise<{ puerto: number; recibido: () => Buffer; cerrar: () => Promise<void> }> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      const conexiones: net.Socket[] = [];
      const srv = net.createServer((c) => {
        conexiones.push(c);
        c.on('data', (d) => chunks.push(d));
        c.on('error', () => undefined);
      });
      srv.listen(0, '127.0.0.1', () => {
        resolve({
          puerto: (srv.address() as net.AddressInfo).port,
          recibido: () => Buffer.concat(chunks),
          cerrar: () => new Promise((r) => { conexiones.forEach((c) => c.destroy()); srv.close(() => r()); }),
        });
      });
    });
  }

  /** Config con llave (así el asistente no pide vincular) en un archivo temporal propio. */
  function configTemporal(): { ruta: string; limpiar: () => void } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'red-cfg-'));
    const ruta = path.join(dir, 'config.json');
    fs.writeFileSync(ruta, JSON.stringify({ apiUrl: 'http://x', agenteKey: 'k' }));
    const prev = process.env.AGENTE_CONFIG;
    process.env.AGENTE_CONFIG = ruta;
    return { ruta, limpiar: () => { process.env.AGENTE_CONFIG = prev; fs.rmSync(dir, { recursive: true, force: true }); } };
  }

  it('crearDispositivo elige red (tcp:// o IP), USB o Windows según el destino', () => {
    expect(crearDispositivo('tcp://192.168.1.50:9100', undefined, 'TICKETERA')).toBeInstanceOf(ImpresoraRed);
    expect(crearDispositivo('192.168.1.50').obtenerRuta()).toBe('tcp://192.168.1.50:9100');
    expect(crearDispositivo('/dev/usb/lp0')).toBeInstanceOf(ImpresoraUsb);
    expect(crearDispositivo('POS80')).toBeInstanceOf(ImpresoraWindows);
  });

  it('asistente: IP inválida y puerto cerrado vuelven a preguntar; IP buena se prueba, se guarda y se imprime la prueba si se acepta', async () => {
    const red = await impresoraDeRed();
    const cerrado = await impresoraDeRed();
    const puertoCerrado = cerrado.puerto;
    await cerrado.cerrar();
    const cfg = configTemporal();
    const resp = ['192.168.1.300', `127.0.0.1:${puertoCerrado}`, `127.0.0.1:${red.puerto}`, 'S', ''];
    const logs: string[] = [];
    try {
      const r = await ejecutarAsistente(async () => resp.shift() ?? '', (m) => logs.push(m));
      expect(r.etiquetera).toBe(`tcp://127.0.0.1:${red.puerto}`);
      expect(r.ticketera).toBeUndefined();
      expect(logs.some((m) => m.includes('IP no válida'))).toBe(true);
      expect(logs.some((m) => m.includes('No se pudo conectar con la impresora 127.0.0.1:'))).toBe(true);
      expect(logs.some((m) => m.startsWith('✔ Conexión con tcp://127.0.0.1:'))).toBe(true);
      await new Promise((res) => setTimeout(res, 50));
      expect(red.recibido().length).toBeGreaterThan(0); // la página de prueba de la etiquetera
      const guardado = JSON.parse(fs.readFileSync(cfg.ruta, 'utf-8'));
      expect(guardado.etiquetera).toBe(`tcp://127.0.0.1:${red.puerto}`);
    } finally {
      cfg.limpiar();
      await red.cerrar();
    }
  });

  it('asistente: con «n» en la prueba solo guarda (sin ticket, solo la consulta de estado)', async () => {
    const red = await impresoraDeRed();
    const cfg = configTemporal();
    const resp = ['', `127.0.0.1:${red.puerto}`, 'n'];
    try {
      const r = await ejecutarAsistente(async () => resp.shift() ?? '', () => undefined);
      expect(r.ticketera).toBe(`tcp://127.0.0.1:${red.puerto}`);
      await new Promise((res) => setTimeout(res, 50));
      // Solo la consulta de estado DLE EOT de la verificación: ningún ticket salió
      expect(red.recibido()).toEqual(Buffer.from([0x10, 0x04, 0x04, 0x10, 0x04, 0x02]));
    } finally {
      cfg.limpiar();
      await red.cerrar();
    }
  });
});
