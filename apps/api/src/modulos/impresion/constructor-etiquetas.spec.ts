import {
  construirTicketNotaMozo,
  construirTicketPago,
  esLineaBebida,
  construirEtiquetaGeneral,
  construirEtiquetasArea,
  construirEtiquetasBebida,
  construirTodasLasEtiquetas,
  construirTicketComandaSalon,
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

  it('Bebidas no tiene sticker por área: solo Salados y Postres, y los vasos siguen igual', () => {
    const pedido: any = {
      ...pedidoMock,
      lineas: [
        { id: 1n, cantidad: 1, nombre: 'Limonada', area: { id: 1n, nombre: 'Bebidas' }, categoria: { nombre: 'Bebidas' }, opciones: [] },
        { id: 2n, cantidad: 1, nombre: 'Empanada', area: { id: 2n, nombre: 'Salados' }, opciones: [] },
        { id: 3n, cantidad: 1, nombre: 'Brownie', area: { id: 3n, nombre: 'Postres' }, opciones: [] },
      ],
    };
    const areas = construirEtiquetasArea(pedido);
    expect(areas.map((a) => a.areaNombre)).toEqual(['SALADOS', 'POSTRES']);
    expect(areas.every((a) => a.totalAreas === 2)).toBe(true);
    expect(construirEtiquetasBebida(pedido)).toHaveLength(1);
  });

  it('un pedido solo de bebidas no genera ninguna etiqueta por área', () => {
    const pedido: any = {
      ...pedidoMock,
      lineas: [{ id: 1n, cantidad: 2, nombre: 'Limonada', area: { id: 1n, nombre: 'Bebidas' }, opciones: [] }],
    };
    const resumen = construirTodasLasEtiquetas(pedido);
    expect(resumen.areas).toEqual([]);
    expect(resumen.bebidas).toHaveLength(2);
  });

  const comboBase = (extra: any): any => ({
    codigo: 'CP-7',
    modalidad: 'RECOGER',
    cliente_nombre: 'Ana',
    canal: 'CARTA',
    creado_en: new Date('2026-10-27T17:30:00.000Z'),
    lineas: [{ cantidad: 1, tamano: null, area: { nombre: 'Cocina' }, categoria: { nombre: 'COMBOS' }, ...extra }],
  });

  it('combo con 2 bebidas: una etiqueta de bebida por bebida elegida, con su nombre', () => {
    const pedido = comboBase({
      nombre: 'Dúo Irresistible',
      nombres_persona: ['Lucía', 'Pedro'],
      opcionesElegidas: [
        { grupo_nombre: 'Bebida 1 · Bebida', opcion_nombre: 'Frappe Moca' },
        { grupo_nombre: 'Bebida 2 · Bebida', opcion_nombre: 'Café Latte' },
        { grupo_nombre: 'Postre · Postre', opcion_nombre: 'Brownie' },
      ],
    });
    const b = construirEtiquetasBebida(pedido);
    expect(b.map((x) => [x.bebidaNombre, x.persona, x.totalBebidas])).toEqual([
      ['Frappe Moca', 'Lucía', 2],
      ['Café Latte', 'Pedro', 2],
    ]);
    expect(construirEtiquetasArea(pedido)).toHaveLength(1);
  });

  it('combo sin bebidas (donas): solo general y área, nunca bebida', () => {
    const pedido = comboBase({
      nombre: '1/2 docena donuts',
      area: { nombre: 'Barra' },
      opcionesElegidas: [{ grupo_nombre: 'Dona 1 · Dona', opcion_nombre: 'Glaseada' }],
    });
    const r = construirTodasLasEtiquetas(pedido);
    expect(r.bebidas).toHaveLength(0);
    expect(r.general.codigo).toBe('CP-7');
    expect(r.areas).toHaveLength(1);
  });

  it('bebida suelta x2 usa el nombre de cada envase', () => {
    const b = construirEtiquetasBebida(
      comboBase({ nombre: 'Frappe Moca', cantidad: 2, categoria: { nombre: 'Frappes' }, nombres_persona: ['Ana', 'Luis'] }),
    );
    expect(b.map((x) => x.persona)).toEqual(['Ana', 'Luis']);
  });
});

describe('construirTicketPago: ajuste por cambio de dirección', () => {
  const pedido = { codigo: 'CP-9', total: 20, lineas: [{ cantidad: 1, nombre: 'Lomo', subtotal: 20 }], cobros: [] };

  it('con ajuste pendiente lleva el ajuste; sin él no agrega la clave (el ticket sale como antes)', () => {
    const con = construirTicketPago(pedido, {}, undefined, { tipo: 'SALDO', monto: 4 });
    expect(con.ajusteUbicacion).toEqual({ tipo: 'SALDO', monto: 4 });
    const sin = construirTicketPago(pedido, {}, undefined, null);
    expect(sin).not.toHaveProperty('ajusteUbicacion');
  });
});

describe('construirTicketNotaMozo (nota que el mozo envía a Caja)', () => {
  const pedido = { codigo: 'PED-50', total: 35, lineas: [{ cantidad: 1, nombre: 'Lomo', subtotal: 35 }], cobros: [] };

  it('efectivo con Recibido y Vuelto, nota con número y «Cobrado por mozo»', () => {
    const t = construirTicketNotaMozo(
      pedido,
      { nombre: 'Caprichos' },
      { tipo: 'NOTA_VENTA', numero_texto: 'NV01-000001' },
      [{ medio: 'EFECTIVO', monto: 35 }],
      100,
      'Juan Mozo',
    );
    expect(t.pagos).toEqual([{ medio: 'EFECTIVO', monto: 35, recibido: 100, vuelto: 65 }]);
    expect(t.comprobante).toEqual({ tipo: 'NOTA_VENTA', numero: 'NV01-000001' });
    expect(t.cobradoPorMozo).toBe('Juan Mozo');
    expect(t.total).toBe(35);
  });

  it('pago dividido: el vuelto sale del renglón de efectivo, no del total', () => {
    const t = construirTicketNotaMozo(
      pedido,
      {},
      { tipo: 'NOTA_VENTA', numero_texto: 'NV01-000002' },
      [
        { medio: 'EFECTIVO', monto: 20 },
        { medio: 'YAPE', monto: 15 },
      ],
      25,
      null,
    );
    expect(t.pagos[0]).toEqual({ medio: 'EFECTIVO', monto: 20, recibido: 25, vuelto: 5 });
    expect(t.pagos[1]).toEqual({ medio: 'YAPE', monto: 15, recibido: null, vuelto: null });
    expect(t.cobradoPorMozo).toBeNull();
  });
});

describe('Etiquetas con reparto por sabor (stock por sabor)', () => {
  // Donas con reparto: el sabor aparece en las opciones de la línea, antes que las opciones elegidas
  const pedidoDonas: any = {
    id: 202n,
    codigo: 'CP-202',
    modalidad: 'MESA',
    mesa_nombre: '5',
    cliente_nombre: 'Luis',
    canal: 'CARTA',
    nota: null,
    creado_en: new Date('2026-11-05T15:00:00.000Z'),
    lineas: [
      {
        id: 9n,
        cantidad: 1,
        nombre: 'Dona',
        tamano: '1/2 docena',
        nota: null,
        area: { id: 3n, nombre: 'Salados' },
        categoria: { nombre: 'Dulces' },
        nombres_persona: [],
        opcionesElegidas: [],
        sabores: [
          { sabor_nombre: 'Fresa', cantidad: 2 },
          { sabor_nombre: 'Oreo', cantidad: 3 },
          { sabor_nombre: 'Manjar', cantidad: 1 },
        ],
      },
    ],
  };

  it('la etiqueta de área muestra «2 Fresa · 3 Oreo · 1 Manjar» en las opciones de la línea', () => {
    const areas = construirEtiquetasArea(pedidoDonas);
    expect(areas[0].lineas[0].opciones).toEqual(['2 Fresa · 3 Oreo · 1 Manjar']);
  });

  it('el ticket de comanda también lo muestra, y una línea sin sabores queda igual', () => {
    const ticket = construirTicketComandaSalon(pedidoDonas);
    expect(ticket.lineas[0].opciones).toEqual(['2 Fresa · 3 Oreo · 1 Manjar']);
    const sinSabores = construirTicketComandaSalon({
      ...pedidoDonas,
      lineas: [{ ...pedidoDonas.lineas[0], sabores: [], opcionesElegidas: [{ opcion_nombre: 'Caja x6' }] }],
    });
    expect(sinSabores.lineas[0].opciones).toEqual(['Caja x6']);
  });
});

describe('construirTicketPago: documento por tipo de comprobante', () => {
  const base = { codigo: 'P-1', total: 118, lineas: [], cobros: [], cliente_nombre: 'Ana' };
  it('sin tipo o SIMPLE: comprobante simple, sin datos de cliente ni IGV', () => {
    expect(construirTicketPago(base, {}, undefined, null, 18).documento).toEqual({ tipo: 'SIMPLE' });
  });
  it('BOLETA: cliente y DNI del pedido, con IGV', () => {
    const d = construirTicketPago({ ...base, comprobante_tipo: 'BOLETA', comprobante_doc: '12345678' }, {}, { tipo: 'BOLETA', numero_texto: 'B002-1' }, null, 18).documento;
    expect(d).toMatchObject({ tipo: 'BOLETA', clienteNombre: 'Ana', docTipo: 'DNI', docNumero: '12345678', igvPct: 18 });
  });
  it('FACTURA: RUC, razón social y dirección del pedido', () => {
    const d = construirTicketPago(
      { ...base, comprobante_tipo: 'FACTURA', comprobante_doc: '20123456789', comprobante_razon: 'ACME SAC', comprobante_direccion: 'Av. Sol 1' },
      {}, { tipo: 'FACTURA', numero_texto: 'F002-1' }, null, 18,
    ).documento;
    expect(d).toMatchObject({ tipo: 'FACTURA', clienteNombre: 'ACME SAC', docTipo: 'RUC', docNumero: '20123456789', direccion: 'Av. Sol 1' });
  });
  it('BOLETA sin documento: docNumero nulo (el ticket dice VARIOS)', () => {
    expect(construirTicketPago({ ...base, cliente_nombre: '', comprobante_tipo: 'BOLETA' }, {}, undefined, null, 18).documento?.docNumero).toBeNull();
  });
});
