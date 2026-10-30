import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ParametrosOperacionTab } from '../ParametrosOperacionTab';

const PARAMETROS = [
  { clave: 'reprog_recargo_modo', valor: 'IGUAL_ENVIO' },
  { clave: 'reparto_recargo_reprogramacion', valor: 5 },
];

describe('Selector del costo de volver a enviar un pedido (ParametrosOperacionTab)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
      permisos: ['configuracion/ver', 'configuracion/editar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: () => true,
    } as any);
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/configuracion') return PARAMETROS;
      throw new Error('no disponible en la prueba');
    });
  });

  it('muestra el modo actual con su nombre y la explicación en el modal', async () => {
    render(<ParametrosOperacionTab puedeVer puedeEditar />);

    await waitFor(() => {
      expect(screen.getByText('Igual al envío')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /^Editar$/ })[0]);
    expect(screen.getByLabelText(/Cómo se cobra/)).toHaveValue('IGUAL_ENVIO');
    expect(screen.getByText(/Cobra al cliente lo mismo que el delivery/)).toBeInTheDocument();
    // En "Igual al envío" no se pide el monto fijo
    expect(screen.queryByLabelText(/Monto fijo \(S\/\)/)).not.toBeInTheDocument();
  });

  it('en "Monto fijo" habilita el campo del monto y guarda modo y monto tras Sí', async () => {
    const putSpy = vi.spyOn(api, 'put').mockImplementation(async (url: string, body: any) => ({
      clave: url.split('/').pop(),
      valor: body.valor,
    }));

    render(<ParametrosOperacionTab puedeVer puedeEditar />);
    await waitFor(() => {
      expect(screen.getByText('Igual al envío')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /^Editar$/ })[0]);
    fireEvent.change(screen.getByLabelText(/Cómo se cobra/), { target: { value: 'FIJO' } });

    const campoMonto = screen.getByLabelText(/Monto fijo \(S\/\)/);
    expect(campoMonto).toHaveValue(5);
    fireEvent.change(campoMonto, { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByText(/¿Confirmas cambiar el valor de "Costo de volver a enviar un pedido" a "Monto fijo"\?/)).toBeInTheDocument();
    expect(putSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Sí, guardar/ }));
    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/admin/configuracion/reprog_recargo_modo', { valor: 'FIJO' });
      expect(putSpy).toHaveBeenCalledWith('/admin/configuracion/reparto_recargo_reprogramacion', { valor: 9 });
    });
  });

  it('en "Monto fijo" no deja guardar un monto negativo', async () => {
    render(<ParametrosOperacionTab puedeVer puedeEditar />);
    await waitFor(() => {
      expect(screen.getByText('Igual al envío')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /^Editar$/ })[0]);
    fireEvent.change(screen.getByLabelText(/Cómo se cobra/), { target: { value: 'FIJO' } });
    fireEvent.change(screen.getByLabelText(/Monto fijo \(S\/\)/), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    expect(screen.getByText(/El monto fijo debe ser un número mayor o igual a 0/)).toBeInTheDocument();
    expect(screen.queryByText(/¿Guardar parámetro de operación\?/)).not.toBeInTheDocument();
  });
});
