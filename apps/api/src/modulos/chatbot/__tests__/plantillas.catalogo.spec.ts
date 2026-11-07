import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';

// Reglas de Meta para el cuerpo de una plantilla: sin saltos de línea consecutivos, sin variable al inicio ni al final
// y una muestra por cada variable ({{1}}..{{n}} sin huecos).
describe('Catálogo de plantillas: reglas de Meta', () => {
  const entradas = Object.entries(CATALOGO_PLANTILLAS);

  // Las plantillas anteriores ya están aprobadas en Meta: la regla de formato se exige a las nuevas (ubicación).
  const nuevas = entradas.filter(([clave]) => clave.startsWith('CARTA_DELIVERY_UBICACION_'));

  it.each(nuevas)('%s: sin saltos consecutivos ni variables en los extremos', (_clave, d) => {
    expect(d.texto).not.toMatch(/\n\s*\n/);
    expect(d.texto.trim()).not.toMatch(/^\{\{\d+\}\}/);
    expect(d.texto.trim()).not.toMatch(/\{\{\d+\}\}[.!?\s]*$/);
  });

  it.each(entradas)('%s: variables {{n}} completas y sin huecos', (_clave, d) => {
    const usadas = [...new Set([...d.texto.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    expect(usadas).toEqual(d.variables.map((_v, i) => i + 1));
  });

  it('las plantillas de delivery con ubicación piden captura (digital), envío por confirmar y ubicación', () => {
    const digital = CATALOGO_PLANTILLAS.CARTA_DELIVERY_UBICACION_DIGITAL;
    const efectivo = CATALOGO_PLANTILLAS.CARTA_DELIVERY_UBICACION_EFECTIVO;
    expect(digital.nombre).toBe('caprichos_pedido_delivery_ubicacion_digital');
    expect(efectivo.nombre).toBe('caprichos_pedido_delivery_ubicacion_efectivo');
    expect(digital.variables).toHaveLength(3);
    expect(efectivo.variables).toHaveLength(2);
    for (const d of [digital, efectivo]) {
      expect(d.categoria).toBe('UTILITY');
      expect(d.idioma).toBe('es');
      expect(d.texto).toContain('Envío por confirmar');
      expect(d.texto).toContain('toca el clip 📎 → Ubicación → Enviar tu ubicación actual');
    }
    expect(digital.texto).toContain('captura de tu pago');
  });
});
