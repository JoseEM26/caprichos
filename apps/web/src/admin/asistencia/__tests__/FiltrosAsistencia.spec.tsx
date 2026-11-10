import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bandeja = vi.fn();
const lote = vi.fn();
const crono = vi.fn();
vi.mock('../correccionesApi', async (orig) => ({
  ...(await orig<any>()),
  bandejaCorrecciones: (...a: any[]) => bandeja(...a),
  loteCorrecciones: (...a: any[]) => lote(...a),
  cronograma: (...a: any[]) => crono(...a),
  contadorSolicitudes: vi.fn(async () => ({ pendientes: 0 })),
}));
const listar = vi.fn();
const feriados = vi.fn();
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarPlanilla: (...a: any[]) => listar(...a),
  listarFeriados: (...a: any[]) => feriados(...a),
}));
const reporteMes = vi.fn();
const reporteHoy = vi.fn();
const marcas = vi.fn();
vi.mock('../asistenciaApi', async (orig) => ({
  ...(await orig<any>()),
  reporteMes: (...a: any[]) => reporteMes(...a),
  reporteHoy: (...a: any[]) => reporteHoy(...a),
  listarMarcas: (...a: any[]) => marcas(...a),
  obtenerConfigAsistencia: vi.fn(async () => ({ radioM: 10, toleranciaMin: 10, retencionDias: 90, precisionMaxM: 25, localLat: -12, localLng: -77 })),
}));
vi.mock('../../../comun/mapa/MapaUbicacion', () => ({ MapaUbicacion: () => null }));
vi.mock('../../../comun/mapa/BuscadorDireccion', () => ({ BuscadorDireccion: () => null }));

import { AsistenciaAdminView } from '../AsistenciaAdminView';
import { CronogramaTab } from '../CronogramaTab';
import { FeriadosTab } from '../FeriadosTab';
import { PlanillaTab } from '../PlanillaTab';
import { SolicitudesTab } from '../SolicitudesTab';
import { coincide, normalizarBusqueda } from '../buscar';
import { jornadaActual } from '../jornada';

const ninguno = () => undefined;
/** Promesa que se resuelve a mano, para ordenar las respuestas. */
const diferida = <T,>() => {
  let ok!: (v: T) => void;
  const p = new Promise<T>((r) => { ok = r; });
  return { p, ok };
};

beforeEach(() => {
  [bandeja, lote, crono, listar, feriados, reporteMes, reporteHoy, marcas].forEach((f) => f.mockReset());
  reporteHoy.mockResolvedValue({ jornada: '2026-11-06', filas: [] });
  reporteMes.mockResolvedValue({ dias: [], filas: [], personas: [] });
  marcas.mockResolvedValue([]);
});

describe('jornadaActual (cierra a las 04:00 Lima, igual que el servidor)', () => {
  it('00:30 y 03:59 Lima siguen en la jornada anterior; 04:00 ya es la nueva', () => {
    expect(jornadaActual(Date.parse('2026-11-10T05:30:00Z'))).toBe('2026-11-09'); // 00:30 Lima
    expect(jornadaActual(Date.parse('2026-11-10T08:59:00Z'))).toBe('2026-11-09'); // 03:59 Lima
    expect(jornadaActual(Date.parse('2026-11-10T09:00:00Z'))).toBe('2026-11-10'); // 04:00 Lima
    expect(jornadaActual(Date.parse('2026-11-10T04:59:00Z'))).toBe('2026-11-09'); // 23:59 Lima del 9: aún del 9
  });
  it('a las 01:00 Lima de un lunes la planilla no abre el período nuevo', () => {
    expect(jornadaActual(Date.parse('2026-11-09T06:00:00Z'))).toBe('2026-11-08'); // lunes 01:00 Lima → domingo
  });
});

describe('búsqueda normalizada', () => {
  it('ignora tildes, mayúsculas y espacios de más', () => {
    expect(normalizarBusqueda('  JOSÉ   Pérez ')).toBe('jose perez');
    expect(coincide('Ñusta Pérez', 'perez')).toBe(true);
    expect(coincide('José  Pérez', ' jose perez')).toBe(true);
    expect(coincide('Ana', 'luis')).toBe(false);
    expect(coincide('Ana', '   ')).toBe(true);
  });
  it('HoyTab encuentra «José» escribiendo «jose»', async () => {
    reporteHoy.mockResolvedValue({
      jornada: '2026-11-06',
      filas: [
        { partyId: 1, nombre: 'José Pérez', turno: null, estado: 'CUMPLIO', alertas: [], entrada: null, salida: null, trabajadaMin: 0, tardanzaMin: 0 },
        { partyId: 2, nombre: 'Luis Ruiz', turno: null, estado: 'CUMPLIO', alertas: [], entrada: null, salida: null, trabajadaMin: 0, tardanzaMin: 0 },
      ],
    });
    render(<MemoryRouter><AsistenciaAdminView /></MemoryRouter>);
    await screen.findByText('José Pérez');
    fireEvent.change(screen.getByLabelText('Buscar persona'), { target: { value: ' JOSE  perez' } });
    expect(screen.queryByText('Luis Ruiz')).toBeNull();
    expect(screen.getByText('José Pérez')).toBeInTheDocument();
  });
});

describe('Bandeja: el lote solo actúa sobre lo visible', () => {
  const marca = (id: number, partyId: number, nombre: string, rol: string) => ({
    id, partyId, nombre, roles: [rol], jornada: '2026-11-06', hora: '09:00', rol: 'ENTRADA', origen: 'WEB', estado: 'A_REVISAR', alertas: null, tieneSelfie: false, clase: 'WEB', cantidadesRaras: false,
  });
  const dato = (ms: any[]) => ({ solicitudes: [], marcas: ms, sinSolicitud: [] });

  it('seleccionas las de Ana, filtras a Luis: no se aprueban las de Ana', async () => {
    bandeja.mockResolvedValue(dato([marca(1, 8, 'Ana Ruiz', 'COCINA'), marca(2, 8, 'Ana Ruiz', 'COCINA'), marca(3, 7, 'Luis Pérez', 'MOZO')]));
    lote.mockResolvedValue({ total: 1, ok: 1, fallidas: 0, resultados: [{ tipo: 'MARCA', id: 3, ok: true }] });
    render(<SolicitudesTab onError={ninguno} onOk={ninguno} />);
    await screen.findAllByText('Ana Ruiz', { selector: 'td' });
    fireEvent.click(screen.getAllByLabelText(/Elegir .* de Ana Ruiz/)[0]);
    fireEvent.click(screen.getAllByLabelText(/Elegir .* de Ana Ruiz/)[1]);
    expect(screen.getByRole('region', { name: 'Acciones en lote' })).toHaveTextContent('2 seleccionadas');

    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'MOZO' } });
    // Ana quedó oculta: el contador no la cuenta y el lote lo avisa
    const region = screen.getByRole('region', { name: 'Acciones en lote' });
    expect(region).toHaveTextContent('0 seleccionadas');
    expect(region).toHaveTextContent('2 más ocultas');
    expect(screen.getByRole('button', { name: 'Aprobar seleccionadas' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Elegir .* de Luis Pérez/));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar seleccionadas' }));
    expect(await screen.findByText(/1 ítem de Luis Pérez/)).toBeInTheDocument(); // el resumen coincide con lo enviado
    fireEvent.click(screen.getByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(lote).toHaveBeenCalledWith({ accion: 'APROBAR', items: [{ tipo: 'MARCA', id: 3 }] }));
  });

  it('si el rol filtrado desaparece al recargar, el filtro se limpia y el select vuelve a «Todos»', async () => {
    bandeja.mockResolvedValueOnce(dato([marca(1, 8, 'Ana Ruiz', 'COCINA'), marca(3, 7, 'Luis Pérez', 'MOZO')]));
    bandeja.mockResolvedValue(dato([marca(3, 7, 'Luis Pérez', 'MOZO')]));
    lote.mockResolvedValue({ total: 1, ok: 1, fallidas: 0, resultados: [{ tipo: 'MARCA', id: 1, ok: true }] });
    render(<SolicitudesTab onError={ninguno} onOk={ninguno} />);
    await screen.findByText('Ana Ruiz', { selector: 'td' });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'COCINA' } });
    fireEvent.click(screen.getByLabelText(/Elegir .* de Ana Ruiz/));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar seleccionadas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    // tras aprobar, COCINA ya no existe: el filtro no queda pegado y se ve a Luis
    expect(await screen.findByText('Luis Pérez', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByLabelText('Rol')).toHaveValue('');
  });
});

describe('Cronograma: respuestas tardías y filtros pegados', () => {
  const persona = (id: number, nombre: string, rol = 'MOZO') => ({ partyId: id, nombre, roles: [rol], dias: [] });
  const crn = (personas: any[]) => ({ desde: '', hasta: '', dias: [], resumen: {}, personas });

  it('la respuesta lenta del mes anterior no pisa la del mes nuevo', async () => {
    const lenta = diferida<any>();
    const rapida = diferida<any>();
    crono.mockResolvedValueOnce(crn([persona(1, 'Inicial')])).mockReturnValueOnce(lenta.p).mockReturnValueOnce(rapida.p);
    render(<CronogramaTab onError={ninguno} onOk={ninguno} />);
    await screen.findByRole('option', { name: 'Inicial' });
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await act(async () => { rapida.ok(crn([persona(2, 'Del mes nuevo')])); });
    await screen.findByRole('option', { name: 'Del mes nuevo' });
    await act(async () => { lenta.ok(crn([persona(3, 'Mes viejo')])); });
    expect(screen.queryByRole('option', { name: 'Mes viejo' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Del mes nuevo' })).toBeInTheDocument();
  });

  it('persona y rol elegidos que no existen en el mes nuevo se limpian', async () => {
    crono.mockResolvedValueOnce(crn([persona(1, 'Ana', 'COCINA'), persona(2, 'Luis', 'MOZO')])).mockResolvedValue(crn([persona(2, 'Luis', 'MOZO')]));
    render(<CronogramaTab onError={ninguno} onOk={ninguno} />);
    await screen.findByRole('option', { name: 'Ana' });
    fireEvent.change(screen.getByLabelText('Persona'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'COCINA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    await waitFor(() => expect(screen.getByLabelText('Persona')).toHaveValue(''));
    expect(screen.getByLabelText('Rol')).toHaveValue('');
  });
});

describe('Planilla y Feriados: respuestas tardías', () => {
  it('Planilla: la respuesta lenta de la fecha anterior no pisa la nueva', async () => {
    const fila = (nombre: string) => ({ partyId: 1, nombre, sueldo: null });
    const lenta = diferida<any>();
    const rapida = diferida<any>();
    listar.mockResolvedValueOnce({ fecha: 'x', filas: [fila('Inicial')] }).mockReturnValueOnce(lenta.p).mockReturnValueOnce(rapida.p);
    render(<PlanillaTab onError={ninguno} onOk={ninguno} />);
    await screen.findByText('Inicial');
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const f = screen.getByLabelText(/Día del período/);
    fireEvent.change(f, { target: { value: '2026-10-01' } });
    fireEvent.change(f, { target: { value: '2026-10-08' } });
    await act(async () => { rapida.ok({ fecha: 'x', filas: [fila('Nueva')] }); });
    await screen.findByText('Nueva');
    await act(async () => { lenta.ok({ fecha: 'x', filas: [fila('Vieja')] }); });
    expect(screen.queryByText('Vieja')).toBeNull();
    expect(screen.getByText('Nueva')).toBeInTheDocument();
  });

  it('Feriados: la respuesta lenta del año anterior no pisa la nueva', async () => {
    const fer = (nombre: string) => [{ id: 1, fecha: '2026-01-01', nombre, recargo: 2, activo: true }];
    const lenta = diferida<any>();
    const rapida = diferida<any>();
    feriados.mockResolvedValueOnce(fer('Inicial')).mockReturnValueOnce(lenta.p).mockReturnValueOnce(rapida.p);
    render(<FeriadosTab onError={ninguno} onOk={ninguno} />);
    await screen.findByText('Inicial');
    const sel = screen.getByLabelText('Año');
    const [a, b] = [...sel.querySelectorAll('option')].map((o) => o.value).slice(2);
    fireEvent.change(sel, { target: { value: a } });
    fireEvent.change(sel, { target: { value: b } });
    await act(async () => { rapida.ok(fer('Nuevo')); });
    await screen.findByText('Nuevo');
    await act(async () => { lenta.ok(fer('Viejo')); });
    expect(screen.queryByText('Viejo')).toBeNull();
  });
});

