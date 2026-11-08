import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductosView } from '../ProductosView';
import { AgotarProductoModal } from '../AgotarProductoModal';
import * as sesionModulo from '../../../comun/sesion';
import * as apiModulo from '../../../comun/api';
import { catalogoApi } from '../catalogoApi';
import { cierreHoy, cronometroAgotado, resolverRegreso, aperturaManana, esIndefinido, type HorarioDia } from '../../../comun/agotadoTiempo';

// 15:40 en Lima (domingo)
const AHORA = Date.parse('2026-11-08T20:40:00Z');
const HORARIO: HorarioDia[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dia_semana: d, abre: '14:00', cierra: '22:00', cerrado: false }));

describe('agotadoTiempo (puro)', () => {
  it('atajos, cierre y apertura en hora de Lima', () => {
    expect(resolverRegreso({ tipo: 'min', min: 60 }, AHORA)).toEqual({ hasta: AHORA + 3_600_000 });
    expect(cierreHoy(HORARIO, AHORA)).toBe(Date.parse('2026-11-09T03:00:00Z')); // 22:00 Lima
    expect(aperturaManana(HORARIO, AHORA)).toBe(Date.parse('2026-11-09T19:00:00Z')); // 14:00 Lima de mañana
    expect(cierreHoy(HORARIO, Date.parse('2026-11-09T03:00:00Z'))).toBeNull(); // justo al cierre: ya pasó
    expect(cierreHoy(undefined, AHORA)).toBeNull();
  });

  it('personalizado: mínimo 1 minuto y máximo 7 días; hora exacta pasada se rechaza; cruza la medianoche con «mañana»', () => {
    expect(resolverRegreso({ tipo: 'dur', horas: 0, min: 0 }, AHORA)).toHaveProperty('error');
    expect(resolverRegreso({ tipo: 'dur', horas: 0, min: 1 }, AHORA)).toEqual({ hasta: AHORA + 60_000 });
    expect(resolverRegreso({ tipo: 'dur', horas: 200, min: 0 }, AHORA)).toHaveProperty('error');
    expect(resolverRegreso({ tipo: 'hora', hhmm: '15:40', dia: 'hoy' }, AHORA)).toHaveProperty('error'); // = ahora: ya pasó
    expect(resolverRegreso({ tipo: 'hora', hhmm: '15:00', dia: 'hoy' }, AHORA)).toHaveProperty('error');
    expect(resolverRegreso({ tipo: 'hora', hhmm: '23:30', dia: 'hoy' }, AHORA)).toEqual({ hasta: Date.parse('2026-11-09T04:30:00Z') });
    expect(resolverRegreso({ tipo: 'hora', hhmm: '01:00', dia: 'manana' }, AHORA)).toEqual({ hasta: Date.parse('2026-11-09T06:00:00Z') });
  });

  it('cronómetro: indefinido y vencido no tienen; temporal da minutos y hora', () => {
    expect(esIndefinido('9999-12-31T23:59:59.000Z')).toBe(true);
    expect(cronometroAgotado('9999-12-31T23:59:59.000Z', AHORA)).toBeNull();
    expect(cronometroAgotado(new Date(AHORA - 1).toISOString(), AHORA)).toBeNull();
    expect(cronometroAgotado(new Date(AHORA + 38 * 60_000).toISOString(), AHORA)).toEqual({ minutos: 38, hora: '16:18' });
  });
});

describe('AgotarProductoModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  const abrir = (extra: Partial<React.ComponentProps<typeof AgotarProductoModal>> = {}) => {
    const alConfirmar = vi.fn().mockResolvedValue(undefined);
    const alCancelar = vi.fn();
    render(<AgotarProductoModal nombre="Dona X" horario={HORARIO} alConfirmar={alConfirmar} alCancelar={alCancelar} {...extra} />);
    return { alConfirmar, alCancelar };
  };

  it('por defecto es indefinido y confirma Sí con hasta null', async () => {
    const { alConfirmar } = abrir();
    expect(screen.getByRole('dialog', { name: /Agotar «Dona X»/ })).toBeInTheDocument();
    expect(screen.getByText(/seguirá agotado hasta que lo reactives tú/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, agotar' }));
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledWith(null, ''));
  });

  it('atajo 1 h: resumen con la hora de regreso y envía la fecha exacta + motivo', async () => {
    const { alConfirmar } = abrir();
    fireEvent.click(screen.getByRole('button', { name: '1 h' }));
    expect(screen.getByText(/se agotará por 1 h 00 y volverá a estar disponible a las 16:40/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'se acabó la masa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, agotar' }));
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledWith(new Date(AHORA + 3_600_000).toISOString(), 'se acabó la masa'));
  });

  it('hasta el cierre y hasta mañana usan el horario; sin horario quedan deshabilitados', () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Hasta el cierre de hoy' }));
    expect(screen.getByText(/volverá a estar disponible a las 22:00/)).toBeInTheDocument();
  });

  it('sin horario: cierre y apertura deshabilitados', () => {
    abrir({ horario: null });
    expect(screen.getByRole('button', { name: 'Hasta el cierre de hoy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hasta mañana a la apertura' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '30 min' })).toBeEnabled();
  });

  it('personalizado: 0 min bloquea el Sí con aviso; 1 h 30 lo habilita', () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '0' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Pon al menos 1 minuto');
    expect(screen.getByRole('button', { name: 'Sí, agotar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '30' } });
    expect(screen.getByRole('button', { name: 'Sí, agotar' })).toBeEnabled();
    expect(screen.getByText(/a las 17:10/)).toBeInTheDocument();
  });

  it('hora exacta pasada de hoy: error; con «Mañana» vale', () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'A una hora exacta' }));
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '15:00' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Esa hora ya pasó');
    fireEvent.change(screen.getByLabelText('Día'), { target: { value: 'manana' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sí, agotar' })).toBeEnabled();
  });

  it('No cancela sin guardar', () => {
    const { alConfirmar, alCancelar } = abrir();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(alCancelar).toHaveBeenCalled();
    expect(alConfirmar).not.toHaveBeenCalled();
  });
});

describe('Productos: insignia, cronómetro, Reactivar ya y Cambiar tiempo', () => {
  let prods: any[];
  const base = (o: any) => ({
    id: 'p1', categoriaId: 'c1', categoria: { id: 'c1', nombre: 'Donas' }, nombre: 'Dona X', descripcion: '', precio: 5,
    orden: 1, oculto: false, disponible: true, agotadoHasta: null, noSumaBeneficios: false, controlaStock: false, fotoUrl: null,
    tamanos: [], grupos: [], sabores: [], ...o,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: () => true } as any);
    vi.spyOn(apiModulo, 'clienteFetch').mockResolvedValue({ horario: HORARIO } as any);
    vi.spyOn(catalogoApi, 'listarProductos').mockImplementation(async () => JSON.parse(JSON.stringify(prods)));
    vi.spyOn(catalogoApi, 'listarCategorias').mockResolvedValue([{ id: 'c1', nombre: 'Donas', areaId: 'a', orden: 1, oculta: false, llevaOpciones: false }] as any);
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([]);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  const montar = async () => {
    render(<MemoryRouter><ProductosView /></MemoryRouter>);
    await screen.findByText('Dona X');
  };

  it('agotado temporal: insignia AGOTADO + «Vuelve en 38 min · 16:18» y el motivo', async () => {
    prods = [base({ disponible: false, agotadoOrigen: 'MANUAL', agotadoHasta: new Date(AHORA + 38 * 60_000).toISOString(), agotadoMotivo: 'se acabó la masa' })];
    await montar();
    expect(screen.getByText('AGOTADO')).toBeInTheDocument();
    expect(screen.getByTestId('cronometro-agotado')).toHaveTextContent('Vuelve en 38 min · 16:18');
    expect(screen.getByText('se acabó la masa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar disponibilidad de Dona X' })).toHaveTextContent('Reactivar ya');
    expect(screen.getByRole('button', { name: /Cambiar tiempo de Dona X/ })).toBeInTheDocument();
  });

  it('agotado indefinido: sin cronómetro, dice «Hasta que lo reactives»', async () => {
    prods = [base({ disponible: false, agotadoOrigen: 'MANUAL', agotadoHasta: '9999-12-31T23:59:59.000Z' })];
    await montar();
    expect(screen.queryByTestId('cronometro-agotado')).toBeNull();
    expect(screen.getByText('Hasta que lo reactives')).toBeInTheDocument();
  });

  it('Marcar agotado abre la ventana y guarda con la hora de regreso y el motivo', async () => {
    prods = [base({})];
    const agotar = vi.spyOn(catalogoApi, 'agotarProducto').mockResolvedValue({ ok: true, disponible: false, agotadoHasta: null });
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar disponibilidad de Dona X' }));
    fireEvent.click(await screen.findByRole('button', { name: '30 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, agotar' }));
    await waitFor(() => expect(agotar).toHaveBeenCalledWith('p1', { alcance: 'INDEFINIDO', agotadoHasta: new Date(AHORA + 30 * 60_000).toISOString() }));
  });

  it('Reactivar ya pide Sí/No y llama a disponibilizar', async () => {
    prods = [base({ disponible: false, agotadoOrigen: 'MANUAL', agotadoHasta: new Date(AHORA + 600_000).toISOString() })];
    const disp = vi.spyOn(catalogoApi, 'disponibilizarProducto').mockResolvedValue({ ok: true, disponible: true, agotadoHasta: null });
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar disponibilidad de Dona X' }));
    fireEvent.click(await screen.findByRole('button', { name: /Sí/ }));
    await waitFor(() => expect(disp).toHaveBeenCalledWith('p1'));
  });

  it('Cambiar tiempo abre la ventana con el motivo previo', async () => {
    prods = [base({ disponible: false, agotadoOrigen: 'MANUAL', agotadoHasta: new Date(AHORA + 600_000).toISOString(), agotadoMotivo: 'se acabó la masa' })];
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /Cambiar tiempo de Dona X/ }));
    expect(await screen.findByRole('dialog', { name: /Cambiar el tiempo de «Dona X»/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo/)).toHaveValue('se acabó la masa');
  });
});
