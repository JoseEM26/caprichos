import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { partesFijasResumen, ResumenPartesFijas } from '../ReemplazoCombo';
import { ModalCombo } from '../../admin/ofertas/ModalCombo';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';

const combo = (tamanoId: string | null, tamanoNombre: string | null, principalNombre = 'FRAPPE OREO'): OfertaItem =>
  ({
    id: '1', tipo: 'COMBO', nombre: 'COMBO CAJITA CAPRIKIDS', descripcion: '', lleva: null, paga: null, alcanceCategoriaId: null,
    alcanceProductoId: null, descuentoTipo: null, descuentoValor: null, compraMinima: null, dias: [], horaDesde: null,
    horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'], limiteUsos: null, usosActuales: 0,
    noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '',
    combosPrecio: [{ tamanoNombre: 'Cajita', precio: 27 }],
    combosParte: [
      { id: '100', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['5'], principalNombre, alternativasActivas: false,
        tamanoId, tamanoNombre, tamanoUnidades: 1, alternativas: [] },
    ],
  }) as unknown as OfertaItem;

const productos = [
  { id: '5', nombre: 'FRAPPE OREO', precio: 12, tamanos: [{ id: '77', nombre: 'Regular 12 oz', precio: 12 }, { id: '78', nombre: 'Grande 16 oz', precio: 15 }] },
  { id: '9', nombre: 'Dona', precio: 5 },
];

describe('tamaño de la parte fija del combo', () => {
  it('el resumen de la carta muestra la parte con su tamaño', () => {
    expect(partesFijasResumen(combo('77', 'Regular 12 oz'))).toEqual(['FRAPPE OREO · Regular 12 oz']);
    render(<ResumenPartesFijas oferta={combo('77', 'Regular 12 oz')} />);
    expect(screen.getByText('Incluye: FRAPPE OREO · Regular 12 oz')).toBeInTheDocument();
  });

  it('sin tamaño muestra solo el producto; sin partes fijas no muestra nada', () => {
    expect(partesFijasResumen(combo(null, null))).toEqual(['FRAPPE OREO']);
    expect(partesFijasResumen(null)).toEqual([]);
  });

  it('el editor de combos guarda el tamaño elegido de la parte fija', async () => {
    let guardado: any = null;
    render(
      <ModalCombo
        abierto
        comboAEditar={combo(null, null)}
        onCerrar={() => {}}
        onGuardar={async (d) => { guardado = d; }}
        productosDisponibles={productos}
        categorias={[]}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Partes y alternativas/ }));
    const selectTamano = await screen.findByLabelText('Tamaño del producto fijo');
    fireEvent.change(selectTamano, { target: { value: '77' } });
    fireEvent.click(screen.getByTestId('btn-guardar-combo'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(guardado?.partes?.[0]?.tamanoId).toBe('77');
    expect(guardado?.combosPartes?.[0]?.tamanoId).toBe('77');
  });
});
