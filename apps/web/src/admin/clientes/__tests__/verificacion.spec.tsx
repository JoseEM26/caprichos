import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientesAdminView } from '../ClientesAdminView';
import { InsigniaGasta, InsigniaVerificacion } from '../InsigniasVerificacion';
import * as clientesApi from '../clientesApi';
import type { ClienteItem } from '../tipos';

const cli = (id: string, nombre: string, extra: Partial<ClienteItem>): ClienteItem => ({
  id, nombre, tipo: 'Persona', telefono: '999888777', correo: 'sin correo', cumpleanos: '—', pedidos: 0, puntos: 12,
  creditoPersonal: false, envioFijo: null, descuentoEnvio: null, activo: true, ...extra,
});

const verificada = cli('1', 'Vera Verificada', {
  verificado: true, verificadoEn: '2026-11-05T15:00:00.000Z', estadoVerificacion: 'VERIFICADO', tieneContrasena: true, puedeGastarPuntos: true,
});
const mostrador = cli('2', 'Mario Mostrador', {
  verificado: false, estadoVerificacion: 'SIN_VERIFICAR', razonSinVerificar: 'MOSTRADOR', tieneContrasena: false, puedeGastarPuntos: false,
});
const antigua = cli('3', 'Aida Antigua', { verificado: false, estadoVerificacion: 'ANTIGUA', tieneContrasena: true, puedeGastarPuntos: true });

describe('Clientes ▸ verificación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(clientesApi, 'listarClientes').mockResolvedValue({
      items: [verificada, mostrador, antigua], total: 3, pagina: 1, paginas: 1,
      contadores: { verificados: 1, sinVerificar: 2, gastanPuntos: 2 },
    });
    vi.spyOn(clientesApi, 'obtenerFichaCliente').mockResolvedValue({} as any);
    vi.spyOn(clientesApi, 'listarHistorialPuntos').mockResolvedValue([]);
  });

  it('insignia verde con icono, texto y tooltip con la fecha', () => {
    render(<InsigniaVerificacion cliente={verificada} />);
    const b = screen.getByTestId('insignia-verificacion');
    expect(b).toHaveTextContent('✓ Verificado');
    expect(b.title).toMatch(/Creó su contraseña y confirmó su celular con el código de WhatsApp el 05\/11\/2026/);
  });

  it('sin verificar muestra la razón y la cuenta antigua se dice en gris sin inventar', () => {
    const { unmount } = render(<InsigniaVerificacion cliente={mostrador} />);
    expect(screen.getByTestId('insignia-verificacion')).toHaveTextContent('Sin verificar · Creado en mostrador');
    unmount();
    render(<InsigniaVerificacion cliente={{ ...mostrador, razonSinVerificar: 'SIN_CONTRASENA' }} />);
    expect(screen.getByTestId('insignia-verificacion')).toHaveTextContent('No creó contraseña');
  });

  it('cuenta antigua: Verificación no registrada', () => {
    render(<InsigniaVerificacion cliente={antigua} />);
    expect(screen.getByTestId('insignia-verificacion')).toHaveTextContent('Verificación no registrada (cuenta antigua)');
  });

  it('sin dato de la API no pinta nada; «Puede gastar» solo si corresponde y muestra el saldo', () => {
    const { container, unmount } = render(<InsigniaVerificacion cliente={{}} />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    const r = render(<InsigniaGasta cliente={mostrador} saldo={12} />);
    expect(r.container).toBeEmptyDOMElement();
    r.unmount();
    render(<InsigniaGasta cliente={verificada} saldo={12} />);
    expect(screen.getByTestId('insignia-gasta')).toHaveTextContent('Puede gastar sus puntos (12.00)');
  });

  it('las tarjetas muestran las insignias', async () => {
    render(<ClientesAdminView />);
    await waitFor(() => expect(screen.getByText('Vera Verificada')).toBeInTheDocument());
    expect(screen.getAllByTestId('insignia-verificacion')).toHaveLength(3);
    expect(screen.getAllByTestId('insignia-gasta')).toHaveLength(2);
  });

  it('filtros: Verificación y Pueden gastar piden al servidor y muestran contadores', async () => {
    render(<ClientesAdminView />);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Verificación: Todos' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Verificación: Todos' }));
    expect(screen.getByRole('option', { name: 'Verificados (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Sin verificar (2)' }));
    await waitFor(() =>
      expect(clientesApi.listarClientes).toHaveBeenCalledWith(expect.objectContaining({ verificacion: 'sin_verificar' })),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pueden gastar sus puntos: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sí (2)' }));
    await waitFor(() =>
      expect(clientesApi.listarClientes).toHaveBeenCalledWith(expect.objectContaining({ gastaPuntos: true })),
    );
  });
});
