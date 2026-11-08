import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AperturaDiaView } from '../AperturaDiaView';
import { almacenApi } from '../almacenApi';
import * as sesionModulo from '../../../comun/sesion';
import { ErrorApi } from '../../../comun/api';

const DONA = {
  productoId: 'p1',
  nombre: 'DONA',
  areaNombre: 'Cocina',
  saldo: 16,
  quedaronAyer: 16,
  producidoHoy: 0,
  aperturaHoy: true,
  aperturaCantidad: 16,
  sabores: [
    { saborId: 's1', nombre: 'Fresa', saldo: 10, quedaronAyer: 10, producidoHoy: 0, aperturaHoy: true, aperturaCantidad: 10 },
    { saborId: 's2', nombre: 'Chocolate', saldo: 6, quedaronAyer: 6, producidoHoy: 0, aperturaHoy: true, aperturaCantidad: 6 },
  ],
};

const MERMA_HOY = {
  id: '77',
  producto: 'DONA',
  sabor: 'Fresa',
  cantidad: 3,
  motivo: 'Se cayó o se rompió',
  nota: null,
  en: '2026-11-08T15:30:00.000Z',
  por: 'Ana Pérez',
  anulada: false,
};

function sesionCon(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Ana', rol: 'COCINA' },
    tiene: (p: string) => permisos.includes(p),
  } as any);
}

async function abrirYBajarFresa(valor = '7') {
  render(<AperturaDiaView />);
  await screen.findByText('DONA');
  fireEvent.click(screen.getByRole('button', { name: 'DONA, 2 sabores' }));
  fireEvent.change(await screen.findByLabelText('Quedaron de ayer DONA · Fresa'), { target: { value: valor } });
}

describe('Apertura: bajar un conteo es una merma con motivo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sesionCon(['almacen/apertura']);
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-08', productos: [DONA as any] });
    vi.spyOn(almacenApi, 'mermasHoy').mockResolvedValue({ fecha: '2026-11-08', mermas: [] });
  });

  it('Fresa de 10 a 7 marca la fila «Merma: −3»; subir o dejar igual no marca nada', async () => {
    await abrirYBajarFresa('7');
    expect(screen.getByText('Merma: −3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quedaron de ayer DONA · Fresa'), { target: { value: '12' } });
    expect(screen.queryByText(/Merma: −/)).toBeNull();
  });

  it('subir el conteo guarda directo, sin pedir motivo', async () => {
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 1, mermas: 0 });
    await abrirYBajarFresa('12');
    fireEvent.click(screen.getByRole('button', { name: /Guardar apertura/ }));
    await waitFor(() => expect(registrar).toHaveBeenCalled());
    expect(screen.queryByRole('dialog', { name: 'Confirmar mermas de la apertura' })).toBeNull();
  });

  it('la confirmación lista todas las mermas; sin motivo no deja guardar y marca el campo', async () => {
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 2, mermas: 2 });
    await abrirYBajarFresa('7');
    fireEvent.change(screen.getByLabelText('Quedaron de ayer DONA · Chocolate'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar apertura/ }));

    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar mermas de la apertura' });
    expect(within(dialogo).getAllByTestId('merma-confirmar-fila')).toHaveLength(2);
    expect(within(dialogo).getByText(/¿Registrar 4 unidades como merma\?/)).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, registrar merma y guardar' }));
    expect((await within(dialogo).findAllByText('Elige el motivo.')).length).toBe(2);
    expect(registrar).not.toHaveBeenCalled();
  });

  it('«Mismo motivo para todos» rellena cada fila y se envía con saldoEsperado', async () => {
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 2, mermas: 2 });
    await abrirYBajarFresa('7');
    fireEvent.change(screen.getByLabelText('Quedaron de ayer DONA · Chocolate'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar apertura/ }));
    await screen.findByRole('dialog', { name: 'Confirmar mermas de la apertura' });

    fireEvent.change(screen.getByLabelText('Mismo motivo para todos'), { target: { value: 'ERROR_COCINA' } });
    expect(screen.getByLabelText('Motivo de la merma de DONA · Fresa')).toHaveValue('ERROR_COCINA');
    expect(screen.getByLabelText('Motivo de la merma de DONA · Chocolate')).toHaveValue('ERROR_COCINA');

    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar merma y guardar' }));
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith([
        { productoId: 'p1', saborId: 's1', cantidad: 7, produccion: 0, saldoEsperado: 10, motivo: 'ERROR_COCINA' },
        { productoId: 'p1', saborId: 's2', cantidad: 5, produccion: 0, saldoEsperado: 6, motivo: 'ERROR_COCINA' },
      ]),
    );
  });

  it('el motivo «Otro» pide una nota de al menos 5 letras y la envía', async () => {
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 1, mermas: 1 });
    await abrirYBajarFresa('7');
    fireEvent.click(screen.getByRole('button', { name: /Guardar apertura/ }));
    await screen.findByRole('dialog', { name: 'Confirmar mermas de la apertura' });
    fireEvent.change(screen.getByLabelText('Motivo de la merma de DONA · Fresa'), { target: { value: 'OTRO' } });
    fireEvent.change(screen.getByLabelText('Nota de la merma de DONA · Fresa'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar merma y guardar' }));
    expect(await screen.findByText('Escribe una nota de al menos 5 letras.')).toBeInTheDocument();
    expect(registrar).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nota de la merma de DONA · Fresa'), { target: { value: 'Se quemó en el horno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar merma y guardar' }));
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith([
        { productoId: 'p1', saborId: 's1', cantidad: 7, produccion: 0, saldoEsperado: 10, motivo: 'OTRO', nota: 'Se quemó en el horno' },
      ]),
    );
  });

  it('si el stock cambió mientras contaba (409) recarga y avisa', async () => {
    vi.spyOn(almacenApi, 'registrarApertura').mockRejectedValue(
      new ErrorApi('CONTEO_DESACTUALIZADO', 'El stock cambió mientras contabas. Recarga la pantalla.', 409),
    );
    await abrirYBajarFresa('7');
    fireEvent.click(screen.getByRole('button', { name: /Guardar apertura/ }));
    await screen.findByRole('dialog', { name: 'Confirmar mermas de la apertura' });
    fireEvent.change(screen.getByLabelText('Mismo motivo para todos'), { target: { value: 'VENCIDO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar merma y guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El stock cambió mientras contabas');
    expect(almacenApi.obtenerApertura).toHaveBeenCalledTimes(2);
  });
});

describe('Mermas de hoy (pie de Apertura)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-08', productos: [DONA as any] });
  });

  it('lista producto, sabor, cantidad, motivo y quién; con permiso se puede anular', async () => {
    sesionCon(['almacen/apertura', 'almacen/movimientos']);
    vi.spyOn(almacenApi, 'mermasHoy').mockResolvedValue({ fecha: '2026-11-08', mermas: [MERMA_HOY] });
    const anular = vi.spyOn(almacenApi, 'anularMovimiento').mockResolvedValue({ ok: true } as any);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AperturaDiaView />);
    const fila = await screen.findByTestId('merma-hoy');
    expect(fila).toHaveTextContent('DONA · Fresa');
    expect(fila).toHaveTextContent('−3');
    expect(fila).toHaveTextContent('Se cayó o se rompió');
    expect(fila).toHaveTextContent('Ana Pérez');
    fireEvent.click(within(fila).getByRole('button', { name: 'Anular' }));
    await waitFor(() => expect(anular).toHaveBeenCalledWith('77', expect.any(String)));
  });

  it('sin permiso de movimientos no ofrece anular', async () => {
    sesionCon(['almacen/apertura']);
    vi.spyOn(almacenApi, 'mermasHoy').mockResolvedValue({ fecha: '2026-11-08', mermas: [MERMA_HOY] });
    render(<AperturaDiaView />);
    await screen.findByTestId('merma-hoy');
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });
});
