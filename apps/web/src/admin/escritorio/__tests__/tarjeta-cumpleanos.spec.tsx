import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TarjetaCumpleanos } from '../TarjetaCumpleanos';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';

const datos = {
  ventanaDias: 60,
  sinFecha: 2,
  proximos: [
    { nombre: 'Ana Pérez', rol: 'Cajero', fecha: 'dom 8 nov', enDias: 0, etiqueta: 'Hoy' },
    { nombre: 'Luis Paz', rol: 'Mozo', fecha: 'sáb 15 nov', enDias: 7, etiqueta: 'en 7 días' },
  ],
};

function sesion(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p) } as any);
}
const ver = () => render(<MemoryRouter><TarjetaCumpleanos /></MemoryRouter>);

describe('Tarjeta de cumpleaños del equipo', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('ADMIN/SUPERVISOR: lista con el de hoy resaltado y aviso de faltantes solo si puede editar', async () => {
    sesion(['escritorio/cumpleanos', 'usuarios/editar']);
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    ver();
    expect(await screen.findByText(/¡Hoy cumple años!/)).toBeInTheDocument();
    expect(screen.getByText(/en 7 días · sáb 15 nov/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 personas sin fecha de nacimiento · completar/ })).toBeInTheDocument();
  });

  it('el supervisor (sin editar usuarios) no ve el aviso de faltantes', async () => {
    sesion(['escritorio/cumpleanos']);
    vi.spyOn(api, 'get').mockResolvedValue(datos);
    ver();
    await screen.findByText('Luis Paz', { exact: false });
    expect(screen.queryByText(/sin fecha de nacimiento/)).not.toBeInTheDocument();
  });

  it('estado vacío', async () => {
    sesion(['escritorio/cumpleanos']);
    vi.spyOn(api, 'get').mockResolvedValue({ ventanaDias: 60, sinFecha: 0, proximos: [] });
    ver();
    expect(await screen.findByText('Sin cumpleaños en los próximos 60 días')).toBeInTheDocument();
  });

  it('otros roles: no pide ni muestra nada', async () => {
    sesion(['pedidos/ver']);
    const get = vi.spyOn(api, 'get').mockResolvedValue(datos);
    ver();
    await waitFor(() => expect(get).not.toHaveBeenCalled());
    expect(screen.queryByText(/Próximos cumpleaños/)).not.toBeInTheDocument();
  });
});
