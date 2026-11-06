import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { SelectorMesasCroquis, resumenMesas, etiquetaMesas } from '../componentes/SelectorMesasCroquis';
import { MesaSalon, PisoSalon } from '../tipos';

function mesa(id: string, numero: number, asientos: number): MesaSalon {
  return {
    id,
    pisoId: 'p1',
    tipo: 'MESA',
    numero,
    nombre: null,
    asientos,
    x: numero * 3,
    y: 0,
    ancho: 2,
    alto: 2,
    activo: true,
    estado: 'LIBRE',
    pedido: null,
    reserva: null,
  };
}

const pisos: PisoSalon[] = [
  {
    id: 'p1',
    nombre: 'Piso 1',
    activo: true,
    cuadriculaAncho: 20,
    cuadriculaAlto: 12,
    mesas: [mesa('m1', 1, 4), mesa('m2', 2, 2), mesa('m3', 3, 4)],
    elementos: [1, 2, 3].map((n) => ({
      id: `m${n}`,
      pisoId: 'p1',
      tipo: 'MESA',
      nombre: null,
      x: n * 3,
      y: 0,
      ancho: 2,
      alto: 2,
      numero: n,
      asientos: n === 2 ? 2 : 4,
      activo: true,
    })),
  },
];

/** Selector controlado, como lo usa la aprobación: el padre guarda la selección. */
function Controlado(props: { personas?: number; ocupadas?: Record<string, any>; onCambio?: (ids: string[]) => void; inicial?: string[] }) {
  const [sel, setSel] = useState<string[]>(props.inicial ?? []);
  return (
    <SelectorMesasCroquis
      pisos={pisos}
      seleccionadas={sel}
      personas={props.personas}
      ocupadas={props.ocupadas}
      onCambio={(ids) => {
        props.onCambio?.(ids);
        setSel(ids);
      }}
    />
  );
}

describe('SelectorMesasCroquis', () => {
  it('selecciona varias mesas tocándolas y resume «Mesas 1 y 3 · capacidad total 8»', () => {
    const onCambio = vi.fn();
    render(<Controlado personas={4} onCambio={onCambio} />);

    fireEvent.click(screen.getByText('1'));
    expect(onCambio).toHaveBeenLastCalledWith(['m1']);

    fireEvent.click(screen.getByText('3'));
    expect(onCambio).toHaveBeenLastCalledWith(['m1', 'm3']);
    expect(screen.getByRole('status')).toHaveTextContent('Mesas 1 y 3 · capacidad total 8');
  });

  it('tocar una mesa elegida la quita de la selección', () => {
    const onCambio = vi.fn();
    render(<Controlado personas={2} inicial={['m1', 'm3']} onCambio={onCambio} />);
    fireEvent.click(screen.getByText('1'));
    expect(onCambio).toHaveBeenLastCalledWith(['m3']);
  });

  it('una mesa ocupada a esa hora no se puede elegir y se ve como ocupada', () => {
    const onCambio = vi.fn();
    render(
      <Controlado
        personas={2}
        onCambio={onCambio}
        ocupadas={{ m2: { reservaId: '9', nombre: 'Ana', hora: '19:30' } }}
      />,
    );
    expect(screen.getByTitle(/Reservada para Ana/)).toBeInTheDocument();
    // Ocupada: el croquis la rotula con su nombre, no con el número
    fireEvent.click(screen.getByText('Mesa 2'));
    expect(onCambio).not.toHaveBeenCalled();
  });

  it('dibuja las mesas aunque el piso llegue sin «elementos» (así responde el salón)', () => {
    const sinElementos: PisoSalon[] = [{ ...pisos[0], elementos: undefined }];
    render(<SelectorMesasCroquis pisos={sinElementos} seleccionadas={[]} onCambio={() => {}} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('avisa si la capacidad total no alcanza para las personas, sin bloquear', () => {
    render(<Controlado personas={10} inicial={['m1', 'm3']} />);
    expect(screen.getByRole('alert')).toHaveTextContent('faltan 2');
  });

  it('sin mesas elegidas muestra el texto vacío y no avisa de capacidad', () => {
    render(<Controlado personas={2} />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin mesas elegidas');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('resumenMesas y etiquetaMesas (funciones puras)', () => {
  it('nombra 1, 2 y 3 o más mesas como «Mesa», «Mesas 3 y 4» y «Mesas 3, 4 y 5»', () => {
    expect(etiquetaMesas([{ numero: 3 }])).toBe('Mesa 3');
    expect(etiquetaMesas([{ numero: 3 }, { numero: 4 }])).toBe('Mesas 3 y 4');
    expect(etiquetaMesas([{ numero: 3 }, { numero: 4 }, { numero: 5 }])).toBe('Mesas 3, 4 y 5');
    expect(etiquetaMesas([])).toBe('');
  });

  it('calcula capacidad y asientos que faltan', () => {
    const elegidas = [mesa('a', 3, 4), mesa('b', 4, 2)];
    expect(resumenMesas(elegidas, 8)).toEqual({ texto: 'Mesas 3 y 4 · capacidad total 6', capacidad: 6, faltan: 2 });
    expect(resumenMesas(elegidas).faltan).toBe(0);
  });
});
