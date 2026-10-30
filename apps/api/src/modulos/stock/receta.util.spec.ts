import {
  insumosDeLinea,
  calcularSemaforoYEstado,
  calcularCostoYMargen,
  convertirAUnidadAlmacen,
} from './receta.util';
import { Prisma } from '@prisma/client';

describe('receta.util', () => {
  describe('insumosDeLinea', () => {
    const recetaCapuchino = {
      lineas: [
        { insumo_id: '1', cantidad: 18 }, // Café en grano: 18g
        { insumo_id: '2', cantidad: 200 }, // Leche entera: 200ml
      ],
    };

    it('devuelve los insumos base sin opciones', () => {
      const res = insumosDeLinea(recetaCapuchino, [], null, [], 1);
      expect(res).toEqual([
        { insumoId: '1', cantidad: 18 },
        { insumoId: '2', cantidad: 200 },
      ]);
    });

    it('multiplica por la cantidad pedida', () => {
      const res = insumosDeLinea(recetaCapuchino, [], null, [], 3);
      expect(res).toEqual([
        { insumoId: '1', cantidad: 54 },
        { insumoId: '2', cantidad: 600 },
      ]);
    });

    it('aplica ajuste SUMA (ej. shot extra +9 g de café)', () => {
      const ajustes = [
        {
          opcion_id: '10',
          insumo_id: '1',
          efecto: 'SUMA',
          cantidad: 9,
        },
      ];
      const res = insumosDeLinea(recetaCapuchino, ajustes, null, ['10'], 1);
      expect(res).toEqual([
        { insumoId: '1', cantidad: 27 },
        { insumoId: '2', cantidad: 200 },
      ]);
    });

    it('aplica ajuste REEMPLAZA (leche de almendras reemplaza leche entera)', () => {
      const ajustes = [
        {
          opcion_id: '20',
          insumo_id: '3', // Leche de almendras
          efecto: 'REEMPLAZA',
          reemplaza_insumo_id: '2', // Leche entera
          cantidad: 200,
        },
      ];
      const res = insumosDeLinea(recetaCapuchino, ajustes, null, ['20'], 1);
      expect(res).toEqual([
        { insumoId: '1', cantidad: 18 },
        { insumoId: '3', cantidad: 200 },
      ]);
    });

    it('aplica ajuste QUITA', () => {
      const ajustes = [
        {
          opcion_id: '30',
          insumo_id: '2', // quitar leche
          efecto: 'QUITA',
          cantidad: 50,
        },
      ];
      const res = insumosDeLinea(recetaCapuchino, ajustes, null, ['30'], 1);
      expect(res).toEqual([
        { insumoId: '1', cantidad: 18 },
        { insumoId: '2', cantidad: 150 },
      ]);
    });

    it('selecciona la receta correcta según el tamaño', () => {
      const recetasPorTamano = [
        {
          tamano_valor_id: '101', // Regular
          lineas: [
            { insumo_id: '1', cantidad: 18 },
            { insumo_id: '2', cantidad: 200 },
          ],
        },
        {
          tamano_valor_id: '102', // Grande
          lineas: [
            { insumo_id: '1', cantidad: 24 },
            { insumo_id: '2', cantidad: 260 },
          ],
        },
      ];

      const resGrande = insumosDeLinea(recetasPorTamano, [], '102', [], 1);
      expect(resGrande).toEqual([
        { insumoId: '1', cantidad: 24 },
        { insumoId: '2', cantidad: 260 },
      ]);
    });

    it('devuelve array vacío si no hay receta', () => {
      expect(insumosDeLinea(null, [], null, [], 1)).toEqual([]);
      expect(insumosDeLinea({ lineas: [] }, [], null, [], 1)).toEqual([]);
    });
  });

  describe('calcularSemaforoYEstado', () => {
    it('muestra rojo y Agotado cuando stock <= 0', () => {
      const info = calcularSemaforoYEstado(0, 10, 25, 40);
      expect(info.semaforo).toBe('rojo');
      expect(info.estado).toBe('Agotado');
    });

    it('muestra rojo y Poco cuando stock <= mínimo (ej. 8 con min 10)', () => {
      const info = calcularSemaforoYEstado(8, 10, 25, 40);
      expect(info.semaforo).toBe('rojo');
      expect(info.estado).toBe('Poco');
    });

    it('muestra naranja y Por acabarse cuando stock <= intermedio', () => {
      const info = calcularSemaforoYEstado(20, 10, 25, 40);
      expect(info.semaforo).toBe('naranja');
      expect(info.estado).toBe('Por acabarse');
    });

    it('muestra verde y Lleno cuando stock >= 95% del máximo (ej. 38 de 40)', () => {
      const info = calcularSemaforoYEstado(38, 10, 25, 40);
      expect(info.semaforo).toBe('verde');
      expect(info.estado).toBe('Lleno');
    });

    it('muestra verde y Bien en rango normal', () => {
      const info = calcularSemaforoYEstado(30, 10, 25, 40);
      expect(info.semaforo).toBe('verde');
      expect(info.estado).toBe('Bien');
    });
  });

  describe('calcularCostoYMargen', () => {
    it('calcula S/ 2,44 de costo y 72,9 % de margen sobre precio S/ 9,00', () => {
      // 18 g * 0.08 = 1.44 + 200 ml * 0.005 = 1.00 -> total 2.44
      const res = calcularCostoYMargen(2.44, 9.0);
      expect(res.costo).toBe(2.44);
      expect(res.margenSoles).toBe(6.56);
      expect(res.margenPorcentaje).toBe(72.9);
      expect(res.tieneReceta).toBe(true);
    });

    it('producto sin receta devuelve null y tieneReceta false', () => {
      const res = calcularCostoYMargen(null, 9.0);
      expect(res.costo).toBeNull();
      expect(res.margenSoles).toBeNull();
      expect(res.margenPorcentaje).toBeNull();
      expect(res.tieneReceta).toBe(false);
    });
  });

  describe('convertirAUnidadAlmacen', () => {
    it('caja de 12 L con 2 cajas suma 24 L', () => {
      const res = convertirAUnidadAlmacen(2, 'compra', 12, 1000);
      expect(res).toBe(24);
    });

    it('receta de 250 ml con factor 1000 descuenta 0.25 L', () => {
      const res = convertirAUnidadAlmacen(250, 'receta', 12, 1000);
      expect(res).toBe(0.25);
    });

    it('unidad almacén se mantiene igual', () => {
      const res = convertirAUnidadAlmacen(5, 'almacen', 12, 1000);
      expect(res).toBe(5);
    });
  });
});
