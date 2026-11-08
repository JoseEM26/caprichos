import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CierreView } from '../CierreView';
import { cierreApi } from '../cierreApi';
import { pedidosApi } from '../../pedidos/pedidosApi';
import * as sesionModulo from '../../../comun/sesion';

// Ya no existe el código del supervisor: el SUPERVISOR cierra como el ADMIN, viendo el detalle del cuadre
function usarSesion(rol: string) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: rol === 'SUPERVISOR' ? '3' : '2', nombres: 'Persona de prueba', rol },
    permisos: ['caja/ver', 'caja/cerrar'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  });
}

describe('cierre: el SUPERVISOR cierra sin ningún código', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({
      abierta: true,
      caja: { id: 10, estado: 'ABIERTA', apertura: 50 },
    } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarPendientesDeCobro').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 10,
      fecha: `${hoy}T00:00:00.000Z`,
      apertura: 50,
      efectivoEsperado: 355,
      medios: { efectivo: 355, yape: 210, plin: 0, transferencia: 0, tarjeta: 120 },
      desglose: { ventasEfectivo: 300, ingresos: 20, egresos: 15 },
    } as any);
    vi.spyOn(cierreApi, 'realizarArqueo').mockResolvedValue({ resultado: 'NO_CUADRA', intento: 1 } as any);
    vi.spyOn(cierreApi, 'cerrarCaja').mockResolvedValue({} as any);
  });

  async function llegarAlConteo() {
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja y cuadrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ya revisé: continuar al conteo' }));
  }

  it('no muestra ningún campo de código al contar y cerrar', async () => {
    usarSesion('SUPERVISOR');
    render(<CierreView />);
    await llegarAlConteo();

    expect(await screen.findByRole('button', { name: 'Cerrar caja' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Código de la supervisora/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Código del supervisor/i)).not.toBeInTheDocument();
  });

  it('confirma el cierre con descuadre solo con la nota', async () => {
    usarSesion('SUPERVISOR');
    render(<CierreView />);
    await llegarAlConteo();

    fireEvent.change(await screen.findByLabelText('Cantidad de billetes de S/ 100'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Nota explicativa/i), { target: { value: 'Faltante de turno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    fireEvent.click(await screen.findByRole('button', { name: /Sí, continuar/ }));

    await waitFor(() => expect(cierreApi.cerrarCaja).toHaveBeenCalledTimes(1));
    expect(cierreApi.cerrarCaja).toHaveBeenCalledWith(expect.objectContaining({ conteo: expect.any(Object), nota: 'Faltante de turno' }));
  });
});
