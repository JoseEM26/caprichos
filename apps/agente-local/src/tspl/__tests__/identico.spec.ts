import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { generarTsplTrabajo } from '../generadorTspl';
import { resolverFormato } from '../formato';
import { generarTicketEscPos } from '../../escpos/generadorTicket';
import { muestraEtiquetaArea } from '../../datosMuestra';

// Huellas del TSPL / ESC-POS que se imprimia ANTES de mover la maqueta a @caprichos/compartido:
// si cambia una, cambio lo que sale en el papel. (Sticker de área: marca CAPRICHOS arriba, nombre y mesa grandes, 08/11/2026; hashes renovados tras revisar el PNG.)
const huella = (s: string | Buffer) => createHash('sha256').update(typeof s === 'string' ? Buffer.from(s, 'latin1') : s).digest('hex').slice(0, 16);

describe('la maqueta compartida imprime lo mismo que antes', () => {
  const esperado: Record<string, string[]> = {
    '90': ['c54ffde0c527c9f2'],
    '270': ['c1f7e5a2344a5e51'],
  };
  for (const giro of [90, 270] as const) {
    it(`TSPL de la etiqueta de area (la que sigue en el rollo del agente), giro ${giro}`, () => {
      const f = resolverFormato({ giro });
      const got = [
        generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, true, f),
      ].map(huella);
      expect(got).toEqual(esperado[giro]);
    });
  }

  // Huellas renovadas: el nombre largo ahora sigue en otro renglón en vez de cortarse (ticket detallado)
  it('ticket ESC/POS de 48 y 32 columnas', () => {
    const t = {
      local: { nombre: 'Caprichos', razonSocial: 'X SAC', ruc: '2012345', direccion: 'Av. Siempre Viva 123' },
      codigo: 'CP-1', fecha: '30/10/2026', hora: '10:15', who: 'Jose', modalidad: 'MESA',
      lineas: [{ cantidad: 2, nombre: 'Frappe Oreo con nombre muy largo para cortar', tamano: '16oz', subtotal: 36 }, { cantidad: 1, nombre: 'Club', subtotal: 22 }],
      total: 58, pagos: [{ medio: 'EFECTIVO', monto: 58, recibido: 100, vuelto: 42 }], comprobante: { tipo: 'BOLETA', numero: 'B001-1' },
    };
    expect([huella(generarTicketEscPos(t, 48)), huella(generarTicketEscPos(t, 32))]).toEqual(['4cf35ae951cd7560', 'f7ce86aba00efb98']);
  });
});
