import { construirTicketComandaArea, construirTicketComandaSalon } from './constructor-etiquetas';

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
