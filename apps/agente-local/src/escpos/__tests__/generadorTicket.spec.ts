import { describe, it, expect } from 'vitest';
import type { TicketPagoDatos } from '@caprichos/compartido';
import { bloqueQrEscPos, generarTicketEscPos, generarComandaSalonEscPos } from '../generadorTicket';

const CADENA = '20600000001|03|B002|1|1.80|11.80|2026-11-02|1|00000000|';
const GS_K = Buffer.from([0x1d, 0x28, 0x6b]);

const base: TicketPagoDatos = {
  local: { nombre: 'Caprichos' },
  codigo: 'PED-1', fecha: '02/11/2026', hora: '10:00', who: '', modalidad: '',
  lineas: [{ cantidad: 1, nombre: 'Frappe', subtotal: 11.8 }],
  total: 11.8, pagos: [{ medio: 'EFECTIVO', monto: 11.8 }],
  comprobante: null,
};
const conQr: TicketPagoDatos = {
  ...base,
  comprobante: {
    tipo: 'BOLETA', numero: 'B002-1', representacion: 'Representación impresa de la Boleta de venta electrónica',
    hash: 'HASH-DE-PRUEBA-0123456789', cadenaQr: CADENA,
  },
};

describe('bloqueQrEscPos (GS ( k)', () => {
  it('modelo 2, módulo 4 en 58 mm, corrección M, datos almacenados e impresión', () => {
    const b = bloqueQrEscPos(CADENA, 32);
    const esperadoInicio = Buffer.from([
      0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00, // modelo 2
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04, // módulo 4
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31, // ECC M
    ]);
    expect(b.subarray(0, esperadoInicio.length)).toEqual(esperadoInicio);
    // almacenar: pL pH = largo + 3 (cn, fn, m + datos)
    const n = CADENA.length + 3;
    expect(b.subarray(esperadoInicio.length, esperadoInicio.length + 8)).toEqual(
      Buffer.from([0x1d, 0x28, 0x6b, n & 0xff, n >> 8, 0x31, 0x50, 0x30]),
    );
    const despues = esperadoInicio.length + 8;
    expect(b.subarray(despues, despues + CADENA.length).toString('latin1')).toBe(CADENA);
    // imprimir al final
    expect(b.subarray(b.length - 8)).toEqual(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]));
  });

  it('módulo 6 en 80 mm', () => {
    expect(bloqueQrEscPos(CADENA, 48).subarray(16, 17)).toEqual(Buffer.from([0x06]));
  });

  it('pL/pH de datos largos usa el byte alto', () => {
    const largo = 'x'.repeat(300);
    const b = bloqueQrEscPos(largo, 32);
    const pos = 9 + 8 + 8; // tras modelo (9), módulo (8) y ECC (8)
    expect(b.subarray(pos, pos + 5)).toEqual(Buffer.from([0x1d, 0x28, 0x6b, 303 & 0xff, 303 >> 8]));
  });
});

describe('generarTicketEscPos con cadena QR', () => {
  it('imprime el QR entre la representación y el hash, centrado', () => {
    const t = generarTicketEscPos(conQr, 32).toString('latin1');
    const qr = t.indexOf('\x1d(k');
    expect(qr).toBeGreaterThan(t.indexOf('Representación'));
    expect(qr).toBeLessThan(t.indexOf('Hash:'));
    expect(t.slice(0, qr).endsWith('\x1ba\x01')).toBe(true);
    expect(t).toContain(CADENA);
  });

  it('sin cadena QR no lleva comando GS ( k y sale igual que antes (hash en texto)', () => {
    const sin: TicketPagoDatos = { ...conQr, comprobante: { ...conQr.comprobante!, cadenaQr: null } };
    const t = generarTicketEscPos(sin, 32);
    expect(t.includes(GS_K)).toBe(false);
    expect(t.toString('latin1')).toContain('Hash: HASH-DE-PRUEBA');
    expect(t.toString('latin1').endsWith('\x1dV\x42\x00')).toBe(true);
  });

  it('ticket sin comprobante (compatibilidad) no cambia de tamaño por el QR', () => {
    const t = generarTicketEscPos(base, 48);
    expect(t.includes(GS_K)).toBe(false);
    expect(t.toString('latin1').endsWith('\x1dV\x42\x00')).toBe(true);
  });
});

describe('generarComandaSalonEscPos', () => {
  it('imprime la comanda en texto, sin QR, y corta el papel al final', () => {
    const b = generarComandaSalonEscPos({
      codigo: 'CP-7', mesa: 'Mesa 2', cliente: 'Luis', canal: 'Mozo', fecha: '05/11/2026', hora: '12:30',
      lineas: [{ cantidad: 2, nombre: 'Croissant', opciones: [], nota: 'Sin mantequilla' }],
    }, 32);
    const texto = b.toString('latin1');
    expect(texto).toContain('Pedido CP-7');
    expect(texto).toContain('2 x Croissant');
    expect(texto).toContain('Sin mantequilla');
    expect(b.includes(GS_K)).toBe(false);
    expect(b.subarray(b.length - 4)).toEqual(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
  });
});

describe('simulación de pedido', () => {
  it('el ticket y la comanda de una simulación imprimen *** PRUEBA ***; uno normal no', () => {
    const ticket = { ...base, simulacion: true } as TicketPagoDatos;
    expect(generarTicketEscPos(ticket, 48).toString('latin1')).toContain('*** PRUEBA ***');
    expect(generarTicketEscPos(base, 48).toString('latin1')).not.toContain('PRUEBA');
    const comanda: any = { codigo: 'PRUEBA', mesa: null, lineas: [], simulacion: true };
    expect(generarComandaSalonEscPos(comanda, 48).toString('latin1')).toContain('*** PRUEBA ***');
  });
});
