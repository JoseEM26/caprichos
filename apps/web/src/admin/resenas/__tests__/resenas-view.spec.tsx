import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ResenasView } from '../ResenasView';

const estado = (o: Record<string, any> = {}) => ({
  negocio: { businessId: 'biz-1', nombre: 'Caprichos Campoy' },
  claveConfigurada: true,
  resumen: { rating: 4.8, total: 778 },
  ultimaActualizacion: null,
  cargaInicialHecha: true,
  consumo: 12,
  tope: 40,
  guardadas: 3,
  visibles: 2,
  ocultas: 1,
  actualizarAhora: { disponible: true, motivo: null },
  autoActiva: false,
  ...o,
});

const resena = (id: string, extra: Record<string, any> = {}) => ({
  id,
  autor: `Autor ${id}`,
  foto: null,
  estrellas: 5,
  texto: `Texto de la reseña ${id}, muy buen café y atención amable.`,
  fecha: '2026-10-01T12:00:00.000Z',
  enlace: `https://maps.google.com/?r=${id}`,
  visible: true,
  ...extra,
});

function montar(datos: any) {
  vi.spyOn(api, 'get').mockResolvedValue(datos);
  return render(
    <MemoryRouter>
      <ResenasView />
    </MemoryRouter>,
  );
}

/** Tarjetas del módulo (cada una es un article de la cuadrícula). */
const tarjetas = () => Array.from(document.querySelectorAll('article'));

describe('ResenasView (módulo Reseñas de Google)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: () => true } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('quien no tiene resenas/ver no ve la lista y no pide datos', () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'CAJERO' }, tiene: () => false } as any);
    const get = vi.spyOn(api, 'get');
    render(
      <MemoryRouter>
        <ResenasView />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('resenas-no-admin')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('muestra el resumen con contadores y una tarjeta por reseña con el diseño de la carta', async () => {
    montar({ estado: estado(), resenas: [resena('a'), resena('b', { visible: false })] });
    expect(await screen.findByText('4.8 en Google · 778 reseñas')).toBeInTheDocument();
    expect(screen.getByText('Guardadas: 3')).toBeInTheDocument();
    expect(screen.getByText('Visibles: 2')).toBeInTheDocument();
    expect(screen.getByText('Ocultas: 1')).toBeInTheDocument();
    expect(tarjetas()).toHaveLength(2);
    expect(screen.getAllByText('Octubre de 2026 · Reseña de Google')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Ver en Google Maps' })).toHaveLength(2);
  });

  it('marca como Oculta y atenúa solo las ocultas', async () => {
    montar({ estado: estado(), resenas: [resena('a'), resena('b', { visible: false })] });
    await screen.findByRole('button', { name: 'Ocultar reseña de Autor a' });
    const ocultaA = tarjetas()[0];
    const ocultaB = tarjetas()[1];
    expect(ocultaA.style.opacity).toBe('');
    expect(ocultaB.style.opacity).toBe('0.6');
    expect(within(ocultaB).getByText('Oculta')).toBeInTheDocument();
    expect(within(ocultaA).queryByText('Oculta')).not.toBeInTheDocument();
  });

  it('filtra por buscador (autor o texto), estrellas y estado', async () => {
    montar({
      estado: estado({ guardadas: 3, visibles: 2, ocultas: 1 }),
      resenas: [
        resena('ana', { autor: 'Ana Quispe', estrellas: 5 }),
        resena('luis', { autor: 'Luis Ruiz', estrellas: 4, texto: 'Pizza excelente y rápida' }),
        resena('rosa', { autor: 'Rosa Vela', estrellas: 5, visible: false }),
      ],
    });
    await screen.findByText('Ana Quispe');
    expect(tarjetas()).toHaveLength(3);

    fireEvent.change(screen.getByPlaceholderText('Buscar por autor o texto'), { target: { value: 'pizza' } });
    expect(tarjetas()).toHaveLength(1);
    expect(screen.getByText('Luis Ruiz')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por autor o texto'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Estrellas: Todas' }));
    fireEvent.click(screen.getByRole('option', { name: /4 estrellas/ }));
    expect(tarjetas()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Estrellas: 4 estrellas' }));
    fireEvent.click(screen.getByRole('option', { name: /Todas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Estado: Todas' }));
    fireEvent.click(screen.getByRole('option', { name: /Ocultas/ }));
    expect(tarjetas()).toHaveLength(1);
    expect(screen.getByText('Rosa Vela')).toBeInTheDocument();
  });

  it('ordena por más recientes o más antiguas', async () => {
    montar({
      estado: estado({ guardadas: 2, visibles: 2, ocultas: 0 }),
      resenas: [resena('viejo', { autor: 'Viejo', fecha: '2025-01-05T12:00:00.000Z' }), resena('nuevo', { autor: 'Nuevo', fecha: '2026-09-05T12:00:00.000Z' })],
    });
    await screen.findByText('Viejo');
    expect(tarjetas()[0]).toHaveTextContent('Nuevo');
    fireEvent.click(screen.getByRole('button', { name: 'Orden: Más recientes' }));
    fireEvent.click(screen.getByRole('option', { name: 'Más antiguas' }));
    expect(tarjetas()[0]).toHaveTextContent('Viejo');
  });

  it('ocultar una reseña pide Confirmar; No no llama a la API; Sí hace PATCH con visible false', async () => {
    montar({ estado: estado(), resenas: [resena('7')] });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ visible: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar reseña de Autor 7' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /No, cancelar/ }));
    expect(patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar reseña de Autor 7' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/admin/resenas/7', { visible: false }));
    expect(await screen.findByText('Reseña oculta de la carta.')).toBeInTheDocument();
  });

  it('selección múltiple: casillas, ocultar varias con Confirmar y un solo PATCH en lote', async () => {
    montar({ estado: estado({ guardadas: 3, visibles: 3, ocultas: 0 }), resenas: [resena('1'), resena('2'), resena('3')] });
    await screen.findByText('Autor 1');
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ cambiadas: 2, visible: false });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar reseña de Autor 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar reseña de Autor 3' }));
    expect(screen.getByText('2 seleccionadas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar seleccionadas' }));
    expect(patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /No, cancelar/ }));
    expect(patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar seleccionadas' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/admin/resenas/visibilidad', { ids: ['1', '3'], visible: false }));
    expect(await screen.findByText('2 reseñas dejan de verse en la carta.')).toBeInTheDocument();
  });

  it('mostrar seleccionadas usa visible true y «Elegir esta página» marca las de la página', async () => {
    montar({ estado: estado({ guardadas: 2, visibles: 0, ocultas: 2 }), resenas: [resena('1', { visible: false }), resena('2', { visible: false })] });
    await screen.findByText('Autor 1');
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ cambiadas: 2, visible: true });
    fireEvent.click(screen.getByRole('button', { name: 'Elegir esta página' }));
    expect(screen.getByText('2 seleccionadas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar seleccionadas' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/admin/resenas/visibilidad', { ids: ['1', '2'], visible: true }));
  });

  it('pagina de 24 en 24', async () => {
    const muchas = Array.from({ length: 30 }, (_, i) => resena(String(i + 1), { autor: `Persona ${i + 1}`, fecha: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z` }));
    montar({ estado: estado({ guardadas: 30, visibles: 30, ocultas: 0 }), resenas: muchas });
    await screen.findByText('Mostrando 1 a 24 de 30 resultados');
    expect(tarjetas()).toHaveLength(24);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Mostrando 25 a 30 de 30 resultados')).toBeInTheDocument();
    expect(tarjetas()).toHaveLength(6);
  });

  it('sin reseñas guardadas explica dónde se cargan y enlaza a Configuración › Operación', async () => {
    montar({ estado: estado({ guardadas: 0, visibles: 0, ocultas: 0, resumen: null, negocio: null }), resenas: [] });
    expect(await screen.findByText('Todavía no hay reseñas de Google guardadas')).toBeInTheDocument();
    expect(screen.getByText(/«Carga inicial»/)).toBeInTheDocument();
    const enlace = screen.getByRole('link', { name: 'Ir a Configuración › Operación' });
    expect(enlace).toHaveAttribute('href', '/admin/mirest?tab=operacion');
  });

  it('si el filtro no encuentra nada, lo dice sin mostrar el estado vacío inicial', async () => {
    montar({ estado: estado(), resenas: [resena('a')] });
    await screen.findByText('Autor a');
    fireEvent.change(screen.getByPlaceholderText('Buscar por autor o texto'), { target: { value: 'nadie' } });
    expect(screen.getByText('Ninguna reseña coincide con los filtros')).toBeInTheDocument();
  });
});
