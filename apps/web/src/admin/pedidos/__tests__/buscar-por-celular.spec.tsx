import { describe, it, expect } from 'vitest';

// Misma regla que la búsqueda de PedidosAdminView: solo dígitos, con o sin +51
const porCelular = (q: string, telefono: string) => {
  const qDig = q.replace(/\D/g, '');
  const tel = String(telefono || '').replace(/\D/g, '');
  return qDig.length >= 3 && tel.includes(qDig.replace(/^51(?=9\d{8}$)/, ''));
};

describe('buscar pedidos por celular', () => {
  it('encuentra con 9 dígitos, parcial, con espacios o con +51', () => {
    expect(porCelular('987654321', '987654321')).toBe(true);
    expect(porCelular('987 654', '987654321')).toBe(true);
    expect(porCelular('+51 987 654 321', '987654321')).toBe(true);
    expect(porCelular('51987654321', '987654321')).toBe(true);
    expect(porCelular('911', '987654321')).toBe(false);
  });
});
