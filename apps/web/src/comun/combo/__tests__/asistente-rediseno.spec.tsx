import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AsistenteCombo } from '../AsistenteCombo';
import { CamposVasos } from '../CamposVasos';
import { TextoResumenCombo } from '../TextoResumenCombo';
import type { PasoAsistente } from '../pasosCombo';

const bebidas = (hechos: boolean[]): PasoAsistente => ({
  id: 'bebidas',
  etiqueta: 'Bebidas',
  titulo: 'Bebidas',
  hecho: hechos.every(Boolean),
  falta: 'Elige tu bebida',
  avanzaSolo: true,
  slots: hechos.map((hecho, indice) => ({ id: `beb-1-${indice}`, etiqueta: `Bebida ${indice + 1}`, hecho, falta: `Elige tu bebida ${indice + 1}`, parteId: '1', indice })),
});

/** Ventana de prueba: el contenido de cada paso es un botón que marca el paso como hecho. */
function Prueba({ inicial, alAgregar }: { inicial: PasoAsistente[]; alAgregar: () => void }) {
  const [pasos, setPasos] = useState(inicial);
  const [indice, setIndice] = useState(0);
  const [sub, setSub] = useState(0);
  const p = pasos[Math.min(indice, pasos.length)];
  const marcar = (id: string, k?: number) =>
    setPasos((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        if (!q.slots) return { ...q, hecho: true };
        const slots = q.slots.map((s, i) => (i === k ? { ...s, hecho: true } : s));
        return { ...q, slots, hecho: slots.every((s) => s.hecho) };
      }),
    );
  return (
    <AsistenteCombo
      activo
      pasos={pasos}
      indice={indice}
      alCambiarIndice={(i) => {
        setIndice(i);
        setSub(0);
      }}
      subIndice={sub}
      alCambiarSub={setSub}
      titulo="Dúo Irresistible"
      precio={33}
      resumen="Regular 12 oz · FRAPPE BERRIES"
      resumenTexto={<p>Tu <strong>Dúo Irresistible</strong> en tamaño <strong>Regular 12 oz</strong>.</p>}
      cantidad={<button type="button">Más cantidad</button>}
      puedeAgregar={pasos.every((q) => q.hecho || q.opcional)}
      textoAgregar="Falta elegir"
      alAgregar={alAgregar}
    >
      {p?.slots ? (
        <button type="button" onClick={() => marcar(p.id, sub)}>{`Marcar ${p.slots[sub]?.etiqueta}`}</button>
      ) : p && !p.hecho ? (
        <button type="button" onClick={() => marcar(p.id)}>{`Marcar ${p.id}`}</button>
      ) : (
        <span>{`Contenido de ${p?.id}`}</span>
      )}
    </AsistenteCombo>
  );
}

describe('stepper del asistente', () => {
  const pasos: PasoAsistente[] = [
    { id: 'tamano', etiqueta: 'Tamaño', titulo: 'Tamaño', hecho: true, falta: 'Elige tu tamaño', avanzaSolo: true },
    bebidas([false, false, false, false]),
    { id: 'detalles', etiqueta: 'Detalles', titulo: 'Detalles', hecho: false, falta: 'Escribe el nombre del vaso', opcional: false },
  ];

  it('marca el paso actual con aria-current, los hechos con ✓ y los pendientes sin marca', () => {
    render(<Prueba inicial={pasos} alAgregar={() => {}} />);
    const nav = within(screen.getByTestId('progreso-asistente'));
    expect(nav.getByRole('button', { name: 'Paso 1: Tamaño, listo' })).toHaveTextContent('✓');
    // el paso actual es el primero (aunque ya esté listo); los pendientes no llevan aria-current
    expect(nav.getByRole('button', { name: 'Paso 1: Tamaño, listo' })).toHaveAttribute('aria-current', 'step');
    expect(nav.getByRole('button', { name: 'Paso 2: Bebidas, pendiente' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('button', { name: 'Paso 3: Detalles, pendiente' })).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 1 de 4');
    expect(screen.getByRole('button', { name: 'Paso 2: Bebidas, pendiente' }).closest('li')).toHaveAttribute('data-estado', 'pendiente');
    expect(screen.getByRole('button', { name: 'Paso 1: Tamaño, listo' }).closest('li')).toHaveAttribute('data-estado', 'hecho');
  });

  it('en un paso con varias bebidas muestra el sub-progreso «Bebida 1 de 4» con puntos', () => {
    render(<Prueba inicial={pasos} alAgregar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); // tamaño listo → Bebidas
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 1 de 4');
    expect(screen.getByRole('button', { name: 'Bebida 1, pendiente' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'Bebida 4, pendiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByTestId('motivo-siguiente')).toHaveTextContent('Elige tu bebida 1');
  });

  it('elegir una bebida avanza a la siguiente dentro del mismo paso; la última pasa al paso siguiente', () => {
    render(<Prueba inicial={pasos} alAgregar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Bebida 1' }));
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 2 de 4');
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 2 de 4');
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' })); // vuelve a la bebida 1, ya lista
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 1 de 4');
    expect(screen.getByRole('button', { name: 'Bebida 1, lista' })).toHaveTextContent('✓');
  });
});

describe('línea de resumen y pie', () => {
  it('la línea corta va en el pie junto al precio, con el texto completo en el title para truncarla sin perderla', () => {
    const largo = 'Regular 12 oz · FRAPPE BERRIES + CHOCONUBE + CAPUCCINO + ICED COFFE · 2 Oreo + 1 Caramel';
    render(
      <AsistenteCombo activo pasos={[{ id: 'tamano', etiqueta: 'Tamaño', titulo: 'Tamaño', hecho: true, falta: '' }]} indice={0} alCambiarIndice={() => {}} titulo="Dúo" precio={33} resumen={largo} puedeAgregar={false} textoAgregar="" alAgregar={() => {}}>
        <span>x</span>
      </AsistenteCombo>,
    );
    const linea = screen.getByTestId('resumen-asistente');
    expect(linea).toHaveAttribute('title', largo);
    expect(linea).toHaveTextContent(largo);
    expect(screen.getByText('S/ 33.00').closest('.ac-fila-resumen')).toContainElement(linea);
    // una sola línea de resumen en el pie
    expect(screen.getAllByText(largo)).toHaveLength(1);
  });

  it('en el último paso: tarjeta de texto, cantidad, «Cambiar» por cada paso y total; el pie solo lleva Agregar con el precio', () => {
    const alAgregar = vi.fn();
    const pasos: PasoAsistente[] = [
      { id: 'tamano', etiqueta: 'Tamaño', titulo: 'Tamaño', hecho: true, falta: '' },
      { id: 'sec-Cremas', etiqueta: 'Cremas', titulo: 'Cremas', hecho: true, falta: '' },
      { id: 'detalles', etiqueta: 'Detalles', titulo: 'Detalles', hecho: true, falta: '', opcional: false },
    ];
    render(<Prueba inicial={pasos} alAgregar={alAgregar} />);
    fireEvent.click(screen.getByRole('button', { name: /Paso 4: Resumen/ }));
    expect(screen.getByTestId('texto-resumen')).toHaveTextContent('Tu Dúo Irresistible en tamaño Regular 12 oz.');
    expect(screen.getByRole('button', { name: 'Más cantidad' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar tamaño' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar cremas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar detalles' })).toBeInTheDocument();
    expect(screen.getByTestId('total-resumen')).toHaveTextContent('S/ 33.00');
    // el pie: la línea corta no se repite; solo el botón con el precio
    expect(screen.queryByTestId('resumen-asistente')).toBeNull();
    expect(screen.getByRole('button', { name: /Agregar al pedido · S\/ 33.00/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    expect(alAgregar).toHaveBeenCalledTimes(1);
    // «Cambiar» vuelve al paso
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar cremas' }));
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 2 de 4');
  });

  it('si falta algo, el resumen lo dice y ofrece «Completar» hasta ese paso', () => {
    const pasos: PasoAsistente[] = [
      { id: 'tamano', etiqueta: 'Tamaño', titulo: 'Tamaño', hecho: true, falta: '' },
      { id: 'beb-1-0', etiqueta: 'Bebida 1', titulo: 'Bebida 1', hecho: false, falta: 'Elige tu bebida 1', slots: undefined },
    ];
    render(
      <AsistenteCombo activo pasos={pasos} indice={2} alCambiarIndice={() => {}} titulo="Dúo" precio={1} resumen="" resumenTexto={<p>x</p>} puedeAgregar={false} textoAgregar="Falta elegir" alAgregar={() => {}}>
        <span />
      </AsistenteCombo>,
    );
    expect(screen.getByTestId('falta-resumen')).toHaveTextContent('Falta: Elige tu bebida 1');
    expect(screen.getByRole('button', { name: 'Completar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resumen de tu combo' })).toHaveAttribute('aria-live', 'polite');
  });
});

describe('TextoResumenCombo', () => {
  it('lo elegido en una frase con los datos en negrita, sin secciones vacías', () => {
    render(
      <TextoResumenCombo
        d={{
          nombre: 'Dúo Irresistible',
          tamano: 'Regular 12 oz',
          bebidas: ['Choconube', 'Frappe Berries'],
          secciones: [
            { titulo: 'Cremas', elegidos: ['Oreo', 'Caramel'] },
            { titulo: 'Vacía', elegidos: [] },
          ],
          otros: [],
          extras: ['1 Papas nativas extra (S/ 6.00)'],
          vasos: ['Ana', 'Luis'],
          nota: 'sin hielo',
        }}
      />,
    );
    const t = screen.getByText(/Dúo Irresistible/).closest('p')!;
    expect(t).toHaveTextContent('Tu Dúo Irresistible en tamaño Regular 12 oz incluye 2 bebidas: Choconube, Frappe Berries.');
    expect(screen.getByText('Cremas')).toBeInTheDocument();
    expect(screen.queryByText('Vacía')).toBeNull();
    expect(screen.getByText('1 Papas nativas extra (S/ 6.00)')).toBeInTheDocument();
    expect(screen.getByText(/Vasos a nombre de:/)).toHaveTextContent('Vasos a nombre de: Ana, Luis.');
    expect(screen.getByText(/Nota para cocina:/)).toHaveTextContent('Nota para cocina: sin hielo.');
  });
});

describe('CamposVasos', () => {
  it('una fila por vaso: etiqueta con «Bebida N», la bebida debajo y el contador dentro del campo', () => {
    const onChange = vi.fn();
    render(
      <CamposVasos
        titulo="Nombres para el vaso"
        ayuda="Obligatorio · máx. 14 letras se ven completas en el vaso"
        filas={[
          { etiqueta: 'Bebida 1', bebida: 'CAPUCCINO', valor: 'Lucía', onChange },
          { etiqueta: 'Bebida 2', bebida: 'ICED COFFE', valor: '', onChange },
        ]}
      />,
    );
    expect(screen.getByText('Nombres para el vaso')).toBeInTheDocument();
    expect(screen.getByText('Obligatorio · máx. 14 letras se ven completas en el vaso')).toBeInTheDocument();
    const filas = document.querySelectorAll('.cv-fila');
    expect(filas).toHaveLength(2);
    expect(within(filas[0] as HTMLElement).getByText('Bebida 1')).toBeInTheDocument();
    expect(within(filas[0] as HTMLElement).getByText('CAPUCCINO')).toBeInTheDocument();
    expect(within(filas[0] as HTMLElement).getByText('5/14')).toBeInTheDocument();
    expect(screen.getByLabelText('CAPUCCINO · Nombre para el envase (obligatorio, máx. 14 letras se ven completas)')).toHaveValue('Lucía');
    fireEvent.change(screen.getByLabelText(/ICED COFFE/), { target: { value: 'Pedro' } });
    expect(onChange).toHaveBeenCalledWith('Pedro');
  });

  it('muestra el aviso de lo que falta con role alert', () => {
    render(<CamposVasos titulo="Nombres para el vaso" ayuda="x" filas={[{ etiqueta: 'Bebida 1', bebida: 'A', valor: '', onChange: () => {} }]} aviso="Escribe el nombre del vaso de la Bebida 1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del vaso de la Bebida 1');
  });
});
