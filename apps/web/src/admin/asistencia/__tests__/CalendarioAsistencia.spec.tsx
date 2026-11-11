import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calendario = vi.fn();
const filasApi = vi.fn();
vi.mock('../calendarioApi', async (orig) => ({
  ...(await orig<any>()),
  calendario: (...a: any[]) => calendario(...a),
  calendarioFilas: (...a: any[]) => filasApi(...a),
}));
const lote = vi.fn();
const crono = vi.fn();
vi.mock('../correccionesApi', async (orig) => ({
  ...(await orig<any>()),
  loteCorrecciones: (...a: any[]) => lote(...a),
  cronograma: (...a: any[]) => crono(...a),
  contadorSolicitudes: vi.fn(async () => ({ pendientes: 3 })),
}));
const detallePago = vi.fn();
vi.mock('../planillaApi', async (orig) => ({ ...(await orig<any>()), detallePlanilla: (...a: any[]) => detallePago(...a) }));
const reporteHoy = vi.fn();
const reiniciar = vi.fn();
vi.mock('../asistenciaApi', async (orig) => ({
  ...(await orig<any>()),
  reporteHoy: (...a: any[]) => reporteHoy(...a),
  reiniciarCelular: (...a: any[]) => reiniciar(...a),
  obtenerConfigAsistencia: vi.fn(async () => ({ radioM: 10, toleranciaMin: 10, retencionDias: 90, precisionMaxM: 25, localLat: -12, localLng: -77 })),
}));
vi.mock('../../../comun/mapa/MapaUbicacion', () => ({ MapaUbicacion: () => null }));
vi.mock('../../../comun/mapa/BuscadorDireccion', () => ({ BuscadorDireccion: () => null }));

import { AsistenciaAdminView } from '../AsistenciaAdminView';
import { jornadaActual } from '../jornada';

const HOY = jornadaActual();
const mkFila = (o: any) => ({
  fecha: HOY, partyId: '1', nombre: 'Ana Pérez', rol: 'MOZO', turno: { entrada: '13:30', salida: '22:30' },
  marcas: [{ id: 11, tipo: 'ENTRADA', hora: '13:28', origen: 'CELULAR', estado: 'A_REVISAR', tieneSelfie: false }, { id: 12, tipo: 'ALMUERZO_SALIDA', hora: '17:00', origen: 'CELULAR', estado: 'VALIDA', tieneSelfie: false }],
  entrada: '13:28', salida: null, almuerzoSalida: '17:00', almuerzoVuelta: '17:40', almuerzoMin: 40, trabajadaMin: 480, tardanzaMin: 0, salioAntesMin: 0, extraMin: 0,
  estado: 'CUMPLIO', solicitudes: [{ id: 5, tipo: 'CORRECCION', estado: 'PENDIENTE' }], inconsistencias: [], ...o,
});
const registro = (filas: any[]) => ({ total: filas.length, pagina: 1, limite: filas.length, filas, totales: { trabajadaMin: 0, tardanzaMin: 0, extraMin: 0, faltas: 0 } });
const cronoDia = {
  jornada: HOY, estado: 'CUMPLIO', turno: { entrada: 810, salida: 1350, almuerzoIni: null, almuerzoFin: null }, alertas: [], trabajadaMin: 480, tardanzaMin: 0, breakMin: 40, tramos: [],
  marcas: [{ id: 11, minutos: 808, hora: '13:28', momento: null, origen: 'CELULAR', estado: 'A_REVISAR', rol: 'ENTRADA', duplicada: false, tieneSelfie: false, motivo: null, alertas: null }],
  solicitudes: [], cantidadesRaras: false, inconsistencia: null,
};

const abrir = (url = '/admin/asistencia?pestana=calendario') => render(<MemoryRouter initialEntries={[url]}><AsistenciaAdminView /></MemoryRouter>);

beforeEach(() => {
  [calendario, filasApi, lote, crono, reporteHoy, reiniciar, detallePago].forEach((f) => f.mockReset());
  calendario.mockResolvedValue({ desde: '', hasta: '', dias: [{ fecha: HOY, feriado: null, programadas: 2, presentes: 1, tardanzas: 0, faltas: 1, aRevisar: 1, solicitudesPendientes: 1, inconsistencias: 0 }] });
  filasApi.mockResolvedValue(registro([mkFila({}), mkFila({ partyId: '2', nombre: 'Luis Gómez', rol: 'CAJERO', solicitudes: [], marcas: [], estado: 'FALTA', entrada: null, almuerzoSalida: null, almuerzoVuelta: null, almuerzoMin: null, trabajadaMin: 0 })]));
  crono.mockResolvedValue({ desde: HOY, hasta: HOY, dias: [HOY], resumen: {}, personas: [{ partyId: 1, nombre: 'Ana Pérez', roles: ['MOZO'], dias: [cronoDia] }] });
  lote.mockResolvedValue({ total: 2, ok: 2, fallidas: 0, resultados: [] });
  reporteHoy.mockResolvedValue({ jornada: HOY, filas: [{ partyId: 1, nombre: 'Ana Pérez', turno: null, estado: 'CUMPLIO', alertas: [], entrada: '13:28', salida: null, trabajadaMin: 60, tardanzaMin: 0, almuerzoSalida: '17:00', almuerzoVuelta: '17:40', almuerzoMin: 40 }] });
});

describe('Estructura de pestañas', () => {
  it('muestra Hoy, Calendario, Planilla y Configuración (con el contador de solicitudes) y sin las viejas', async () => {
    abrir('/admin/asistencia');
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/ \(\d+\)/, ''))).toEqual(['Hoy', 'Calendario', 'Planilla', 'Configuración']);
    expect(await screen.findByRole('tab', { name: 'Calendario (3)' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Cronograma|Marcas|Mensual|Feriados|Pantalla/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Calendario (3)' }));
    expect(screen.getByRole('tab', { name: 'Calendario (3)', selected: true })).toBeInTheDocument();
  });

  it('un enlace viejo (?pestana=mes) abre el Calendario', async () => {
    abrir('/admin/asistencia?pestana=mes');
    expect(await screen.findByRole('tab', { name: /Calendario/, selected: true })).toBeInTheDocument();
  });
});

const abrirDia = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /1 presentes, 0 tardanzas, 1 faltas, 1 a revisar, 1 solicitudes pendientes/ }));
  return screen.findByRole('dialog', { name: /Movimientos del/ });
};

describe('Calendario: barra de controles legible', () => {
  it('los controles principales son botones de 44 px con texto de 14 px o más, agrupados: modo, rango, filtros', async () => {
    abrir();
    await screen.findByRole('button', { name: /1 presentes/ });
    const grupo = screen.getByRole('group', { name: 'Modo del calendario' });
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ver', 'Programar']);
    const rango = screen.getByRole('group', { name: 'Rango de días' });
    expect(within(rango).getAllByRole('button').map((b) => b.textContent)).toEqual(['1 día', '3 días', 'Semana', 'Mes', 'Rango personalizado', 'Ver movimientos']);
    // ningún botón de la barra usa el tamaño chico de 13 px
    for (const b of [...within(rango).getAllByRole('button'), screen.getByRole('button', { name: 'Filtros' }), screen.getByRole('button', { name: 'Mes anterior' })]) {
      expect(b.style.minHeight).toBe('44px');
      expect(parseInt(b.style.fontSize || '14', 10)).toBeGreaterThanOrEqual(14);
    }
  });
});

describe('Calendario: días y rangos', () => {
  const ult = () => filasApi.mock.calls.at(-1)![0];

  it('al entrar no abre nada; tocar un día abre el modal grande y pide ese día', async () => {
    abrir();
    await screen.findByRole('button', { name: /1 presentes/ });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(filasApi).not.toHaveBeenCalled();
    const dlg = await abrirDia();
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    await within(dlg).findByText('Ana Pérez');
    expect(ult()).toMatchObject({ desde: HOY, hasta: HOY });
  });

  it('3 días, Semana y Mes cambian el rango; «Ver movimientos» lo abre con una pestaña por día', async () => {
    abrir();
    await screen.findByRole('button', { name: /1 presentes/ });
    fireEvent.click(screen.getByRole('button', { name: '3 días' }));
    expect(screen.getByText(/· 3 días/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }));
    const dlg = await screen.findByRole('dialog', { name: /Movimientos del .* al / });
    await waitFor(() => expect(ult().hasta > ult().desde).toBe(true));
    // «Todo el rango» + 3 días
    expect(within(dlg).getAllByRole('tab')).toHaveLength(4);
    expect(within(dlg).getByRole('tab', { name: /Todo el rango/, selected: true })).toBeInTheDocument();
    fireEvent.click(within(dlg).getAllByRole('button', { name: 'Cerrar' }).at(-1)!);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(screen.getByText(/· 7 días/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getByText(/· (28|29|30|31) días/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1 día' }));
    expect(screen.getByText(/· 1 día$/)).toBeInTheDocument();
  });

  it('el día del calendario trae su resumen accesible y se puede elegir', async () => {
    abrir();
    const celda = await screen.findByRole('button', { name: /1 presentes, 0 tardanzas, 1 faltas, 1 a revisar, 1 solicitudes pendientes/ });
    expect(celda).toHaveAttribute('aria-pressed', 'true');
    const otro = screen.getAllByRole('button', { name: /sin datos/ })[0];
    fireEvent.click(otro);
    await waitFor(() => expect(otro).toHaveAttribute('aria-pressed', 'true'));
  });

  it('un rango personalizado de más de 62 días avisa y no pide al servidor', async () => {
    abrir();
    await screen.findByRole('button', { name: /1 presentes/ });
    fireEvent.click(screen.getByRole('button', { name: 'Rango personalizado' }));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2099-01-01' } });
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('1 a 62 días');
    expect(screen.getByRole('button', { name: 'Ver movimientos' })).toBeDisabled();
    expect(filasApi).not.toHaveBeenCalled();
  });
});

describe('Modal del día: movimientos de todos', () => {
  it('resumen del día, todas las columnas y totales; Esc cierra', async () => {
    abrir();
    const dlg = await abrirDia();
    const resumen = await within(dlg).findByRole('list', { name: 'Resumen' });
    expect(resumen).toHaveTextContent('1 Presentes');
    expect(resumen).toHaveTextContent('1 Faltas');
    expect(resumen).toHaveTextContent('1 A revisar');
    expect(resumen).toHaveTextContent('1 Solicitudes pendientes');
    const tabla = await within(dlg).findByRole('table');
    for (const c of ['Persona', 'Turno', 'Entrada', 'Sal. almorzar', 'Vuelta', 'Salida', 'Trabajado', 'Tardanza', 'Extra', 'Estado', 'Marcas']) {
      expect(within(tabla).getByRole('columnheader', { name: c })).toBeInTheDocument();
    }
    expect(within(tabla).getByText('17:40')).toBeInTheDocument();
    expect(within(tabla).getByText('Entrada 13:28')).toBeInTheDocument();
    expect(within(dlg).getByRole('status', { name: 'Totales del rango' })).toHaveTextContent('Faltas 1');
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra el feriado del día', async () => {
    calendario.mockResolvedValue({ desde: '', hasta: '', dias: [{ fecha: HOY, feriado: 'Día de prueba', programadas: 2, presentes: 1, tardanzas: 0, faltas: 1, aRevisar: 1, solicitudesPendientes: 1, inconsistencias: 0 }] });
    abrir();
    const dlg = await abrirDia();
    expect(within(dlg).getByText('Feriado: Día de prueba')).toBeInTheDocument();
  });

  it('buscar sin tildes y los filtros rápidos por estado recortan la lista', async () => {
    abrir();
    const dlg = await abrirDia();
    await within(dlg).findByText('Luis Gómez');
    fireEvent.change(within(dlg).getByLabelText('Buscar persona'), { target: { value: 'gomez' } });
    expect(within(dlg).queryByText('Ana Pérez')).toBeNull();
    expect(within(dlg).getByText('Luis Gómez')).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText('Buscar persona'), { target: { value: '' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Faltas 1' }));
    expect(within(dlg).getByRole('button', { name: 'Faltas 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dlg).queryByText('Ana Pérez')).toBeNull();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Con solicitud 1' }));
    expect(within(dlg).queryByText('Luis Gómez')).toBeNull();
    expect(within(dlg).getByText('Ana Pérez')).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Todos' }));
    expect(within(dlg).getByText('Luis Gómez')).toBeInTheDocument();
  });

  it('los filtros de la página (rol, estado, persona) también aplican a lo que muestra el modal', async () => {
    abrir();
    await screen.findByRole('button', { name: /1 presentes/ });
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.change(screen.getByLabelText('Persona'), { target: { value: 'gomez' } });
    expect(screen.getByRole('button', { name: 'Quitar filtro Persona: gomez' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByText('Luis Gómez');
    expect(within(dlg).queryByText('Ana Pérez')).toBeNull();
  });

  it('un rango de varios días trae «Todo el rango» y una pestaña por día', async () => {
    abrir();
    await screen.findByRole('button', { name: /1 presentes/ });
    fireEvent.click(screen.getByRole('button', { name: '3 días' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByText('Ana Pérez');
    const tabs = within(dlg).getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    fireEvent.click(tabs[1]);
    expect(within(dlg).getByRole('tab', { selected: true })).toBe(tabs[1]);
  });
});

describe('Calendario: detalle de la persona y lote', () => {
  it('«Ver detalle» cambia el MISMO modal al detalle de la persona (una sola ventana) con «← Volver al día»', async () => {
    abrir();
    const dia = await abrirDia();
    fireEvent.click(await within(dia).findByRole('button', { name: `Detalle de Ana Pérez del ${HOY}` }));
    const det = await screen.findByRole('dialog', { name: /Ana Pérez ·/ });
    expect(det).toBe(dia); // el mismo elemento: nunca dos modales
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(det).getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual(['Resumen', 'Marcas', 'Solicitudes', 'Pago del período']);
    expect(within(det).getByText('Salida a almorzar')).toBeInTheDocument();
    // Marcas: tarjetas ordenadas, con tipo y estado, y corrección manual
    fireEvent.click(within(det).getByRole('tab', { name: /Marcas/ }));
    const tarjeta = await within(det).findByRole('listitem', { name: 'Marca de las 13:28' });
    expect(within(tarjeta).getByText('Entrada')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Por revisar')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Sin selfie')).toBeInTheDocument();
    expect(within(det).getByText('Agregar una marca que falta (corrección manual)')).toBeInTheDocument();
    // «Acciones» muestra aprobar/anular/reasignar
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Acciones de la marca de las 13:28' }));
    const reg = within(det).getByRole('region', { name: /Detalle de la marca de las 13:28/ });
    expect(within(reg).getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
    expect(within(reg).getByRole('button', { name: 'Anular' })).toBeInTheDocument();
    expect(within(reg).getByRole('button', { name: 'Reasignar' })).toBeInTheDocument();
    // flechas entre pestañas
    const tab = within(det).getByRole('tab', { name: /Marcas/ });
    tab.focus();
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(within(det).getByRole('tab', { name: /Solicitudes/, selected: true })).toBeInTheDocument();
    // Volver al día: la lista vuelve y el foco regresa al «Ver detalle» de esa persona
    fireEvent.click(within(det).getByRole('button', { name: '← Volver al día' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: /Movimientos del/ })).toBeInTheDocument();
    expect(document.activeElement).toBe(within(screen.getByRole('dialog')).getByRole('button', { name: `Detalle de Ana Pérez del ${HOY}` }));
  });

  it('«Pago del período» trae lo ganado y descontado de esa persona desde su planilla', async () => {
    detallePago.mockResolvedValue({
      estado: 'ABIERTO', periodo: { desde: '2099-01-01', hasta: '2099-01-07' }, consumosAnterioresPendiente: 12,
      resultado: { ganado: 300, adicional: 20, penalidadTardanza: 5, consumosCobrados: 40, descuentos: 30, adelantos: 50, neto: 195 },
    });
    abrir();
    const dia = await abrirDia();
    fireEvent.click(await within(dia).findByRole('button', { name: `Detalle de Ana Pérez del ${HOY}` }));
    const det = await screen.findByRole('dialog', { name: /Ana Pérez ·/ });
    fireEvent.click(within(det).getByRole('tab', { name: 'Pago del período' }));
    expect(await within(det).findByText('S/ 195.00')).toBeInTheDocument();
    expect(detallePago).toHaveBeenCalledWith(1, HOY, []);
    expect(within(det).getByText('− S/ 40.00')).toBeInTheDocument();
    expect(within(det).getByText(/Consumos de períodos anteriores sin cobrar: S\/ 12\.00/)).toBeInTheDocument();
  });

  it('Esc en el detalle vuelve al día (conservando la búsqueda y el filtro); Esc en el día cierra el modal', async () => {
    abrir();
    const dia = await abrirDia();
    fireEvent.change(within(dia).getByLabelText('Buscar persona'), { target: { value: 'ana' } });
    fireEvent.click(within(dia).getByRole('button', { name: /Con solicitud/ }));
    fireEvent.click(await within(dia).findByRole('button', { name: `Detalle de Ana Pérez del ${HOY}` }));
    const det = await screen.findByRole('dialog', { name: /Ana Pérez ·/ });
    fireEvent.keyDown(det, { key: 'Escape' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const vuelta = screen.getByRole('dialog', { name: /Movimientos del/ });
    expect(within(vuelta).getByLabelText('Buscar persona')).toHaveValue('ana');
    expect(within(vuelta).getByRole('button', { name: /Con solicitud/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(vuelta, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('en un rango, «← Volver al día» regresa a la pestaña del día en la que estaba', async () => {
    abrir();
    await screen.findByRole('button', { name: /1 presentes/ });
    fireEvent.click(screen.getByRole('button', { name: '3 días' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByText('Ana Pérez');
    const tabs = within(dlg).getAllByRole('tab');
    fireEvent.click(tabs[1]);
    const nombre = tabs[1].textContent;
    fireEvent.click(await within(dlg).findByRole('button', { name: /Detalle de Ana Pérez/ }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(within(dlg).getByRole('button', { name: '← Volver al día' }));
    expect(within(dlg).getByRole('tab', { selected: true }).textContent).toBe(nombre);
  });

  it('aprobación en lote: elige la fila, confirma «Sí» y manda solicitudes y marcas por revisar', async () => {
    abrir();
    const dlg = await abrirDia();
    fireEvent.click(await within(dlg).findByLabelText(`Elegir Ana Pérez del ${HOY}`));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Aprobar seleccionadas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(lote).toHaveBeenCalledWith({ accion: 'APROBAR', items: [{ tipo: 'SOLICITUD', id: 5 }, { tipo: 'MARCA', id: 11 }] }));
    expect(await screen.findByRole('dialog', { name: /Resultado: 2 de 2/ })).toBeInTheDocument();
  });

  it('rechazar exige un motivo de 10 caracteres', async () => {
    abrir();
    const dlg = await abrirDia();
    fireEvent.click(await within(dlg).findByLabelText(`Elegir Ana Pérez del ${HOY}`));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Rechazar/anular seleccionadas' }));
    const si = screen.getByRole('button', { name: 'Sí, rechazar' });
    expect(si).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Un solo motivo/), { target: { value: 'No coincide con la cámara' } });
    expect(si).toBeEnabled();
  });
});

describe('Calendario: modo Programar', () => {
  it('Ver | Programar: Programar muestra turnos y línea de tiempo (sin modal); un rango largo pide acotar', async () => {
    abrir();
    await screen.findByRole('button', { name: /1 presentes/ });
    fireEvent.click(screen.getByRole('button', { name: 'Programar' }));
    expect(await screen.findByRole('group', { name: 'Línea de tiempo de Ana Pérez' })).toBeInTheDocument();
    expect(crono).toHaveBeenCalledWith(HOY, HOY);
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(await screen.findByText('Rango muy largo para programar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Hoy: Reiniciar celular', () => {
  it('explica el botón, pide confirmación Sí/No y solo reinicia con «Sí»', async () => {
    reiniciar.mockResolvedValue({});
    abrir('/admin/asistencia');
    expect(await screen.findByText(/ligada al primer celular desde el que marca/)).toBeInTheDocument();
    const tabla = screen.getByRole('table');
    for (const c of ['Entrada', 'Salida a almorzar', 'Vuelta', 'Almuerzo (min)', 'Salida']) expect(within(tabla).getByRole('columnheader', { name: c })).toBeInTheDocument();
    expect(within(tabla).getByText('17:40')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar celular de Ana Pérez' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(reiniciar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar celular de Ana Pérez' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sí, reiniciar' })); });
    expect(reiniciar).toHaveBeenCalledWith(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Celular de Ana Pérez reiniciado');
  });
});
