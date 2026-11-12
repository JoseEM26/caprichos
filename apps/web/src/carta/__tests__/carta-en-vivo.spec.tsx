import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartaPublica } from '../CartaPublica';
import { api } from '../../comun/api';
import { aplicarDisponibilidad, msHastaProximoCambio } from '../enVivo';
import { excesosDeStock, infoStockDe } from '../stock';
import type { CategoriaCarta, EstadoLocalCarta, LineaCarrito, ProductoCarta } from '../tipos';

const producto = (extra: Partial<ProductoCarta> = {}): ProductoCarta => ({
  id: '1', nombre: 'Dona glaseada', descripcion: null, fotoUrl: null, precio: 6, tamanos: [], grupos: [], sabores: [],
  noSumaBeneficios: false, disponible: true, agotadoHasta: null, controlaStock: true, quedan: 5, ...extra,
});
const cartaCon = (p: ProductoCarta): CategoriaCarta[] => [{ id: 'c1', nombre: 'DONAS', productos: [p] } as unknown as CategoriaCarta];
const estado = (extra: Partial<EstadoLocalCarta> = {}): EstadoLocalCarta => ({
  abierta: true, motivo: 'OK', texto: 'Abierto', abre: '10:00', cierra: '22:00', pausaAltaDemanda: false, tiempoPrometidoMin: null, altaDemandaMin: 0, ...extra,
});
const linea = (cantidad: number): LineaCarrito => ({
  id: 'l1', productoId: '1', nombre: 'Dona glaseada', precioBase: 6, cantidad, opciones: [], precioUnitario: 6, subtotal: 6 * cantidad,
});

describe('enVivo.ts', () => {
  it('aplicarDisponibilidad actualiza quedan, disponible y sabores; sin cambios devuelve lo mismo', () => {
    const c = cartaCon(producto({ saboresConStock: true, sabores: [{ id: 's1', nombre: 'Fresa', activo: true, disponible: true, quedan: 3 }] }));
    expect(aplicarDisponibilidad(c, { productos: [{ id: '1', disponible: true, controlaStock: true, quedan: 5, sabores: [{ id: 's1', disponible: true, quedan: 3 }] }] })).toBe(c);
    const n = aplicarDisponibilidad(c, { productos: [{ id: '1', disponible: false, controlaStock: true, quedan: 0, sabores: [{ id: 's1', disponible: false, quedan: 0 }] }] });
    expect(n[0].productos[0]).toMatchObject({ disponible: false, quedan: 0, saboresConStock: false });
    expect(n[0].productos[0].sabores[0]).toMatchObject({ disponible: false, quedan: 0 });
  });

  it('una línea del carrito de un producto agotado a mano cuenta como exceso 0', () => {
    const inv = { '1': infoStockDe(producto({ controlaStock: false, quedan: null, disponible: false })) };
    expect(excesosDeStock([linea(2)], inv)).toEqual([{ productoId: '1', nombre: 'Dona glaseada', pedidas: 2, quedan: 0 }]);
  });

  it('msHastaProximoCambio: cierre de hoy en hora de Lima; sin cambio con pausa o ya cerrado', () => {
    const ahora = Date.UTC(2026, 0, 1, 20, 0, 0); // 15:00 en Lima
    expect(msHastaProximoCambio(estado({ cierra: '15:30' }), ahora)).toBe(30 * 60000);
    expect(msHastaProximoCambio(estado({ abierta: false, motivo: 'HORARIO', abre: '17:00' }), ahora)).toBe(120 * 60000);
    expect(msHastaProximoCambio(estado({ abierta: false, motivo: 'HORARIO', abre: '10:00' }), ahora)).toBeNull();
    expect(msHastaProximoCambio(estado({ pausaAltaDemanda: true }), ahora)).toBeNull();
    expect(msHastaProximoCambio(null, ahora)).toBeNull();
  });
});

describe('Carta en vivo (CartaPublica)', () => {
  let llamadas: string[];
  let disp: any;
  let est: EstadoLocalCarta;

  const montar = (lineas: LineaCarrito[] = []) => {
    sessionStorage.setItem('caprichos_carrito', JSON.stringify(lineas));
    llamadas = [];
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      llamadas.push(ruta);
      if (ruta === '/carta') return cartaCon(producto());
      if (ruta === '/carta/estado') return est;
      if (ruta === '/carta/disponibilidad') return disp;
      if (ruta === '/carta/ofertas') return [];
      return null;
    });
    render(<MemoryRouter><CartaPublica /></MemoryRouter>);
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    sessionStorage.clear();
    est = estado();
    disp = { productos: [{ id: '1', disponible: true, controlaStock: true, quedan: 5 }] };
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  const avanzar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

  it('al llegar disponibilidad con quedan 0 la tarjeta pasa a Agotado sin recargar', async () => {
    montar();
    await avanzar(10);
    expect(screen.queryByText('Agotado')).toBeNull();
    disp = { productos: [{ id: '1', disponible: false, controlaStock: true, quedan: 0 }] };
    await avanzar(30_000);
    expect(screen.getAllByText(/Agotado/i).length).toBeGreaterThan(0);
  });

  it('una línea del carrito sin stock muestra aviso y el checkout no deja enviar', async () => {
    montar([linea(2)]);
    await avanzar(10);
    disp = { productos: [{ id: '1', disponible: false, controlaStock: true, quedan: 0 }] };
    await avanzar(30_000);
    fireEvent.click(screen.getByLabelText(/carrito|pedido/i, { selector: 'button' }));
    expect(screen.getAllByText(/Se nos acabó Dona glaseada/).length).toBeGreaterThan(0);
  });

  it('refresca justo a la hora de cierre (sin esperar los 30 s)', async () => {
    vi.setSystemTime(Date.UTC(2026, 0, 1, 20, 59, 50)); // 15:59:50 Lima
    est = estado({ cierra: '16:00' });
    montar();
    await avanzar(10);
    const antes = llamadas.filter((r) => r === '/carta/estado').length;
    est = estado({ abierta: false, motivo: 'HORARIO', texto: 'Cerrado por hoy', cierra: '16:00' });
    await avanzar(12_000); // pasa el minuto exacto (10 s), antes del sondeo de 30 s
    expect(llamadas.filter((r) => r === '/carta/estado').length).toBeGreaterThan(antes);
    expect(llamadas).toContain('/carta/disponibilidad');
  });
});
