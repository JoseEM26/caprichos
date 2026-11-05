import { describe, it, expect, afterEach } from 'vitest';
import * as net from 'net';
import { ImpresoraRed, parsearDestinoRed, esDestinoRed } from '../impresoraRed';
import { ErrorImpresora } from '../dispositivo.interface';

const servidores: net.Server[] = [];
const conexiones: net.Socket[] = [];

/** Servidor TCP local que guarda lo recibido. `alConectar` permite simular respuestas o silencio. */
function servidor(alConectar?: (s: net.Socket, recibido: () => Buffer) => void): Promise<{ puerto: number; recibido: () => Buffer }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const srv = net.createServer((s) => {
      conexiones.push(s);
      s.on('data', (c) => chunks.push(c));
      s.on('error', () => undefined);
      alConectar?.(s, () => Buffer.concat(chunks));
    });
    servidores.push(srv);
    srv.listen(0, '127.0.0.1', () => {
      const puerto = (srv.address() as net.AddressInfo).port;
      resolve({ puerto, recibido: () => Buffer.concat(chunks) });
    });
  });
}

/** Puerto que nadie escucha: conexión rechazada. */
async function puertoCerrado(): Promise<number> {
  const { puerto } = await servidor();
  await new Promise((r) => servidores.pop()!.close(r));
  return puerto;
}

afterEach(async () => {
  conexiones.splice(0).forEach((c) => c.destroy());
  await Promise.all(servidores.splice(0).map((s) => new Promise((r) => s.close(() => r(undefined)))));
});

describe('parsearDestinoRed (formatos aceptados)', () => {
  it('acepta IP, IP:puerto, tcp://IP y tcp://IP:puerto; el puerto por defecto es 9100', () => {
    expect(parsearDestinoRed('192.168.1.50')).toEqual({ host: '192.168.1.50', puerto: 9100 });
    expect(parsearDestinoRed('192.168.1.50:9101')).toEqual({ host: '192.168.1.50', puerto: 9101 });
    expect(parsearDestinoRed('tcp://192.168.1.50')).toEqual({ host: '192.168.1.50', puerto: 9100 });
    expect(parsearDestinoRed(' tcp://10.0.0.7:65535 ')).toEqual({ host: '10.0.0.7', puerto: 65535 });
    expect(parsearDestinoRed('tcp://ticketera-caja.local:9100')).toEqual({ host: 'ticketera-caja.local', puerto: 9100 });
  });

  it('rechaza rutas, nombres sueltos, IP fuera de rango y puertos inválidos', () => {
    for (const malo of ['/dev/usb/lp0', 'C:\\print', 'POS80', 'EPSON TM-T20', '999.1.1.1', '192.168.1', '192.168.1.50:0', '192.168.1.50:70000', '192.168.1.50:', ':9100', 'tcp://', 'tcp://../etc', '192.168.1.50/x', 'tcp://999.1.1.1', '::1']) {
      expect(() => parsearDestinoRed(malo), malo).toThrow();
    }
  });

  it('esDestinoRed distingue red de impresora instalada o ruta', () => {
    expect(esDestinoRed('192.168.1.50')).toBe(true);
    expect(esDestinoRed('192.168.1.50:9100')).toBe(true);
    expect(esDestinoRed('tcp://ticketera')).toBe(true);
    expect(esDestinoRed('/dev/usb/lp0')).toBe(false);
    expect(esDestinoRed('POS80')).toBe(false);
  });

  it('obtenerRuta devuelve tcp://IP:PUERTO', () => {
    expect(new ImpresoraRed('192.168.1.50').obtenerRuta()).toBe('tcp://192.168.1.50:9100');
  });
});

describe('ImpresoraRed.escribir', () => {
  it('escribe el búfer completo, grande incluido, y cierra', async () => {
    const { puerto, recibido } = await servidor();
    const datos = Buffer.alloc(300_000, 0x41);
    datos[0] = 0x1b; datos[1] = 0x40; // ESC @ al inicio
    await new ImpresoraRed(`127.0.0.1:${puerto}`).escribir(datos);
    await new Promise((r) => setTimeout(r, 50));
    expect(recibido().equals(datos)).toBe(true);
  });

  it('conexión rechazada: desconectada con el mensaje en español', async () => {
    const puerto = await puertoCerrado();
    const err = await new ImpresoraRed(`127.0.0.1:${puerto}`).escribir(Buffer.from('x')).catch((e) => e);
    expect(err).toBeInstanceOf(ErrorImpresora);
    expect(err.estado).toBe('desconectada');
    expect(err.message).toBe(`No se pudo conectar con la impresora 127.0.0.1:${puerto}: revisa que esté encendida y en la misma red`);
  });

  it('host inaccesible o timeout de conexión: desconectada (sin importar la causa exacta)', async () => {
    const err = await new ImpresoraRed('10.255.255.1', { timeoutConexionMs: 300 }).escribir(Buffer.from('x')).catch((e) => e);
    expect(err.estado).toBe('desconectada');
    expect(err.message).toContain('No se pudo conectar con la impresora 10.255.255.1:9100');
  });

  it('impresora que no recibe a tiempo: timeout de escritura, desconectada', async () => {
    // El servidor nunca lee: el búfer no cabe en los buffers del kernel y el flush no termina
    const { puerto } = await servidor((s) => s.pause());
    const grande = Buffer.alloc(64 * 1024 * 1024, 0x20);
    const inicio = Date.now();
    const err = await new ImpresoraRed(`127.0.0.1:${puerto}`, { timeoutEscrituraMs: 300 }).escribir(grande).catch((e) => e);
    expect(err.estado).toBe('desconectada');
    expect(err.message).toContain('no terminó de recibir los datos a tiempo');
    expect(Date.now() - inicio).toBeLessThan(5000);
  });
});

describe('ImpresoraRed.verificarEstado', () => {
  it('lista si conecta, sin enviar ningún dato a la impresora', async () => {
    const { puerto, recibido } = await servidor();
    const estado = await new ImpresoraRed(`127.0.0.1:${puerto}`).verificarEstado();
    expect(estado).toEqual({ estado: 'lista', detalle: `Red 127.0.0.1:${puerto}` });
    await new Promise((r) => setTimeout(r, 50));
    expect(recibido().length).toBe(0);
  });

  it('desconectada con la causa si no conecta', async () => {
    const puerto = await puertoCerrado();
    const estado = await new ImpresoraRed(`127.0.0.1:${puerto}`).verificarEstado();
    expect(estado.estado).toBe('desconectada');
    expect(estado.detalle).toContain(`No se pudo conectar con la impresora 127.0.0.1:${puerto}`);
    expect(estado.detalle).toContain('ECONNREFUSED');
  });

  it('ticketera: pide el estado DLE EOT y reporta sin papel', async () => {
    // Responde a cada DLE EOT: byte de papel con bit 0x60 (fin de papel) y causa sin novedad
    const { puerto, recibido } = await servidor((s, rec) => {
      s.on('data', () => { if (rec().length >= 6) s.write(Buffer.from([0x60, 0x00])); });
    });
    const estado = await new ImpresoraRed(`127.0.0.1:${puerto}`, { rol: 'TICKETERA' }).verificarEstado();
    expect(estado.estado).toBe('sin_papel');
    await new Promise((r) => setTimeout(r, 50));
    expect(recibido()).toEqual(Buffer.from([0x10, 0x04, 0x04, 0x10, 0x04, 0x02]));
  });

  it('ticketera: tapa abierta si la causa lo dice', async () => {
    const { puerto } = await servidor((s, rec) => {
      s.on('data', () => { if (rec().length >= 6) s.write(Buffer.from([0x00, 0x04])); });
    });
    const estado = await new ImpresoraRed(`127.0.0.1:${puerto}`, { rol: 'TICKETERA' }).verificarEstado();
    expect(estado.estado).toBe('error');
    expect(estado.detalle).toContain('Tapa abierta');
  });

  it('ticketera que no contesta el estado sigue en lista (no cuenta como error)', async () => {
    const { puerto } = await servidor();
    const inicio = Date.now();
    const estado = await new ImpresoraRed(`127.0.0.1:${puerto}`, { rol: 'TICKETERA', timeoutEstadoMs: 100 }).verificarEstado();
    expect(estado.estado).toBe('lista');
    expect(Date.now() - inicio).toBeLessThan(2500);
  });
});
