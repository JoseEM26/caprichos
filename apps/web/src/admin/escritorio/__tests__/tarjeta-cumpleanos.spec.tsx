import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TarjetaCumpleanos } from '../TarjetaCumpleanos';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';

const equipo = {
  ventanaDias: 60,
  sinFecha: 2,
  proximos: [
    { nombre: 'Ana Pérez', rol: 'Cajero', fecha: 'dom 8 nov', enDias: 0, etiqueta: 'Hoy' },
    { nombre: 'Luis Paz', rol: 'Mozo', fecha: 'sáb 15 nov', enDias: 7, etiqueta: 'en 7 días' },
    { nombre: 'Eva Soto', rol: 'Cocina', fecha: 'lun 24 nov', enDias: 16, etiqueta: 'en 16 días' },
  ],
};
const clientes = {
  ventanaDias: 31,
  proximos: [
    { nombre: 'Rosa Lima', fecha: 'dom 8 nov', enDias: 0, etiqueta: 'Hoy', celular: '9•• ••• 321', ventanaAbierta: true, chatCelular: '900000321' },
    { nombre: 'Sin Chat', fecha: 'dom 8 nov', enDias: 0, etiqueta: 'Hoy', celular: '9•• ••• 333', ventanaAbierta: false, chatCelular: null },
  ],
};

function sesion(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p) } as any);
}
const ver = () => render(<MemoryRouter><TarjetaCumpleanos /></MemoryRouter>);
const responder = () =>
  vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => (ruta.includes('clientes') ? clientes : equipo) as any);

describe('Cumpleaños en el escritorio', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('equipo: el de hoy resaltado, filtros Hoy / 7 días / Este mes y aviso de faltantes solo si puede editar', async () => {
    sesion(['escritorio/cumpleanos', 'usuarios/editar']);
    responder();
    ver();
    expect(await screen.findByText(/¡Hoy cumple años!/)).toBeInTheDocument();
    expect(screen.getByText(/en 16 días · lun 24 nov/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '7 días' }));
    expect(screen.getByText(/en 7 días · sáb 15 nov/)).toBeInTheDocument();
    expect(screen.queryByText('Eva Soto', { exact: false })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.queryByText('Luis Paz', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 personas sin fecha de nacimiento · completar/ })).toBeInTheDocument();
  });

  it('el supervisor (sin editar usuarios) no ve el aviso de faltantes ni la pestaña de clientes', async () => {
    sesion(['escritorio/cumpleanos']);
    responder();
    ver();
    await screen.findByText('Luis Paz', { exact: false });
    expect(screen.queryByText(/sin fecha de nacimiento/)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Clientes' })).not.toBeInTheDocument();
  });

  it('con permiso de clientes hay pestañas; Felicitar solo si hay ventana abierta, si no, aviso', async () => {
    sesion(['escritorio/cumpleanos', 'clientes/ver']);
    const get = responder();
    ver();
    await screen.findByText('Ana Pérez', { exact: false });
    fireEvent.click(screen.getByRole('tab', { name: 'Clientes' }));
    expect(await screen.findByText('Rosa Lima', { exact: false })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(expect.stringContaining('cumpleanos-clientes'));
    expect(screen.getByText(/9•• ••• 321/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Felicitar por WhatsApp' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Felicitar por WhatsApp' })).toHaveAttribute('href', '/admin/mensajes?telefono=900000321');
    expect(screen.getByText(/no hay un chat abierto en las últimas 24 horas/)).toBeInTheDocument();
  });

  it('estado vacío', async () => {
    sesion(['escritorio/cumpleanos']);
    vi.spyOn(api, 'get').mockResolvedValue({ ventanaDias: 60, sinFecha: 0, proximos: [] });
    ver();
    expect(await screen.findByText('Sin cumpleaños en los próximos 30 días')).toBeInTheDocument();
  });

  it('otros roles: no pide ni muestra nada', async () => {
    sesion(['pedidos/ver']);
    const get = vi.spyOn(api, 'get').mockResolvedValue(equipo);
    ver();
    await waitFor(() => expect(get).not.toHaveBeenCalled());
    expect(screen.queryByText(/Cumpleaños/)).not.toBeInTheDocument();
  });
});
