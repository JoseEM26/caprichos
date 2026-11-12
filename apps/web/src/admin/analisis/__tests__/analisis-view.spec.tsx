import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnalisisView } from '../AnalisisView';
import { PESTANAS_ANALISIS } from '../registro';
import { MODULOS } from '../../modulos';
import { moduloVisible } from '../../../comun/permisosPuro';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

function sesionCon(rol: string, permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '7', nombres: 'Prueba', rol, roles: [rol] },
    permisos,
    tiene: (p: string) => rol === 'ADMIN' || permisos.includes(p),
  } as any);
}

const vacio = {
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-11', hasta: '2026-11-11', dias: 1 },
  truncado: false,
  limite: 5000,
  pedidos: { entran: 0, considerados: 0, enCurso: 0 },
  anulados: { n: 0, minutosPromedio: null, minutosMediana: null },
  etapaMasLenta: null,
  etapas: [],
  areas: [],
};

const ver = (url = '/admin/analisis') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AnalisisView />
    </MemoryRouter>,
  );

describe('AnalisisView', () => {
  let get: { mock: { calls: unknown[][] } };
  beforeEach(() => {
    vi.restoreAllMocks();
    get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => (url.includes('/atascados') ? { generadoEn: '', total: 0, items: [] } : vacio));
  });

  it('registro: la primera pestaña es Tiempos y cada una declara sus filtros extra', () => {
    expect(PESTANAS_ANALISIS[0]).toMatchObject({ id: 'tiempos', etiqueta: 'Tiempos' });
    expect(PESTANAS_ANALISIS[0].filtros).toEqual(['modalidad', 'canal', 'turno']);
  });

  it('el módulo del menú exige analisis/ver: supervisor sí, cajero y mozo no', () => {
    const modulo = MODULOS.find((m) => m.clave === 'analisis')!;
    expect(modulo).toMatchObject({ ruta: '/admin/analisis', grupo: 'Análisis', permisoMinimo: 'analisis/ver' });
    expect(moduloVisible(modulo, (p) => ['analisis/ver'].includes(p))).toBe(true);
    expect(moduloVisible(modulo, (p) => ['caja/ver', 'pedidos/crear'].includes(p))).toBe(false);
  });

  it('sin el permiso no muestra nada del análisis ni consulta el servidor', () => {
    sesionCon('CAJERO', ['caja/ver']);
    ver();
    expect(screen.getByText('Sin acceso')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('con permiso: filtros de fechas y extras, y consulta de hoy por defecto', async () => {
    sesionCon('SUPERVISOR', ['analisis/ver']);
    ver();
    for (const t of ['Hoy', 'Ayer', '7 días', '30 días', 'Elegir fechas']) expect(screen.getByRole('button', { name: t })).toBeInTheDocument();
    expect(screen.getByLabelText('Modalidad')).toBeInTheDocument();
    expect(screen.getByLabelText('Canal')).toBeInTheDocument();
    expect(screen.getByLabelText('Turno')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tiempos' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(get.mock.calls.some(([u]: unknown[]) => String(u).startsWith('/admin/analisis/tiempos?desde='))).toBe(true));
  });

  it('cambiar el período y la modalidad vuelve a consultar con esos filtros', async () => {
    sesionCon('ADMIN', []);
    ver();
    await screen.findByText('Recorrido del pedido');
    fireEvent.click(screen.getByRole('button', { name: '7 días' }));
    fireEvent.change(screen.getByLabelText('Modalidad'), { target: { value: 'DELIVERY' } });
    await waitFor(() => {
      const urls = get.mock.calls.map(([u]: unknown[]) => String(u));
      expect(urls.some((u: string) => /^\/admin\/analisis\/tiempos\?desde=\d{4}-\d{2}-\d{2}&hasta=\d{4}-\d{2}-\d{2}&modalidad=DELIVERY$/.test(u))).toBe(true);
    });
    expect(screen.getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('un rango inválido muestra el error y no consulta', async () => {
    sesionCon('ADMIN', []);
    ver('/admin/analisis?periodo=rango&desde=2026-11-11&hasta=2026-11-01');
    expect(await screen.findByText(/no puede ser después/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('un rango de más de 92 días se rechaza en pantalla', () => {
    sesionCon('ADMIN', []);
    ver('/admin/analisis?periodo=rango&desde=2025-01-01&hasta=2025-12-31');
    expect(screen.getByText(/como máximo 92 días/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
