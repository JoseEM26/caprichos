import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AperturaDiaView } from '../AperturaDiaView';
import { AvisoAperturaHoy } from '../AvisoAperturaHoy';
import { almacenApi } from '../almacenApi';
import * as sesionModulo from '../../../comun/sesion';
import { ErrorApi } from '../../../comun/api';

const PRODUCTOS = [
  { productoId: 'd1', nombre: 'DONA CHOCOLATE', areaNombre: 'Cocina', saldo: 10, quedaronAyer: 10, producidoHoy: 0, aperturaHoy: false, aperturaCantidad: null },
  { productoId: 'g1', nombre: 'GALLETA AVENA', areaNombre: null, saldo: 6, quedaronAyer: 6, producidoHoy: 0, aperturaHoy: true, aperturaCantidad: 8 },
];

function sesionCon(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Ana', rol: 'COCINA' },
    tiene: (p: string) => permisos.includes(p),
  } as any);
}

describe('Apertura del día (conteo de productos controlados)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sesionCon(['almacen/apertura']);
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-05', productos: PRODUCTOS });
  });

  it('carga los productos con el saldo precargado y el estado de hoy de cada uno', async () => {
    render(<AperturaDiaView />);
    expect(await screen.findByText('DONA CHOCOLATE')).toBeInTheDocument();
    expect(screen.getByLabelText('Quedaron de ayer DONA CHOCOLATE')).toHaveValue(10);
    expect(screen.getByLabelText('Quedaron de ayer GALLETA AVENA')).toHaveValue(6);
    expect(screen.getByText('Falta la apertura de hoy')).toBeInTheDocument();
    expect(screen.getByText('Apertura registrada hoy: 8')).toBeInTheDocument();
    expect(screen.getByText(/05\/11\/2026/)).toBeInTheDocument();
  });

  it('envía solo lo que falta o cambió, con el cuerpo correcto', async () => {
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 1 });
    render(<AperturaDiaView />);
    await screen.findByText('DONA CHOCOLATE');

    // la dona no tiene apertura hoy: se guarda aunque no la toque; la galleta ya está contada y no cambió
    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (1)' }));
    await waitFor(() => expect(registrar).toHaveBeenCalledWith([{ productoId: 'd1', cantidad: 10, produccion: 0 }]));
    expect(await screen.findByRole('status')).toHaveTextContent('Apertura guardada: 1 producto.');
  });

  it('los botones − y + ajustan la cantidad y la galleta entra al envío al cambiarla', async () => {
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 2 });
    render(<AperturaDiaView />);
    await screen.findByText('GALLETA AVENA');
    fireEvent.click(screen.getByRole('button', { name: 'Sumar uno a GALLETA AVENA' }));
    expect(screen.getByLabelText('Quedaron de ayer GALLETA AVENA')).toHaveValue(7);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar uno de DONA CHOCOLATE' }));
    expect(screen.getByLabelText('Quedaron de ayer DONA CHOCOLATE')).toHaveValue(9);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (2)' }));
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith([
        { productoId: 'd1', cantidad: 9, produccion: 0 },
        { productoId: 'g1', cantidad: 7, produccion: 0 },
      ]),
    );
  });

  it('una diferencia de más de la mitad del saldo pide confirmación Sí/No antes de guardar', async () => {
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 1 });
    render(<AperturaDiaView />);
    await screen.findByText('DONA CHOCOLATE');
    fireEvent.change(screen.getByLabelText('Quedaron de ayer DONA CHOCOLATE'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (1)' }));

    expect(screen.getByText(/¿Guardar una diferencia grande\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No, revisar' }));
    expect(registrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(registrar).toHaveBeenCalledWith([{ productoId: 'd1', cantidad: 2, produccion: 0 }]));
  });

  it('un número no válido bloquea el guardado', async () => {
    const registrar = vi.spyOn(almacenApi, 'registrarApertura');
    render(<AperturaDiaView />);
    await screen.findByText('DONA CHOCOLATE');
    fireEvent.change(screen.getByLabelText('Quedaron de ayer DONA CHOCOLATE'), { target: { value: '' } });
    expect(screen.getByText('Escribe un número entero de 0 o más.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar apertura/ })).toBeDisabled();
    expect(registrar).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor y no se pierde lo escrito', async () => {
    vi.spyOn(almacenApi, 'registrarApertura').mockRejectedValue(new ErrorApi('ERROR_API', 'Sin conexión con el servidor', 500));
    render(<AperturaDiaView />);
    await screen.findByText('DONA CHOCOLATE');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (1)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión con el servidor');
    expect(screen.getByLabelText('Quedaron de ayer DONA CHOCOLATE')).toHaveValue(10);
  });

  it('sin productos controlados explica cómo marcarlos en el Catálogo', async () => {
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-05', productos: [] });
    render(<AperturaDiaView />);
    expect(await screen.findByText('No hay productos con control de stock')).toBeInTheDocument();
    expect(screen.getByText(/Controlar stock de este producto/)).toBeInTheDocument();
  });

  it('si no carga, muestra el error con reintento', async () => {
    vi.spyOn(almacenApi, 'obtenerApertura').mockRejectedValue(new ErrorApi('SIN_PERMISO', 'No tienes permiso', 403));
    render(<AperturaDiaView />);
    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument();
    expect(screen.getByText('No tienes permiso')).toBeInTheDocument();
  });

  it('el aviso aparece si hay productos sin apertura hoy y enlaza a la pantalla', async () => {
    render(
      <MemoryRouter>
        <AvisoAperturaHoy />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Falta el conteo de apertura de hoy (1 producto)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contar ahora' })).toHaveAttribute('href', '/admin/apertura');
  });

  it('el aviso no aparece si todo está contado o si no hay permiso', async () => {
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({
      fecha: '2026-11-05',
      productos: [{ ...PRODUCTOS[0], aperturaHoy: true, aperturaCantidad: 10 }],
    });
    const { unmount } = render(
      <MemoryRouter>
        <AvisoAperturaHoy />
      </MemoryRouter>,
    );
    await waitFor(() => expect(almacenApi.obtenerApertura).toHaveBeenCalled());
    expect(screen.queryByTestId('aviso-apertura-hoy')).toBeNull();
    unmount();

    sesionCon([]);
    vi.mocked(almacenApi.obtenerApertura).mockClear();
    render(
      <MemoryRouter>
        <AvisoAperturaHoy />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('aviso-apertura-hoy')).toBeNull();
    expect(almacenApi.obtenerApertura).not.toHaveBeenCalled();
  });

  it('el menú la filtra por almacen/apertura (sin el permiso no aparece)', async () => {
    const { MODULOS } = await import('../../modulos');
    const apertura = MODULOS.find((m) => m.clave === 'apertura');
    expect(apertura?.permisoMinimo).toBe('almacen/apertura');
    expect(apertura?.ruta).toBe('/admin/apertura');
    // AdminShell filtra con MODULOS.filter(m => !m.permisoMinimo || tiene(m.permisoMinimo))
    const tieneNada = (permiso: string) => permiso !== 'almacen/apertura' && permiso !== '';
    const visibles = MODULOS.filter((m) => !m.permisoMinimo || tieneNada(m.permisoMinimo));
    expect(visibles.find((m) => m.clave === 'apertura')).toBeUndefined();
  }, 30000);
});
