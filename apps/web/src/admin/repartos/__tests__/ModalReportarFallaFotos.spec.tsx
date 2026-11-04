import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalReportarFalla } from '../ModalReportarFalla';
import { repartosApi, PedidoReparto } from '../repartosApi';

const pedido = {
  id: '60',
  codigo: 'CP-0110',
  cliente_nombre: 'Kevin',
  estado: 'EN_CAMINO',
  llego_en: new Date(Date.now() - 15 * 60000).toISOString(),
  espera_max_min: 10,
} as unknown as PedidoReparto;

function registrarDosLlamadas() {
  const boton = screen.getByRole('button', { name: '+ Registrar llamada' });
  fireEvent.click(boton);
  fireEvent.click(boton);
}

describe('ModalReportarFalla: cliente no salió exige fotos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:foto-local');
    URL.revokeObjectURL = vi.fn();
  });

  it('sin foto no deja confirmar', () => {
    render(<ModalReportarFalla pedido={pedido} alCerrar={vi.fn()} alCompletar={vi.fn()} />);
    registrarDosLlamadas();
    fireEvent.click(screen.getByRole('button', { name: 'Reportar entrega fallida' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Toma al menos 1 foto del lugar donde esperaste.');
    expect(screen.queryByText('¿Confirmas que el cliente no salió?')).not.toBeInTheDocument();
  });

  it('con foto pide confirmación Sí/No, sube la foto y envía el reporte', async () => {
    const subir = vi.spyOn(repartosApi, 'subirFotoPrueba').mockResolvedValue('77');
    const reportar = vi.spyOn(repartosApi, 'reportarFalla').mockResolvedValue({ ok: true } as any);
    const alCompletar = vi.fn();
    render(<ModalReportarFalla pedido={pedido} alCerrar={vi.fn()} alCompletar={alCompletar} />);
    registrarDosLlamadas();

    const input = screen.getByTestId('input-foto-prueba');
    expect(input).toHaveAttribute('capture', 'environment');
    fireEvent.change(input, { target: { files: [new File(['x'], 'puerta.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByAltText('Foto 1 del lugar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reportar entrega fallida' }));
    expect(screen.getByText('Se devolverá el pedido a la tienda y se reprogramará. ¿Confirmas?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, reportar' }));
    await waitFor(() => expect(alCompletar).toHaveBeenCalled());
    expect(subir).toHaveBeenCalledTimes(1);
    expect(reportar).toHaveBeenCalledWith('60', expect.objectContaining({ motivo: 'NO_CONTESTA', fotoArchivoIds: ['77'] }));
  });

  it('se puede quitar una foto antes de enviar', () => {
    render(<ModalReportarFalla pedido={pedido} alCerrar={vi.fn()} alCompletar={vi.fn()} />);
    const input = screen.getByTestId('input-foto-prueba');
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto 1' }));
    expect(screen.queryByAltText('Foto 1 del lugar')).not.toBeInTheDocument();
  });
});
