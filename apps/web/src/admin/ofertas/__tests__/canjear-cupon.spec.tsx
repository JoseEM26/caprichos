import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ModalCanjearCupon } from '../ModalCanjearCupon';
import { ofertasApi, type RevisionCupon } from '../ofertasApi';
import { Icono } from '../../../comun/Icono';
import { CuponesCierre } from '../../cierre/CuponesCierre';

// Datos inventados
const buena: RevisionCupon = {
  codigo: 'ABC123', existe: true, aplicable: true, motivo: null, estado: 'VIGENTE', descuento: 5, nuevoTotal: 45, totalActual: 50,
  cupon: { codigoBase: 'GRACIAS10', descripcion: '10% de cortesia', modo: 'ASIGNADO_PERSONAL', tipo: 'PORCENTAJE', valor: 10, compraMinima: 20, alcance: null, canales: ['CAJA', 'MOZO'], venceEn: '2026-12-01T00:00:00Z' },
  dado: { por: 'Ana Mozo', en: '2026-11-10T15:00:00Z', pedido: 'CP-1', cliente: '9•••••321' },
  canje: null,
};

const abrir = (canal: 'CAJA' | 'MOZO' = 'CAJA') => {
  const alAplicado = vi.fn();
  const alCerrar = vi.fn();
  render(<ModalCanjearCupon pedido={{ id: '9', codigo: 'CP-9' }} canal={canal} alCerrar={alCerrar} alAplicado={alAplicado} />);
  return { alAplicado, alCerrar };
};
const revisar = (codigo: string) => {
  fireEvent.change(screen.getByLabelText('Código del cupón'), { target: { value: codigo } });
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));
};

describe('Canjear cupón', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(cleanup);

  it('el ícono de cupón existe y el código se normaliza a mayúsculas sin espacios', () => {
    const { container } = render(<Icono nombre="cupon" aria-hidden="true" />);
    expect(container.querySelector('svg path')?.getAttribute('d')).toContain('M3 9');
    cleanup();
    abrir();
    const campo = screen.getByLabelText('Código del cupón') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: ' ab c 1 ' } });
    expect(campo.value).toBe('ABC1');
  });

  it('revisar muestra los detalles sin aplicar nada', async () => {
    const revisarApi = vi.spyOn(ofertasApi, 'revisarCupon').mockResolvedValue(buena);
    const canjear = vi.spyOn(ofertasApi, 'canjearCupon');
    abrir('MOZO');
    revisar('abc123');
    const detalle = await screen.findByTestId('detalle-cupon');
    expect(revisarApi).toHaveBeenCalledWith('ABC123', '9', 'MOZO');
    expect(detalle).toHaveTextContent('GRACIAS10');
    expect(detalle).toHaveTextContent('10 % de descuento');
    expect(detalle).toHaveTextContent('S/ 50.00 pasa a S/ 45.00');
    expect(detalle).toHaveTextContent('Compra mínima');
    expect(detalle).toHaveTextContent('Vigente');
    expect(detalle).toHaveTextContent('Ana Mozo en el pedido CP-1 · cliente 9•••••321');
    expect(canjear).not.toHaveBeenCalled();
  });

  it('si no sirve: motivo claro y no deja pasar a confirmar', async () => {
    vi.spyOn(ofertasApi, 'revisarCupon').mockResolvedValue({
      ...buena, aplicable: false, motivo: 'Este cupón ya fue canjeado', estado: 'CANJEADO', descuento: null, nuevoTotal: null,
      canje: { en: '2026-11-12T15:00:00Z', por: 'Luis Caja', canal: 'CAJA', pedido: 'CP-3' },
    });
    abrir();
    revisar('ABC123');
    const detalle = await screen.findByTestId('detalle-cupon');
    expect(screen.getByRole('alert')).toHaveTextContent('No se puede aplicar: Este cupón ya fue canjeado');
    expect(detalle).toHaveTextContent('Canjeado');
    expect(detalle).toHaveTextContent('por Luis Caja en CP-3');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.queryByTestId('pregunta-aplicar')).not.toBeInTheDocument();
  });

  it('aplicar pide confirmación Sí/No; No no llama al servidor; Sí aplica con el canal y avisa', async () => {
    vi.spyOn(ofertasApi, 'revisarCupon').mockResolvedValue(buena);
    const canjear = vi.spyOn(ofertasApi, 'canjearCupon').mockResolvedValue({ canjeado: true, descuento: 5, totalActualizado: 45 });
    const { alAplicado, alCerrar } = abrir('CAJA');
    revisar('ABC123');
    await screen.findByTestId('detalle-cupon');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByTestId('pregunta-aplicar')).toHaveTextContent('¿Aplicar el cupón GRACIAS10 al pedido CP-9?');

    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(canjear).not.toHaveBeenCalled();
    expect(alCerrar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Sí, aplicar' }));
    await waitFor(() => expect(canjear).toHaveBeenCalledWith('ABC123', '9', 'CAJA'));
    await waitFor(() => expect(alAplicado).toHaveBeenCalled());
  });
});

describe('Cupones del turno en el cierre', () => {
  afterEach(cleanup);
  const datos = {
    porPersona: [
      {
        partyId: '7', nombre: 'Ana Mozo',
        dados: [{ codigo: 'D1', cupon: 'GRACIAS10', pedido: 'CP-1', cliente: '9•••••321', en: '2026-11-16T15:00:00Z', venceEn: '2026-12-01T00:00:00Z', estado: 'VIGENTE' }],
        canjeados: [{ codigo: 'C1', cupon: 'GRACIAS10', pedido: 'CP-2', descuento: 5, dioNombre: 'Luis Caja', canal: 'MOZO', en: '2026-11-16T16:00:00Z' }],
        pendientes: [{ codigo: 'D1', cupon: 'GRACIAS10', pedido: 'CP-1', cliente: '9•••••321', venceEn: '2026-12-01T00:00:00Z' }],
        totales: { dados: 1, canjeados: 1, pendientes: 1, descuento: 5 },
      },
    ],
    otros: { canjes: 2, descuento: 7.5 },
    totales: { dados: 1, canjeados: 1, pendientes: 1, descuento: 5 },
  };

  it('agrupa por persona, con totales, pendientes y la línea aparte de otros cupones', () => {
    render(<CuponesCierre datos={datos} />);
    expect(screen.getByRole('heading', { name: 'Cupones del turno' })).toBeInTheDocument();
    expect(screen.getByTestId('cupones-descuento')).toHaveTextContent('S/ 5.00');
    expect(screen.getByTestId('cupones-persona')).toHaveTextContent('Ana Mozo');
    expect(screen.getByTestId('cupon-dado-fila')).toHaveTextContent('9•••••321');
    expect(screen.getByTestId('cupon-canjeado-fila')).toHaveTextContent('Luis Caja');
    expect(screen.getByTestId('cupones-pendientes')).toHaveTextContent('D1');
    expect(screen.getByTestId('cupones-otros')).toHaveTextContent('2 · descuento S/ 7.50');
  });

  it('sin datos del servidor no muestra nada', () => {
    const { container } = render(<CuponesCierre datos={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
