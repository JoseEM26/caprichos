import { construirEtiquetasArea, construirTicketComandaArea, construirTicketComandaSalon } from './constructor-etiquetas';

const pedido = {
  codigo: 'CP-90', canal: 'MOZO', mesa_nombre: '4', cliente_nombre: 'Ana', creado_en: new Date('2026-11-08T15:00:00Z'), nota: null,
  lineas: [
    {
      id: 1n, cantidad: 1, nombre: 'Frappé Oreo', tamano: 'Regular 12 oz', area_id: 7n, area: { nombre: 'Barra' },
      opcionesElegidas: [
        { grupo_nombre: 'Leche', opcion_nombre: 'Deslactosada', precio_extra: 2 },
        { grupo_nombre: 'Endulzante', opcion_nombre: 'Stevia', precio_extra: 0 },
      ],
      sabores: [], nombres_persona: ['Ana'], nota: null, linea_combo_id: null,
    },
    { id: 2n, cantidad: 1, nombre: 'Dúo Cafetero', tamano: null, area_id: null, area: null, opcionesElegidas: [], sabores: [], linea_combo_id: null },
    {
      id: 3n, cantidad: 1, nombre: 'Latte Coffe', tamano: 'Regular 12 oz', area_id: 7n, area: { nombre: 'Barra' },
      opcionesElegidas: [], sabores: [{ sabor_nombre: 'Vainilla', cantidad: 1 }], nombres_persona: ['Luis'], linea_combo_id: 2n,
    },
    {
      id: 4n, cantidad: 1, nombre: 'Dona', tamano: 'Caja x4', area_id: 8n, area: { nombre: 'Postres' }, opcionesElegidas: [],
      sabores: [{ sabor_nombre: 'Fresa', cantidad: 3 }, { sabor_nombre: 'Oreo', cantidad: 1 }], linea_combo_id: 2n,
    },
  ],
};

describe('comanda: detalle de línea y piezas de combo', () => {
  it('la comanda de salón lleva tamaño, opciones, «Para» y las piezas del combo con su tamaño y sabor', () => {
    const t = construirTicketComandaSalon(pedido);
    expect(t.lineas.map((l) => l.nombre)).toEqual(['Frappé Oreo', 'Dúo Cafetero']);
    expect(t.lineas[0]).toMatchObject({ tamano: 'Regular 12 oz', opciones: ['Deslactosada', 'Stevia'] });
    expect(t.lineas[0].detalles).toEqual(['Leche: Deslactosada (+S/ 2.00)', 'Endulzante: Stevia', 'Para: Ana']);
    const partes = t.lineas[1].partes!;
    expect(partes).toHaveLength(2);
    expect(partes[0]).toMatchObject({ nombre: 'Latte Coffe', tamano: 'Regular 12 oz' });
    expect(partes[0].detalles).toEqual(['Sabores: 1 Vainilla', 'Para: Luis']);
    expect(partes[1].detalles).toEqual(['Sabores: 3 Fresa · 1 Oreo']);
  });

  it('la comanda de un área incluye las piezas de combo de esa área y no repite el combo contenedor', () => {
    const barra = construirTicketComandaArea(pedido, 7n);
    expect(barra.area).toBe('BARRA');
    expect(barra.lineas.map((l) => l.nombre)).toEqual(['Frappé Oreo', 'Latte Coffe']);
    expect(barra.lineas[1]).toMatchObject({ tamano: 'Regular 12 oz' });
    const postres = construirTicketComandaArea(pedido, 8n);
    expect(postres.lineas).toHaveLength(1);
    expect(postres.lineas[0].detalles).toEqual(['Sabores: 3 Fresa · 1 Oreo']);
  });
});

describe('combo con parte opcional en comanda y Caja', () => {
  const duo = {
    codigo: 'CP-91', canal: 'CARTA', cliente_nombre: 'Ana', creado_en: new Date('2026-11-08T15:00:00Z'), nota: null,
    lineas: [
      { id: 1n, cantidad: 1, nombre: 'Dúo Irresistible', area_id: null, area: null, opcionesElegidas: [], sabores: [], linea_combo_id: null, nota: 'Dúo Irresistible · SIN PAPAS NATIVAS' },
      { id: 2n, cantidad: 1, nombre: 'CLUB SANDWICH', area_id: 1n, area: { nombre: 'Salados' }, opcionesElegidas: [], sabores: [], linea_combo_id: 1n, nota: 'SIN PAPAS NATIVAS · Combo: Dúo Irresistible' },
      { id: 3n, cantidad: 2, nombre: 'FRAPPE', area_id: 7n, area: { nombre: 'Barra' }, opcionesElegidas: [], sabores: [], linea_combo_id: 1n, nota: 'Combo: Dúo Irresistible' },
    ],
  };
  it('el detalle de Caja y la comanda salón muestran SIN papas en la línea del combo y en su pieza; no hay línea de papas', () => {
    const t = construirTicketComandaSalon(duo);
    const texto = JSON.stringify(t);
    expect(texto).toContain('SIN PAPAS NATIVAS');
    expect(texto).not.toContain('"nombre":"PAPAS');
    expect(t.lineas[0].partes?.map((p) => p.nombre)).toEqual(['CLUB SANDWICH', 'FRAPPE']);
  });
  it('un área sin piezas (las papas quitadas eran su única pieza) no recibe comanda', () => {
    expect(construirTicketComandaArea(duo, 9n).lineas).toHaveLength(0);
    expect(construirTicketComandaArea(duo, 1n).lineas).toHaveLength(1);
  });
  it('un extra sale con cantidad real y la marca EXTRA', () => {
    const conExtra = { ...duo, lineas: [...duo.lineas, { id: 4n, cantidad: 2, nombre: 'PAPAS NATIVAS', area_id: 1n, area: { nombre: 'Salados' }, opcionesElegidas: [], sabores: [], linea_combo_id: 1n, nota: 'EXTRA +1 · Combo: Dúo Irresistible' }] };
    const t = construirTicketComandaArea(conExtra, 1n);
    expect(JSON.stringify(t)).toContain('EXTRA +1');
    expect(t.lineas.find((l) => l.nombre === 'PAPAS NATIVAS')?.cantidad).toBe(2);
  });
});

describe('sticker de área con parte opcional', () => {
  it('la pieza con extra lleva «EXTRA +1» y la que sigue a una parte quitada «SIN …» como opción del sticker', () => {
    const ped = {
      codigo: 'CP-92', canal: 'CARTA', cliente_nombre: 'Ana', creado_en: new Date('2026-11-08T15:00:00Z'), nota: null,
      lineas: [
        { id: 1n, cantidad: 1, nombre: 'Dúo Irresistible', producto_id: null, area_id: null, area: null, opcionesElegidas: [], sabores: [], linea_combo_id: null },
        { id: 2n, cantidad: 1, nombre: 'CLUB SANDWICH', producto_id: 5n, area_id: 1n, area: { nombre: 'Salados' }, opcionesElegidas: [], sabores: [], linea_combo_id: 1n, nota: 'SIN FRITAS · Combo: Dúo' },
        { id: 3n, cantidad: 2, nombre: 'PAPAS NATIVAS', producto_id: 6n, area_id: 1n, area: { nombre: 'Salados' }, opcionesElegidas: [], sabores: [], linea_combo_id: 1n, nota: 'EXTRA +1 · Combo: Dúo' },
      ],
    };
    const [area] = construirEtiquetasArea(ped);
    expect(area.lineas.find((l) => l.nombre === 'CLUB SANDWICH')?.opciones).toContain('SIN FRITAS');
    expect(area.lineas.find((l) => l.nombre === 'PAPAS NATIVAS')).toMatchObject({ cantidad: 2, opciones: ['EXTRA +1'] });
  });
});
