import { readFileSync } from 'fs';
import { join } from 'path';
import { ManualesCargadorService } from '../manuales-cargador.service';

const texto = readFileSync(join(__dirname, '..', 'manuales', 'analisis.md'), 'utf8');

describe('Manual de Capri: Analisis', () => {
  const manual = new ManualesCargadorService().parsearManual('analisis.md', texto);

  it('es un manual valido de la ruta /admin/analisis solo para ADMIN y SUPERVISOR', () => {
    expect(manual).not.toBeNull();
    expect(manual?.modulo).toBe('analisis');
    expect(manual?.ruta).toBe('/admin/analisis');
    expect(manual?.roles).toEqual(['ADMIN', 'SUPERVISOR']);
  });

  it('explica filtros, etapas, atascados y metas', () => {
    expect(texto).toContain('92 dias');
    expect(texto).toContain('Pedidos atascados ahora');
    expect(texto).toContain('Sin dato');
    expect(texto).toContain('Metas por etapa');
    expect(texto).toContain('analisis/ver');
  });

  it('explica Reparto, Equipo y Almacen sin exponer datos de personas al supervisor', () => {
    expect(texto).toContain('Efectivo por rendir');
    expect(texto).toContain('Huecos ahora');
    expect(texto).toContain('Control de almacen apagado');
    expect(texto).toContain('solo lo ve el Administrador');
  });
});
