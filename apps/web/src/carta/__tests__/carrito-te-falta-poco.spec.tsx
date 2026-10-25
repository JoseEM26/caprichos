import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AvisoTeFaltaPoco, obtenerAvisoTeFaltaPoco } from '../AvisoTeFaltaPoco';
import { LineaCarrito, DatosLocalCarta } from '../tipos';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';

const lineaIced1: LineaCarrito = {
  id: 'l1',
  productoId: '101',
  nombre: 'Iced Coffee',
  precioBase: 12,
  precioUnitario: 12,
  cantidad: 1,
  subtotal: 12,
  opciones: [],
};

const lineaIced2: LineaCarrito = {
  ...lineaIced1,
  cantidad: 2,
  subtotal: 24,
};

const oferta2x1Iced: OfertaItem = {
  id: 'of_lp',
  tipo: 'LLEVA_PAGA',
  nombre: '2x1 Iced Coffee',
  descripcion: null,
  lleva: 2,
  paga: 1,
  alcanceProductoId: '101',
  productoNombre: 'Iced Coffee',
  alcanceCategoriaId: null,
  descuentoTipo: null,
  descuentoValor: null,
  compraMinima: null,
  dias: [],
  horaDesde: null,
  horaHasta: null,
  fechaDesde: null,
  fechaHasta: null,
  canales: ['CARTA'],
  limiteUsos: null,
  usosActuales: 0,
  noSumaBeneficios: false,
  orden: 1,
  activo: true,
  creadoEn: '',
  vigenteAhora: true,
};

const ofertaDescMinima: OfertaItem = {
  id: 'of_desc',
  tipo: 'DESCUENTO',
  nombre: '15% en compras mayores a 50',
  descripcion: null,
  lleva: null,
  paga: null,
  alcanceProductoId: null,
  alcanceCategoriaId: null,
  descuentoTipo: 'PORCENTAJE',
  descuentoValor: 15,
  compraMinima: 50,
  dias: [],
  horaDesde: null,
  horaHasta: null,
  fechaDesde: null,
  fechaHasta: null,
  canales: ['CARTA'],
  limiteUsos: null,
  usosActuales: 0,
  noSumaBeneficios: false,
  orden: 2,
  activo: true,
  creadoEn: '',
  vigenteAhora: true,
};

const datosLocalPrueba: DatosLocalCarta = {
  nombre: 'Caprichos',
  direccion: 'Av. Test 123',
  telefono: '999999999',
  whatsapp: '999999999',
  redes: {},
  horario: [],
  mediosPago: {},
  envioGratisDesde: 70,
  envioGratisModo: 'mas_de',
  pedidoMinimo: 15,
};

describe('Aviso de «Te falta poco» en el carrito', () => {
  it('1. Aviso LLEVA_PAGA: cuando tiene 1 unidad en un 2x1 muestra aviso con botón Agregar y desaparece al agregar la 2da', () => {
    const onAgregar = vi.fn();

    // Con 1 unidad
    const { rerender } = render(
      <AvisoTeFaltaPoco
        lineas={[lineaIced1]}
        subtotal={12}
        ofertas={[oferta2x1Iced]}
        onAgregarProducto={onAgregar}
      />,
    );

    const aviso = screen.getByTestId('aviso-te-falta-poco');
    expect(aviso).toBeInTheDocument();
    expect(aviso.textContent).toContain('Agrega 1 Iced Coffee y llevas el 2x1');

    const btnAgregar = screen.getByRole('button', { name: /agregar/i });
    expect(btnAgregar).toBeInTheDocument();
    fireEvent.click(btnAgregar);
    expect(onAgregar).toHaveBeenCalledWith('101');

    // Al tener 2 unidades (ya aplica el beneficio 2x1), el aviso DESAPARECE
    rerender(
      <AvisoTeFaltaPoco
        lineas={[lineaIced2]}
        subtotal={24}
        ofertas={[oferta2x1Iced]}
        onAgregarProducto={onAgregar}
      />,
    );
    expect(screen.queryByTestId('aviso-te-falta-poco')).toBeNull();
  });

  it('2. Aviso DESCUENTO con compra mínima: muestra lo que falta y desaparece al alcanzar el mínimo', () => {
    // Subtotal 42 con compra mínima de 50 -> faltan S/ 8
    const linea42: LineaCarrito = {
      id: 'l_postre',
      productoId: '202',
      nombre: 'Postres Varios',
      precioBase: 42,
      precioUnitario: 42,
      cantidad: 1,
      subtotal: 42,
      opciones: [],
    };

    const { rerender } = render(
      <AvisoTeFaltaPoco
        lineas={[linea42]}
        subtotal={42}
        ofertas={[ofertaDescMinima]}
      />,
    );

    const aviso = screen.getByTestId('aviso-te-falta-poco');
    expect(aviso).toBeInTheDocument();
    expect(aviso.textContent).toContain('Agrega S/ 8 y activas el 15 % de descuento');
    // Para descuentos de compra mínima general no hay botón de producto único
    expect(screen.queryByRole('button', { name: /agregar/i })).toBeNull();

    // Cuando el subtotal alcanza los 50 (o más), el beneficio ya aplica y DESAPARECE
    rerender(
      <AvisoTeFaltaPoco
        lineas={[{ ...linea42, subtotal: 55 }]}
        subtotal={55}
        ofertas={[ofertaDescMinima]}
      />,
    );
    expect(screen.queryByTestId('aviso-te-falta-poco')).toBeNull();
  });

  it('3. Aviso ENVÍO GRATIS: respeta envio_gratis_monto y modos (mas_de y desde), y desaparece al aplicar', () => {
    // Con modo 'mas_de' y monto 70: subtotal 62 -> faltan S/ 8
    const linea62: LineaCarrito = {
      id: 'l_comida',
      productoId: '303',
      nombre: 'Waffle Familiar',
      precioBase: 62,
      precioUnitario: 62,
      cantidad: 1,
      subtotal: 62,
      opciones: [],
    };

    const { rerender } = render(
      <AvisoTeFaltaPoco
        lineas={[linea62]}
        subtotal={62}
        ofertas={[]}
        datosLocal={datosLocalPrueba}
      />,
    );

    const aviso = screen.getByTestId('aviso-te-falta-poco');
    expect(aviso).toBeInTheDocument();
    expect(aviso.textContent).toContain('Te faltan S/ 8 para envío gratis');

    // Con subtotal 75 (> 70 en modo 'mas_de') -> DESAPARECE
    rerender(
      <AvisoTeFaltaPoco
        lineas={[{ ...linea62, subtotal: 75 }]}
        subtotal={75}
        ofertas={[]}
        datosLocal={datosLocalPrueba}
      />,
    );
    expect(screen.queryByTestId('aviso-te-falta-poco')).toBeNull();

    // Con modo 'desde' y monto 70: al llegar a exactamente 70 -> DESAPARECE
    const datosModoDesde: DatosLocalCarta = {
      ...datosLocalPrueba,
      envioGratisModo: 'desde',
    };
    rerender(
      <AvisoTeFaltaPoco
        lineas={[{ ...linea62, subtotal: 70 }]}
        subtotal={70}
        ofertas={[]}
        datosLocal={datosModoDesde}
      />,
    );
    expect(screen.queryByTestId('aviso-te-falta-poco')).toBeNull();
  });

  it('4. Solo muestra un aviso (el más relevante), nunca combos ni en carrito vacío', () => {
    // Carrito vacío
    const vacio = obtenerAvisoTeFaltaPoco({
      lineas: [],
      subtotal: 0,
      ofertas: [oferta2x1Iced, ofertaDescMinima],
      datosLocal: datosLocalPrueba,
    });
    expect(vacio).toBeNull();

    // Cuando coinciden LLEVA_PAGA y ENVIO GRATIS, LLEVA_PAGA tiene mayor relevancia
    const res = obtenerAvisoTeFaltaPoco({
      lineas: [lineaIced1],
      subtotal: 12,
      ofertas: [oferta2x1Iced],
      datosLocal: datosLocalPrueba,
    });
    expect(res).not.toBeNull();
    expect(res?.tipo).toBe('LLEVA_PAGA');
    expect(res?.texto).toContain('2x1');

    // Oferta tipo COMBO nunca genera aviso de te falta poco
    const ofertaCombo: OfertaItem = {
      ...oferta2x1Iced,
      tipo: 'COMBO',
      nombre: 'Combo Especial',
    };
    const resCombo = obtenerAvisoTeFaltaPoco({
      lineas: [lineaIced1],
      subtotal: 12,
      ofertas: [ofertaCombo],
      datosLocal: null,
    });
    expect(resCombo).toBeNull();
  });
});
