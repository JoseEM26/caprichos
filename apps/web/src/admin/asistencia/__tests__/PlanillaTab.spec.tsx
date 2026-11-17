import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const listar = vi.fn();
const detalle = vi.fn();
const pagar = vi.fn();
const historial = vi.fn(async () => []);
const sueldoApi = vi.fn(async () => ({ sueldo: null, historial: [] }));
const filasCal = vi.fn(async () => ({ total: 0, pagina: 1, limite: 0, filas: [], totales: { trabajadaMin: 0, tardanzaMin: 0, extraMin: 0, faltas: 0 } }));
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarPlanilla: (...a: any[]) => listar(...a),
  detallePlanilla: (...a: any[]) => detalle(...a),
  pagarPlanilla: (...a: any[]) => pagar(...a),
  historialPagos: (...a: any[]) => (historial as any)(...a),
  obtenerSueldo: (...a: any[]) => (sueldoApi as any)(...a),
}));
vi.mock('../calendarioApi', async (orig) => ({ ...(await orig<any>()), calendarioFilas: (...a: any[]) => (filasCal as any)(...a) }));

import { PlanillaTab } from '../PlanillaTab';
import { sueldoEquivalente } from '../planillaApi';

describe('sueldoEquivalente (web)', () => {
  it('mensual ×12/52 y semanal ×52/12', () => {
    expect(sueldoEquivalente('MENSUAL', 1000)).toEqual({ semanal: 230.77, mensual: 1000 });
    expect(sueldoEquivalente('SEMANAL', 300)).toEqual({ semanal: 300, mensual: 1300 });
  });
});


function Url() {
  const l = useLocation();
  return <output data-testid="url">{l.search}</output>;
}
const montar = (entrada = '/') => render(<MemoryRouter initialEntries={[entrada]}><PlanillaTab onError={() => undefined} onOk={() => undefined} /><Url /></MemoryRouter>);
const url = () => new URLSearchParams(screen.getByTestId('url').textContent ?? '');
const tab = async (n: string) => fireEvent.click(await screen.findByRole('tab', { name: new RegExp(`^${n}`) }));
const cifra = (t: string) => within(screen.getByLabelText('Cifras del período')).getByText(t).nextElementSibling!;

describe('PlanillaTab', () => {
  const resultado = {
    programadaMin: 3000, trabajadaMin: 1800, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, extraAprobadaMin: 0, valorHora: 20,
    pagoTrabajado: 600, pagoExtra: 0, ganado: 600, consumosCobrados: 40, consumosPendientes: 0, descuentos: 0, adelantos: 0, neto: 560,
  };
  const persona = { partyId: 7, nombre: 'Luis Pérez', rol: 'MOZO', sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 }, periodo: { desde: '2026-11-01', hasta: '2026-11-30' } };
  const base = {
    partyId: 7, nombre: 'Luis Pérez', periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, sueldo: persona.sueldo,
    estado: 'ABIERTO', periodoId: null, toleranciaMin: 5, pendientes: 0, resultado, dias: [], consumos: [], ajustes: [],
  };
  const abrir = async () => fireEvent.click(await screen.findByRole('button', { name: 'Abrir la planilla de Luis Pérez' }));
  const pagarOk = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Marcar pagado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, marcar pagado' }));
  };

  it('lista a la persona con tarjeta, totales y abre su PÁGINA (ruta propia); los consumos pasan al siguiente período al desmarcarlos', async () => {
    listar.mockResolvedValue({ fecha: '2026-11-09', filas: [{ ...persona, estado: 'ABIERTO', programadasH: 50, trabajadasH: 30, ganado: 600, consumos: 40, descuentos: 0, adelantos: 0, neto: 560, pendientes: 0 }] });
    detalle.mockResolvedValue({ ...base, consumos: [{ id: '1', fecha: '2026-11-10', pedido: 'P-100', monto: 40, cobrar: true }] });
    montar();
    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(screen.getByText('S/ 1000.00 al mes', { exact: false })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Totales de la planilla')).getByText('A pagar').nextElementSibling).toHaveTextContent('S/ 560.00');
    await abrir();
    // ruta propia: persona + período en la URL, sin diálogo
    expect(url().get('persona')).toBe('7');
    expect(url().get('desde')).toBe('2026-11-01');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByTestId('pagina-planilla-persona')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Migas de pan' })).toHaveTextContent('Planilla › Luis Pérez › 2026-11-01 a 2026-11-30');
    expect(cifra('Neto a pagar')).toHaveTextContent('S/ 560.00');
    expect(cifra('Bruto (ganado)')).toHaveTextContent('S/ 600.00');
    expect(cifra('Descuentos')).toHaveTextContent('− S/ 40.00');
    expect(cifra('Horas trabajadas / programadas')).toHaveTextContent('30.00 h de 50.00 h');
    await tab('Descuentos y créditos');
    fireEvent.click(await screen.findByLabelText('Cobrar en este pago el consumo P-100'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), ['1'], [], [], []));
  });

  it('las 5 pestañas de la página, con Resumen primero, y la cascada del neto con cifras en texto', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({ ...base, resultado: { ...resultado, pagoExtra: 30, ganado: 630, adelantos: 20, descuentos: 10, consumosCobrados: 40, neto: 560 } });
    montar();
    await abrir();
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/[^A-Za-zÁ-ú ]/g, '').trim())).toEqual(['Resumen', 'Asistencia', 'Descuentos y créditos', 'Pago', 'Historial']);
    expect(screen.getByRole('tab', { name: /^Resumen/ })).toHaveAttribute('aria-selected', 'true');
    const c = within(screen.getByTestId('cascada-neto'));
    expect(c.getByText('Horas extra aprobadas').closest('li')).toHaveTextContent('+ S/ 30.00');
    expect(c.getByText('Adelantos').closest('li')).toHaveTextContent('− S/ 20.00');
    expect(c.getByText('Neto a pagar').closest('li')).toHaveTextContent('S/ 560.00');
    await tab('Historial');
    expect(url().get('seccion')).toBe('historial');
  });

  it('resumen por persona: penalidad, préstamos, adelantos, medio de pago, LIQUIDADO y copiar; sin ningún «50 %»', async () => {
    const copiar = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText: copiar } });
    const excel = {
      pagoPorDia: 62.5, valorHora: 6.94, horasLaboradas: 10, minutosLaborados: 25, horasExtra: 1, total: 72.34, adicional: 20,
      descuentos: 41.64, descuentosPorCategoria: { NETFLIX: 1.64, MERMA: 15, PRESTAMO: 25 }, netoAPagar: 75.7, adelanto: 30, diferencia: 45.7, penalidadTardanza: 8.5,
    };
    listar.mockResolvedValue({ fecha: '2026-11-09', filas: [{ ...persona, estado: 'PAGADO', pendientes: 0, excel, pago: { celular: '999000111', medio: 'YAPE' } }] });
    const { container } = montar();
    expect(await screen.findByText('10 h 25 min')).toBeInTheDocument();
    const dd = (t: string) => within(container.querySelector('.pl-tarjeta') as HTMLElement).getByText(t, { selector: 'dt' }).nextElementSibling!;
    expect(dd('Penalidad')).toHaveTextContent('S/ 8.50');
    expect(dd('Préstamos')).toHaveTextContent('S/ 25.00');
    expect(dd('Adelantos')).toHaveTextContent('S/ 30.00');
    expect(screen.getByText(/Merma: S\/ 15\.00/)).toBeInTheDocument();
    expect(screen.getByText('YAPE')).toBeInTheDocument();
    expect(screen.getByText('LIQUIDADO')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/50 ?%/);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el número de pago' }));
    await waitFor(() => expect(copiar).toHaveBeenCalledWith('999000111'));
  });

  it('filtros siempre visibles: estado, rol, orden y buscador; viven en la URL y se pueden quitar', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [
      { ...persona, estado: 'PAGADO', neto: 100 },
      { ...persona, partyId: 8, nombre: 'Ana Ríos', rol: 'COCINA', estado: 'ABIERTO', neto: 300, pendientes: 2 },
      { ...persona, partyId: 9, nombre: 'Beto Sol', rol: 'COCINA', estado: 'ABIERTO', neto: 200, consumosAnterioresPendiente: 5 },
    ] });
    const { container } = montar();
    await screen.findByText('Ana Ríos');
    const nombres = () => [...container.querySelectorAll('.pl-nombre')].map((n) => n.textContent);
    expect(nombres()).toEqual(['Ana Ríos', 'Beto Sol', 'Luis Pérez']);
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'NETO' } });
    expect(nombres()).toEqual(['Ana Ríos', 'Beto Sol', 'Luis Pérez']);
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'ALERTAS' } });
    expect(nombres()[0]).toBe('Ana Ríos');
    expect(url().get('orden')).toBe('ALERTAS');
    expect(screen.getByText('Créditos pendientes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pagados' }));
    expect(nombres()).toEqual(['Luis Pérez']);
    expect(url().get('estado')).toBe('PAGADO');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'COCINA' } });
    expect(nombres()).toEqual(['Ana Ríos', 'Beto Sol']);
    fireEvent.change(screen.getByLabelText('Persona'), { target: { value: 'beto' } });
    expect(nombres()).toEqual(['Beto Sol']);
    expect(url().get('q')).toBe('beto');
  });

  it('abrir desde un enlace compartido muestra la página, y «Volver a la planilla» regresa a la lista con período, filtros y búsqueda', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }, { ...persona, partyId: 8, nombre: 'Luis Díaz' }, { ...persona, partyId: 9, nombre: 'Ana Ríos' }] });
    detalle.mockResolvedValue(base);
    montar('/?modo=MES&fecha=2026-10-15&q=luis&estado=ABIERTO&persona=7&desde=2026-11-01&seccion=pago');
    expect(await screen.findByTestId('pagina-planilla-persona')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Pago/ })).toHaveAttribute('aria-selected', 'true');
    expect(detalle).toHaveBeenCalledWith(7, '2026-11-01', [], [], [], []);
    fireEvent.click(screen.getAllByRole('button', { name: '← Volver a la planilla' })[0]);
    expect(await screen.findByText('Luis Díaz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Ríos')).toBeNull();
    expect(screen.getByLabelText('Persona')).toHaveValue('luis');
    expect(screen.getByRole('button', { name: 'Mes', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abiertos', pressed: true })).toBeInTheDocument();
    expect(screen.getByText(/^Octubre 2026$/)).toBeInTheDocument();
    expect(url().get('persona')).toBeNull();
  });

  it('flechas ‹ › del período: van al período anterior y siguiente de la MISMA persona y el día elegido se guarda en la URL', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    // el servidor responde con el período que contiene el día pedido
    detalle.mockImplementation(async (_p: number, f: string) => ({ ...base, periodo: { desde: `${f.slice(0, 7)}-01`, hasta: `${f.slice(0, 7)}-28` } }));
    montar('/?persona=7&desde=2026-11-01');
    await screen.findByTestId('pagina-planilla-persona');
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, '2026-10-01', [], [], [], []));
    expect(url().get('desde')).toBe('2026-10-01');
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, '2026-11-01', [], [], [], []));
    fireEvent.change(screen.getByLabelText('Día del período'), { target: { value: '2026-09-15' } });
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, '2026-09-15', [], [], [], []));
    expect(url().get('persona')).toBe('7');
  });

  it('error al abrir la página: mensaje con «Reintentar»', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(base);
    montar('/?persona=7&desde=2026-11-01');
    expect(await screen.findByText('No pudimos abrir la planilla')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('pagina-planilla-persona')).toBeInTheDocument();
  });

  it('la lista que no carga muestra el error con «Reintentar»', async () => {
    listar.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    montar();
    expect(await screen.findByText('No pudimos cargar la planilla')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
  });

  it('Asistencia muestra la penalidad por tardanza con su detalle por día (en soles o en céntimos) y no el antiguo porcentaje', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({
      ...base, pctTardanza: 50,
      resultado: { ...resultado, tardanzaMin: 40, neto: 551.5 },
      penalidadTardanza: { totalCents: 850, detalle: [{ fecha: '2026-11-03', minutos: 30, monto: 5 }, { fecha: '2026-11-05', minutos: 10, monto: 3.5 }] },
    });
    const { container } = montar();
    await abrir();
    await tab('Asistencia');
    const sec = (await screen.findByText('Penalidad por tardanza', { selector: '.pl-seccion-titulo' })).closest('details')!;
    expect(sec).toHaveTextContent('− S/ 8.50');
    expect(sec).toHaveTextContent('2026-11-03 · 30 min de tardanza');
    expect(sec).toHaveTextContent('− S/ 5.00');
    expect(sec).toHaveTextContent('2026-11-05 · 10 min de tardanza');
    expect(container.textContent).not.toMatch(/50 ?%/);
    expect(screen.getByText('Horas trabajadas (el break se paga)')).toBeInTheDocument();
  });

  it('sin datos de penalidad se degrada a S/ 0.00 sin romperse', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue(base);
    montar();
    await abrir();
    await tab('Asistencia');
    expect(await screen.findByText('Sin penalidad')).toBeInTheDocument();
    expect(screen.getByText('No hay tardanzas con penalidad en este período.')).toBeInTheDocument();
  });

  it('una cuota de préstamo (con capital e interés) y un servicio extra se pueden saltar en este pago y se vuelve a pedir el cálculo', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({
      ...base,
      cuotas: [{ id: '90', prestamoId: '1', numero: 1, numCuotas: 3, monto: 106, motivo: null, cobrar: true, capital: 100, interes: 6 }],
      recurrentes: [{ id: '5', tipo: 'NETFLIX', nombre: 'Netflix', monto: 6.56, cobrar: true, periodicidad: 'MENSUAL' }],
    });
    montar();
    await abrir();
    await tab('Descuentos y créditos');
    expect(await screen.findByText(/capital S\/ 100\.00 \+ interés S\/ 6\.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cobrar la cuota 1 del préstamo'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), [], ['90'], [], []));
    fireEvent.click(screen.getByLabelText('Cobrar Netflix en este pago'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), [], ['90'], ['5'], []));
  });

  it('checklist de cierre listo: lleva a Pago y marcar pagado pide confirmación', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue(base);
    pagar.mockResolvedValue({});
    montar();
    await abrir();
    const lista = within(await screen.findByLabelText('Lista de cierre'));
    expect(lista.getByText(/Asistencia revisada/)).toBeInTheDocument();
    expect(lista.getByText(/Descuentos revisados/)).toBeInTheDocument();
    expect(lista.getByText(/Créditos anteriores/)).toBeInTheDocument();
    expect(lista.getByText(/Listo para pagar/)).toBeInTheDocument();
    fireEvent.click(lista.getByRole('button', { name: 'Ir a Pago' }));
    expect(screen.getByRole('tab', { name: /^Pago/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('bloqueo-pago')).toBeNull();
    pagarOk();
    await waitFor(() => expect(pagar).toHaveBeenCalledWith(7, expect.any(String), [], [], [], [], {}));
  });

  it('con jornadas por revisar el checklist lo dice, «Marcar pagado» queda bloqueado con el motivo y Aprobar todas pide confirmación', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({ ...base, pendientes: 2, jornadasPorRevisar: ['2026-11-03', '2026-11-04'] });
    montar();
    await abrir();
    const lista = within(await screen.findByLabelText('Lista de cierre'));
    expect(lista.getByText(/Asistencia: 2 por revisar/)).toBeInTheDocument();
    expect(lista.getByText(/Todavía no está listo para pagar/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Asistencia/ })).toHaveTextContent('Asistencia2');
    fireEvent.click(lista.getAllByRole('button', { name: 'Ir a resolverlo' })[0]); // lleva a la pestaña del problema
    expect(screen.getByRole('tab', { name: /^Asistencia/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('banner-por-revisar')).toHaveTextContent('2 jornadas por revisar o sin evaluar');
    await tab('Pago');
    expect(screen.getByTestId('bloqueo-pago')).toHaveTextContent(/Falta resolver 2 jornadas por revisar o sin evaluar \(2026-11-03, 2026-11-04\)/);
    expect(screen.getByRole('button', { name: 'Marcar pagado' })).toBeDisabled();
    await tab('Asistencia');
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar todas las marcas dudosas del período' }));
    expect(await screen.findByText('¿Aprobar todas las marcas dudosas del período?')).toBeInTheDocument();
  });

  it('«Pagar igual (solo administrador)» pide motivo de 10+ caracteres, desbloquea el pago y lo manda al pagar', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({ ...base, pendientes: 1, jornadasPorRevisar: ['2026-11-03'] });
    pagar.mockResolvedValue({});
    montar();
    await abrir();
    await tab('Pago');
    expect(screen.getByRole('button', { name: 'Marcar pagado' })).toBeDisabled();
    fireEvent.click(await screen.findByRole('button', { name: 'Pagar igual (solo administrador)' }));
    const dejar = screen.getByRole('button', { name: 'Dejar avanzar' });
    expect(dejar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo para pagar con jornadas pendientes/), { target: { value: 'Se le pagó en efectivo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dejar avanzar' }));
    expect(screen.getByTestId('aviso-pagar-igual')).toHaveTextContent('Se le pagó en efectivo');
    expect(screen.queryByTestId('bloqueo-pago')).toBeNull();
    pagarOk();
    await waitFor(() => expect(pagar).toHaveBeenCalledWith(7, expect.any(String), [], [], [], [], { pagarIgualMotivo: 'Se le pagó en efectivo' }));
  });

  it('un descanso trabajado se ve como tal y se aprueba en Asistencia', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({ ...base, dias: [{ jornada: '2026-11-11', estado: 'A_REVISAR', programadaMin: 0, trabajadaMin: 0, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 300, extraPendiente: true, extraAprobada: false, descansoTrabajado: true, ganado: 0, marcas: [] }] });
    montar();
    await abrir();
    await tab('Asistencia');
    expect(await screen.findByText('Descanso trabajado')).toBeInTheDocument();
    expect(screen.getByLabelText('Aprobar el descanso trabajado del 2026-11-11')).not.toBeChecked();
  });

  it('«Ver detalle» abre el detalle del día en una ventana (no ensancha la página)', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({ ...base, dias: [{ jornada: '2026-11-11', estado: 'CUMPLIO', programadaMin: 480, trabajadaMin: 480, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, extraAprobada: false, ganado: 40, marcas: [] }] });
    montar();
    await abrir();
    await tab('Asistencia');
    fireEvent.click(await screen.findByRole('button', { name: 'Ver el detalle del día 2026-11-11' }));
    const ventana = await screen.findByRole('dialog');
    expect(within(ventana).getByText(/Ese día no tiene registro de marcas/)).toBeInTheDocument();
    fireEvent.click(within(ventana).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lo escrito en el formulario de adelanto no se pierde al cambiar de pestaña', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue(base);
    montar();
    await abrir();
    await tab('Descuentos y créditos');
    fireEvent.change((await screen.findAllByLabelText(/Monto \(S\/\)/))[0], { target: { value: '25' } });
    await tab('Pago');
    await tab('Descuentos y créditos');
    expect((await screen.findAllByLabelText(/Monto \(S\/\)/))[0]).toHaveValue(25);
  });

  it('créditos de días anteriores sin cerrar: avisa, bloquea el pago y se puede confirmar pagar sin descontarlos', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({ ...base, consumos: [{ id: '3', fecha: '2026-10-20', pedido: 'P-99', monto: 12, cobrar: false, anterior: true }] });
    montar();
    await abrir();
    expect(await screen.findByText(/Créditos anteriores: 1 sin cerrar/)).toBeInTheDocument();
    await tab('Pago');
    expect(screen.getByTestId('bloqueo-pago')).toHaveTextContent(/1 crédito sin cerrar de días anteriores por S\/ 12\.00/);
    expect(screen.getByRole('button', { name: 'Marcar pagado' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Descuentos y créditos' }));
    expect(await screen.findByTestId('aviso-creditos-anteriores')).toHaveTextContent('Tiene 1 crédito sin cerrar de días anteriores por S/ 12.00');
    fireEvent.click(screen.getByLabelText('Confirmo pagar sin descontar los créditos anteriores'));
    await tab('Pago');
    expect(screen.queryByTestId('bloqueo-pago')).toBeNull();
    expect(screen.getByRole('button', { name: 'Marcar pagado' })).toBeEnabled();
  });

  it('período pagado: solo lectura, sello «Pagado el … por …», sin Marcar pagado y con Reabrir', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'PAGADO' }] });
    detalle.mockResolvedValue({ ...base, estado: 'PAGADO', periodoId: '5', pagadoEn: '2026-11-10T12:00:00Z' });
    historial.mockResolvedValueOnce([{ id: 5, desde: '2026-11-01', hasta: '2026-11-30', estado: 'PAGADO', neto: 560, pagadoEn: '2026-11-10T12:00:00Z', pagadoPor: 1, pagadoPorNombre: 'Rosa Admin', reabiertoEn: null, reabiertoMotivo: null }] as never);
    montar();
    await abrir();
    expect(await screen.findByText(/Pagado el .* por Rosa Admin/)).toBeInTheDocument();
    expect(screen.getByText(/Período pagado: solo lectura/)).toBeInTheDocument();
    await tab('Pago');
    expect(screen.queryByRole('button', { name: 'Marcar pagado' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reabrir período' })).toBeInTheDocument();
  });

  it('Historial: pagos anteriores de la persona, cambios de sueldo con «Vigente desde» y ajustes anulados', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({ ...base, ajustes: [{ id: 1, tipo: 'DESCUENTO', categoria: 'MERMA', fecha: '2026-11-03', monto: 5, motivo: 'Torta caída', anulado: true, anuladoMotivo: 'Error de digitación' }] });
    historial.mockResolvedValueOnce([{ id: 4, desde: '2026-10-01', hasta: '2026-10-31', estado: 'PAGADO', neto: 900, pagadoEn: '2026-11-02T12:00:00Z', pagadoPor: 1, pagadoPorNombre: 'Rosa Admin', reabiertoEn: null, reabiertoMotivo: null }] as never);
    sueldoApi.mockResolvedValueOnce({ sueldo: null, historial: [{ modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000, vigenteDesde: '2026-09-01', creadoEn: 'x' }] } as never);
    montar();
    await abrir();
    await tab('Historial');
    const h = within(await screen.findByTestId('historial-planilla'));
    expect(await h.findByText('S/ 900.00')).toBeInTheDocument();
    expect(h.getByText(/por Rosa Admin/)).toBeInTheDocument();
    expect(await h.findByText(/Vigente desde 2026-09-01 · mensual/)).toBeInTheDocument();
    expect(h.getByText(/anulado: Error de digitación/)).toBeInTheDocument();
  });

  it('selector Semana | Mes: pide la lista con el modo, avanza y retrocede de período y muestra la etiqueta', async () => {
    listar.mockResolvedValue({ fecha: '2026-11-11', filas: [{ ...persona, estado: 'ABIERTO', neto: 100 }] });
    montar();
    await screen.findByText('Luis Pérez');
    expect(listar).toHaveBeenLastCalledWith(expect.any(String), 'SEMANA');
    expect(screen.getByRole('button', { name: 'Semana', pressed: true })).toBeInTheDocument();
    expect(screen.getByText(/^Semana del \d+/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esta semana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semana pasada' })).toBeInTheDocument();
    const antes = listar.mock.calls.length;
    const fechaAntes = listar.mock.calls[antes - 1][0] as string;
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(antes));
    expect(Date.parse(fechaAntes) - Date.parse(listar.mock.calls[listar.mock.calls.length - 1][0] as string)).toBe(7 * 86_400_000);
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(expect.any(String), 'MES'));
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes pasado' })).toBeInTheDocument();
    expect(screen.getByText(/^(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) \d{4}$/)).toBeInTheDocument();
  });

  it('paginación: 12 por página y la página vive en la URL', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: Array.from({ length: 14 }, (_, i) => ({ ...persona, partyId: 100 + i, nombre: `Persona ${String(i).padStart(2, '0')}`, estado: 'ABIERTO' })) });
    const { container } = montar();
    await screen.findByText('Persona 00');
    expect(container.querySelectorAll('.pl-tarjeta')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(url().get('pag')).toBe('2');
    expect(container.querySelectorAll('.pl-tarjeta')).toHaveLength(2);
  });

  it('totales del período: a pagar, pagado y pendiente; quien se paga por otro período avisa y no suma', async () => {
    listar.mockResolvedValue({
      fecha: '2026-11-11',
      filas: [
        { ...persona, partyId: 7, estado: 'ABIERTO', neto: 100, netoPagado: 0 },
        { ...persona, partyId: 8, nombre: 'Ana Ríos', estado: 'PAGADO', neto: 50, netoPagado: 50 },
        { ...persona, partyId: 9, nombre: 'Rosa Mes', estado: 'ABIERTO', neto: 900, fueraDeModalidad: true, aviso: 'Se paga por mes: se muestra su mes (no suma en los totales de la semana)' },
      ],
    });
    montar();
    await screen.findByText('Rosa Mes');
    const tot = within(screen.getByLabelText('Totales de la planilla'));
    expect(tot.getByText('A pagar').nextElementSibling).toHaveTextContent('S/ 150.00');
    expect(tot.getByText('Pagado').nextElementSibling).toHaveTextContent('S/ 50.00');
    expect(tot.getByText('Pendiente').nextElementSibling).toHaveTextContent('S/ 100.00');
    expect(screen.getByText(/Se paga por mes/)).toBeInTheDocument();
  });

  it('persona semanal en vista Mes: lista sus semanas y cada una abre su página', async () => {
    listar.mockResolvedValue({
      fecha: '2026-11-11',
      filas: [{ ...persona, estado: 'ABIERTO', neto: 300, aviso: 'Se paga por semana: suma de 2 semanas del mes', abrirFecha: '2026-11-09',
        semanas: [{ desde: '2026-11-02', hasta: '2026-11-08', estado: 'PAGADO', neto: 100, pendientes: 0 }, { desde: '2026-11-09', hasta: '2026-11-15', estado: 'ABIERTO', neto: 200, pendientes: 0 }] }],
    });
    detalle.mockResolvedValue(base);
    montar();
    expect(await screen.findByRole('button', { name: 'Abrir la semana del 2026-11-02 de Luis Pérez' })).toHaveTextContent('Pagada');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir la semana del 2026-11-09 de Luis Pérez' }));
    await waitFor(() => expect(detalle).toHaveBeenCalledWith(7, '2026-11-09', [], [], [], []));
    expect(url().get('desde')).toBe('2026-11-09');
  });

  it('consumos del personal: productos, los de períodos anteriores sin marcar y se piden aparte al pagar', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO', consumosAnterioresPendiente: 12 }] });
    detalle.mockResolvedValue({
      ...base,
      consumos: [
        { id: '1', fecha: '2026-11-10', pedido: 'P-100', monto: 40, cobrar: true, productos: ['2 × Café (Grande)'] },
        { id: '3', fecha: '2026-10-20', pedido: 'P-99', monto: 12, cobrar: false, anterior: true, productos: ['1 × Torta'] },
      ],
      consumosAnterioresPendiente: 12,
    });
    pagar.mockResolvedValue({});
    montar();
    expect(await screen.findByText('Consumos de períodos anteriores sin cobrar: S/ 12.00')).toBeInTheDocument();
    await abrir();
    await tab('Descuentos y créditos');
    expect(await screen.findByText('2 × Café (Grande)')).toBeInTheDocument();
    expect(screen.getByText(/Consumos de períodos anteriores sin cobrar · S\/ 12\.00/)).toBeInTheDocument();
    expect(screen.getByLabelText('Cobrar en este pago el consumo P-99')).not.toBeChecked();
    expect(screen.getByLabelText('Cobrar en este pago el consumo P-100')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Cobrar en este pago el consumo P-99'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), [], [], [], ['3']));
    fireEvent.click(screen.getByLabelText('Confirmo pagar sin descontar los créditos anteriores'));
    await tab('Pago');
    pagarOk();
    await waitFor(() => expect(pagar).toHaveBeenCalledWith(7, expect.any(String), [], [], [], ['3'], { sinDescontarAnteriores: true }));
  });
});
