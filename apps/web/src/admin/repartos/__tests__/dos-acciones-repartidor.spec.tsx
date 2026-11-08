import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { etapaDe, BotonEtapa } from '../RepartidorView';
import { enlaceLlamar } from '../textoVisible';
import { OpcionesRutaSugerida } from '../OpcionesRutaSugerida';

const base: any = { id: '1', codigo: 'CP-1', total: 20 };

describe('Delivery con dos acciones del repartidor', () => {
  it('LISTO -> «Ya salió»; EN_CAMINO sin llegada -> «Ya llegó»', () => {
    expect(etapaDe({ ...base, estado: 'LISTO' })).toMatchObject({ id: 'salir', texto: 'Ya salió' });
    expect(etapaDe({ ...base, estado: 'EN_CAMINO', llego_en: null })).toMatchObject({ id: 'llegue', texto: 'Ya llegó' });
  });

  it('pedido antiguo ya llegado sigue con su paso de cobro, no se rompe', () => {
    expect(etapaDe({ ...base, estado: 'EN_CAMINO', llego_en: '2026-11-01T10:00:00Z' }).id).toBe('entregar');
  });

  it('el botón muestra el texto de la etapa', () => {
    render(<BotonEtapa pedido={base} etapa={etapaDe({ ...base, estado: 'LISTO' })} onAccion={() => {}} />);
    expect(screen.getByTestId('btn-salir-1')).toHaveTextContent('Ya salió');
  });
});

describe('enlace de llamada', () => {
  it('normaliza a tel:+51 sin intent ni wa.me', () => {
    expect(enlaceLlamar('987 654 321')).toBe('tel:+51987654321');
    expect(enlaceLlamar('+51 987654321')).toBe('tel:+51987654321');
    expect(enlaceLlamar('51987654321')).toBe('tel:+51987654321');
    expect(enlaceLlamar('')).toBeNull();
  });
});

describe('rutas sin flechas', () => {
  it('las opciones de ruta numeran las paradas y no dibujan flechas (svg)', () => {
    const datos: any = {
      cupo: 3,
      sinUbicacion: [],
      opciones: [{ id: 'a', sector: 'NORTE', rumbo: 10, tiempoMin: 20, distanciaKm: 3, urgente: false, razon: 'x', pedidos: [{ id: '1', codigo: 'CP-1', cliente: 'Ana', llegadaMin: 5, retrasoMin: 0 }] }],
    };
    const { container } = render(
      <OpcionesRutaSugerida datos={datos} cargando={false} error={null} alReintentar={() => {}} seleccionadaId={null} alSeleccionar={() => {}} alCambiar={() => {}} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('ol li')).not.toBeNull();
  });
});
