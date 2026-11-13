import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreviaDocumentoUsuario } from '../PreviaDocumentoUsuario';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  ErrorApi: class extends Error {},
}));

const cliente = (o: object = {}) => ({
  estado: 'CLIENTE', pareceCelular: false, puedeVincular: true,
  cliente: { nombre: 'Ana Prueba', puntos: 1234, pedidos: 7, ultimoPedido: '2026-11-01T15:00:00Z', tieneCuenta: true, cuentaActiva: true, yaVinculadoA: null, registradoEn: '2026-01-02T15:00:00Z', celularEnmascarado: '···123', mismoNombre: true },
  ...o,
});

function montar(numero: string | null = 'AB1234567') {
  const alRechazar = vi.fn();
  const alCambiarBloqueo = vi.fn();
  render(<PreviaDocumentoUsuario usuarioId="5" tipo="CE" numero={numero} alRechazar={alRechazar} alCambiarBloqueo={alCambiarBloqueo} />);
  return { alRechazar, alCambiarBloqueo };
}
const esperar = { timeout: 3000 };

describe('PreviaDocumentoUsuario', () => {
  beforeEach(() => vi.resetAllMocks());

  it('no consulta sin número válido; con número espera 500 ms (una sola llamada)', async () => {
    montar(null);
    expect(api.post).not.toHaveBeenCalled();
    vi.mocked(api.post).mockResolvedValue({ estado: 'LIBRE', pareceCelular: false });
    montar();
    expect(api.post).not.toHaveBeenCalled(); // aún dentro del debounce
    expect(await screen.findByText('Documento libre: se puede usar', {}, esperar)).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/admin/usuarios/5/previa-documento', { tipoDocumento: 'CE', documento: 'AB1234567' });
  });

  it('OTRO_USUARIO: mensaje rojo y avisa el bloqueo', async () => {
    vi.mocked(api.post).mockResolvedValue({ estado: 'OTRO_USUARIO', pareceCelular: false, usuario: { nombre: 'Luis', rol: 'Cajero' } });
    const { alCambiarBloqueo } = montar();
    expect(await screen.findByText(/Ya es de Luis \(Cajero\) del equipo\. No se puede usar\./, {}, esperar)).toBeTruthy();
    await waitFor(() => expect(alCambiarBloqueo).toHaveBeenLastCalledWith(expect.stringContaining('Luis')));
  });

  it('CLIENTE: ficha con puntos, pedidos, celular y pregunta; bloquea el documento', async () => {
    vi.mocked(api.post).mockResolvedValue(cliente());
    const { alCambiarBloqueo } = montar();
    expect(await screen.findByText('1,234 puntos', {}, esperar)).toBeTruthy();
    expect(screen.getByText('Ana Prueba')).toBeTruthy();
    expect(screen.getByText(/7 pedidos pagados/)).toBeTruthy();
    expect(screen.getByText('Celular ···123')).toBeTruthy();
    expect(screen.getByText(/¿Es la misma persona\?/)).toBeTruthy();
    expect(alCambiarBloqueo).toHaveBeenLastCalledWith(expect.stringContaining('cliente'));
  });

  it('PARECE_CELULAR: advertencia sobre la ficha', async () => {
    vi.mocked(api.post).mockResolvedValue(cliente({ pareceCelular: true }));
    montar('907942491');
    expect(await screen.findByText(/parece un celular, no un documento/, {}, esperar)).toBeTruthy();
    expect(screen.getByText('Ana Prueba')).toBeTruthy();
  });

  it('vincular con mismo nombre: un Sí y queda vinculada', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(cliente()).mockResolvedValueOnce({ ok: true, vinculada: { nombre: 'Ana Prueba', celular: '···123' } });
    montar();
    fireEvent.click(await screen.findByText('Sí, vincular su cuenta de cliente', {}, esperar));
    fireEvent.click(screen.getByText('Sí, vincular'));
    expect(await screen.findByText(/Vinculada a Ana Prueba \(···123\) — recibe el descuento de personal/)).toBeTruthy();
    expect(api.post).toHaveBeenLastCalledWith('/admin/usuarios/5/cuenta-cliente/vincular-por-documento', { tipoDocumento: 'CE', documento: 'AB1234567' });
  });

  it('vincular con nombres distintos: segunda confirmación y confirmaMismaPersona', async () => {
    const c: any = cliente();
    c.cliente.mismoNombre = false;
    vi.mocked(api.post).mockResolvedValueOnce(c).mockResolvedValueOnce({ ok: true, vinculada: { nombre: 'Ana Prueba', celular: '···123' } });
    montar();
    fireEvent.click(await screen.findByText('Sí, vincular su cuenta de cliente', {}, esperar));
    fireEvent.click(screen.getByText('Sí, vincular'));
    fireEvent.click(await screen.findByText('Sí, es la misma persona'));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith(expect.stringContaining('vincular-por-documento'), expect.objectContaining({ confirmaMismaPersona: true })));
  });

  it('«No, es otra persona» limpia el número; no vinculable no ofrece el botón', async () => {
    vi.mocked(api.post).mockResolvedValue(cliente({ puedeVincular: false, motivo: 'Esa cuenta ya está vinculada a otro usuario del equipo.' }));
    const { alRechazar } = montar();
    expect(await screen.findByText(/ya está vinculada a otro usuario/, {}, esperar)).toBeTruthy();
    expect(screen.queryByText('Sí, vincular su cuenta de cliente')).toBeNull();
    fireEvent.click(screen.getByText('No, es otra persona'));
    expect(alRechazar).toHaveBeenCalled();
  });

  it('error en la vista previa: no muestra nada ni bloquea', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('x'));
    const { alCambiarBloqueo } = montar();
    await waitFor(() => expect(api.post).toHaveBeenCalled(), esperar);
    expect(alCambiarBloqueo).toHaveBeenLastCalledWith(null);
    expect(screen.queryByTestId('ficha-cliente')).toBeNull();
  });
});
