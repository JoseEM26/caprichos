import { usePreferencia, preferenciasApi } from '../../comun/usePreferencia';

// El hook y el cliente de preferencias viven en comun (los comparte el Cierre); aquí quedan las claves de Caja.
export { preferenciasApi };
export const usePreferenciaCaja = usePreferencia;

export const CLAVE_COLUMNAS = 'caja.tabla.columnas';
export const CLAVE_VISTA = 'caja.vista';
export const CLAVE_FILAS = 'caja.tabla.filas';
export const CLAVE_ORDEN_LISTA = 'caja.lista.orden';
