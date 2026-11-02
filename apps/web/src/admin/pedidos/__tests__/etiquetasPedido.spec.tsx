import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { armarEtiquetas } from '../etiquetasPedido';
import { EtiquetasPedido } from '../EtiquetasPedido';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido } from '../pedidosApi';
// PedidoDetalle usa useSesion (botón de rechazo del cobro del mozo): sin sesión en estas pruebas, sin permisos extra
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: () => false, usuario: null }),
}));


vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

function crearPedidoBase(parcial: Partial<Pedido> = {}): Pedido {
  return {
    id: 'ped-1',
    codigo: 'CP-W999',
    canal: 'MOZO',
    modalidad: 'MESA',
    mesa_nombre: '3',
    cliente_nombre: 'Jose Espinoza',
    cliente_telefono: '999888777',
    estado: 'COLA',
    creado_en: '2026-10-25T21:59:00.000Z',
    subtotal: 45,
    descuento: 0,
    total: 45,
    nota: 'Salir juntos',
    lineas: [],
    ...parcial,
  } as Pedido;
}

describe('etiquetasPedido - armarEtiquetas (lógica pura)', () => {
  it('1. armarEtiquetas con pedido de varias áreas (cuenta correcta de generales, áreas y bebidas)', () => {
    const pedido = crearPedidoBase({
      lineas: [
        {
          id: 'l1',
          nombre: 'Frappe Oreo',
          tamano: 'Grande 16 oz',
          cantidad: 1,
          precio_unit: 18,
          subtotal: 18,
          area: { id: 'a1', nombre: 'BARRA' },
          opciones: [{ opcion_nombre: 'Leche sin lactosa' }],
        },
        {
          id: 'l2',
          nombre: 'Club Sandwich',
          tamano: '4 cuartos',
          cantidad: 1,
          precio_unit: 22,
          subtotal: 22,
          area: { id: 'a2', nombre: 'COCINA' },
          opciones: [{ opcion_nombre: 'Sin tomate' }],
        },
        {
          id: 'l3',
          nombre: 'Torta de Chocolate',
          cantidad: 1,
          precio_unit: 10,
          subtotal: 10,
          area: { id: 'a3', nombre: 'POSTRES' },
        },
      ],
    });

    const resumen = armarEtiquetas(pedido);

    // 1 General siempre
    expect(resumen.general.codigo).toBe('CP-W999');
    expect(resumen.general.printer).toBe('Etiquetera de caja');
    expect(resumen.general.cantidadProductos).toBe(3);

    // 3 Áreas agrupadas: BARRA, COCINA, POSTRES
    expect(resumen.areas).toHaveLength(3);
    expect(resumen.areas[0].areaNombre).toBe('BARRA');
    expect(resumen.areas[0].printer).toBe('Etiquetera de barra');
    expect(resumen.areas[1].areaNombre).toBe('COCINA');
    expect(resumen.areas[1].printer).toBe('Etiquetera de cocina');
    expect(resumen.areas[2].areaNombre).toBe('POSTRES');
    expect(resumen.areas[2].printer).toBe('Etiquetera de postres');

    // 1 Bebida (solo la de área BARRA)
    expect(resumen.bebidas).toHaveLength(1);
    expect(resumen.bebidas[0].bebidaNombre).toBe('Frappe Oreo');
    expect(resumen.bebidas[0].persona).toBe('Jose Espinoza');
  });

  it('2. línea de cantidad 2 con dos personas genera 2 etiquetas con su respectivo nombre', () => {
    const pedido = crearPedidoBase({
      lineas: [
        {
          id: 'l1',
          nombre: 'Frappe Oreo',
          tamano: 'Grande 16 oz',
          cantidad: 2,
          nombres_persona: ['Carlos', 'Ana'],
          precio_unit: 18,
          subtotal: 36,
          area: { id: 'a1', nombre: 'BARRA' },
        },
      ],
    });

    const resumen = armarEtiquetas(pedido);
    expect(resumen.bebidas).toHaveLength(2);
    expect(resumen.bebidas[0].persona).toBe('Carlos');
    expect(resumen.bebidas[0].bebidaIndex).toBe(1);
    expect(resumen.bebidas[0].totalBebidas).toBe(2);

    expect(resumen.bebidas[1].persona).toBe('Ana');
    expect(resumen.bebidas[1].bebidaIndex).toBe(2);
    expect(resumen.bebidas[1].totalBebidas).toBe(2);
  });

  it('3. bebida sin nombre por vaso usa el cliente del pedido', () => {
    const pedido = crearPedidoBase({
      cliente_nombre: 'Lucia Ramos',
      lineas: [
        {
          id: 'l1',
          nombre: 'Capuccino',
          tamano: 'Regular 12 oz',
          cantidad: 1,
          precio_unit: 12,
          subtotal: 12,
          area: { id: 'a1', nombre: 'BARRA' },
          nombres_persona: null,
        },
      ],
    });

    const resumen = armarEtiquetas(pedido);
    expect(resumen.bebidas).toHaveLength(1);
    expect(resumen.bebidas[0].persona).toBe('Lucia Ramos');
    expect(resumen.bebidas[0].who).toBe('Para: Lucia Ramos');
  });

  it('4. más de 6 bebidas: muestra a lo sumo 6 y calcula las restantes', () => {
    const pedido = crearPedidoBase({
      lineas: Array.from({ length: 8 }, (_, i) => ({
        id: `l${i}`,
        nombre: `Bebida Especial ${i + 1}`,
        cantidad: 1,
        precio_unit: 15,
        subtotal: 15,
        area: { id: 'a1', nombre: 'BARRA' },
      })),
    });

    const resumen = armarEtiquetas(pedido);
    expect(resumen.bebidas).toHaveLength(8);
    expect(resumen.bebidasVisibles).toHaveLength(6);
    expect(resumen.bebidasRestantes).toBe(2);
  });

  it('5. pedido sin bebidas genera lista vacía de bebidas', () => {
    const pedido = crearPedidoBase({
      lineas: [
        {
          id: 'l1',
          nombre: 'Hamburguesa Artesanal',
          cantidad: 1,
          precio_unit: 25,
          subtotal: 25,
          area: { id: 'a1', nombre: 'COCINA' },
        },
      ],
    });

    const resumen = armarEtiquetas(pedido);
    expect(resumen.bebidas).toHaveLength(0);
    expect(resumen.bebidasVisibles).toHaveLength(0);
    expect(resumen.bebidasRestantes).toBe(0);
  });

  it('6. área con varios productos se marca como compacta', () => {
    const pedido = crearPedidoBase({
      lineas: [
        {
          id: 'l1',
          nombre: 'Frappe Oreo',
          tamano: '16 oz',
          cantidad: 1,
          precio_unit: 18,
          subtotal: 18,
          area: { id: 'a1', nombre: 'BARRA' },
          opciones: [{ opcion_nombre: 'Leche sin lactosa' }],
        },
        {
          id: 'l2',
          nombre: 'Capuccino',
          tamano: '12 oz',
          cantidad: 1,
          precio_unit: 12,
          subtotal: 12,
          area: { id: 'a1', nombre: 'BARRA' },
          opciones: [{ opcion_nombre: 'Sin azúcar' }],
        },
      ],
    });

    const resumen = armarEtiquetas(pedido);
    expect(resumen.areas).toHaveLength(1);
    expect(resumen.areas[0].esCompacta).toBe(true);
    expect(resumen.areas[0].lineas).toHaveLength(2);
  });
});

describe('EtiquetasPedido (componente React)', () => {
  it('renderiza las tres secciones, el nombre en grande, "Sale en" y botones deshabilitados con su texto honesto', () => {
    const pedido = crearPedidoBase({
      estado: 'COLA',
      cliente_nombre: 'Jose Espinoza',
      lineas: [
        {
          id: 'l1',
          nombre: 'Frappe Oreo',
          tamano: 'Grande 16 oz',
          cantidad: 1,
          precio_unit: 18,
          subtotal: 18,
          area: { id: 'a1', nombre: 'BARRA' },
          opciones: [{ opcion_nombre: 'Leche sin lactosa' }],
        },
        {
          id: 'l2',
          nombre: 'Club Sandwich',
          tamano: '4 cuartos',
          cantidad: 1,
          precio_unit: 22,
          subtotal: 22,
          area: { id: 'a2', nombre: 'COCINA' },
          opciones: [{ opcion_nombre: 'Sin tomate' }],
        },
      ],
    });

    render(<EtiquetasPedido pedido={pedido} />);

    // 1. Las tres secciones del mockup
    expect(screen.getByText('1. Etiqueta general del pedido')).toBeInTheDocument();
    expect(screen.getByText('2. Etiquetas por área')).toBeInTheDocument();
    expect(screen.getByText('3. Etiqueta por bebida')).toBeInTheDocument();

    // 2. Nota de estado para pedido nuevo
    expect(
      screen.getByText(
        'Vista previa. Estas etiquetas se imprimirán solas, junto con la comanda, cuando caja acepte el pedido.',
      ),
    ).toBeInTheDocument();

    // 3. Vista previa = las primitivas de la maqueta compartida, dibujadas en SVG (con el nombre en grande y el logo)
    const svgs = screen.getAllByRole('img', { name: /Vista previa de la etiqueta/ });
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs[0]).toHaveAttribute('data-maqueta', '508x813');
    expect(svgs[0]).toHaveTextContent('JOSE ESPINOZA');
    expect(svgs[0].querySelector('path[data-logo]')).not.toBeNull();

    // 4. "Sale en" correcto para Caja, Barra y Cocina
    expect(screen.getByText(/Sale en: Etiquetera de caja/i)).toBeInTheDocument();
    expect(screen.getByText(/Sale en: Etiquetera de barra/i)).toBeInTheDocument();
    expect(screen.getByText(/Sale en: Etiquetera de cocina/i)).toBeInTheDocument();

    // 5. Botones habilitados con confirmación Sí/No que llaman al endpoint
    const btnGeneral = screen.getByRole('button', { name: /Reimprimir la general/i });
    const btnAreas = screen.getByRole('button', { name: /Reimprimir las de área/i });
    const btnBebida = screen.getByRole('button', { name: /Reimprimir las de bebida/i });

    expect(btnGeneral).toBeEnabled();
    expect(btnAreas).toBeEnabled();
    expect(btnBebida).toBeEnabled();

    const textosAyuda = screen.getAllByText(
      'Envía una copia a la cola de impresión de la etiquetera de caja.',
    );
    expect(textosAyuda).toHaveLength(3);

    // Al hacer click en Reimprimir la general abre el modal de confirmación
    fireEvent.click(btnGeneral);
    expect(screen.getByText('¿Reimprimir etiqueta general?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sí, reimprimir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No, cancelar/i })).toBeInTheDocument();
  });

  it('muestra "Este pedido no tiene bebidas." cuando no hay ítems de barra', () => {
    const pedido = crearPedidoBase({
      lineas: [
        {
          id: 'l1',
          nombre: 'Club Sandwich',
          cantidad: 1,
          precio_unit: 22,
          subtotal: 22,
          area: { id: 'a1', nombre: 'COCINA' },
        },
      ],
    });

    render(<EtiquetasPedido pedido={pedido} />);
    expect(screen.getByText('Este pedido no tiene bebidas.')).toBeInTheDocument();
  });

  it('muestra una tarjeta por cada vaso (sin "y N más") cuando hay más de 6 bebidas', () => {
    const pedido = crearPedidoBase({
      lineas: Array.from({ length: 8 }, (_, i) => ({
        id: `l${i}`,
        nombre: `Frappe Especial ${i + 1}`,
        cantidad: 1,
        precio_unit: 18,
        subtotal: 18,
        area: { id: 'a1', nombre: 'BARRA' },
      })),
    });

    const { container } = render(<EtiquetasPedido pedido={pedido} />);
    expect(container.querySelectorAll('[data-clave^="BEBIDA:"]')).toHaveLength(8);
    expect(screen.queryByText(/más del mismo estilo/)).not.toBeInTheDocument();
  });

  it('integra correctamente en PedidoDetalle al seleccionar la pestaña Etiquetas', () => {
    const pedido = crearPedidoBase({
      cliente_nombre: 'Maria Flores',
      lineas: [
        {
          id: 'l1',
          nombre: 'Capuccino Vainilla',
          tamano: 'Regular 12 oz',
          cantidad: 1,
          precio_unit: 14,
          subtotal: 14,
          area: { id: 'a1', nombre: 'BARRA' },
          opciones: [{ opcion_nombre: 'Leche de almendras' }],
        },
      ],
    });

    render(
      <MemoryRouter>
        <PedidoDetalle pedido={pedido} alActualizar={() => {}} />
      </MemoryRouter>,
    );

    // Click en la pestaña 'Etiquetas'
    const tabEtiquetas = screen.getByRole('tab', { name: 'Etiquetas' });
    fireEvent.click(tabEtiquetas);

    // Debe mostrarse el nuevo diseño y las tres secciones
    expect(screen.getByText('1. Etiqueta general del pedido')).toBeInTheDocument();
    expect(screen.getByText('2. Etiquetas por área')).toBeInTheDocument();
    expect(screen.getByText('3. Etiqueta por bebida')).toBeInTheDocument();
    expect(screen.getByText(/Sale en: Etiquetera de barra/i)).toBeInTheDocument();
  });
});
