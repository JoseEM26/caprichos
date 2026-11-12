import { anonimizar, palabrasDeNombre } from './anonimizador';

describe('anonimizar', () => {
  it('reemplaza celulares con y sin +51', () => {
    expect(anonimizar('llama al 987654321 o al +51 912 345 678')).toBe('llama al <CEL> o al <CEL>');
  });
  it('reemplaza DNI, RUC y numeros largos', () => {
    expect(anonimizar('dni 12345678 ruc 20123456789 cuenta 1234 5678 9012 3456')).toBe('dni <DOC> ruc <DOC> cuenta <DOC>');
  });
  it('reemplaza correos y enlaces', () => {
    expect(anonimizar('escribe a ana@correo.com mira https://maps.app.goo.gl/abc')).toBe('escribe a <MAIL> mira <DIR>');
  });
  it('reemplaza direcciones aproximadas', () => {
    expect(anonimizar('vivo en Av. Los Pinos 123, cerca')).toBe('vivo en <DIR>, cerca');
    expect(anonimizar('Mz B Lote 4')).toBe('<DIR>');
  });
  it('reemplaza nombres conocidos sin tocar palabras parecidas', () => {
    const n = palabrasDeNombre('Rosa Quispe', null);
    expect(anonimizar('Hola Rosa, soy QUISPE; la rosada es linda', n)).toBe('Hola <NOMBRE>, soy <NOMBRE>; la rosada es linda');
  });
  it('deja intactos precios y horarios', () => {
    expect(anonimizar('El pastel cuesta S/ 45.50 y abrimos a las 10 am')).toBe('El pastel cuesta S/ 45.50 y abrimos a las 10 am');
  });
  it('acepta vacio', () => {
    expect(anonimizar(null)).toBe('');
  });
});
