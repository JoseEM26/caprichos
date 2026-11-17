import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MotivoAnulacion } from '../MotivoAnulacion';
import { InsigniaNumeroDia } from '../InsigniaNumeroDia';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import { ListaCaja } from '../ListaCaja';
import type { Pedido } from '../pedidosApi';

// Pedidos sintéticos
const anulado = {
  id: '10', codigo: 'CP-T010', canal: 'CARTA', modalidad: 'RECOGER', estado: 'ANULADO', pago_estado: 'PENDIENTE_ONLINE',
  total: 29, creado_en: new Date().toISOString(), cliente_nombre: 'Prueba', lineas: [], mediosPago: ['CULQI'],
  motivo_anulacion: 'Sin pago en línea en 15 minutos',
} as unknown as Pedido;

describe('Motivo de la anulación en Caja (F)', () => {
  it('muestra «Motivo: …» con el texto completo en title', () => {
    render(<MotivoAnulacion pedido={anulado} />);
    const m = screen.getByTestId('motivo-anulacion');
    expect(m.textContent).toBe('Motivo: Sin pago en línea en 15 minutos');
    expect(m.getAttribute('title')).toBe('Motivo: Sin pago en línea en 15 minutos');
  });

  it('no sale si el pedido no está anulado o no tiene motivo', () => {
    const { container, rerender } = render(<MotivoAnulacion pedido={{ ...anulado, estado: 'COLA' } as Pedido} />);
    expect(container.textContent).toBe('');
    rerender(<MotivoAnulacion pedido={{ ...anulado, motivo_anulacion: null } as Pedido} />);
    expect(container.textContent).toBe('');
  });

  it('la tarjeta de Caja y la lista lo muestran', () => {
    const { unmount } = render(<TarjetaPedidoCaja pedido={anulado} seleccionado={false} resaltado={false} cajaCerradaEspera={false} cambioCobroPendiente={false} alSeleccionar={() => {}} />);
    expect(screen.getByTestId('motivo-anulacion').textContent).toMatch(/Sin pago en línea en 15 minutos/);
    unmount();
    render(<ListaCaja filas={[anulado] as any} accionDe={() => null} resaltados={new Set()} alAccion={() => {}} alVerDetalle={() => {}} alAbrir={() => {}} />);
    expect(screen.getByTestId('motivo-anulacion').textContent).toMatch(/Sin pago en línea en 15 minutos/);
  });
});

describe('Número del día sin número (G)', () => {
  it('un pedido sin número no muestra ninguna raya suelta', () => {
    const { container } = render(<InsigniaNumeroDia numero={null} />);
    expect(container.textContent).toBe('');
  });
});
