import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalCombo } from '../ModalCombo';
import { ModalDescuento } from '../ModalDescuento';
import { ModalLlevaPaga } from '../ModalLlevaPaga';
import { PrevisualizacionCarta } from '../PrevisualizacionCarta';
import { ModalPrevisualizacionCarta } from '../ModalPrevisualizacionCarta';
import { OfertaItem } from '../ofertasApi';

const mockProductos = [
  { id: '1', nombre: 'Frappé Clásico', categoria: 'Frappes', precio: 12, noSumaBeneficios: false },
  { id: '2', nombre: 'Waffle Belga', categoria: 'Waffles', precio: 16, noSumaBeneficios: false },
  { id: '3', nombre: 'Iced Latte', categoria: 'Iced', precio: 10, noSumaBeneficios: false },
];

const mockCategorias = [
  { id: '1', nombre: 'Combos', productos: [] },
  { id: '2', nombre: 'Frappes', productos: [{ id: 1, nombre: 'Frappé Clásico', precio: 12 }] },
  { id: '3', nombre: 'Waffles', productos: [{ id: 2, nombre: 'Waffle Belga', precio: 16 }] },
  { id: '4', nombre: 'Iced', productos: [{ id: 3, nombre: 'Iced Latte', precio: 10 }] },
];

describe('Asistente de Ofertas y Previsualización', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ModalCombo (Constructor de Combos por Pasos)', () => {
    it('navega entre los 4 pasos, valida cada paso y conserva los datos al ir y volver', async () => {
      const onGuardarMock = vi.fn().mockResolvedValue(undefined);
      const onCerrarMock = vi.fn();

      render(
        <ModalCombo
          abierto={true}
          onCerrar={onCerrarMock}
          onGuardar={onGuardarMock}
          productosDisponibles={mockProductos}
          categorias={mockCategorias}
        />,
      );

      // Verificamos Paso 1
      expect(screen.getByText(/Paso 1 de 4: Nombre y categoría/i)).toBeInTheDocument();

      // Intentar avanzar sin nombre -> Debe mostrar error de validación
      const btnSiguiente = screen.getByRole('button', { name: /Siguiente/i });
      fireEvent.click(btnSiguiente);
      expect(await screen.findByText('Escribe el nombre del combo.')).toBeInTheDocument();

      // Escribir nombre y categoría
      const inputNombre = screen.getByLabelText(/Nombre del combo \*/i);
      fireEvent.change(inputNombre, { target: { value: 'Combo Desayuno Dulce' } });
      const inputDesc = screen.getByLabelText(/Descripción corta/i);
      fireEvent.change(inputDesc, { target: { value: 'Frappé y Waffle para iniciar el día' } });

      // Avanzar al Paso 2
      fireEvent.click(btnSiguiente);
      expect(await screen.findByText(/Paso 2 de 4: ¿Qué lleva el combo\?/i)).toBeInTheDocument();

      // En Paso 2, agregar una parte usando "+ 2 bebidas a elección"
      const btnAgregarBebida = screen.getByRole('button', { name: /\+ 2 bebidas a elección/i });
      fireEvent.click(btnAgregarBebida);

      // La parte agregada tiene input con "Bebidas a elección"
      const inputNombreParte = screen.getByDisplayValue('Bebidas a elección');
      fireEvent.change(inputNombreParte, { target: { value: 'Bebidas del Desayuno' } });

      // Retroceder al Paso 1 y verificar que los datos se conservaron
      const btnAtras = screen.getByRole('button', { name: /Atrás/i });
      fireEvent.click(btnAtras);
      expect(await screen.findByText(/Paso 1 de 4: Nombre y categoría/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Combo Desayuno Dulce')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Frappé y Waffle para iniciar el día')).toBeInTheDocument();

      // Volver al Paso 2 y comprobar que los datos de partes siguen ahí
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
      expect(await screen.findByDisplayValue('Bebidas del Desayuno')).toBeInTheDocument();

      // Avanzar al Paso 3: Cuánto vale
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
      expect(await screen.findByText(/Paso 3 de 4: ¿Cuánto vale el combo/i)).toBeInTheDocument();

      // Configurar precio en Paso 3
      const inputPrecio = screen.getByLabelText('Precio del tamaño');
      fireEvent.change(inputPrecio, { target: { value: '18' } });

      // Avanzar al Paso 4: Visualización
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
      expect(await screen.findByTestId('paso-4-combo')).toBeInTheDocument();
      expect(screen.getByText('Resumen del combo')).toBeInTheDocument();
      expect(screen.getAllByText('Combo Desayuno Dulce').length).toBeGreaterThanOrEqual(1);

      // Guardar combo -> abre diálogo de confirmación Sí/No (no window.confirm)
      const btnGuardar = screen.getByRole('button', { name: /Guardar combo/i });
      fireEvent.click(btnGuardar);

      expect(await screen.findByText('¿Guardar nuevo combo?')).toBeInTheDocument();
      const btnConfirmar = screen.getByRole('button', { name: 'Confirmar' });
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(onGuardarMock).toHaveBeenCalledWith(
          expect.objectContaining({
            nombre: 'Combo Desayuno Dulce',
            descripcion: 'Frappé y Waffle para iniciar el día',
            tamanos: [expect.objectContaining({ precio: 18 })],
          }),
        );
      });
    });

    it('calcula ahorro del cliente y emite aviso ámbar si el combo es más caro que por separado', async () => {
      render(
        <ModalCombo
          abierto={true}
          onCerrar={() => {}}
          onGuardar={async () => {}}
          productosDisponibles={mockProductos}
          categorias={mockCategorias}
        />,
      );

      // Paso 1: llenar nombre
      fireEvent.change(screen.getByLabelText(/Nombre del combo \*/i), { target: { value: 'Combo Cálculo' } });
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

      // Paso 2: agregar un complemento fijo con Frappé Clásico (S/ 12)
      fireEvent.click(screen.getByRole('button', { name: /\+ 1 complemento fijo/i }));
      const selectProducto = screen.getByRole('combobox');
      fireEvent.change(selectProducto, { target: { value: '1' } }); // Frappé Clásico S/ 12

      // Avanzar a Paso 3
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
      expect(await screen.findByText(/Paso 3 de 4: ¿Cuánto vale el combo/i)).toBeInTheDocument();

      // Caso A: Precio combo S/ 10 (Suma productos sueltos es S/ 12) -> Ahorro S/ 2 (17%)
      const inputPrecio = screen.getByLabelText('Precio del tamaño');
      fireEvent.change(inputPrecio, { target: { value: '10' } });
      expect(await screen.findByText(/Ahorro para el cliente: S\/ 2\.00 \(17 %\)/i)).toBeInTheDocument();

      // Caso B: Precio combo S/ 20 (Suma es S/ 12) -> Más caro que por separado (aviso ámbar)
      fireEvent.change(inputPrecio, { target: { value: '20' } });
      expect(await screen.findByTestId('aviso-combo-caro')).toBeInTheDocument();
      expect(screen.getByTestId('aviso-combo-caro')).toHaveTextContent(/sale más caro que comprar por separado/i);
    });

    it('al editar un combo existente carga todos los pasos con sus datos', async () => {
      const comboExistente: OfertaItem = {
        id: '10',
        tipo: 'COMBO',
        nombre: 'Combo Existente Cargado',
        descripcion: 'Descripción del combo existente',
        activo: true,
        creadoEn: '2026-10-25T00:00:00.000Z',
        categoriaNombre: 'Combos',
        combosPrecio: [{ tamanoValorId: '1', tamanoNombre: 'Personal', precio: 22 }],
        combosParte: [
          {
            id: '100',
            tipo: 'A_ELECCION',
            cantidad: 2,
            categorias: ['2'],
            nombre: '2 Bebidas',
          },
        ],
      };

      render(
        <ModalCombo
          abierto={true}
          comboAEditar={comboExistente}
          onCerrar={() => {}}
          onGuardar={async () => {}}
          productosDisponibles={mockProductos}
          categorias={mockCategorias}
        />,
      );

      // Paso 1 debe tener los datos precargados
      expect(screen.getByDisplayValue('Combo Existente Cargado')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Descripción del combo existente')).toBeInTheDocument();

      // Paso 2 cargado
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
      expect(await screen.findByDisplayValue('2 Bebidas')).toBeInTheDocument();

      // Paso 3 cargado
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
      expect(await screen.findByDisplayValue('22')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Personal')).toBeInTheDocument();
    });
  });

  describe('PrevisualizacionCarta', () => {
    const ofertaPrueba: OfertaItem = {
      id: '99',
      tipo: 'COMBO',
      nombre: 'Combo Previsualización',
      descripcion: 'Combo para probar preview en carta',
      activo: true,
      creadoEn: '2026-10-25T00:00:00.000Z',
      combosPrecio: [
        { tamanoValorId: '1', tamanoNombre: 'Regular', precio: 29 },
        { tamanoValorId: '2', tamanoNombre: 'Grande', precio: 35 },
      ],
      combosParte: [
        {
          id: '1',
          nombre: 'Bebida',
          tipo: 'A_ELECCION',
          cantidad: 1,
          categorias: ['2'],
        },
      ],
    };

    it('conmuta entre Tarjeta en la lista y Al abrirla, y conmuta entre Celular y PC', async () => {
      render(
        <PrevisualizacionCarta
          oferta={ofertaPrueba}
          productosDisponibles={mockProductos}
          categoriasDisponibles={mockCategorias}
          vistaInicial="tarjeta"
          dispositivoInicial="pc"
        />,
      );

      // Vista inicial: Tarjeta en la lista
      expect(screen.getByText('Combo Previsualización')).toBeInTheDocument();
      expect(screen.getByText(/Desde/i)).toBeInTheDocument();
      expect(screen.getByText(/29/i)).toBeInTheDocument();

      // Conmutar a Celular (390px)
      const btnCelular = screen.getByRole('button', { name: /Celular/i });
      fireEvent.click(btnCelular);
      expect(btnCelular).toHaveAttribute('aria-pressed', 'true');

      // Conmutar a Al abrirla
      const btnAbierta = screen.getByRole('button', { name: /Al abrirla/i });
      fireEvent.click(btnAbierta);

      // Debe mostrar el modal real VentanaProductoCarta en modo solo lectura
      expect(await screen.findByText('Arma tu combo')).toBeInTheDocument();
      // El botón de pedido debe estar deshabilitado con etiqueta 'Vista previa'
      const btnPedir = screen.getByRole('button', { name: /Vista previa/i });
      expect(btnPedir).toBeInTheDocument();
      expect(btnPedir).toBeDisabled();
    });
  });

  describe('ModalDescuento (Límites, validación y textos didácticos)', () => {
    it('tipo PORCENTAJE: bloquea mayores a 100, no admite letras ni negativos, y muestra aviso', async () => {
      render(
        <ModalDescuento
          abierto={true}
          onCerrar={() => {}}
          onGuardar={async () => {}}
          productosDisponibles={mockProductos}
          categorias={mockCategorias}
        />,
      );

      // Llenar Paso 1 y avanzar a Paso 3
      fireEvent.change(screen.getByLabelText(/Nombre del descuento \*/i), { target: { value: 'Descuento 15%' } });
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })); // Paso 2
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })); // Paso 3

      expect(await screen.findByText(/Paso 3 de 4: Beneficio del descuento/i)).toBeInTheDocument();

      const inputValor = screen.getByLabelText(/Valor del descuento \*/i);

      // Si el usuario escribe más de 100 (ej. 150), se queda en 100 y muestra aviso
      fireEvent.change(inputValor, { target: { value: '150' } });
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
      expect(screen.getByTestId('aviso-valor-descuento')).toHaveTextContent('El porcentaje va de 1 a 100');

      // Texto dinámico con 15%
      fireEvent.change(inputValor, { target: { value: '15' } });
      expect(screen.getByTestId('texto-dinamico-valor')).toHaveTextContent(
        'Con 15 %: en una compra de S/ 40 el cliente ahorra S/ 6',
      );

      // Si intenta escribir 0 o letras o negativos
      fireEvent.change(inputValor, { target: { value: '0' } });
      expect(screen.getByTestId('aviso-valor-descuento')).toHaveTextContent('El porcentaje va de 1 a 100');

      fireEvent.change(inputValor, { target: { value: '-20' } });
      // El negativo se limpia y se toma '20'
      expect(screen.getByDisplayValue('20')).toBeInTheDocument();

      // Botón de ayuda valor
      const btnAyudaValor = screen.getByLabelText('Ayuda sobre valor del descuento');
      fireEvent.click(btnAyudaValor);
      expect(screen.getByText(/Porcentaje que se descuenta del precio regular/i)).toBeInTheDocument();
    });

    it('compra mínima: opcional, nunca negativa, muestra ayuda y ejemplo dinámico', async () => {
      render(
        <ModalDescuento
          abierto={true}
          onCerrar={() => {}}
          onGuardar={async () => {}}
          productosDisponibles={mockProductos}
          categorias={mockCategorias}
        />,
      );

      // Paso 1
      fireEvent.change(screen.getByLabelText(/Nombre del descuento \*/i), { target: { value: 'Descuento Mínima' } });
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

      // Paso 2: Condiciones y compra mínima
      expect(await screen.findByText(/Paso 2 de 4: Condiciones y vigencia/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Opcional\. El descuento solo se aplica si la compra llega a este monto\. Deja 0 si no hay minimo/i),
      ).toBeInTheDocument();

      const inputMinima = screen.getByLabelText(/Compra mínima \(S\/\):/i);

      // Escribir 30
      fireEvent.change(inputMinima, { target: { value: '30' } });
      expect(screen.getByTestId('ejemplo-dinamico-minima')).toHaveTextContent(
        'Compra minima S/ 30: una compra de S/ 25 no recibe descuento, una de S/ 35 si',
      );

      // Si intenta escribir negativo -5, el guion se elimina y queda 5
      fireEvent.change(inputMinima, { target: { value: '-5' } });
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();

      // Botón de ayuda mínima
      const btnAyudaMinima = screen.getByLabelText('Ayuda sobre compra mínima');
      fireEvent.click(btnAyudaMinima);
      expect(screen.getByText(/Monto mínimo que debe sumar el pedido para que el descuento se active/i)).toBeInTheDocument();
    });

    it('en Paso 4 muestra el ejemplo didáctico con productos reales y los textos dinámicos', async () => {
      render(
        <ModalDescuento
          abierto={true}
          onCerrar={() => {}}
          onGuardar={async () => {}}
          productosDisponibles={mockProductos}
          categorias={mockCategorias}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Nombre del descuento \*/i), { target: { value: 'Descuento Paso 4' } });
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })); // Paso 2
      fireEvent.change(screen.getByLabelText(/Compra mínima \(S\/\):/i), { target: { value: '30' } });
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })); // Paso 3
      fireEvent.change(screen.getByLabelText(/Valor del descuento \*/i), { target: { value: '15' } });
      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })); // Paso 4

      expect(await screen.findByTestId('paso-4-descuento')).toBeInTheDocument();
      expect(screen.getByTestId('ejemplo-calculado-dinamico-valor')).toHaveTextContent(
        'Con 15 %: en una compra de S/ 40 el cliente ahorra S/ 6',
      );
      expect(screen.getByTestId('ejemplo-calculado-dinamico-minima')).toHaveTextContent(
        'Compra minima S/ 30: una compra de S/ 25 no recibe descuento, una de S/ 35 si',
      );
    });
  });

  describe('ModalLlevaPaga (Asistente 2x1 con ejemplo calculado)', () => {
    it('avanza por los 4 pasos y muestra ejemplo didáctico 2x1', async () => {
      render(
        <ModalLlevaPaga
          abierto={true}
          onCerrar={() => {}}
          onGuardar={async () => {}}
          productosDisponibles={mockProductos}
          categorias={mockCategorias}
        />,
      );

      expect(screen.getByText(/Paso 1 de 4: Nombre y a qué aplica/i)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Nombre de la promoción \*/i), { target: { value: '2x1 Iced Coffee' } });

      // Agregar un producto a los componentes en Paso 1
      const selectProd = screen.getByRole('combobox');
      fireEvent.change(selectProd, { target: { value: 'Frappé Clásico' } });
      const btnAgregar = screen.getByRole('button', { name: /\+ Agregar$/i });
      fireEvent.click(btnAgregar);

      // Incrementar cantidad a 2 para que coincida con qLleva = 2
      const btnMas = screen.getByRole('button', { name: '+' });
      fireEvent.click(btnMas);

      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })); // Paso 2
      expect(await screen.findByText(/Paso 2 de 4: Condiciones de aplicación/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })); // Paso 3
      expect(await screen.findByText(/Paso 3 de 4: Beneficio/i)).toBeInTheDocument();

      // Configurar precio en Paso 3
      const inputPrecio = screen.getByLabelText(/Precio final de la promo/i);
      fireEvent.change(inputPrecio, { target: { value: '12' } });

      fireEvent.click(screen.getByRole('button', { name: /Siguiente/i })); // Paso 4
      expect(await screen.findByTestId('paso-4-lleva-paga')).toBeInTheDocument();
      expect(screen.getByTestId('ejemplo-calculado-lleva-paga')).toBeInTheDocument();
    });
  });

  describe('ModalPrevisualizacionCarta (Modal de solo lectura)', () => {
    it('se abre y se cierra con Escape', async () => {
      const onCerrarMock = vi.fn();
      const oferta: OfertaItem = {
        id: '50',
        tipo: 'COMBO',
        nombre: 'Combo Preview Modal',
        activo: true,
        creadoEn: '2026-10-25T00:00:00.000Z',
        combosPrecio: [{ tamanoValorId: '1', tamanoNombre: 'Único', precio: 20 }],
      };

      render(
        <ModalPrevisualizacionCarta
          abierto={true}
          oferta={oferta}
          onCerrar={onCerrarMock}
          productosDisponibles={mockProductos}
          categoriasDisponibles={mockCategorias}
        />,
      );

      expect(screen.getByText(/Cómo se ve en la carta/i)).toBeInTheDocument();

      // Presionar Escape cierra el modal
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onCerrarMock).toHaveBeenCalled();
    });
  });
});
