import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ClienteDto } from './crear-pedido.dto';
import { LiberarMesaDto } from '../../salon/dto/liberar-mesa.dto';

const errores = (cls: any, o: any) => validateSync(plainToInstance(cls, o)).length;

describe('DTO cliente del pedido', () => {
  it('nombre de 1 letra o vacío -> inválido', () => {
    expect(errores(ClienteDto, { nombre: 'A', telefono: '987654321' })).toBeGreaterThan(0);
    expect(errores(ClienteDto, { nombre: '', telefono: '987654321' })).toBeGreaterThan(0);
  });
  it('999999999 ya no es celular válido', () => {
    expect(errores(ClienteDto, { nombre: 'Ana', telefono: '999999999' })).toBeGreaterThan(0);
  });
  it('nombre y celular válidos pasan', () => {
    expect(errores(ClienteDto, { nombre: 'Ana', telefono: '987654321' })).toBe(0);
  });
});

describe('DTO liberar mesa', () => {
  it('sin motivo es válido', () => {
    expect(errores(LiberarMesaDto, {})).toBe(0);
    expect(errores(LiberarMesaDto, { forzar: true })).toBe(0);
  });
});
