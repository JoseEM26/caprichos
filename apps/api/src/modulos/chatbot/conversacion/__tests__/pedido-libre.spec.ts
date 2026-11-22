import { esPregunta, esSi, interpretarPedidoLibre } from '../flujos/pedido/pedido-libre.util';
import { CARTA } from './simulador-pedido';

const vendible = (p: any) => p.disponible !== false;
const leer = (t: string) => interpretarPedidoLibre(t, CARTA, vendible);
const nombres = (t: string) => (leer(t)?.lineas ?? []).map((l) => `${l.cantidad} ${l.producto.nombre}${l.tamano ? ` ${l.tamano.nombre}` : ''}`);

describe('Pedido dicho en una frase', () => {
  it('cantidad, producto, tamaño y modalidad', () => {
    expect(nombres('2 frappé moka grande para llevar')).toEqual(['2 Frappé Moka Grande']);
    expect(leer('2 frappé moka grande para llevar')?.modalidad).toBe('RECOGER');
    expect(leer('quiero un latte mediano a domicilio')?.modalidad).toBe('DELIVERY');
  });

  it('varios productos, con coma, «y» o solo números', () => {
    expect(nombres('un cheesecake, un carrot cake y 2 americanos')).toEqual(['1 Cheesecake', '1 Carrot Cake', '2 Café Americano']);
    expect(nombres('1 cheesecake 1 carrot cake')).toEqual(['1 Cheesecake', '1 Carrot Cake']);
  });

  it('nombre parcial y cantidad con letras', () => {
    expect(nombres('dame dos moka')).toEqual(['2 Frappé Moka']);
  });

  it('opción dicha en la frase (leche de almendra) y con cuánto paga', () => {
    const r = leer('un cappuccino grande con leche de almendra, pago con 50')!;
    expect(r.lineas[0].opciones.map((o) => o.opcion.id)).toEqual(['l_alm']);
    expect(r.pagaCon).toBe(50);
    expect(r.medio).toBe('EFECTIVO');
  });

  it('si hay duda entre productos no elige: lo deja como ambiguo', () => {
    const r = leer('quiero un frappé')!;
    expect(r.lineas).toHaveLength(0);
    expect(r.ambiguos[0].candidatos.map((c) => c.producto.id).sort()).toEqual(['p_moka', 'p_oreo']);
  });

  it('un producto agotado se avisa, no se pone', () => {
    const r = interpretarPedidoLibre('un tiramisu', CARTA, (p) => p.id !== 'p_agot')!;
    expect(r.lineas).toHaveLength(0);
    expect(r.agotados).toEqual(['Tiramisú']);
  });

  it('lo que no es de la carta no es un pedido', () => {
    expect(leer('hola buenas tardes')).toBeNull();
    expect(leer('gracias')).toBeNull();
  });

  it('las preguntas no son pedidos', () => {
    expect(esPregunta('cuanto cuesta el frappe moka', 'cuánto cuesta el frappé moka')).toBe(true);
    expect(esPregunta('tienen cheesecake', 'tienen cheesecake?')).toBe(true);
    expect(esPregunta('2 frappe moka para llevar', '2 frappé moka para llevar')).toBe(false);
  });

  it('«sí» se dice de muchas formas', () => {
    for (const t of ['si', 'sii', 'ok', 'okey', 'dale', 'ya', 'listo', 'esta bien', 'de acuerdo', 'si gracias', 'confirmo', 'perfecto']) expect(esSi(t)).toBe(true);
    for (const t of ['no', 'cambiar', 'mejor otro', 'asi no']) expect(esSi(t)).toBe(false);
  });
});
