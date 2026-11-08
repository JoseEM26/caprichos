import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SeccionPermisosExtra } from '../SeccionPermisosExtra';
import { SelectorOtrosRoles } from '../SelectorOtrosRoles';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ErrorApi: class extends Error {},
}));
vi.mock('../../modulos', () => ({
  MODULOS: [
    { nombre: 'Pedidos y caja', permisoMinimo: 'caja/ver' },
    { nombre: 'Créditos del personal', permisoMinimo: 'creditos/ver' },
    { nombre: 'Usuarios', permisoMinimo: 'usuarios/ver' },
  ],
}));

const acc = (modulo: string, accion: string, nombre: string, o: any = {}) => ({ clave: `${modulo}/${accion}`, accion, nombre, sensible: false, porRol: false, extra: false, ...o });
const RESPUESTA = (extras: any[] = [], bloqueado: string | null = null) => ({
  rol: 'CAJERO',
  roles: ['CAJERO'],
  bloqueado,
  extras,
  efectivos: ['caja/ver'],
  modulos: [
    { modulo: 'caja', nombre: 'Caja', acciones: [acc('caja', 'ver', 'Ver', { porRol: true }), acc('caja', 'cerrar', 'Cerrar', { porRol: true })] },
    {
      modulo: 'creditos',
      nombre: 'Créditos',
      acciones: [acc('creditos', 'ver', 'Ver'), acc('creditos', 'exportar', 'Exportar'), acc('creditos', 'saldar', 'Saldar deudas', { sensible: true })],
    },
    { modulo: 'usuarios', nombre: 'Usuarios', acciones: [acc('usuarios', 'ver', 'Ver'), acc('usuarios', 'editar', 'Editar', { sensible: true })] },
  ],
});

const abrir = (puedeEditar = true) => render(<SeccionPermisosExtra usuarioId="5" puedeEditar={puedeEditar} />);
const modulo = (nombre: string) => screen.getByText(nombre).closest('details') as HTMLElement;

describe('Permisos por módulo (extra)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockResolvedValue(RESPUESTA());
    (api.put as any).mockResolvedValue({ ok: true });
  });

  it('marca y bloquea lo que ya da el rol, y explica por qué', async () => {
    abrir();
    const caja = within(await waitFor(() => modulo('Caja')));
    const ver = caja.getByRole('checkbox', { name: /Ver/ });
    expect(ver).toBeChecked();
    expect(ver).toBeDisabled();
    expect(caja.getAllByText(/Incluido por su rol Cajero/).length).toBeGreaterThan(0);
  });

  it('los permisos delicados salen bloqueados «Solo con rol Administrador»', async () => {
    abrir();
    const usuarios = within(await waitFor(() => modulo('Usuarios')));
    expect(usuarios.getByRole('checkbox', { name: /Crear\/editar/ })).toBeDisabled();
    expect(usuarios.getAllByText(/Solo con rol Administrador/).length).toBeGreaterThan(0);
  });

  it('«Solo lectura» marca únicamente Ver, y el resumen muestra lo que podrá abrir', async () => {
    abrir();
    const cred = await waitFor(() => modulo('Créditos'));
    fireEvent.click(within(cred).getByRole('button', { name: 'Solo lectura' }));
    const c2 = within(modulo('Créditos'));
    expect(c2.getByRole('checkbox', { name: /^Ver/ })).toBeChecked();
    await waitFor(() => expect(screen.getByRole('status', { name: 'Resultado final' })).toHaveTextContent('Créditos del personal'));
    expect(screen.getByRole('status', { name: 'Resultado final' })).not.toHaveTextContent('Usuarios');
  });

  it('confirma con Sí/No y envía vencimiento y nota; avisa cuándo se aplica', async () => {
    abrir();
    const cred = await waitFor(() => modulo('Créditos'));
    fireEvent.click(within(cred).getByRole('button', { name: 'Solo lectura' }));
    fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2027-02-01' } });
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: 'apoyo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar permisos extra' }));
    expect(await screen.findByText(/Se agrega: Créditos: Ver/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect((api.put as any).mock.calls[0][0]).toBe('/admin/usuarios/5/permisos-extra');
    expect((api.put as any).mock.calls[0][1].permisos).toEqual([
      { modulo: 'creditos', accion: 'ver', venceEn: '2027-02-01T23:59:00-05:00', nota: 'apoyo' },
    ]);
    expect(await screen.findByText(/Permisos guardados\. Se aplican la próxima vez/)).toBeInTheDocument();
  });

  it('«No» no guarda nada', async () => {
    abrir();
    fireEvent.click(within(await waitFor(() => modulo('Créditos'))).getByRole('button', { name: 'Solo lectura' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar permisos extra' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(api.put).not.toHaveBeenCalled();
  });

  it('quitar un extra existente lo envía como conjunto sin él', async () => {
    (api.get as any).mockResolvedValue(RESPUESTA([{ clave: 'creditos/ver', modulo: 'creditos', accion: 'ver', venceEn: null, nota: null }]));
    abrir();
    const cred = within(await waitFor(() => modulo('Créditos')));
    fireEvent.click(cred.getByRole('checkbox', { name: /^Ver/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar permisos extra' }));
    expect(await screen.findByText(/Se quita: Créditos: Ver/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect((api.put as any).mock.calls[0][1].permisos).toEqual([]));
  });

  it('sin ser administrador no se puede editar; con rol bloqueado se explica', async () => {
    abrir(false);
    expect(await screen.findByText(/Solo un administrador puede dar o quitar permisos/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar permisos extra' })).toBeNull();
  });

  it('muestra el motivo si la persona es Repartidor', async () => {
    (api.get as any).mockResolvedValue(RESPUESTA([], 'El Repartidor no recibe permisos extra: queda aislado de la administración'));
    abrir();
    expect(await screen.findByText(/El Repartidor no recibe permisos extra/)).toBeInTheDocument();
  });

  it('el buscador filtra módulos', async () => {
    abrir();
    await waitFor(() => modulo('Caja'));
    fireEvent.change(screen.getByLabelText('Buscar módulo'), { target: { value: 'cré' } });
    expect(screen.queryByText('Caja')).toBeNull();
    expect(screen.getByText('Créditos')).toBeInTheDocument();
  });
});

describe('Otros roles: rol principal y motivos', () => {
  it('muestra el rol principal marcado y bloqueado con su nota', () => {
    render(<SelectorOtrosRoles principal="CAJERO" valor={[]} alCambiar={vi.fn()} />);
    const caja = screen.getByRole('checkbox', { name: /Cajero\/a/ });
    expect(caja).toBeChecked();
    expect(caja).toBeDisabled();
    expect(screen.getByText(/Es su rol principal/)).toBeInTheDocument();
  });

  it('explica por qué Administrador y Repartidor quedan apagados y apunta a los permisos por módulo', () => {
    render(<SelectorOtrosRoles principal="CAJERO" valor={['MOZO']} alCambiar={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /Administrador/ })).toBeDisabled();
    expect(screen.getAllByText(/no se combina con otros roles/).length).toBeGreaterThan(0);
    expect(screen.getByRole('note')).toHaveTextContent(/Permisos por módulo \(extra\)/);
  });

  it('con principal Administrador todo lo demás se apaga con el motivo', () => {
    render(<SelectorOtrosRoles principal="ADMIN" valor={[]} alCambiar={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /Mozo/ })).toBeDisabled();
    expect(screen.getAllByText(/No se combina con Administrador/).length).toBeGreaterThan(0);
  });
});
