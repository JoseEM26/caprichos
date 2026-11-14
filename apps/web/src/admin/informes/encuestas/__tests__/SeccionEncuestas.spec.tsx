import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../../comun/api';
import { SeccionEncuestas, RespuestaEncuestas } from '../SeccionEncuestas';

const respuesta = (over: Partial<RespuestaEncuestas> = {}): RespuestaEncuestas => ({
  rango: { desde: '2026-10-01', hasta: '2026-10-29' },
  resumen: { enviadas: 10, respondidas: 6, tasaRespuesta: 60, promedio: 3.5, satisfechos: 50, insatisfechos: 33.3 },
  distribucion: [
    { puntaje: 1, cantidad: 2 },
    { puntaje: 2, cantidad: 0 },
    { puntaje: 3, cantidad: 0 },
    { puntaje: 4, cantidad: 1 },
    { puntaje: 5, cantidad: 3 },
  ],
  tendencia: [
    { dia: '2026-10-28', promedio: 4, respondidas: 2 },
    { dia: '2026-10-29', promedio: null, respondidas: 0 },
  ],
  porModalidad: [{ modalidad: 'DELIVERY', promedio: 2.5, respondidas: 4 }],
  porMotivo: [
    { codigo: 'DEMORA', motivo: 'Demora', cantidad: 2 },
    { codigo: 'PRECIO', motivo: 'Precio', cantidad: 0 },
  ],
  items: [
    {
      id: '7',
      fecha: '2026-10-28T16:00:00.000Z',
      puntaje: 1,
      comentario: 'Llegó frío',
      motivo: 'Demora',
      pedidoCodigo: 'CP-7',
      clienteNombre: 'Ana',
      modalidad: 'DELIVERY',
      canal: 'WHATSAPP',
      quejaId: '99',
    },
    {
      id: '8',
      fecha: '2026-10-27T16:00:00.000Z',
      puntaje: 5,
      pedidoCodigo: 'CP-8',
      clienteNombre: 'Luis',
      modalidad: 'MESA',
      canal: 'CARTA',
      quejaId: null,
    },
  ],
  total: 6,
  pagina: 1,
  limite: 8,
  totalPaginas: 1,
  ...over,
});

function renderSeccion() {
  return render(
    <MemoryRouter>
      <SeccionEncuestas />
    </MemoryRouter>,
  );
}

describe('SeccionEncuestas', () => {
  let getSpy: any;

  beforeEach(() => {
    getSpy = vi.spyOn(api, 'get').mockResolvedValue(respuesta() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el resumen, la distribución accesible y la lista ordenada con enlace a reclamos', async () => {
    renderSeccion();

    expect(await screen.findByText('3.5')).toBeInTheDocument();
    expect(screen.getByText('60 %')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
    expect(screen.getByText('33.3 %')).toBeInTheDocument();

    const grafico = screen.getByRole('img', { name: /Distribución de puntajes/ });
    expect(grafico).toHaveAccessibleName(expect.stringContaining('5 estrellas: 3'));

    const lista = screen.getByRole('list', { name: /Lista de encuestas respondidas/ });
    const tarjetas = within(lista).getAllByRole('listitem');
    expect(tarjetas).toHaveLength(2);
    expect(within(tarjetas[0]).getByText('Ana')).toBeInTheDocument();
    expect(within(tarjetas[0]).getByText(/Pedido CP-7/)).toBeInTheDocument();
    expect(within(tarjetas[0]).getByText(/Llegó frío/)).toBeInTheDocument();
    expect(within(tarjetas[0]).getByRole('link', { name: /Derivó en queja/ })).toHaveAttribute('href', '/admin/reclamos');
    expect(within(tarjetas[0]).getByText('Demora')).toBeInTheDocument();
    expect(within(tarjetas[1]).queryByText(/Motivo:/)).toBeNull();
    const motivos = screen.getByRole('list', { name: /Motivos de calificación baja/ });
    expect(within(motivos).getByText('Demora').nextSibling).toHaveTextContent('2');
    expect(within(tarjetas[1]).queryByRole('link')).toBeNull();
  });

  it('envía el filtro de puntaje y vuelve a la primera página', async () => {
    renderSeccion();
    await screen.findByText('3.5');

    fireEvent.click(screen.getByRole('button', { name: '1 estrella' }));

    await waitFor(() => {
      const ultima = getSpy.mock.calls.at(-1)?.[0] as string;
      expect(ultima).toContain('puntaje=1');
      expect(ultima).toContain('pagina=1');
    });
  });

  it('muestra el estado vacío cuando no hay encuestas con el filtro', async () => {
    getSpy.mockResolvedValue(respuesta({ items: [], total: 0, totalPaginas: 0, resumen: { enviadas: 0, respondidas: 0, tasaRespuesta: null, promedio: null, satisfechos: null, insatisfechos: null } }) as any);
    renderSeccion();

    expect(await screen.findByText('Sin encuestas en este filtro')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('pagina pidiendo la página siguiente', async () => {
    getSpy.mockResolvedValue(respuesta({ total: 20, totalPaginas: 3 }) as any);
    renderSeccion();
    await screen.findByText('3.5');

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));

    await waitFor(() => {
      expect(getSpy.mock.calls.at(-1)?.[0]).toContain('pagina=2');
    });
  });

  it('muestra error con Reintentar y vuelve a consultar', async () => {
    getSpy.mockRejectedValueOnce(new Error('caída'));
    renderSeccion();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    const antes = getSpy.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => expect(getSpy.mock.calls.length).toBeGreaterThan(antes));
    expect(await screen.findByText('3.5')).toBeInTheDocument();
  });
});
