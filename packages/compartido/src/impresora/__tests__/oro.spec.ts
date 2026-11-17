import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { generarComandosTrabajo, comandosDeTrabajo, validarComandos, LIMITE_COMANDOS_BYTES } from '../comandos.js';
import { CASOS_ORO } from './muestras.js';
import { maquetarEtiqueta } from '../../etiquetas/maquetaStickers.js';

// PRUEBAS DE ORO: los bytes del servidor son IDENTICOS a los que imprimia el programa de impresión antes de mover el
// diseño al servidor (oro.json se generó con el generador del agente ANTES de moverlo). Un cambio INTENCIONAL de diseño
// se acepta regenerando el archivo:  ACTUALIZAR_ORO=1 pnpm --filter @caprichos/compartido test
const RUTA = fileURLToPath(new URL('./oro.json', import.meta.url));
const FECHA = '16/11/2026 10:30';
const generar = (c: (typeof CASOS_ORO)[number]) =>
  generarComandosTrabajo(c.tipo, c.payload, c.copia ?? false, { ticketColumnas: c.ticketColumnas, etiqueta: c.etiqueta as any }, { fechaTexto: FECHA });
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

if (process.env.ACTUALIZAR_ORO === '1') {
  const nuevo: Record<string, { formato: string; b64: string }> = {};
  for (const c of CASOS_ORO) {
    const r = generar(c);
    nuevo[c.nombre] = { formato: r.formato, b64: b64(r.bytes) };
  }
  writeFileSync(RUTA, JSON.stringify(nuevo, null, 1));
}
const oro: Record<string, { formato: string; b64: string }> = JSON.parse(readFileSync(RUTA, 'utf8'));

describe('pruebas de oro: los bytes del servidor igualan los del programa', () => {
  it('cubre todos los tipos de trabajo', () => {
    const tipos = new Set(CASOS_ORO.map((c) => c.tipo));
    for (const t of ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'TICKET_PAGO', 'TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA', 'TICKET_CIERRE']) {
      expect(tipos.has(t)).toBe(true);
    }
    expect(Object.keys(oro).sort()).toEqual(CASOS_ORO.map((c) => c.nombre).sort());
  });

  for (const c of CASOS_ORO) {
    it(c.nombre, () => {
      const r = generar(c);
      expect(r.formato).toBe(oro[c.nombre].formato);
      expect(b64(r.bytes)).toBe(oro[c.nombre].b64);
    });
  }
});

describe('comandos que viajan en el trabajo', () => {
  it('base64 + formato, y vuelven a bytes iguales', () => {
    const c = CASOS_ORO.find((x) => x.nombre === 'pago-qr-48')!;
    const viaje = comandosDeTrabajo(c.tipo, c.payload, false, { ticketColumnas: 48 });
    expect(viaje.formato).toBe('ESCPOS');
    const v = validarComandos(JSON.parse(JSON.stringify(viaje)));
    expect(v && b64(v.bytes)).toBe(viaje.base64);
  });

  it('se rechazan formato desconocido, base64 malo, vacío y demasiado grande', () => {
    expect(validarComandos(undefined)).toBeNull();
    expect(validarComandos({ formato: 'PDF', base64: 'AAAA' })).toBeNull();
    expect(validarComandos({ formato: 'TSPL', base64: '' })).toBeNull();
    expect(validarComandos({ formato: 'TSPL', base64: 'no es base64!' })).toBeNull();
    expect(validarComandos({ formato: 'TSPL', base64: 'AAA' })).toBeNull();
    expect(validarComandos({ formato: 'TSPL', base64: 5 })).toBeNull();
    const grande = Buffer.alloc(LIMITE_COMANDOS_BYTES + 1, 1).toString('base64');
    expect(validarComandos({ formato: 'ESCPOS', base64: grande })).toBeNull();
    expect(validarComandos({ formato: 'ESCPOS', base64: Buffer.alloc(LIMITE_COMANDOS_BYTES, 1).toString('base64') })).not.toBeNull();
  });

  it('un payload roto lanza (el servidor entonces no manda comandos)', () => {
    expect(() => generarComandosTrabajo('TICKET_PAGO', null, false, {})).toThrow();
  });
});

describe('el sticker de bebida con `maqueta` ya armada por el servidor imprime IGUAL que sin ella', () => {
  for (const nombre of ['bebida-defecto', 'bebida-50x40', 'bebida-70x40-sin-nota']) {
    it(nombre, () => {
      const c = CASOS_ORO.find((x) => x.nombre === nombre)!;
      const tam = c.payload.tamanoMm ?? { anchoMm: 76, altoMm: 38 };
      const maqueta = maquetarEtiqueta('ETIQUETA_BEBIDA', { ...c.payload, tamanoMm: tam }, tam);
      const con = generarComandosTrabajo(c.tipo, { ...c.payload, tamanoMm: tam, maqueta }, false, { etiqueta: c.etiqueta as any });
      const sin = generarComandosTrabajo(c.tipo, { ...c.payload, tamanoMm: tam }, false, { etiqueta: c.etiqueta as any });
      expect(b64(con.bytes)).toBe(b64(sin.bytes));
    });
  }
});
