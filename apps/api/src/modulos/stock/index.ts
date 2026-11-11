// Interfaz pública del módulo de stock (solo lo que otros módulos pueden importar sin arrastrar servicios).
export { controlAlmacenActivo, almacenConsumirAlPreparar, almacenPermitirCocinaNegativa } from './control-almacen';
export { insumosDeLinea } from './receta.util';
