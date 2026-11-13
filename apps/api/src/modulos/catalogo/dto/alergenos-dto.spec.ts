import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CrearProductoDto } from './crear-producto.dto';
import { EditarProductoDto } from './editar-producto.dto';

const base = { nombre: 'Torta', categoriaId: '1', precio: 10 };
function crear(alergenos: unknown) {
  const dto = plainToInstance(CrearProductoDto, { ...base, alergenos });
  const errores = validateSync(dto).filter((e) => e.property === 'alergenos');
  return { dto, errores };
}

describe('alérgenos libres en el DTO', () => {
  it('acepta fijos y personalizados válidos', () => {
    const { dto, errores } = crear(['MANI', 'lúcuma', 'fresa']);
    expect(errores).toHaveLength(0);
    expect(dto.alergenos).toEqual(['MANI', 'lúcuma', 'fresa']);
  });
  it('«Maní» y «mani» pasan al código MANI y se deduplican sin tildes ni mayúsculas', () => {
    expect(crear(['Maní', 'mani', 'MANI']).dto.alergenos).toEqual(['MANI']);
    expect(crear(['  Lúcuma ', 'lucuma', 'Maracuyá   dulce', 'maracuyá dulce']).dto.alergenos).toEqual(['lúcuma', 'maracuyá dulce']);
  });
  it('rechaza más de 30 caracteres, símbolos y más de 20', () => {
    expect(crear(['a'.repeat(31)]).errores).toHaveLength(1);
    expect(crear(['fresa!']).errores).toHaveLength(1);
    expect(crear(['fresa2']).errores).toHaveLength(1);
    expect(crear(['']).errores).toHaveLength(1);
    expect(crear(Array.from({ length: 21 }, (_, i) => 'a'.repeat(i + 1))).errores).toHaveLength(1);
  });
  it('acepta guiones y ñ; editar normaliza igual', () => {
    expect(crear(['piña-colada']).errores).toHaveLength(0);
    const dto = plainToInstance(EditarProductoDto, { alergenos: ['Sésamo', 'Cacao'] });
    expect(validateSync(dto).filter((e) => e.property === 'alergenos')).toHaveLength(0);
    expect(dto.alergenos).toEqual(['SESAMO', 'cacao']);
  });
});
