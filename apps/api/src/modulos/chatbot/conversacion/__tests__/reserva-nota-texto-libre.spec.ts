import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';

describe('nota de la reserva con texto libre', () => {
  const flujo: any = {
    estado: 'RESERVA_PREGUNTAR_NOTA',
    reserva: {
      estadoInterno: 'RESERVA_PREGUNTAR_NOTA',
      datos: { personas: 5, fechaIso: '2030-01-10', fechaTexto: 'jueves', hora: '15:00', nombre: 'Ana', telefono: '987654321' },
    },
  };

  it.each([
    'mesa para 5 personas, es un cumpleaños',
    'pido atención con una torta y silla de bebé',
    'necesito ayuda con una silla de ruedas',
  ])('"%s" se guarda como nota y no pasa a una persona', (t) => {
    const r = transicionarEstado(flujo, normalizarEntrada({ texto: t, textoOriginal: t } as any), {});
    expect(r.nuevoEstado).toBe('RESERVA_RESUMEN_CONFIRMAR');
  });

  it('pedir un asesor exacto sigue pasando a una persona', () => {
    const r = transicionarEstado(flujo, normalizarEntrada({ texto: 'asesor', textoOriginal: 'asesor' } as any), {});
    expect(r.nuevoEstado).toBe('ATENCION_PERSONA');
  });
});
