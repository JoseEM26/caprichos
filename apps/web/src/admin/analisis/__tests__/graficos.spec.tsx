import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BarrasHorizontales, ListaRanking, MapaDeCalor, PanelDetalle, Semaforo, TarjetaAnalisis, TarjetaIndicador } from '../comun';
import { textoMinutos, errorDeRango, rangoDePreset, sumarDias } from '../comun/fechas';

describe('Semaforo', () => {
  it('dice la palabra además de usar color y forma', () => {
    render(<Semaforo nivel="rojo" />);
    expect(screen.getByText('Pasada de la meta')).toBeInTheDocument();
    expect(screen.getByText('■')).toHaveAttribute('aria-hidden', 'true');
  });
  it('sin dato no inventa un color de aprobación', () => {
    render(<Semaforo nivel="sin_dato" />);
    expect(screen.getByText('Sin dato')).toBeInTheDocument();
  });
});

describe('BarrasHorizontales', () => {
  const filas = [
    { id: 'a', nombre: 'Cocina', valor: 12, texto: '12 min', meta: 15, semaforo: 'verde' as const },
    { id: 'b', nombre: 'Reparto', valor: 30, texto: '30 min', meta: 20, semaforo: 'rojo' as const, destacada: true },
    { id: 'c', nombre: 'Cobro', valor: null, texto: 'Sin dato' },
  ];

  it('es una lista con nombre accesible; la fila destacada lleva la palabra, no solo el borde', () => {
    render(<BarrasHorizontales filas={filas} descripcion="Minutos por etapa" />);
    const lista = screen.getByRole('list', { name: 'Minutos por etapa' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Más lenta')).toBeInTheDocument();
    expect(screen.getByText('Meta: 20 min')).toBeInTheDocument();
  });

  it('una fila sin dato dice Sin dato y no dibuja barra', () => {
    const { container } = render(<BarrasHorizontales filas={filas} descripcion="x" />);
    expect(screen.getByText('Sin dato')).toBeInTheDocument();
    expect(container.querySelectorAll('.an-barras__barra')).toHaveLength(2);
  });

  it('con alElegir cada fila es un botón y marca la elegida', () => {
    const elegir = vi.fn();
    render(<BarrasHorizontales filas={filas} descripcion="x" alElegir={elegir} elegida="b" />);
    const botones = screen.getAllByRole('button');
    expect(botones).toHaveLength(3);
    expect(botones[1]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(botones[0]);
    expect(elegir).toHaveBeenCalledWith('a');
  });
});

describe('MapaDeCalor', () => {
  it('es una tabla con el número en cada celda y «–» donde no hay dato', () => {
    render(<MapaDeCalor descripcion="Pedidos por hora" filas={['Lun', 'Mar']} columnas={['12', '13']} valores={[[1, 8], [null, 4]]} />);
    const tabla = screen.getByRole('table', { name: 'Pedidos por hora' });
    expect(within(tabla).getByText('8')).toBeInTheDocument();
    expect(within(tabla).getByText('–')).toBeInTheDocument();
    expect(within(tabla).getByRole('rowheader', { name: 'Mar' })).toBeInTheDocument();
  });
});

describe('ListaRanking', () => {
  it('ordena de mayor a menor y corta en el máximo', () => {
    render(
      <ListaRanking
        descripcion="Top"
        max={2}
        items={[
          { id: '1', nombre: 'Menor', valor: 1, texto: '1' },
          { id: '2', nombre: 'Mayor', valor: 9, texto: '9' },
          { id: '3', nombre: 'Medio', valor: 5, texto: '5' },
        ]}
      />,
    );
    const filas = within(screen.getByRole('list', { name: 'Top' })).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Mayor');
    expect(filas[1]).toHaveTextContent('Medio');
  });
});

describe('TarjetaAnalisis', () => {
  it('cargando, vacío y error con Reintentar', () => {
    const reintentar = vi.fn();
    const { rerender } = render(<TarjetaAnalisis id="t" titulo="Mi gráfico" estado="cargando" />);
    expect(screen.getByRole('status', { name: 'Cargando Mi gráfico' })).toBeInTheDocument();
    rerender(<TarjetaAnalisis id="t" titulo="Mi gráfico" estado="vacio" vacio="Nada por aquí" />);
    expect(screen.getByText('Nada por aquí')).toBeInTheDocument();
    rerender(<TarjetaAnalisis id="t" titulo="Mi gráfico" estado="error" alReintentar={reintentar} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reintentar).toHaveBeenCalled();
  });

  it('con datos trae su tabla alterna plegada', () => {
    render(
      <TarjetaAnalisis id="t" titulo="G" estado="ok" tabla={{ cabecera: ['Etapa', 'Min'], filas: [['Cocina', 12]] }}>
        <div>grafico</div>
      </TarjetaAnalisis>,
    );
    expect(screen.getByText('Ver como tabla')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Min' })).toBeInTheDocument();
  });
});

describe('TarjetaIndicador y PanelDetalle', () => {
  it('indicador con semáforo', () => {
    render(<TarjetaIndicador titulo="Cocina" valor="12 min" detalle="Meta 15" semaforo="verde" />);
    expect(screen.getByText('12 min')).toBeInTheDocument();
    expect(screen.getByText('En meta')).toBeInTheDocument();
  });
  it('el detalle es una región inline (no un diálogo) y se cierra con Esc', () => {
    const cerrar = vi.fn();
    render(
      <PanelDetalle titulo="Cocina" alCerrar={cerrar}>
        <p>contenido</p>
      </PanelDetalle>,
    );
    const region = screen.getByRole('region', { name: 'Detalle: Cocina' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(region, { key: 'Escape' });
    expect(cerrar).toHaveBeenCalled();
  });
});

describe('fechas', () => {
  it('presets en horario de Lima', () => {
    expect(rangoDePreset('hoy', '2026-11-11')).toEqual({ desde: '2026-11-11', hasta: '2026-11-11' });
    expect(rangoDePreset('ayer', '2026-11-11')).toEqual({ desde: '2026-11-10', hasta: '2026-11-10' });
    expect(rangoDePreset('7d', '2026-11-11')).toEqual({ desde: '2026-11-05', hasta: '2026-11-11' });
    expect(rangoDePreset('30d', '2026-11-11')).toEqual({ desde: '2026-10-13', hasta: '2026-11-11' });
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('valida invertido, futuro y más de 92 días', () => {
    expect(errorDeRango('2026-11-11', '2026-11-10', '2026-11-11')).toMatch(/después/);
    expect(errorDeRango('2026-11-11', '2026-11-12', '2026-11-11')).toMatch(/futuro/);
    expect(errorDeRango('2026-08-11', '2026-11-11', '2026-11-11')).toMatch(/92/);
    expect(errorDeRango('2026-08-12', '2026-11-11', '2026-11-11')).toBe('');
  });
  it('minutos en texto corto', () => {
    expect(textoMinutos(0.5)).toBe('30 s');
    expect(textoMinutos(7.5)).toBe('7,5 min');
    expect(textoMinutos(130)).toBe('2 h 10 min');
    expect(textoMinutos(null)).toBe('Sin dato');
  });
});
