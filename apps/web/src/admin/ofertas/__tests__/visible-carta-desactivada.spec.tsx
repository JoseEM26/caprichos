import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SelectorVisibleCarta } from '../canalesPromo';
import { ModalEnvioGratis } from '../ModalEnvioGratis';
import { ModalDescuento } from '../ModalDescuento';

describe('control «Si está desactivada» (cómo se ve en la carta)', () => {
  it('muestra las dos opciones y marca la que corresponde a visibleCarta', () => {
    render(<SelectorVisibleCarta id="t" visibleCarta={false} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Ocultar de la carta' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mostrar como No disponible' })).not.toBeChecked();
  });

  it('al elegir «Mostrar como No disponible» avisa visibleCarta = true', () => {
    const onChange = vi.fn();
    render(<SelectorVisibleCarta id="t" visibleCarta={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Mostrar como No disponible' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('ModalEnvioGratis: visibilidad al editar', () => {
  const oferta = { id: '5', tipo: 'ENVIO_GRATIS', nombre: 'Envío gratis', dias: [], canales: ['CARTA', 'ADMIN'], orden: 0, activo: false, visibleCarta: false } as any;

  it('al editar muestra el control con el valor guardado y manda la elección', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<ModalEnvioGratis abierto ofertaAEditar={oferta} onCerrar={() => {}} onGuardar={onGuardar} />);
    expect(screen.getByText('Si está desactivada:')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ocultar de la carta' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Mostrar como No disponible' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    expect(onGuardar.mock.calls[0][0].visibleCarta).toBe(true);
  });
});

describe('ModalDescuento: el control solo aparece al editar', () => {
  async function irAlPasoDeCanales(props: Record<string, unknown>) {
    render(<ModalDescuento abierto onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} {...props} />);
    fireEvent.change(document.getElementById('desc-nombre')!, { target: { value: '10% de prueba' } });
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(document.getElementById('desc-canal-bot')).not.toBeNull());
  }

  it('en alta no muestra el control', async () => {
    await irAlPasoDeCanales({ descuentoAEditar: null });
    expect(screen.queryByText('Si está desactivada:')).toBeNull();
  });

  it('al editar lo muestra con el valor guardado', async () => {
    await irAlPasoDeCanales({
      descuentoAEditar: { id: '6', tipo: 'DESCUENTO', nombre: '10%', descuentoTipo: 'PORCENTAJE', descuentoValor: 10, activo: false, visibleCarta: true, dias: [], canales: ['CARTA'], orden: 0, compraMinima: 0 } as any,
    });
    expect(screen.getByRole('radio', { name: 'Mostrar como No disponible' })).toBeChecked();
  });
});
