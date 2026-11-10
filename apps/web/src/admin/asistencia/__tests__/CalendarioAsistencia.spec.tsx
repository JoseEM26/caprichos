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
  [calendario, filasApi, lote, crono, reporteHoy, reiniciar].forEach((f) => f.mockReset());
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

describe('Calendario: días y rangos', () => {
  const ult = () => filasApi.mock.calls.at(-1)![0];

  it('tocar un día pide ese día; 3 días, Semana y Mes cambian el rango', async () => {
    abrir();
    await screen.findByText('Ana Pérez');
    expect(ult()).toMatchObject({ desde: HOY, hasta: HOY });
    fireEvent.click(screen.getByRole('button', { name: '3 días' }));
    await waitFor(() => expect(ult().hasta > ult().desde).toBe(true));
    expect(ult().desde).toBe(HOY);
    expect(screen.getByText(/· 3 días/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    await waitFor(() => expect(screen.getByText(/· 7 días/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    await waitFor(() => expect(screen.getByText(/· (28|29|30|31) días/)).toBeInTheDocument());
    expect(ult().desde.endsWith('-01')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '1 día' }));
    await waitFor(() => expect(screen.getByText(/· 1 día$/)).toBeInTheDocument());
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
    await screen.findByText('Ana Pérez');
    fireEvent.click(screen.getByRole('button', { name: 'Rango personalizado' }));
    const n = filasApi.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2099-01-01' } });
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('1 a 62 días');
    expect(filasApi.mock.calls.length).toBe(n);
  });
});

describe('Calendario: registro y filtros', () => {
  it('muestra todas las columnas del registro y los totales', async () => {
    abrir();
    const tabla = await screen.findByRole('table');
    for (const c of ['Persona', 'Turno', 'Entrada', 'Sal. almorzar', 'Vuelta', 'Almuerzo (min)', 'Salida', 'Trabajado', 'Tardanza', 'Extra', 'Estado', 'Marcas']) {
      expect(within(tabla).getByRole('columnheader', { name: c })).toBeInTheDocument();
    }
    expect(within(tabla).getByText('17:40')).toBeInTheDocument();
    expect(within(tabla).getByText('Entrada 13:28')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Totales del rango' })).toHaveTextContent('Faltas 1');
  });

  it('los filtros están ocultos tras «Filtros»; buscar sin tildes crea un chip y «Limpiar» lo quita', async () => {
    abrir();
    await screen.findByText('Luis Gómez');
    expect(screen.queryByRole('region', { name: 'Filtros del registro' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.change(screen.getByLabelText('Persona'), { target: { value: 'gomez' } });
    expect(screen.queryByText('Ana Pérez')).toBeNull();
    expect(screen.getByText('Luis Gómez')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar filtro Persona: gomez' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpiar' })[0]);
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
  });

  it('filtra por estado, por «solo con solicitudes pendientes» y por rol', async () => {
    abrir();
    await screen.findByText('Luis Gómez');
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByLabelText('Falta'));
    expect(screen.queryByText('Ana Pérez')).toBeNull();
    fireEvent.click(screen.getByLabelText('Falta'));
    fireEvent.click(screen.getByLabelText('Solo con solicitudes pendientes'));
    expect(screen.queryByText('Luis Gómez')).toBeNull();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Solo con solicitudes pendientes'));
    fireEvent.click(screen.getByLabelText('Cajero/a'));
    expect(screen.queryByText('Ana Pérez')).toBeNull();
  });
});

describe('Calendario: detalle y lote', () => {
  it('«Detalle» abre el día de la persona con sus marcas y la corrección manual', async () => {
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: `Detalle de Ana Pérez del ${HOY}` }));
    const det = await screen.findByTestId('detalle-dia');
    expect(within(det).getByRole('list', { name: 'Marcas del día' })).toHaveTextContent('Salida a almorzar');
    expect(await within(det).findByRole('group', { name: 'Línea de tiempo de Ana Pérez' })).toBeInTheDocument();
    expect(within(det).getByText('Agregar una marca que falta (corrección manual)')).toBeInTheDocument();
    fireEvent.click(within(det).getByRole('button', { name: 'Cerrar detalle' }));
    expect(screen.queryByTestId('detalle-dia')).toBeNull();
  });

  it('aprobación en lote: elige la fila, confirma «Sí» y manda solicitudes y marcas por revisar', async () => {
    abrir();
    fireEvent.click(await screen.findByLabelText(`Elegir Ana Pérez del ${HOY}`));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar seleccionadas' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(lote).toHaveBeenCalledWith({ accion: 'APROBAR', items: [{ tipo: 'SOLICITUD', id: 5 }, { tipo: 'MARCA', id: 11 }] }));
    expect(await screen.findByRole('region', { name: 'Resultado del lote' })).toHaveTextContent('Resultado: 2 de 2');
  });

  it('rechazar exige un motivo de 10 caracteres', async () => {
    abrir();
    fireEvent.click(await screen.findByLabelText(`Elegir Ana Pérez del ${HOY}`));
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar/anular seleccionadas' }));
    const si = screen.getByRole('button', { name: 'Sí, rechazar' });
    expect(si).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Un solo motivo/), { target: { value: 'No coincide con la cámara' } });
    expect(si).toBeEnabled();
  });
});

describe('Calendario: modo Programar', () => {
  it('Ver | Programar: Programar muestra turnos y línea de tiempo; un rango largo pide acotar', async () => {
    abrir();
    await screen.findByText('Ana Pérez');
    fireEvent.click(screen.getByRole('button', { name: 'Programar' }));
    expect(await screen.findByRole('group', { name: 'Línea de tiempo de Ana Pérez' })).toBeInTheDocument();
    expect(crono).toHaveBeenCalledWith(HOY, HOY);
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(await screen.findByText('Rango muy largo para programar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});

describe('Hoy: Reiniciar celular', () => {
  it('explica el botón, pide confirmación Sí/No y solo reinicia con «Sí»', async () => {
    reiniciar.mockResolvedValue({});
    abrir('/admin/asistencia');
    expect(await screen.findByText(/borra el celular asociado a esta persona para que pueda marcar desde uno nuevo/)).toBeInTheDocument();
    const tabla = screen.getByRole('table');
    for (const c of ['Entrada', 'Salida a almorzar', 'Vuelta', 'Almuerzo (min)', 'Salida']) expect(within(tabla).getByRole('columnheader', { name: c })).toBeInTheDocument();
    expect(within(tabla).getByText('17:40')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar celular' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(reiniciar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar celular' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sí, reiniciar' })); });
    expect(reiniciar).toHaveBeenCalledWith(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Celular de Ana Pérez reiniciado');
  });
});
