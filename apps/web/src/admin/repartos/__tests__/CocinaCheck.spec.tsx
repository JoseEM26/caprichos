import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CocinaCheck } from '../CocinaCheck';
import { TarjetaReparto } from '../TarjetaReparto';
import { TarjetaDespacho } from '../DespachoAdmin';

const area = (areaId: string, areaNombre: string, listo: boolean, despachada = false) => ({ areaId, areaNombre, listo, despachada });
const tres = [area('1', 'Salados', true), area('2', 'Barra', true), area('3', 'Postres', false)];
const conAreas = (o: Record<string, unknown> = {}) => ({
  id: '501', codigo: 'CP-0501', estado: 'PREPARANDO', areas: tres, areasListas: 2, areasTotal: 3, completo: false, ...o,
});

describe('CocinaCheck', () => {
  it('3 estados con icono y texto, resumen «2 de 3», franja «Falta» y aria-label', () => {
    render(<CocinaCheck pedido={conAreas({ areas: [...tres.slice(0, 2), area('3', 'Postres', false), ] })} />);
    expect(screen.getByText('✓ Salados')).toBeInTheDocument();
    expect(screen.getByText('✓ Barra')).toBeInTheDocument();
    expect(screen.getByText('⏳ Postres')).toBeInTheDocument();
    expect(screen.getByText('2 de 3 áreas listas')).toBeInTheDocument();
    expect(screen.getByText('Falta: Postres')).toBeInTheDocument();
    expect(screen.getByLabelText('Cocina: Salados lista, Barra lista, Postres falta')).toBeInTheDocument();
  });

  it('área despachada: «Ya salió»', () => {
    render(<CocinaCheck pedido={conAreas({ areas: [area('1', 'Salados', true, true), area('3', 'Postres', false)], areasListas: 1, areasTotal: 2 })} />);
    expect(screen.getByText('Salados · Ya salió')).toBeInTheDocument();
  });

  it('todo completo: «Todo listo: puedes recoger»', () => {
    render(<CocinaCheck pedido={conAreas({ estado: 'LISTO', areas: [area('1', 'Salados', true)], areasListas: 1, areasTotal: 1, completo: true })} />);
    expect(screen.getByText('Todo listo: puedes recoger')).toBeInTheDocument();
    expect(screen.getByText('1 de 1 área lista')).toBeInTheDocument();
  });

  it('se actualiza al cambiar los datos (cuando llega el refresco por socket)', () => {
    const { rerender } = render(<CocinaCheck pedido={conAreas()} />);
    expect(screen.getByText('Falta: Postres')).toBeInTheDocument();
    rerender(<CocinaCheck pedido={conAreas({ areas: tres.map((a) => ({ ...a, listo: true })), areasListas: 3, completo: true })} />);
    expect(screen.getByText('Todo listo: puedes recoger')).toBeInTheDocument();
  });

  it('no se muestra EN_CAMINO ni ENTREGADO', () => {
    const { container, rerender } = render(<CocinaCheck pedido={conAreas({ estado: 'EN_CAMINO' })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CocinaCheck pedido={conAreas({ estado: 'ENTREGADO' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sin comandas: «Aún no entra a cocina»', () => {
    render(<CocinaCheck pedido={conAreas({ estado: 'COLA', areas: [], areasListas: 0, areasTotal: 0 })} />);
    expect(screen.getByText(/aún no entra a cocina/i)).toBeInTheDocument();
  });
});

const base = {
  modalidad: 'DELIVERY', cliente_nombre: 'Lucía', cliente_telefono: '987654321', direccion: 'Av. 1', referencia: null, lat: -12.05, lng: -77.04,
  zona: null, zona_id: null, minutosEspera: 5, color: 'verde', total: 45, pago_estado: 'PAGADO', pago_metodo: 'YAPE', cobro_pendiente_efectivo: false,
  paga_con: null, repartidor_party_id: null, repartidor: null, tomado_en: null, salio_en: null, llego_en: null, entregado_en: null, motivo_falla: null,
  creado_en: new Date().toISOString(),
};

describe('Check «Cocina» en las tarjetas', () => {
  it('TarjetaReparto (repartidor) lo muestra', () => {
    render(<TarjetaReparto pedido={{ ...base, ...conAreas({ estado: 'LISTO' }) } as any} esMio alActualizar={() => {}} />);
    expect(screen.getByTestId('cocina-check-501')).toBeInTheDocument();
    expect(screen.getByText('Falta: Postres')).toBeInTheDocument();
  });

  it('TarjetaDespacho (admin) lo muestra para un pedido en cocina', () => {
    const pedido: any = { ...base, ...conAreas(), seccion: 'PREPARACION', etapa: null };
    render(
      <TarjetaDespacho d={{ pedido, numero: 1, fase: 'cocina' }} seleccionada={false} repartidores={[]} puedeAsignar
        alSeleccionar={() => {}} alAbrirDetalle={() => {}} alAsignar={() => {}} />,
    );
    expect(screen.getByText('2 de 3 áreas listas')).toBeInTheDocument();
  });
});
