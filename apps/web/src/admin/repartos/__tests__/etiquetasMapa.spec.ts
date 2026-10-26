import { describe, it, expect } from 'vitest';
import { planificarEtiquetas, cajaEtiqueta, PuntoEtiqueta } from '../etiquetasMapa';
import { nombreClienteVisible } from '../textoVisible';

const punto = (id: string, x: number, y: number, extra: Partial<PuntoEtiqueta> = {}): PuntoEtiqueta => ({
  id,
  x,
  y,
  anchoCompleta: 150,
  anchoCodigo: 70,
  prioridad: 0,
  ...extra,
});

const seSolapan = (a: { x0: number; x1: number; y0: number; y1: number }, b: typeof a) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe('planificarEtiquetas (etiquetas del mapa de reparto)', () => {
  it('pines alejados muestran nombre y código completos', () => {
    const modos = planificarEtiquetas([punto('a', 100, 100), punto('b', 400, 300)]);
    expect(modos.get('a')).toBe('completa');
    expect(modos.get('b')).toBe('completa');
  });

  it('si la etiqueta completa choca con otra, cae a solo código', () => {
    // La etiqueta completa de A (y=69..103) tapa la completa de B, pero el código de B cabe debajo
    const modos = planificarEtiquetas([
      punto('a', 100, 100, { prioridad: 10 }),
      punto('b', 100, 130, { prioridad: 1 }),
    ]);
    expect(modos.get('a')).toBe('completa');
    expect(modos.get('b')).toBe('codigo');
  });

  it('si ni la completa ni el código caben, la etiqueta queda oculta (el pin sigue tocable)', () => {
    // El pin C tapa la etiqueta de B en sus dos modos; A y C sí tienen lugar
    const modos = planificarEtiquetas([
      punto('a', 100, 100, { prioridad: 10 }),
      punto('b', 100, 60, { prioridad: 1 }),
      punto('c', 130, 46, { prioridad: 5 }),
    ]);
    expect(modos.get('a')).toBe('completa');
    expect(modos.get('c')).toBe('completa');
    expect(modos.get('b')).toBe('oculta');
  });

  it('nunca deja dos etiquetas visibles encimadas ni una etiqueta sobre otro pin', () => {
    // Cuadrícula densa de pedidos
    const puntos: PuntoEtiqueta[] = [];
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        puntos.push(punto(`p${i}-${j}`, 60 + i * 30, 60 + j * 22, { prioridad: i + j }));
      }
    }
    const modos = planificarEtiquetas(puntos);
    const visibles = puntos
      .filter((p) => modos.get(p.id) !== 'oculta')
      .map((p) => ({ p, caja: cajaEtiqueta(p, modos.get(p.id) as 'completa' | 'codigo') }));

    for (let i = 0; i < visibles.length; i++) {
      for (let j = i + 1; j < visibles.length; j++) {
        expect(seSolapan(visibles[i].caja, visibles[j].caja)).toBe(false);
      }
      for (const q of puntos) {
        if (q.id === visibles[i].p.id) continue;
        const pin = { x0: q.x - 13, x1: q.x + 13, y0: q.y - 26, y1: q.y };
        expect(seSolapan(visibles[i].caja, pin)).toBe(false);
      }
    }
  });

  it('un obstáculo fijo (marcador de la tienda) no queda tapado por una etiqueta', () => {
    // Sin obstáculo, la etiqueta de A caería justo encima de la caja fija
    const caja = { x0: 112, x1: 200, y0: 80, y1: 100 };
    const modos = planificarEtiquetas([punto('a', 100, 100, { anchoCompleta: 150 })], [caja]);
    expect(modos.get('a')).not.toBe('completa');
  });

  it('la prioridad decide quién conserva la etiqueta completa cuando dos se disputan el mismo lugar', () => {
    const xAlta = planificarEtiquetas([
      punto('x', 100, 100, { prioridad: 10, anchoCompleta: 20 }),
      punto('y', 110, 130, { prioridad: 1 }),
    ]);
    expect(xAlta.get('x')).toBe('completa');
    expect(xAlta.get('y')).toBe('codigo');

    const yAlta = planificarEtiquetas([
      punto('x', 100, 100, { prioridad: 1, anchoCompleta: 20 }),
      punto('y', 110, 130, { prioridad: 10 }),
    ]);
    expect(yAlta.get('y')).toBe('completa');
    expect(yAlta.get('x')).toBe('codigo');
  });
});

describe('nombreClienteVisible (sin teléfonos ni números largos en pantalla)', () => {
  it('quita teléfonos pegados al nombre', () => {
    expect(nombreClienteVisible('792627476-1')).toBe('Cliente sin nombre');
    expect(nombreClienteVisible('Ana Pérez 987654321')).toBe('Ana Pérez');
    expect(nombreClienteVisible('324324324')).toBe('Cliente sin nombre');
  });

  it('conserva nombres normales', () => {
    expect(nombreClienteVisible('Rosa Quispe')).toBe('Rosa Quispe');
    expect(nombreClienteVisible('  Juan  ')).toBe('Juan');
  });
});
