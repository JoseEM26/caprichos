import { describirRegistro } from './auditoria.descripcion';

const EN_TARDE = '2026-11-16T19:00:00Z'; // 14:00 en Lima

describe('describirRegistro', () => {
  it('desactivar producto con nombre', () => {
    expect(
      describirRegistro({
        accion: 'OCULTAR_PRODUCTO',
        entidad: 'producto',
        entidadNombre: 'Torta de chocolate',
      }),
    ).toBe('Desactivó (ocultó) el producto «Torta de chocolate»');
  });

  it('producto sin nombre (ya no existe) no muestra ids', () => {
    expect(
      describirRegistro({
        accion: 'OCULTAR_PRODUCTO',
        entidad: 'producto',
        entidadId: '45',
      } as any),
    ).toBe('Desactivó (ocultó) un producto');
  });

  it('activar producto', () => {
    expect(
      describirRegistro({
        accion: 'MOSTRAR_PRODUCTO',
        entidad: 'producto',
        entidadNombre: 'X',
      }),
    ).toBe('Volvió a activar el producto «X»');
  });

  it('agotado con hora de regreso del mismo día y motivo', () => {
    expect(
      describirRegistro({
        accion: 'AGOTAR_PRODUCTO',
        entidad: 'producto',
        entidadNombre: 'X',
        despues: { agotado_hasta: '2026-11-16T23:00:00Z', motivo: 'rotura' },
        en: EN_TARDE,
      }),
    ).toBe('Marcó agotado el producto «X» hasta las 18:00 (motivo: rotura)');
  });

  it('agotado sin hora de regreso (9999) no pone hora', () => {
    expect(
      describirRegistro({
        accion: 'AGOTAR_PRODUCTO',
        entidad: 'producto',
        entidadNombre: 'X',
        despues: { agotado_hasta: '9999-12-31T23:59:59Z' },
        en: EN_TARDE,
      }),
    ).toBe('Marcó agotado el producto «X»');
  });

  it('cambio solo de precio usa el nombre del snapshot y valores en soles', () => {
    expect(
      describirRegistro({
        accion: 'EDITAR_PRODUCTO',
        entidad: 'producto',
        antes: { nombre: 'X', precio: 12 },
        despues: { nombre: 'X', precio: 14 },
      }),
    ).toBe('Cambió el precio de «X» de S/ 12.00 a S/ 14.00');
  });

  it('edición de varios campos lista los cambios con anterior → nuevo', () => {
    expect(
      describirRegistro({
        accion: 'EDITAR_PRODUCTO',
        entidad: 'producto',
        antes: { nombre: 'Torta', precio: 12, oculto: false, alergenos: [] },
        despues: {
          nombre: 'Torta fina',
          precio: 12,
          oculto: true,
          alergenos: ['gluten'],
        },
      }),
    ).toBe('Editó el producto «Torta fina»: nombre (Torta → Torta fina), oculto (no → sí), alérgenos (ninguno → gluten)');
  });

  it('creación con precio', () => {
    expect(
      describirRegistro({
        accion: 'CREAR_PRODUCTO',
        entidad: 'producto',
        despues: { nombre: 'X', precio: 12 },
      }),
    ).toBe('Creó el producto «X» (S/ 12.00)');
  });

  it('acción desconocida: respaldo legible con motivo', () => {
    expect(
      describirRegistro({
        accion: 'ANULAR_VENTA_RARA',
        entidad: 'pedido',
        motivo: 'error',
      }),
    ).toBe('Anular venta rara (motivo: error)');
  });
});
