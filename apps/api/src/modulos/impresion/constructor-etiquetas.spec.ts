import {
  esLineaBebida,
  construirEtiquetaGeneral,
  construirEtiquetasArea,
  construirEtiquetasBebida,
  construirTodasLasEtiquetas,
} from './constructor-etiquetas';

describe('Constructor server-side de etiquetas', () => {
  const pedidoMock: any = {
    id: 101n,
    codigo: 'CP-101',
    modalidad: 'MESA',
    mesa_nombre: '3',
    cliente_nombre: 'Maria Flores',
    canal: 'CARTA',
    nota: 'Sin cubiertos por favor',
    creado_en: new Date('2026-10-27T17:30:00.000Z'), // 12:30 en America/Lima
    lineas: [
      {
        id: 1n,
        cantidad: 2,
        nombre: 'Cappuccino Vainilla',
        tamano: 'Grande',
        nota: 'Caliente',
        area: { id: 2n, nombre: 'Barra' },
        categoria: { nombre: 'Cafes' },
        nombres_persona: ['Maria', 'Juan'],
        opciones: [{ opcion_nombre: 'Leche de almendras' }],
      },
      {
        id: 2n,
        cantidad: 1,
        nombre: 'Hamburguesa Clasica',
        tamano: null,
        nota: 'Término medio',
        area: { id: 1n, nombre: 'Cocina' },
        categoria: { nombre: 'Fondos' },
        opciones: [{ opcion_nombre: 'Sin cebolla' }],
      },
    ],
  };

  it('detecta correctamente líneas de bebida por área o categoría', () => {
    expect(esLineaBebida(pedidoMock.lineas[0])).toBe(true);
    expect(esLineaBebida(pedidoMock.lineas[1])).toBe(false);
  });

  it('construye etiqueta general completa', () => {
    const general = construirEtiquetaGeneral(pedidoMock);
    expect(general.tipo).toBe('ETIQUETA_GENERAL');
    expect(general.codigo).toBe('CP-101');
    expect(general.modalidadPill).toBe('MESA 3');
    expect(general.who).toBe('Maria Flores');
    expect(general.cantidadProductos).toBe(3); // 2 cappuccinos + 1 hamburguesa
    expect(general.productos).toHaveLength(2);
    expect(general.nota).toBe('Sin cubiertos por favor');
    expect(general.printer).toBe('Etiquetera de caja');
  });

  it('construye etiquetas por área agrupadas', () => {
    const areas = construirEtiquetasArea(pedidoMock);
    expect(areas).toHaveLength(2);

    const barra = areas.find((a) => a.areaNombre === 'BARRA');
    const cocina = areas.find((a) => a.areaNombre === 'COCINA');

    expect(barra).toBeDefined();
    expect(barra?.tipo).toBe('ETIQUETA_AREA');
    expect(barra?.lineas).toHaveLength(1);
    expect(barra?.lineas[0].opciones).toContain('Leche de almendras');

    expect(cocina).toBeDefined();
    expect(cocina?.lineas).toHaveLength(1);
    expect(cocina?.lineas[0].opciones).toContain('Sin cebolla');
  });

  it('construye una etiqueta por cada vaso de bebida individual', () => {
    const bebidas = construirEtiquetasBebida(pedidoMock);
    // 2 unidades de Cappuccino -> 2 etiquetas de bebida
    expect(bebidas).toHaveLength(2);

    expect(bebidas[0].tipo).toBe('ETIQUETA_BEBIDA');
    expect(bebidas[0].bebidaIndex).toBe(1);
    expect(bebidas[0].totalBebidas).toBe(2);
    expect(bebidas[0].persona).toBe('Maria');
    expect(bebidas[0].bebidaNombre).toBe('Cappuccino Vainilla');
    expect(bebidas[0].tamano).toBe('Grande');
    expect(bebidas[0].opciones).toContain('Leche de almendras');

    expect(bebidas[1].bebidaIndex).toBe(2);
    expect(bebidas[1].totalBebidas).toBe(2);
    expect(bebidas[1].persona).toBe('Juan');
  });

  it('construye todas las etiquetas con estructura conjunta', () => {
    const resumen = construirTodasLasEtiquetas(pedidoMock);
    expect(resumen.general.codigo).toBe('CP-101');
    expect(resumen.areas).toHaveLength(2);
    expect(resumen.bebidas).toHaveLength(2);
  });
});
