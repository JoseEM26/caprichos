import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaEquipo } from '../TarjetaEquipo';
import { impresionApi } from '../../impresionApi';
import { alternarCategoriaTipo, categoriasSinPcPorTipo, ponerTipo, resumenTipo, soloFriasTipo, todasTipo } from '../logicaVasos';

const AREAS = [
  { id: '1', nombre: 'Bebidas' },
  { id: '3', nombre: 'Postres' },
];
const CATS = [
  { id: '11', nombre: 'Frappes', areaId: '1' },
  { id: '12', nombre: 'Iced', areaId: '1' },
  { id: '13', nombre: 'Calientes', areaId: '1' },
  { id: '31', nombre: 'Donas', areaId: '3' },
];
const LOCAL = { bebida: { anchoMm: 76, altoMm: 38 }, general: { anchoMm: 100, altoMm: 100 } };
const CFG: any = { ticketera: false, etiquetera: true, ticketPago: false, comandaSalon: false, comandaAreas: [], stickerGeneral: false, stickerAreas: [], stickerBebidaAreas: ['1'], tamanoGeneral: null, tamanoBebida: null, pausado: false, configurado: true };

const equipo = (config: any = CFG): any => ({
  deviceKeyId: '10', nombre: 'BEBIDAS', areaId: null, areaNombre: null, conectado: true, impresoras: {}, pendientes: 0,
  candidatas: [], seleccion: {}, config, ultimoLatido: new Date().toISOString(), ipLocal: [], ipPublica: '', version: '0.1.0', hostname: 'PC', sistema: 'win32',
});

function montar(config: any = CFG, configsOtras: any[] = []) {
  return render(<TarjetaEquipo equipo={equipo(config)} areas={AREAS} categorias={CATS} configsOtras={configsOtras} tamanosLocal={LOCAL} puedeEditar alRecargar={vi.fn()} alAviso={vi.fn()} />);
}

const VIS = CATS.filter((c) => c.areaId === '1');
const abrir = () => fireEvent.click(screen.getByTestId('vasos-misma-10'));

describe('Sticker de bebida por tipo de pedido (UI)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('por defecto: misma regla para todos y la matriz plegada', () => {
    montar();
    expect(screen.getByTestId('vasos-misma-10')).toBeChecked();
    expect(screen.queryByTestId('vasos-matriz-10')).toBeNull();
  });

  it('el conmutador abre la matriz inicializada con la regla general', () => {
    montar({ ...CFG, stickerBebidaCategorias: ['11', '12'] });
    abrir();
    expect(screen.getByTestId('vaso-mod-10-COMER_LOCAL-11')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('vaso-mod-10-DELIVERY-13')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('vasos-matriz-10')).toHaveTextContent('Ej.: no imprimir calientes en el local, pero sí en delivery');
  });

  it('caso del dueño: sin calientes en el local pero sí en delivery; contador por tipo', () => {
    montar();
    abrir();
    fireEvent.click(screen.getByTestId('vasos-mod-frias-10-COMER_LOCAL'));
    expect(screen.getByTestId('vaso-mod-10-COMER_LOCAL-13')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('vaso-mod-10-DELIVERY-13')).toHaveAttribute('aria-pressed', 'true');
    const r = screen.getByTestId('vasos-resumen-tipos-10');
    expect(r).toHaveTextContent('En el local: Frappes, Iced · No: Calientes');
    expect(r).toHaveTextContent('Delivery: todas');
    fireEvent.click(screen.getByTestId('vasos-mod-todas-10-COMER_LOCAL'));
    expect(screen.getByTestId('vaso-mod-10-COMER_LOCAL-13')).toHaveAttribute('aria-pressed', 'true');
  });

  it('advierte si un tipo queda sin ninguna categoría', () => {
    montar();
    abrir();
    for (const id of ['11', '12', '13']) fireEvent.click(screen.getByTestId(`vaso-mod-10-DELIVERY-${id}`));
    expect(screen.getByTestId('vasos-aviso-10-DELIVERY')).toHaveTextContent(/sin ninguna categoría/);
    expect(screen.queryByTestId('vasos-aviso-10-COMER_LOCAL')).toBeNull();
  });

  it('Guardar manda el campo nuevo', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG });
    montar();
    abrir();
    fireEvent.click(screen.getByTestId('vasos-mod-frias-10-COMER_LOCAL'));
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect((guardar.mock.calls[0] as any)[1]).toMatchObject({ stickerBebidaCategorias: null, stickerBebidaCategoriasPorModalidad: { COMER_LOCAL: ['11', '12'] } });
  });

  it('volver a «la misma regla» limpia las reglas por tipo (null)', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG });
    montar({ ...CFG, configurado: false, stickerBebidaCategoriasPorModalidad: { COMER_LOCAL: ['11'] } });
    abrir();
    expect(screen.queryByTestId('vasos-matriz-10')).toBeNull();
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect((guardar.mock.calls[0] as any)[1].stickerBebidaCategoriasPorModalidad).toBeNull();
  });

  it('retrocompatible: una config de v0.4.82 sin el campo guarda null y no abre la matriz', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG });
    montar({ ...CFG, configurado: false, stickerBebidaCategorias: ['11'] });
    expect(screen.queryByTestId('vasos-matriz-10')).toBeNull();
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect((guardar.mock.calls[0] as any)[1]).toMatchObject({ stickerBebidaCategorias: ['11'], stickerBebidaCategoriasPorModalidad: null });
  });

  it('una config con reglas por tipo abre la matriz sola', () => {
    montar({ ...CFG, stickerBebidaCategoriasPorModalidad: { COMER_LOCAL: ['11'] } });
    expect(screen.getByTestId('vasos-misma-10')).not.toBeChecked();
    expect(screen.getByTestId('vaso-mod-10-COMER_LOCAL-12')).toHaveAttribute('aria-pressed', 'false');
  });

  it('el aviso de «sin PC» nombra el tipo de pedido que falta', () => {
    montar({ ...CFG, stickerBebidaCategoriasPorModalidad: { DELIVERY: ['11', '12'] } });
    expect(screen.getByTestId('vasos-sinpc-10')).toHaveTextContent('Calientes: ninguna PC imprime su sticker en delivery');
  });
});

describe('logicaVasos por tipo', () => {
  it('con la general en todas, Marcar todo guarda null (quita la clave)', () => {
    const c: any = { stickerBebidaCategorias: null, stickerBebidaCategoriasPorModalidad: { DELIVERY: ['11'] } };
    expect(todasTipo(c, VIS, 'DELIVERY')).toBeNull();
  });
  it('con una general restrictiva, Marcar todo guarda la lista completa', () => {
    const c: any = { stickerBebidaCategorias: ['11'] };
    expect(todasTipo(c, VIS, 'DELIVERY')).toEqual({ DELIVERY: ['11', '12', '13'] });
    expect(ponerTipo(c, VIS, 'DELIVERY', ['11'])).toBeNull();
  });
  it('alternar y solo frías por tipo, resumen y vacío', () => {
    const c: any = { stickerBebidaCategorias: null };
    expect(soloFriasTipo(c, VIS, 'COMER_LOCAL')).toEqual({ COMER_LOCAL: ['11', '12'] });
    expect(alternarCategoriaTipo(c, VIS, 'LLEVAR', '13')).toEqual({ LLEVAR: ['11', '12'] });
    const v: any = { stickerBebidaCategorias: null, stickerBebidaCategoriasPorModalidad: { DELIVERY: [] } };
    expect(resumenTipo(v, VIS, 'DELIVERY')).toBe('Delivery: ninguna');
  });
  it('categoriasSinPcPorTipo ignora PC en pausa', () => {
    expect(categoriasSinPcPorTipo(CATS, [{ ...CFG, pausado: true }])).toEqual([]);
  });
});
