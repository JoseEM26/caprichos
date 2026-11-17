import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.fn();
vi.mock('../correccionesApi', async (orig) => ({
  ...(await orig<any>()),
  resolverMarcas: (...a: any[]) => resolver(...a),
}));
vi.mock('../miCalendarioApi', () => ({ miCalendario: vi.fn(), miPlanilla: vi.fn() }));

import { TarjetasMarcas } from '../TarjetasMarcas';
import { entreElegidas, necesitaCriterio, seleccionInicial, vistaPrevia } from '../resolverMarcas';

const fila: any = {
  fecha: '2026-11-06', partyId: '7', nombre: 'Luis Pérez', rol: 'MOZO', turno: { entrada: '10:00', salida: '18:00' },
  marcas: [], entrada: '10:51', salida: '17:33', almuerzoSalida: null, almuerzoVuelta: null, almuerzoMin: null,
  trabajadaMin: 402, tardanzaMin: 51, salioAntesMin: 27, extraMin: 0, estado: 'A_REVISAR', solicitudes: [], inconsistencias: [],
};

// Turno 10:00-18:00 (en minutos). Dos entradas y dos salidas: el caso del dueño.
const m = (id: number, hora: string, minutos: number, rol: string, extra: Record<string, unknown> = {}): any => ({
  id, hora, minutos, momento: null, origen: 'CELULAR', estado: 'VALIDA', rol, duplicada: false, tieneSelfie: false, motivo: null, alertas: null, ...extra,
});
const cuatro = (): any => ({
  jornada: '2026-11-06', estado: 'A_REVISAR', turno: { entrada: 600, salida: 1080, almuerzoIni: null, almuerzoFin: null }, alertas: [],
  trabajadaMin: 0, tardanzaMin: 0, breakMin: 0, tramos: [], solicitudes: [], cantidadesRaras: true, inconsistencia: null,
  marcas: [
    m(50, '10:51', 651, 'ENTRADA'),
    m(51, '15:12', 912, 'SALIDA'),
    m(52, '16:35', 995, 'ENTRADA'),
    m(53, '17:33', 1053, 'SALIDA'),
  ],
});
const limpio = (): any => ({
  ...cuatro(), marcas: [m(60, '10:00', 600, 'ENTRADA'), m(61, '14:00', 840, 'SALIDA_ALMUERZO'), m(62, '15:00', 900, 'ENTRADA_ALMUERZO'), m(63, '18:00', 1080, 'SALIDA')],
});

const montar = (dia: any, recargar = vi.fn(async () => undefined)) => render(
  <TarjetasMarcas fila={fila} dia={dia} cargando={false} error={false} reintentar={() => undefined} onError={() => undefined} onOk={() => undefined} recargar={recargar} />,
);
const radio = (nombre: string) => screen.getByRole('radio', { name: nombre }) as HTMLInputElement;

describe('Criterio del administrador: funciones puras', () => {
  it('pide criterio con varias entradas, varias salidas o una doble marca; no en un día limpio', () => {
    expect(necesitaCriterio(cuatro())).toBe(true);
    expect(necesitaCriterio(limpio())).toBe(false);
    const doble = { ...limpio(), marcas: [m(70, '09:39', 579, 'ENTRADA'), m(71, '14:51', 891, 'SALIDA'), m(72, '14:52', 892, 'SALIDA', { duplicada: true })] };
    expect(necesitaCriterio(doble)).toBe(true);
    expect(necesitaCriterio(null)).toBe(false);
  });

  it('preselecciona la primera entrada y la última salida, sin tomar una doble marca', () => {
    expect(seleccionInicial(cuatro().marcas)).toEqual({ entradaId: 50, salidaId: 53 });
    const doble = [m(70, '09:39', 579, 'ENTRADA'), m(71, '14:51', 891, 'SALIDA'), m(72, '14:52', 892, 'SALIDA', { duplicada: true })];
    expect(seleccionInicial(doble)).toEqual({ entradaId: 70, salidaId: 71 });
  });

  it('las marcas entre la entrada y la salida elegidas son las candidatas a break', () => {
    expect(entreElegidas(cuatro().marcas, 50, 53).map((x) => x.id)).toEqual([51, 52]);
    expect(entreElegidas(cuatro().marcas, 52, 53)).toEqual([]);
  });

  it('la vista previa sale con horas, tardanza y extra, y no inventa un resultado si la salida no es posterior', () => {
    const d = cuatro();
    expect(vistaPrevia(d, 50, 53)).toBe('Así queda: entrada 10:51 → salida 17:33 · 6.7 h trabajadas · tardanza 51 min · extra 0 min · salida anticipada 27 min');
    expect(vistaPrevia(d, 53, 50)).toBeNull();
    expect(vistaPrevia({ ...d, turno: null }, 50, 53)).toBe('Así queda: entrada 10:51 → salida 17:33 · 6.7 h trabajadas · sin horario (descanso trabajado)');
  });
});

describe('Panel «Resolver con tu criterio» en el detalle del día', () => {
  beforeEach(() => { resolver.mockReset().mockResolvedValue({ ok: true, entrada: 1, salida: 2 }); });

  it('aparece en un día con varias marcas de entrada o salida, y no en un día limpio', () => {
    const { unmount } = montar(cuatro());
    expect(screen.getByRole('group', { name: 'Resolver con tu criterio' })).toBeInTheDocument();
    unmount();
    montar(limpio());
    expect(screen.queryByRole('group', { name: 'Resolver con tu criterio' })).toBeNull();
  });

  it('viene preseleccionado: 1.ª entrada (10:51) y última salida (17:33), con la vista previa', () => {
    montar(cuatro());
    expect(radio('Cuenta como ENTRADA: 10:51')).toBeChecked();
    expect(radio('Cuenta como SALIDA: 17:33')).toBeChecked();
    expect(screen.getByTestId('vista-previa-resolver')).toHaveTextContent('entrada 10:51 → salida 17:33 · 6.7 h trabajadas');
  });

  it('al cambiar el radio de entrada a 16:35, la vista previa se recalcula en vivo', () => {
    montar(cuatro());
    fireEvent.click(radio('Cuenta como ENTRADA: 16:35'));
    expect(radio('Cuenta como ENTRADA: 16:35')).toBeChecked();
    expect(radio('Cuenta como ENTRADA: 10:51')).not.toBeChecked();
    expect(screen.getByTestId('vista-previa-resolver')).toHaveTextContent('entrada 16:35 → salida 17:33 · 1.0 h trabajadas · tardanza 395 min');
  });

  it('una marca no puede ser entrada y salida a la vez: elegirla como salida quita la entrada', () => {
    montar(cuatro());
    fireEvent.click(radio('Cuenta como SALIDA: 10:51'));
    expect(radio('Cuenta como SALIDA: 10:51')).toBeChecked();
    expect(radio('Cuenta como ENTRADA: 10:51')).not.toBeChecked();
    expect(screen.getByTestId('vista-previa-resolver')).toHaveTextContent('Elige una entrada y una salida posterior a ella.');
  });

  it('«Usarlas como break» solo se habilita si quedan exactamente 2 marcas entre la entrada y la salida', () => {
    montar(cuatro());
    expect(radio('Usarlas como break')).toBeEnabled();
    fireEvent.click(radio('Cuenta como ENTRADA: 16:35'));
    expect(radio('Usarlas como break')).toBeDisabled();
  });

  it('guardar exige motivo de 10 caracteres y confirmación, y llama a la API con los ids correctos', async () => {
    const recargar = vi.fn(async () => undefined);
    montar(cuatro(), recargar);
    const guardar = screen.getByRole('button', { name: 'Guardar criterio' });
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo del criterio'), { target: { value: 'corto' } });
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo del criterio'), { target: { value: 'Marcó de más por el break' } });
    fireEvent.click(guardar);
    const dialogo = await screen.findByRole('dialog');
    expect(resolver).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(resolver).toHaveBeenCalledWith({
      partyId: 7, jornada: '2026-11-06', entradaMarcaId: 50, salidaMarcaId: 53, otras: 'IGNORAR', motivo: 'Marcó de más por el break',
    }));
    await waitFor(() => expect(recargar).toHaveBeenCalled());
  });

  it('con «Usarlas como break» envía BREAK y los ids elegidos', async () => {
    montar(cuatro());
    fireEvent.click(radio('Usarlas como break'));
    fireEvent.change(screen.getByLabelText('Motivo del criterio'), { target: { value: 'Tomó break de almuerzo en el medio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar criterio' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ entradaMarcaId: 50, salidaMarcaId: 53, otras: 'BREAK' })));
  });
});
