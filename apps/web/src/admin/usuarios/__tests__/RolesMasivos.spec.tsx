import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UsuariosView } from '../UsuariosView';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';

const U = (id: string, nombres: string, rol: string, activo = true) => ({
  id,
  partyId: id,
  nombres,
  apellidos: 'Prueba',
  dni: '11****44',
  rol,
  activo,
  debeCambiar: false,
  altaEn: '2026-10-21T00:00:00.000Z',
});
const LISTA = [U('1', 'Carlos', 'ADMIN'), U('2', 'Lucia', 'CAJERO'), U('3', 'Marcos', 'MOZO')];

function montar() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
    permisos: [],
    tiene: vi.fn().mockReturnValue(true),
  } as any);
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url.includes('activo=true&limite=1')) return { total: 7, elementos: [], pagina: 1, limite: 1, totalPaginas: 7 };
    return { total: 3, pagina: 1, limite: 15, totalPaginas: 1, elementos: LISTA };
  });
  return render(
    <MemoryRouter>
      <UsuariosView />
    </MemoryRouter>,
  );
}

describe('Roles masivos en Usuarios', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('modo Selección: marca usuarios y aparece la barra con el número exacto', async () => {
    montar();
    await screen.findByText(/Lucia Prueba/);
    expect(screen.queryByLabelText(/Seleccionar a Lucia/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Selección' }));
    fireEvent.click(screen.getByLabelText(/Seleccionar a Lucia/));
    fireEvent.click(screen.getByLabelText(/Seleccionar a Marcos/));
    expect(screen.getByText('2 usuarios seleccionados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir rol a 2 usuarios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar rol' })).toBeInTheDocument();
  });

  it('Seleccionar visibles marca todos los de la página; Seleccionar todos usa el total de activos', async () => {
    montar();
    await screen.findByText(/Lucia Prueba/);
    fireEvent.click(screen.getByRole('button', { name: 'Selección' }));
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar visibles \(3\)/ }));
    expect(screen.getByText('3 usuarios seleccionados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar todos los activos/ }));
    expect(await screen.findByText('7 usuarios seleccionados')).toBeInTheDocument();
  });

  it('confirmación Sí/No con el número exacto, vista previa y resultado con omitidos y motivo', async () => {
    montar();
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      accion: 'agregar',
      rol: 'APOYO_DELIVERY',
      agregados: 1,
      quitados: 0,
      yaTenian: 0,
      omitidos: [{ usuario: 'Carlos Prueba', usuarioId: '1', motivo: 'El rol ADMIN no se combina con otros roles' }],
    });
    await screen.findByText(/Lucia Prueba/);
    fireEvent.click(screen.getByRole('button', { name: 'Selección' }));
    fireEvent.click(screen.getByLabelText(/Seleccionar a Carlos/));
    fireEvent.click(screen.getByLabelText(/Seleccionar a Lucia/));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir rol a 2 usuarios' }));
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'APOYO_DELIVERY' } });
    expect(screen.getByText(/Tomar pedidos y rutas de reparto/)).toBeInTheDocument();
    expect(screen.getByText(/¿Añadir el rol Apoyo en delivery a 2 usuarios\?/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, añadir a 2 usuarios' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/admin/usuarios/roles-masivo', { usuarioIds: ['1', '2'], rol: 'APOYO_DELIVERY', accion: 'agregar' }),
    );
    expect(await screen.findByText(/El rol ADMIN no se combina con otros roles/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Carlos Prueba: El rol ADMIN no se combina');
    expect(screen.getByRole('status')).toHaveTextContent('1 omitidos');
  });

  it('atajo «Dar acceso a Delivery a todos»: pide confirmar con el total y envía «todos»', async () => {
    montar();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ accion: 'agregar', rol: 'APOYO_DELIVERY', agregados: 6, quitados: 0, yaTenian: 0, omitidos: [] });
    await screen.findByText(/Lucia Prueba/);
    fireEvent.click(screen.getByRole('button', { name: 'Dar acceso a Delivery a todos' }));
    expect(await screen.findByText(/¿Añadir el rol Apoyo en delivery a 7 usuarios\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, añadir a 7 usuarios' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/admin/usuarios/roles-masivo', { usuarioIds: 'todos', rol: 'APOYO_DELIVERY', accion: 'agregar', soloActivos: true }),
    );
    expect(await screen.findByText(/recibieron el rol Apoyo en delivery/)).toBeInTheDocument();
  });

  it('Quitar rol usa la acción quitar', async () => {
    montar();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ accion: 'quitar', rol: 'CAJERO', quitados: 1, agregados: 0, yaTenian: 0, omitidos: [] });
    await screen.findByText(/Lucia Prueba/);
    fireEvent.click(screen.getByRole('button', { name: 'Selección' }));
    fireEvent.click(screen.getByLabelText(/Seleccionar a Lucia/));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar rol' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar a 1 usuario' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/usuarios/roles-masivo', expect.objectContaining({ accion: 'quitar', usuarioIds: ['2'] })));
  });
});
