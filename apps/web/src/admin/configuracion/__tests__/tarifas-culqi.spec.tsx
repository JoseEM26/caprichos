import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ParametrosOperacionTab } from '../ParametrosOperacionTab';

// Las 4 tarifas de Culqi no tienen fila en la base: el API las lista con valor null
const PARAMETROS = [
  { clave: 'pago_online_espera_min', valor: 15 },
  { clave: 'culqi_comision_tarjeta_pct', valor: null },
  { clave: 'culqi_comision_tarjeta_fijo', valor: null },
  { clave: 'culqi_comision_yape_pct', valor: null },
  { clave: 'culqi_comision_yape_fijo', valor: null },
];

// Orden de los botones Editar dentro del grupo «Pago en línea»
const EDITAR = { espera: 0, tarjetaPct: 1, tarjetaFijo: 2, yapePct: 3, yapeFijo: 4 };

describe('Comisión de Culqi en Parámetros de operación', () => {
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

  it('muestra las 4 tarifas en el grupo Pago en línea con «Sin configurar» y botón Editar', async () => {
    render(<ParametrosOperacionTab puedeVer puedeEditar />);

    const grupo = await screen.findByTestId('grupo-parametros-pago_online');
    expect(within(grupo).getByText('Comisión de Culqi por tarjeta: porcentaje (sin IGV)')).toBeInTheDocument();
    expect(within(grupo).getByText('Comisión de Culqi por tarjeta: monto fijo (sin IGV)')).toBeInTheDocument();
    expect(within(grupo).getByText('Comisión de Culqi por Yape: porcentaje (sin IGV)')).toBeInTheDocument();
    expect(within(grupo).getByText('Comisión de Culqi por Yape: monto fijo (sin IGV)')).toBeInTheDocument();
    expect(within(grupo).getAllByText('Sin configurar')).toHaveLength(4);
    expect(within(grupo).queryByText(/null/)).not.toBeInTheDocument();
    expect(within(grupo).getAllByRole('button', { name: /^Editar$/ })).toHaveLength(5);
  });

  it('guarda el porcentaje con decimales (3.99) tras confirmar', async () => {
    const putSpy = vi.spyOn(api, 'put').mockImplementation(async (url: string, body: any) => ({
      clave: url.split('/').pop(),
      valor: body.valor,
    }));

    render(<ParametrosOperacionTab puedeVer puedeEditar />);
    const grupo = await screen.findByTestId('grupo-parametros-pago_online');

    fireEvent.click(within(grupo).getAllByRole('button', { name: /^Editar$/ })[EDITAR.tarjetaPct]);
    const campo = screen.getByLabelText(/Nuevo valor/);
    expect(campo).toHaveValue(null);
    fireEvent.change(campo, { target: { value: '3.99' } });

    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(putSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sí, guardar/ }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/admin/configuracion/culqi_comision_tarjeta_pct', { valor: 3.99 });
    });
  });

  it('el monto fijo vacío se guarda como 0 (lo que dice la ayuda)', async () => {
    const putSpy = vi.spyOn(api, 'put').mockImplementation(async (url: string, body: any) => ({
      clave: url.split('/').pop(),
      valor: body.valor,
    }));

    render(<ParametrosOperacionTab puedeVer puedeEditar />);
    const grupo = await screen.findByTestId('grupo-parametros-pago_online');

    fireEvent.click(within(grupo).getAllByRole('button', { name: /^Editar$/ })[EDITAR.yapeFijo]);
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, guardar/ }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/admin/configuracion/culqi_comision_yape_fijo', { valor: 0 });
    });
  });

  it('el porcentaje vacío no se guarda: pide escribir un número', async () => {
    const putSpy = vi.spyOn(api, 'put');

    render(<ParametrosOperacionTab puedeVer puedeEditar />);
    const grupo = await screen.findByTestId('grupo-parametros-pago_online');

    fireEvent.click(within(grupo).getAllByRole('button', { name: /^Editar$/ })[EDITAR.yapePct]);
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    expect(screen.getByText('Escribe el porcentaje (de 0 a 20)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sí, guardar/ })).not.toBeInTheDocument();
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('un porcentaje negativo se rechaza antes de guardar', async () => {
    const putSpy = vi.spyOn(api, 'put');

    render(<ParametrosOperacionTab puedeVer puedeEditar />);
    const grupo = await screen.findByTestId('grupo-parametros-pago_online');

    fireEvent.click(within(grupo).getAllByRole('button', { name: /^Editar$/ })[EDITAR.tarjetaPct]);
    fireEvent.change(screen.getByLabelText(/Nuevo valor/), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    expect(screen.getByText('El valor debe ser un número mayor o igual a 0')).toBeInTheDocument();
    expect(putSpy).not.toHaveBeenCalled();
  });
});
