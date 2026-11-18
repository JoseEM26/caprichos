import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientesAdminView } from '../ClientesAdminView';
import * as clientesApi from '../clientesApi';

vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol: 'ADMIN' } }),
}));
const sorteoMock = vi.fn();
vi.mock('../sorteos/SorteoEnVivo', () => ({
  SorteoEnVivo: (p: any) => {
    sorteoMock(p);
    return <div role="dialog" aria-label="Sorteo">{p.filtrosTexto}</div>;
  },
}));

const cliente = (id: string, nombre: string) => ({
  id, nombre, tipo: 'Persona' as const, telefono: '999888777', correo: 'sin correo', cumpleanos: '—', pedidos: 1,
  consumo: 10, ultimaCompra: null, puntos: 0, creditoPersonal: false, envioFijo: null, descuentoEnvio: null,
  activo: true, verificado: true,
});

describe('Sorteo: filtros que cambian el conteo y viajan al servidor', () => {
  let participantes: MockInstance<typeof clientesApi.listarParticipantesSorteo>;

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(clientesApi, 'listarClientes').mockResolvedValue({
      items: [cliente('1', 'Ana Pérez')], total: 1, pagina: 1, paginas: 1,
    });
    participantes = vi.spyOn(clientesApi, 'listarParticipantesSorteo').mockResolvedValue({
      total: 1, participantes: [{ id: '1', nombre: 'Ana P.', detalle: '···777' }],
    });
    vi.spyOn(clientesApi, 'registrarSorteoRealizado').mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it('elegir «Solo registrados» recarga los participantes con alcance=registrados y muestra el nuevo conteo', async () => {
    participantes.mockResolvedValueOnce({ total: 1, participantes: [] }).mockResolvedValueOnce({ total: 4, participantes: [] });
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    await waitFor(() => expect(participantes).toHaveBeenCalledTimes(1)); // conteo inicial, antes de cambiar el filtro
    fireEvent.click(screen.getByRole('radio', { name: 'Solo registrados' }));
    await waitFor(() => expect(participantes).toHaveBeenCalledWith(expect.objectContaining({ alcance: 'registrados' })));
    const linea = () => screen.getByText(/Solo clientes con cuenta de cliente/).closest('p');
    await waitFor(() => expect(linea()).toHaveTextContent('Participan 4 con este filtro.'));
  });

  it('con 0 participantes el botón queda deshabilitado y dice «Con este filtro no hay participantes»', async () => {
    participantes.mockResolvedValue({ total: 0, participantes: [] });
    render(<ClientesAdminView />);
    await waitFor(() => expect(screen.getAllByText('Con este filtro no hay participantes.').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: /Sorteo en vivo/ })).toBeDisabled();
  });

  it('«Solo de hoy» viaja como alcance=hoy también en la lista, y aparece como filtro activo', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('radio', { name: 'Solo de hoy' }));
    await waitFor(() => expect(clientesApi.listarClientes).toHaveBeenLastCalledWith(expect.objectContaining({ alcance: 'hoy' })));
    expect(participantes).toHaveBeenLastCalledWith(expect.objectContaining({ alcance: 'hoy' }));
  });

  it('al terminar una ronda se audita con el filtro que se usó y los ganadores ya enmascarados', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => screen.getByText('Ana Pérez'));
    fireEvent.click(screen.getByRole('radio', { name: 'Solo registrados' }));
    await waitFor(() => expect(participantes).toHaveBeenCalledWith(expect.objectContaining({ alcance: 'registrados' })));
    await waitFor(() => expect(screen.getByRole('button', { name: /Sorteo en vivo/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Sorteo en vivo/ }));
    await waitFor(() => expect(sorteoMock).toHaveBeenCalled());
    sorteoMock.mock.calls.at(-1)![0].alGanar([{ id: '1', nombre: 'Ana P.', detalle: '···777' }], 'ruleta');
    expect(clientesApi.registrarSorteoRealizado).toHaveBeenCalledWith(
      expect.objectContaining({ alcance: 'registrados' }),
      { juego: 'ruleta', participantes: 1, ganadores: ['Ana P. ···777'] },
    );
  });
});
