import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AsistenteCombo } from '../AsistenteCombo';
import { decisionesDe, pasosCombo, UMBRAL_ASISTENTE, type EntradaPasos, type PasoAsistente } from '../pasosCombo';

const base: EntradaPasos = {
  tamano: { hay: true, elegido: true },
  grupoPaquete: '',
  paqueteElegido: true,
  alternativas: [],
  bebidas: [{ parteId: '1', slots: [{ indice: 0, hecho: false }, { indice: 1, hecho: false }] }],
  piezas: [],
  secciones: [],
  nombres: { total: 2, faltan: 2, primera: 'Escribe el nombre del vaso de la Bebida 1' },
  opcionales: false,
};

describe('pasosCombo (regla compartida carta y mozo)', () => {
  it('un paso por decisión: tamaño, cada bebida (con 1 o 2) y un único paso final «Detalles» (nombres, extras y nota)', () => {
    const pasos = pasosCombo(base);
    expect(pasos.map((p) => p.id)).toEqual(['tamano', 'beb-1-0', 'beb-1-1', 'detalles']);
    expect(pasos[1]).toMatchObject({ etiqueta: 'Bebida 1', avanzaSolo: true, hecho: false, falta: 'Elige tu bebida 1' });
    expect(pasos[3]).toMatchObject({ etiqueta: 'Detalles', opcional: false, incluye: ['nombres', 'nota'] });
  });

  it('con 3 o más bebidas: una sola etapa «Bebidas» con un sub-paso por bebida', () => {
    const pasos = pasosCombo({
      ...base,
      bebidas: [{ parteId: '1', slots: [0, 1, 2, 3].map((indice) => ({ indice, hecho: indice < 2 })) }],
    });
    expect(pasos.map((p) => p.id)).toEqual(['tamano', 'bebidas', 'detalles']);
    const bebidas = pasos[1];
    expect(bebidas).toMatchObject({ etiqueta: 'Bebidas', hecho: false, falta: 'Elige tu bebida 3' });
    expect(bebidas.slots).toHaveLength(4);
    expect(bebidas.slots?.[2]).toMatchObject({ etiqueta: 'Bebida 3', hecho: false, parteId: '1', indice: 2 });
  });

  it('los extras van con el complemento o la última sección; sin ellos, con Detalles; nunca son un paso propio', () => {
    const conComp = pasosCombo({ ...base, opcionales: true, bebidas: [], nombres: { total: 0, faltan: 0, primera: '' }, grupoPaquete: '', piezas: [{ parteId: '3', faltan: 0 }] });
    expect(conComp.find((p) => p.id === 'comp')?.incluye).toEqual(['opc']);
    expect(conComp.find((p) => p.id === 'detalles')?.incluye).toEqual(['nombres', 'nota']);
    const conSeccion = pasosCombo({ ...base, opcionales: true, bebidas: [], nombres: { total: 0, faltan: 0, primera: '' }, secciones: [{ clave: 'Cremas', completa: false, unica: false, falta: 'Elige en Cremas' }] });
    expect(conSeccion.find((p) => p.id === 'sec-Cremas')?.incluye).toEqual(['opc']);
    const solo = pasosCombo({ ...base, opcionales: true, bebidas: [], nombres: { total: 0, faltan: 0, primera: '' } });
    expect(solo.find((p) => p.id === 'detalles')?.incluye).toEqual(['nombres', 'nota', 'opc']);
    expect(solo.some((p) => p.id === 'opc' || p.id === 'nota')).toBe(false);
  });

  it('el complemento con paquete pide el paquete antes que sus lugares', () => {
    const pasos = pasosCombo({
      ...base,
      grupoPaquete: 'Complemento',
      paqueteElegido: false,
      bebidas: [],
      nombres: { total: 0, faltan: 0, primera: '' },
      piezas: [{ parteId: '3', faltan: 2 }],
    });
    const comp = pasos.find((p) => p.id === 'comp')!;
    expect(comp).toMatchObject({ hecho: false, falta: 'Elige tu complemento' });
    const conPaquete = pasosCombo({ ...base, grupoPaquete: 'Complemento', paqueteElegido: true, bebidas: [], nombres: { total: 0, faltan: 0, primera: '' }, piezas: [{ parteId: '3', faltan: 2 }] });
    expect(conPaquete.find((p) => p.id === 'comp')).toMatchObject({ hecho: false, falta: 'Elige 2 lugar(es) más' });
  });

  it('lugares: 0 de 2 no está listo; 2 de 2 sí; más de 2 pide quitar', () => {
    const en = (faltan: number) => pasosCombo({ ...base, bebidas: [], nombres: { total: 0, faltan: 0, primera: '' }, piezas: [{ parteId: '2', faltan }] }).find((p) => p.id === 'comp')!;
    expect(en(2).hecho).toBe(false);
    expect(en(0).hecho).toBe(true);
    expect(en(-1)).toMatchObject({ hecho: false, falta: 'Quita 1 opción(es)' });
  });

  it('la regla de asistente cuenta solo las decisiones (no la nota ni los extras)', () => {
    const pasos = pasosCombo({ ...base, bebidas: [{ parteId: '1', slots: [{ indice: 0, hecho: true }] }], nombres: { total: 0, faltan: 0, primera: '' } });
    expect(decisionesDe(pasos)).toBe(2); // tamaño + bebida 1 (Detalles, sin nombres, es opcional)
    expect(decisionesDe(pasos)).toBeLessThan(UMBRAL_ASISTENTE);
  });
});

/** Ventana de prueba: los pasos se marcan como hechos desde fuera; el contenido de cada paso es un botón. */
function Prueba({ pasos: inicial, alAgregar }: { pasos: PasoAsistente[]; alAgregar: () => void }) {
  const [pasos, setPasos] = useState(inicial);
  const [indice, setIndice] = useState(0);
  const actual = pasos[Math.min(indice, pasos.length)];
  return (
    <AsistenteCombo
      activo
      pasos={pasos}
      indice={indice}
      alCambiarIndice={setIndice}
      titulo="Dúo"
      precio={33}
      resumen="Regular 12 oz"
      puedeAgregar={pasos.every((p) => p.hecho || p.opcional)}
      textoAgregar="Falta elegir: Bebida 2"
      alAgregar={alAgregar}
    >
      {pasos.map((p) => (
        <button key={p.id} type="button" hidden={!actual || actual.id !== p.id} onClick={() => setPasos((prev) => prev.map((q) => (q.id === p.id ? { ...q, hecho: true } : q)))}>
          {`Marcar ${p.id}`}
        </button>
      ))}
    </AsistenteCombo>
  );
}

describe('AsistenteCombo', () => {
  const pasos: PasoAsistente[] = [
    { id: 'tamano', etiqueta: 'Tamaño', titulo: 'Tamaño', hecho: true, falta: 'Elige tu tamaño', avanzaSolo: true },
    { id: 'beb-1-0', etiqueta: 'Bebida 1', titulo: 'Bebida 1', hecho: false, falta: 'Elige tu bebida 1', avanzaSolo: true },
    { id: 'nota', etiqueta: 'Nota', titulo: 'Nota', hecho: true, opcional: true },
  ];

  it('«Siguiente» bloqueado muestra el motivo; al completar, se avanza', () => {
    render(<Prueba pasos={pasos} alAgregar={() => {}} />);
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 1 de 4');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); // tamaño ya listo
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByTestId('motivo-siguiente')).toHaveTextContent('Elige tu bebida 1');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar beb-1-0' }));
    // una selección única completada avanza sola al paso siguiente (la nota, opcional)
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 3 de 4');
  });

  it('Atrás vuelve sin perder lo elegido y el resumen agrega solo con todo listo', () => {
    const alAgregar = vi.fn();
    render(<Prueba pasos={pasos} alAgregar={alAgregar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar beb-1-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByRole('button', { name: /Paso 2: Bebida 1, listo/ })).toBeInTheDocument();
    // el resumen: lo elegido y el precio; el botón de agregar dice qué falta si algo no está listo
    fireEvent.click(screen.getByRole('button', { name: /Paso 4: Resumen/ }));
    // en el resumen la línea corta se oculta: lo elegido va en la tarjeta de texto (una sola vez)
    expect(screen.queryByTestId('resumen-asistente')).toBeNull();
    expect(screen.getByTestId('texto-resumen')).toHaveTextContent('Regular 12 oz');
    expect(screen.getByRole('button', { name: /Agregar al pedido/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    expect(alAgregar).toHaveBeenCalledTimes(1);
  });

  it('el resumen no se alcanza mientras falte un paso obligatorio (el chip queda deshabilitado)', () => {
    render(<Prueba pasos={pasos} alAgregar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); // tamaño ya listo → bebida 1 pendiente
    expect(screen.getByRole('button', { name: /Paso 4: Resumen/ })).toBeDisabled();
    expect(screen.queryByTestId('boton-agregar-asistente')).toBeNull();
  });

  it('inactivo: muestra el contenido tal cual, sin progreso ni pie', () => {
    render(
      <AsistenteCombo activo={false} pasos={pasos} indice={0} alCambiarIndice={() => {}} titulo="x" precio={1} resumen="" puedeAgregar={false} textoAgregar="" alAgregar={() => {}}>
        <p>contenido plano</p>
      </AsistenteCombo>,
    );
    expect(screen.getByText('contenido plano')).toBeInTheDocument();
    expect(screen.queryByTestId('progreso-asistente')).toBeNull();
    expect(screen.queryByTestId('pie-asistente')).toBeNull();
  });

  it('muestra la descripción del tamaño bajo la cabecera (CAPRIKIDS Jr. y Regular tienen la suya)', () => {
    const props = { activo: true, pasos, indice: 0, alCambiarIndice: () => {}, titulo: 'CAPRIKIDS', precio: 1, resumen: '', puedeAgregar: false, textoAgregar: '', alAgregar: () => {} };
    const { rerender } = render(<AsistenteCombo {...props} descripcion="Papas y 1 juguete"><p>x</p></AsistenteCombo>);
    expect(screen.getByTestId('descripcion-asistente')).toHaveTextContent('Papas y 1 juguete');
    rerender(<AsistenteCombo {...props} descripcion={null}><p>x</p></AsistenteCombo>);
    expect(screen.queryByTestId('descripcion-asistente')).toBeNull();
  });
});
