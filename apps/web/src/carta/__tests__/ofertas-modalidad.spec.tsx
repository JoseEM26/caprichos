import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { TarjetaOferta } from '../TarjetaOferta';
import { aplicaModalidad, etiquetaModalidades } from '../modalidadOferta';
import { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';

vi.mock('../../comun/api', async () => {
  const real = await vi.importActual<typeof import('../../comun/api')>('../../comun/api');
  return { ...real, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const estado: EstadoLocalCarta = { abierta: true, motivo: 'OK', texto: 'Abierto', abre: '14:00', cierra: '22:00', pausaAltaDemanda: false, tiempoPrometidoMin: 25, altaDemandaMin: 0 };
const datos: DatosLocalCarta = {
  nombre: 'Caprichos', direccion: 'Av. Las Delicias 123', telefono: '999888777', whatsapp: '999888777', redes: {}, horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true } }, envioGratisDesde: 70, pedidoMinimo: 0, invitadoPermitido: false,
  propina: { carta: false, bot: false, tope: 50 },
};

describe('modalidades de la oferta en la carta (reglas)', () => {
  it('vacío = todas; llevar y recoger valen entre sí', () => {
    expect(aplicaModalidad([], 'DELIVERY')).toBe(true);
    expect(aplicaModalidad(['COMER_LOCAL'], 'DELIVERY')).toBe(false);
    expect(aplicaModalidad(['COMER_LOCAL'], 'COMER_LOCAL')).toBe(true);
    expect(aplicaModalidad(['LLEVAR'], 'RECOGER')).toBe(true);
  });

  it('etiquetas «Solo …»', () => {
    expect(etiquetaModalidades([])).toBeNull();
    expect(etiquetaModalidades(['DELIVERY'])).toBe('Solo delivery');
    expect(etiquetaModalidades(['COMER_LOCAL'])).toBe('Solo comer en el local');
    expect(etiquetaModalidades(['LLEVAR', 'RECOGER'])).toBe('Solo para llevar');
    expect(etiquetaModalidades(['COMER_LOCAL', 'LLEVAR', 'DELIVERY'])).toBeNull();
  });
});

const oferta: any = {
  id: '7', tipo: 'COMBO', nombre: 'Combo Salón', descripcion: '', lleva: null, paga: null, alcanceCategoriaId: null, alcanceProductoId: null,
  descuentoTipo: null, descuentoValor: null, compraMinima: null, dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null,
  canales: ['CARTA'], modalidades: ['COMER_LOCAL'], limiteUsos: null, usosActuales: 0, noSumaBeneficios: false, orden: 0, activo: true,
  creadoEn: '2026-10-22T05:39:18.163Z', categoriaNombre: null, productoNombre: null, vigenteAhora: true, imagenArchivoId: null, imagenUrl: null,
  combosPrecio: [], combosParte: [],
};

describe('TarjetaOferta: etiqueta de modalidad', () => {
  it('una oferta restringida muestra «Solo comer en el local»; una libre no muestra etiqueta', () => {
    const tarjeta = (o: any) => (
      <CarritoProvider>
        <TarjetaOferta oferta={o} categorias={[]} productos={[]} />
      </CarritoProvider>
    );
    const { rerender } = render(tarjeta(oferta));
    expect(screen.getByTestId('etiqueta-modalidad')).toHaveTextContent('Solo comer en el local');
    rerender(tarjeta({ ...oferta, modalidades: [] }));
    expect(screen.queryByTestId('etiqueta-modalidad')).toBeNull();
  });
});

function Pagina() {
  const { agregarLinea, abrirCheckout } = useCarrito();
  return (
    <div>
      <button
        onClick={() => {
          agregarLinea({ productoId: 'prod-1', nombre: 'Combo Salón', precioBase: 20, cantidad: 1, opciones: [], precioUnitario: 20, subtotal: 20, ofertaId: '7' } as any);
          abrirCheckout();
        }}
      >
        Abrir pedido
      </button>
      <FormularioCheckout estadoLocal={estado} datosLocal={datos} />
    </div>
  );
}

describe('checkout: la oferta se valida contra la modalidad elegida', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta === '/carta/ofertas') return [oferta];
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockResolvedValue({ descuentoTotal: 0, detalles: [] });
  });

  it('en delivery avisa que no aplica y bloquea el envío; al cambiar a comer en el local desaparece sin perder el carrito y recalcula', async () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
    render(
      <CarritoProvider>
        <Pagina />
      </CarritoProvider>,
    );
    fireEvent.click(screen.getByText('Abrir pedido'));
    const aviso = await screen.findByTestId('aviso-oferta-modalidad');
    expect(aviso).toHaveTextContent('no aplica para delivery');
    expect(aviso).toHaveTextContent('Combo Salón');
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    await waitFor(() => expect(screen.queryByTestId('aviso-oferta-modalidad')).toBeNull());
    await waitFor(() =>
      expect(vi.mocked(api.post).mock.calls.some((c) => c[0] === '/carta/descuentos/vista-previa' && (c[1] as any).modalidad === 'COMER_LOCAL')).toBe(true),
    );
  });
});
