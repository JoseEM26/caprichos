import type { PestanaAnalisis } from '../comun';
import { ClientesTab } from './ClientesTab';

export const pestanaClientes: PestanaAnalisis = {
  id: 'clientes',
  etiqueta: 'Clientes',
  filtros: ['modalidad', 'canal', 'turno'],
  Componente: ClientesTab,
};
