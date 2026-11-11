import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Escritorio } from '../admin/escritorio';
import * as sesionModulo from '../comun/sesion';
import { api } from '../comun/api';

function sesionAdmin() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  });
}

const resumen = {
  kpisS: [
    { n: 'VENTAS', v: 's/ 100.00', dTxt: '+10.0% frente al período anterior', dCol: 'var(--cp-ok)' },
    { n: 'PEDIDOS', v: '5', dTxt: 'Sin datos del período anterior', dCol: 'var(--cp-soft)' },
    { n: 'TICKET PROMEDIO', v: 's/ 20.00', dTxt: 'Sin datos del período anterior', dCol: 'var(--cp-soft)' },
    { n: 'TIEMPO DE ENTREGA', v: '12 min', dTxt: 'Meta 13 min · Cumple la meta', dCol: 'var(--cp-ok)' },
  ],
  rechazados: 1,
  porCobrar: 's/ 40.00',
  peak: 'Pico: s/ 60.00 el 15/10',
  legend: [
    { n: 'Salón', c: '#E67929', pedidos: 3, pct: 60, monto: 's/ 60.00', valor: 60 },
    { n: 'Delivery', c: '#0B2C3E', pedidos: 2, pct: 40, monto: 's/ 40.00', valor: 40 },
  ],
  modalidades: [{ n: 'En el local', c: '#E67929', pedidos: 3, pct: 60, monto: 's/ 60.00', valor: 60 }],
  pagos: [{ n: 'Yape', c: '#E67929', pedidos: 2, pct: 100, monto: 's/ 100.00', valor: 100 }],
  porHora: [
    { hora: 14, pedidos: 2, monto: 's/ 40.00', valor: 40 },
    { hora: 15, pedidos: 3, monto: 's/ 60.00', valor: 60 },
  ],
  porDiaSemana: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((dia, i) => ({ dia, pedidos: i === 0 ? 5 : 0, monto: i === 0 ? 's/ 100.00' : 's/ 0.00', valor: i === 0 ? 100 : 0 })),
  porDia: [
    { fecha: '2026-10-14', pedidos: 2, entregaMin: 14, monto: 's/ 40.00', valor: 40 },
    { fecha: '2026-10-15', pedidos: 3, entregaMin: 10, monto: 's/ 60.00', valor: 60 },
  ],
  porEstado: [
    { estado: 'ENTREGADO', n: 4 },
    { estado: 'COLA', n: 1 },
  ],
  tops2: [{ n: 'Frappe de prueba', unidades: 7, monto: 's/ 70.00', valor: 70 }],
  cats2: [{ n: 'Frappes', c: '#E67929', unidades: 7, monto: 's/ 70.00', valor: 70 }],
  pending: [{ n: 'Por confirmar', v: 2, view: '/admin/caja' }],
  metaEntregaMin: 13,
};

function Ubicacion() {
  const l = useLocation();
  return <output data-testid="url">{l.search}</output>;
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Escritorio />
      <Ubicacion />
    </MemoryRouter>,
  );

const urlsPedidas = (espia: { mock: { calls: unknown[][] } }) => espia.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('informes/resumen'));

describe('Escritorio del ADMIN (/admin)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sesionAdmin();
  });

  it('con datos: saludo, KPIs, gráficos con título y tabla alternativa', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => (url.includes('informes/resumen') ? resumen : { conteos: {}, notificaciones: [] }));
    montar();
    expect(screen.getByText('Hola, Admin Test. Este es tu escritorio de Administrador.')).toBeInTheDocument();
    expect((await screen.findAllByText('s/ 100.00')).length).toBeGreaterThan(0);
    for (const t of ['Ventas por día', 'Pedidos por hora del día', 'Ventas por día de la semana', 'Ventas por canal', 'Ventas por modalidad', 'Ventas por medio de pago', 'Ventas por categoría', 'Productos más pedidos', 'Tiempo de entrega por día', 'Pedidos por estado']) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    }
    expect(screen.getByText('POR COBRAR')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Pedidos por hora: 14 horas, 2; 15 horas, 3/ })).toBeInTheDocument();
    expect(screen.getByText('Pico: s/ 60.00 el 15/10')).toBeInTheDocument();
    // la mezcla se lee en texto, no solo en color
    expect(screen.getAllByText(/60 % · 3 pedidos · s\/ 60.00/).length).toBeGreaterThan(0);
    // tabla alternativa de un gráfico
    const tarjeta = screen.getByRole('heading', { name: 'Ventas por día' }).closest('section')!;
    expect(within(tarjeta).getByText('Ver como tabla')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Por confirmar: 2/ })).toBeInTheDocument();
  });

  it('los filtros van a la dirección y vuelven a pedir con el rango y el canal elegidos', async () => {
    const espia = vi.spyOn(api, 'get').mockImplementation(async (url: string) => (url.includes('informes/resumen') ? resumen : { conteos: {}, notificaciones: [] }));
    montar();
    await screen.findAllByText('s/ 100.00');
    fireEvent.click(screen.getByRole('button', { name: 'Salón' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    await waitFor(() => expect(urlsPedidas(espia).some((u) => /desde=(\d{4}-\d{2}-\d{2})&hasta=\1&canal=salon/.test(u))).toBe(true));
    expect(screen.getByTestId('url').textContent).toContain('canal=salon');
    expect(screen.getByTestId('url').textContent).toContain('periodo=hoy');
    expect(screen.getByRole('button', { name: 'Salón' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('con fechas al revés avisa y no pide al servidor', async () => {
    const espia = vi.spyOn(api, 'get').mockResolvedValue({ conteos: {}, notificaciones: [] });
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir fechas' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-10' } });
    expect(await screen.findByText(/no puede ser después de la final/)).toBeInTheDocument();
    expect(urlsPedidas(espia).some((u) => u.includes('desde=2026-10-20&hasta=2026-10-10'))).toBe(false);
  });

  it('si el servidor falla, cada gráfico muestra un error claro (no ceros inventados)', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.includes('informes/resumen')) throw new Error('caído');
      return { conteos: {}, notificaciones: [] };
    });
    montar();
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(3);
    expect(screen.queryByText('s/ 0.00')).not.toBeInTheDocument();
  });

  it('sin pedidos en el período: estado vacío en los gráficos', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) =>
      url.includes('informes/resumen')
        ? { ...resumen, porDia: [], porHora: [], porDiaSemana: resumen.porDiaSemana.map((d) => ({ ...d, pedidos: 0, valor: 0 })), legend: [], modalidades: [], pagos: [], tops2: [], cats2: [], porEstado: [] }
        : { conteos: {}, notificaciones: [] },
    );
    montar();
    expect((await screen.findAllByText(/Sin datos en este período|Todavía no hay cobros|Sin pedidos entregados/)).length).toBeGreaterThanOrEqual(8);
  });
});
