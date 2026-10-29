import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { CabeceraCarta } from '../CabeceraCarta';
import { MisPedidos } from '../MisPedidos';
import { TusPuntos } from '../cuenta/TusPuntos';
import { estimarPuntos } from '../cuenta/PuntosCanje';
import { api } from '../../comun/api';

const cuentaBase = {
  panelAbierto: false, abrirPanel: vi.fn(), cerrarPanel: vi.fn(), ingresar: vi.fn(), registrar: vi.fn(),
  actualizarPerfil: vi.fn(), subirFoto: vi.fn(), quitarFoto: vi.fn(), salir: vi.fn(), refrescar: vi.fn(),
};
const conPuntos = (puntos: number) =>
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    ...cuentaBase,
    cliente: { partyId: '1', nombre: 'José Pérez', dniMascara: '7617****', correo: null, telefono: '987654321', fotoUrl: null, cumpleanos: null, puntos },
  } as any);

describe('Carta ▸ puntos siempre visibles', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('la cabecera muestra «0 pts» con saldo 0 y «12 pts» con saldo', () => {
    for (const [saldo, texto] of [[0, '0 pts'], [12, '12 pts']] as const) {
      conPuntos(saldo);
      const { unmount } = render(
        <CarritoProvider>
          <CabeceraCarta busqueda="" onCambioBusqueda={() => {}} estadoLocal={{ abierta: true } as any} datosLocal={{} as any} pagina="carta" onPagina={() => {}} categorias={[]} categoriaActivaId="todo" onCategoria={() => {}} />
        </CarritoProvider>,
      );
      expect(screen.getByText(texto)).toBeInTheDocument();
      unmount();
    }
  });

  it('estimarPuntos: 5 % de lo canjeable, 0 con cupón, descuenta lo pagado con puntos', () => {
    expect(estimarPuntos({ canjeable: 15, porcentaje: 5, puntosAplicados: 0, conCupon: false })).toBe(0.75);
    expect(estimarPuntos({ canjeable: 15, porcentaje: 5, puntosAplicados: 0, conCupon: true })).toBe(0);
    expect(estimarPuntos({ canjeable: 0, porcentaje: 5, puntosAplicados: 0, conCupon: false })).toBe(0);
    expect(estimarPuntos({ canjeable: 20, porcentaje: 5, puntosAplicados: 10, conCupon: false })).toBe(0.5);
    expect(estimarPuntos({ canjeable: 15, porcentaje: 5, puntosAplicados: 0, conCupon: false, delServidor: 0.7 })).toBe(0.7);
  });

  it('TusPuntos explica cómo funcionan (3 líneas) y lista los movimientos', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      porcentaje: 5,
      pagina: 1,
      hayMas: false,
      movimientos: [
        { id: '1', tipo: 'SUMA', puntos: 0.73, motivo: 'Puntos por pedido CP-W026', fecha: '2026-10-29T18:00:00Z', pedido: { codigo: 'CP-W026' } },
        { id: '2', tipo: 'CANJE', puntos: 2, motivo: 'Canje de puntos', fecha: '2026-10-29T19:00:00Z', pedido: null },
      ],
    });
    render(<TusPuntos puntos={3.5} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cómo funcionan' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
    expect(screen.getByText(/Ganas 5 %/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mis movimientos' }));
    expect(await screen.findByText('+0.73')).toBeInTheDocument();
    expect(screen.getByText('−2.00')).toBeInTheDocument();
    expect(screen.getByText(/Puntos por pedido CP-W026/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/carta/cuenta/puntos/movimientos?pagina=1');
  });

  it('Mis pedidos muestra los puntos de cada pedido o el motivo', async () => {
    conPuntos(0);
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: { partyId: '1', nombre: 'José', puntos: 0 } } as any);
    const fila = (codigo: string, puntos: any) => ({
      codigo, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado', modalidad: 'RECOGER', total: 15, terminado: true, anulado: false,
      creadoEn: new Date().toISOString(), resumen: '1 x Frappe', seguimientoToken: `t-${codigo}`, pasos: [], puntos,
    });
    vi.spyOn(api, 'get').mockResolvedValue({
      hayMas: false,
      pagina: 1,
      pedidos: [
        fila('CP-1', { estado: 'PENDIENTE_DE_COBRO', estimado: 0.75, texto: 'Se sumarán 0.75 puntos cuando Caja cobre tu pedido' }),
        fila('CP-2', { estado: 'NO_SUMA', motivo: 'SOLO_PROMOCION', texto: 'Los combos y promociones no suman puntos' }),
      ],
    });
    function Abrir() {
      const { setListaPedidosAbierta } = useCarrito();
      useEffect(() => setListaPedidosAbierta(true), [setListaPedidosAbierta]);
      return null;
    }
    render(<CarritoProvider><Abrir /><MisPedidos /></CarritoProvider>);
    expect(await screen.findByText(/\+0\.75 pts al cobrarse/)).toBeInTheDocument();
    expect(screen.getByText(/Los combos y promociones no suman puntos/)).toBeInTheDocument();
  });
});
