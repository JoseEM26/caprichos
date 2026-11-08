import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaEquipo } from '../TarjetaEquipo';
import { impresionApi } from '../../impresionApi';
import { categoriasSinPc, soloFrias, alternarCategoria, resumenVasos } from '../logicaVasos';

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

describe('Sticker de bebida: ¿De qué bebidas?', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('por defecto todas marcadas y solo muestra las categorías de las áreas marcadas', () => {
    montar();
    expect(screen.getByTestId('vaso-cat-10-11')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('vaso-cat-10-13')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('vaso-cat-10-31')).toBeNull();
    expect(screen.getByTestId('vasos-resumen-10')).toHaveTextContent('Se imprimirán stickers de: Frappes, Iced, Calientes');
    expect(screen.queryByTestId('vasos-aviso-10')).toBeNull();
  });

  it('«Solo frías» desmarca Calientes y el contador lo dice; «Todas» vuelve', () => {
    montar();
    fireEvent.click(screen.getByTestId('vasos-frias-10'));
    expect(screen.getByTestId('vaso-cat-10-13')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('vasos-resumen-10')).toHaveTextContent('Se imprimirán stickers de: Frappes, Iced · No: Calientes');
    fireEvent.click(screen.getByTestId('vasos-todas-10'));
    expect(screen.getByTestId('vaso-cat-10-13')).toHaveAttribute('aria-pressed', 'true');
  });

  it('desmarcar todas muestra la advertencia', () => {
    montar();
    for (const id of ['11', '12', '13']) fireEvent.click(screen.getByTestId(`vaso-cat-10-${id}`));
    expect(screen.getByTestId('vasos-aviso-10')).toHaveTextContent(/no imprimirá ningún sticker de vaso/);
  });

  it('avisa (sin bloquear) que Calientes no sale en ninguna PC', () => {
    montar({ ...CFG, stickerBebidaCategorias: ['11', '12'] });
    expect(screen.getByTestId('vasos-sinpc-10')).toHaveTextContent('Calientes: ninguna PC imprime su sticker');
  });

  it('si otra PC tiene Calientes marcada no hay aviso', () => {
    montar({ ...CFG, stickerBebidaCategorias: ['11', '12'] }, [{ ...CFG, stickerBebidaCategorias: ['13'] }]);
    expect(screen.queryByTestId('vasos-sinpc-10')).toBeNull();
  });

  it('Guardar manda stickerBebidaCategorias', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG });
    montar();
    fireEvent.click(screen.getByTestId('vasos-frias-10'));
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect((guardar.mock.calls[0] as any)[1]).toMatchObject({ stickerBebidaCategorias: ['11', '12'] });
  });

  it('retrocompatible: sin tocar nada guarda null (todas) y un servidor viejo sin el campo se ve como todas', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG });
    montar({ ...CFG, configurado: false });
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect((guardar.mock.calls[0] as any)[1].stickerBebidaCategorias).toBeNull();
  });

  it('sin categorías (servidor viejo) el bloque no aparece', () => {
    render(<TarjetaEquipo equipo={equipo()} areas={AREAS} tamanosLocal={LOCAL} puedeEditar alRecargar={vi.fn()} alAviso={vi.fn()} />);
    expect(screen.queryByTestId('vasos-10')).toBeNull();
  });
});

describe('logicaVasos', () => {
  const vis = CATS.filter((c) => c.areaId === '1');
  it('volver a marcar todas deja null', () => {
    const sin = { stickerBebidaCategorias: ['11', '12'] };
    expect(alternarCategoria(sin, vis, '13')).toBeNull();
    expect(soloFrias(vis)).toEqual(['11', '12']);
    expect(resumenVasos({ stickerBebidaCategorias: null }, vis).no).toEqual([]);
  });
  it('categoriasSinPc ignora PC en pausa', () => {
    expect(categoriasSinPc(CATS, [{ ...CFG, stickerBebidaCategorias: ['11'], pausado: true }])).toEqual([]);
    expect(categoriasSinPc(CATS, [{ ...CFG, stickerBebidaCategorias: ['11'] }])).toEqual(['Iced', 'Calientes']);
  });
});
