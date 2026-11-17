import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const miCalendario = vi.fn();
const miPlanilla = vi.fn();
vi.mock('../miCalendarioApi', () => ({ miCalendario: (...a: any[]) => miCalendario(...a), miPlanilla: (...a: any[]) => miPlanilla(...a) }));

import { MiCalendario } from '../MiCalendario';
import { marcaDia, textoProximos, textoRecargo, horarioTexto } from '../calendarioDia';

// Mes actual en jornada Lima: los días se arman a partir de él (como en MiCalendario.spec.tsx)
const hoy = new Date(Date.now() - 9 * 3600_000).toISOString().slice(0, 10);
const [A, M] = hoy.split('-');
const f = (d: number) => `${A}-${M}-${String(d).padStart(2, '0')}`;
const celda = (d: number) => document.querySelector(`[data-fecha="${f(d)}"]`) as HTMLButtonElement;
const tocar = (d: number) => fireEvent.click(celda(d));

const turno = { entrada: '14:00', salida: '22:00', almuerzo: { desde: '18:00', hasta: '18:30' }, duracionMin: 480 };
const datos = {
  desde: f(1), hasta: f(28),
  dias: [
    { fecha: f(1), estado: 'CUMPLIO', tipoDia: 'TRABAJA', programado: turno, entrada: '14:02', salida: '22:01', trabajadaMin: 470, marcas: [] },
    { fecha: f(2), estado: 'DESCANSO', tipoDia: 'DESCANSO', motivoDescanso: 'Descanso semanal', programado: null, trabajadaMin: 0, marcas: [] },
    { fecha: f(3), estado: 'CUMPLIO', tipoDia: 'FERIADO', feriado: 'Día de prueba', recargo: 2, pagaRecargo: true, programado: turno, entrada: '14:00', salida: '22:00', trabajadaMin: 480, marcas: [] },
    { fecha: f(4), estado: 'VACACIONES', tipoDia: 'VACACIONES', programado: turno, trabajadaMin: 480, marcas: [] },
    { fecha: f(5), estado: 'CUMPLIO', tipoDia: 'COBERTURA', programado: { entrada: '09:00', salida: '13:00', almuerzo: null, duracionMin: 240 }, cobertura: { rol: 'COBRE', parcial: false }, entrada: '09:00', salida: '13:00', trabajadaMin: 240, marcas: [] },
    { fecha: f(6), estado: 'DESCANSO', tipoDia: 'REEMPLAZO', motivoDescanso: 'Cubierto por otra persona', programado: null, trabajadaMin: 0, marcas: [] },
    { fecha: f(7), estado: 'A_REVISAR', tipoDia: 'DESCANSO', motivoDescanso: 'Descanso semanal', trabajoEnDescanso: true, programado: null, trabajadaMin: 0, extraMin: 240, extraEstado: 'PENDIENTE',
      marcas: [{ tipo: 'ENTRADA', hora: '10:00', estado: 'VALIDA' }, { tipo: 'SALIDA', hora: '14:00', estado: 'VALIDA' }] },
    { fecha: f(8), estado: 'CUMPLIO', tipoDia: 'FERIADO', feriado: 'Feriado sin recargo', recargo: 1, pagaRecargo: false, programado: null, trabajadaMin: 0, marcas: [] },
    { fecha: f(9), estado: 'CUMPLIO', tipoDia: 'TRABAJA', programado: turno, entrada: '14:00', salida: '22:00', trabajadaMin: 480, marcas: [] },
  ],
  resumen: {
    diasTrabajados: 3, horasTrabajadasMin: 1430, tardanzaMin: 0, extraAprobadaMin: 0, extraPendienteMin: 240, faltas: 0,
    diasProgramados: 5, diasDescanso: 2, feriadosConRecargo: 1, horasProgramadasMin: 2400,
  },
  proximos: {
    descanso: { fecha: f(10) },
    feriado: { fecha: f(12), nombre: 'Feriado de prueba', recargo: 2 },
  },
};

describe('MiCalendario: tipo de día en cada celda', () => {
  beforeEach(() => { miCalendario.mockReset().mockResolvedValue(datos); miPlanilla.mockReset().mockResolvedValue({}); });

  it('marca cada día con ícono y texto (no solo color): horario, descanso, feriado con recargo, vacaciones, cobertura y reemplazo', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    expect(celda(1)).toHaveTextContent('14:00–22:00');
    expect(celda(2)).toHaveTextContent('Descanso');
    expect(celda(3)).toHaveTextContent('Feriado ×2');
    expect(celda(4)).toHaveTextContent('Vacaciones');
    expect(celda(5)).toHaveTextContent('Cobertura');
    expect(celda(6)).toHaveTextContent('Reemplazo');
    expect(celda(8)).toHaveTextContent('Feriado');
    expect(celda(8)).not.toHaveTextContent('×');
  });

  it('la etiqueta accesible incluye tipo, feriado con recargo y turno', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    expect(celda(3).getAttribute('aria-label')).toMatch(/feriado Día de prueba, se paga ×2, turno 14:00 a 22:00/);
    expect(celda(2).getAttribute('aria-label')).toMatch(/, descanso, /);
    expect(celda(1).getAttribute('aria-label')).toMatch(/turno 14:00 a 22:00, Cumplió, entrada 14:02, salida 22:01/);
  });

  it('el día de hoy queda marcado como actual', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    expect(document.querySelector(`[data-fecha="${hoy}"]`)).toHaveAttribute('aria-current', 'date');
  });

  it('sin tipo de día (respuesta vieja): sigue mostrando feriado y horario', async () => {
    miCalendario.mockResolvedValue({
      desde: f(1), hasta: f(28),
      dias: [{ fecha: f(3), estado: 'CUMPLIO', feriado: 'Día de prueba', programado: { entrada: '13:30', salida: '22:30' }, marcas: [] }],
      resumen: datos.resumen,
    });
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    expect(celda(3)).toHaveTextContent('Feriado');
  });
});

describe('MiCalendario: leyenda plegable', () => {
  beforeEach(() => { miCalendario.mockReset().mockResolvedValue(datos); miPlanilla.mockReset().mockResolvedValue({}); });

  it('explica cada tipo de día, incluido «Feriado: se paga con recargo ×N»', async () => {
    render(<MiCalendario />);
    const leyenda = await screen.findByTestId('leyenda-calendario');
    expect(leyenda.tagName).toBe('DETAILS');
    expect(leyenda).toHaveTextContent('Feriado: se paga con recargo ×N');
    for (const t of ['Tu horario: de entrada a salida', 'No te toca turno ese día', 'Cubres el turno de otra persona', 'Tu turno lo cubre otra persona', 'Días de vacaciones tomadas']) {
      expect(leyenda).toHaveTextContent(t);
    }
    const lista = within(leyenda).getByRole('list', { name: 'Leyenda' });
    expect(lista.querySelectorAll('li').length).toBe(6);
  });
});

describe('MiCalendario: panel del día (feriado, descanso y turno)', () => {
  beforeEach(() => { miCalendario.mockReset().mockResolvedValue(datos); miPlanilla.mockReset().mockResolvedValue({}); });

  it('feriado con recargo: nombre y «Te pagan ×2 las horas trabajadas ese día», con su horario y almuerzo', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    tocar(3);
    const det = await screen.findByTestId('detalle-dia');
    expect(within(det).getByTestId('feriado-dia')).toHaveTextContent('Día de prueba');
    expect(within(det).getByTestId('feriado-dia')).toHaveTextContent('Te pagan ×2 las horas trabajadas ese día.');
    const horario = within(det).getByTestId('horario-dia');
    expect(horario).toHaveTextContent('De 14:00 a 22:00');
    expect(horario).toHaveTextContent('8 h 00 min');
    expect(horario).toHaveTextContent('18:00 a 18:30 (se paga)');
    expect(within(det).getByText('Duración programada')).toBeInTheDocument();
  });

  it('feriado sin recargo: lo dice y no promete doble pago', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    tocar(8);
    const feriado = await screen.findByTestId('feriado-dia');
    expect(feriado).toHaveTextContent('Feriado sin recargo: esas horas se pagan normal.');
    expect(feriado).not.toHaveTextContent('Te pagan');
  });

  it('descanso: «Hoy te toca descanso» y sin horario', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    tocar(2);
    const desc = await screen.findByTestId('descanso-dia');
    expect(desc).toHaveTextContent('Hoy te toca descanso.');
    expect(desc).toHaveTextContent('Descanso semanal');
    expect(screen.queryByTestId('horario-dia')).toBeNull();
  });

  it('descanso trabajado: se ve como trabajado y se paga solo si el admin lo aprueba; marcas y extra pendiente', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    tocar(7);
    const desc = await screen.findByTestId('descanso-dia');
    expect(desc).toHaveTextContent('descanso trabajado');
    expect(desc).toHaveTextContent('se paga solo si el admin lo aprueba');
    const det = screen.getByTestId('detalle-dia');
    expect(within(det).getByRole('list', { name: 'Línea de tiempo del día' })).toHaveTextContent('10:00 Entrada');
    expect(det).toHaveTextContent('Pendiente');
  });

  it('turno normal: horario de entrada a salida y duración programada, sin avisos de feriado ni descanso', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    tocar(1);
    const det = await screen.findByTestId('detalle-dia');
    expect(within(det).getByTestId('horario-dia')).toHaveTextContent('De 14:00 a 22:00');
    expect(within(det).queryByTestId('feriado-dia')).toBeNull();
    expect(within(det).queryByTestId('descanso-dia')).toBeNull();
    expect(within(det).getByRole('list', { name: 'Línea de tiempo del día' })).toHaveTextContent('14:02 Entrada');
  });

  it('vacaciones, cobertura y reemplazo tienen su aviso en el panel', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    tocar(4);
    expect(await screen.findByTestId('vacaciones-dia')).toHaveTextContent('se paga como día normal');
    tocar(5);
    expect(await screen.findByTestId('cobertura-dia')).toHaveTextContent('Cubres el turno de otra persona');
    tocar(6);
    expect(await screen.findByTestId('reemplazo-dia')).toHaveTextContent('Tu turno lo cubrió otra persona.');
  });
});

describe('MiCalendario: resumen del mes y próximos', () => {
  beforeEach(() => { miCalendario.mockReset().mockResolvedValue(datos); miPlanilla.mockReset().mockResolvedValue({}); });

  it('resumen con días con turno, descansos, feriados con recargo y horas programadas', async () => {
    render(<MiCalendario />);
    const r = await screen.findByTestId('resumen-mes');
    expect(r).toHaveTextContent('Días con turno5');
    expect(r).toHaveTextContent('Descansos2');
    expect(r).toHaveTextContent('Feriados con recargo1');
    expect(r).toHaveTextContent('Horas programadas40 h 00 min');
    expect(r).toHaveTextContent('Días trabajados3');
  });

  it('próximo descanso y próximo feriado desde hoy', async () => {
    render(<MiCalendario />);
    const p = await screen.findByTestId('proximos-calendario');
    expect(p).toHaveTextContent(new RegExp(`Próximo descanso: [^\\d]+ ${Number(f(10).slice(8))}`));
    expect(p).toHaveTextContent(/Próximo feriado: \d+ [a-z]{3} ×2/);
  });

  it('sin próximos en 60 días lo dice', async () => {
    miCalendario.mockResolvedValue({ ...datos, proximos: { descanso: null, feriado: null } });
    render(<MiCalendario />);
    const p = await screen.findByTestId('proximos-calendario');
    expect(p).toHaveTextContent('Próximo descanso: ninguno en los próximos 60 días');
    expect(p).toHaveTextContent('Próximo feriado: ninguno en los próximos 60 días');
  });
});

describe('calendarioDia: helpers puros', () => {
  it('marca por tipo de día', () => {
    expect(marcaDia({ fecha: f(1), estado: 'X', tipoDia: 'TRABAJA', programado: { entrada: '14:00', salida: '22:00' } })).toMatchObject({ texto: '14:00–22:00', clase: 'trabaja' });
    expect(marcaDia({ fecha: f(1), estado: 'X', tipoDia: 'TRABAJA', programado: null })).toBeNull();
    expect(marcaDia({ fecha: f(1), estado: 'X', tipoDia: 'FERIADO', pagaRecargo: true, recargo: 3 })).toMatchObject({ texto: 'Feriado ×3' });
    expect(marcaDia({ fecha: f(1), estado: 'X', tipoDia: 'FERIADO', pagaRecargo: false, recargo: 1 })).toMatchObject({ texto: 'Feriado' });
    expect(marcaDia({ fecha: f(1), estado: 'X', tipoDia: 'DESCANSO' })).toMatchObject({ texto: 'Descanso' });
    expect(marcaDia({ fecha: f(1), estado: 'X', tipoDia: 'VACACIONES' })).toMatchObject({ texto: 'Vacaciones' });
    expect(marcaDia({ fecha: f(1), estado: 'X', tipoDia: 'COBERTURA' })).toMatchObject({ texto: 'Cobertura' });
    expect(marcaDia({ fecha: f(1), estado: 'X', tipoDia: 'REEMPLAZO' })).toMatchObject({ texto: 'Reemplazo' });
  });

  it('formatos: recargo, horario y próximos', () => {
    expect(textoRecargo(2)).toBe('×2');
    expect(textoRecargo(1.5)).toBe('×1.5');
    expect(horarioTexto({ entrada: '09:00', salida: '18:00' })).toBe('09:00–18:00');
    const t = textoProximos({ descanso: { fecha: '2026-11-18' }, feriado: { fecha: '2026-12-08', nombre: 'x', recargo: 2 } });
    expect(t.descanso).toBe('Próximo descanso: miércoles 18');
    expect(t.feriado).toBe('Próximo feriado: 8 dic ×2');
  });
});
